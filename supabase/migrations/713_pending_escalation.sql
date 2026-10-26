-- 698: Pending approvals auto-escalation. ADDITIVE ONLY.
--
-- Har pending qism Manager ke paas shuru hoti hai. Manager SLA
-- (default 24 ghante, har qism alag settings) guzar jaye aur koi faisla
-- na ho, to item EK SATH Admin aur Owner dono ke paas chali jati hai.
-- Dono mein se koi bhi approve/reject kar sakta hai.
--
-- Maker-checker: Admin, Owner, Super Admin apni entry bhi kar sakte hain
-- (timeline: 'Khud approve (Admin)' / 'Khud approve (Owner)').
-- Manager aur baqi staff apni entry kabhi nahi.
--
-- In-app notification sirf. Bahar koi message nahi jata.
-- fn_pending_escalate idempotent hai (dobara chalane se doosri escalate
-- ya doosri notification nahi).

create table if not exists public.pending_escalation_settings (
  category text primary key,
  manager_hours int not null default 24 check (manager_hours between 1 and 720),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.pending_escalation_state (
  category text not null,
  item_id text not null,
  level text not null default 'manager' check (level in ('manager', 'escalated')),
  opened_at timestamptz not null,
  level_since timestamptz not null,
  maker_id uuid,
  branch_id uuid,
  escalated_at timestamptz,
  closed_at timestamptz,
  primary key (category, item_id)
);

create table if not exists public.pending_escalation_events (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  item_id text not null,
  kind text not null check (kind in ('opened', 'escalated', 'delay_note', 'self_decision')),
  from_level text,
  to_level text,
  reason text,
  note text,
  actor_id uuid,
  waited_seconds int,
  created_at timestamptz not null default now()
);

create index if not exists pending_escalation_state_open_idx
  on public.pending_escalation_state (level, opened_at)
  where closed_at is null;

create index if not exists pending_escalation_events_item_idx
  on public.pending_escalation_events (category, item_id, created_at);

create unique index if not exists pending_escalation_one_jump
  on public.pending_escalation_events (category, item_id)
  where kind = 'escalated';

alter table public.pending_escalation_settings enable row level security;
alter table public.pending_escalation_state enable row level security;
alter table public.pending_escalation_events enable row level security;

revoke all on public.pending_escalation_settings from anon;
revoke all on public.pending_escalation_state from anon;
revoke all on public.pending_escalation_events from anon;
grant select on public.pending_escalation_settings to authenticated;
grant select on public.pending_escalation_state to authenticated;
grant select on public.pending_escalation_events to authenticated;

drop policy if exists pes_set_read on public.pending_escalation_settings;
create policy pes_set_read on public.pending_escalation_settings
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_active, true)
      and p.role::text not in ('farmer', 'customer')
  ));

drop policy if exists pes_state_read on public.pending_escalation_state;
create policy pes_state_read on public.pending_escalation_state
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_active, true)
      and p.role::text not in ('farmer', 'customer')
  ));

drop policy if exists pes_event_read on public.pending_escalation_events;
create policy pes_event_read on public.pending_escalation_events
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.is_active, true)
      and p.role::text not in ('farmer', 'customer')
  ));

-- ---------------------------------------------------------------------------
-- Shared maker-checker. Admin/Owner/Super Admin: hamesha haan.
-- Baqi: actor maker na ho. Har approval isi se.
create or replace function public.fn_actor_may_decide(p_actor uuid, p_maker uuid default null, p_also uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
begin
  if p_actor is null then return false; end if;
  select p.role::text, coalesce(p.is_active, true) into v_role, v_active
  from public.profiles p where p.id = p_actor;
  if not found or v_active is not true then return false; end if;
  if v_role in ('owner', 'admin', 'super_admin') then return true; end if;
  if p_maker is not null and p_maker = p_actor then return false; end if;
  if p_also is not null and p_also = p_actor then return false; end if;
  return true;
end $$;

create or replace function public.fn_may_decide_entry(p_maker uuid default null, p_also uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.fn_actor_may_decide(auth.uid(), p_maker, p_also);
end $$;

-- Row guard: fuel, generator, maintenance, POS review.
-- CHECK constraint role nahi dekh sakta, is liye trigger.
create or replace function public.fn_shared_approval_row_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name in ('fuel_logs', 'generator_logs') then
    if new.approved_by is not null and not public.fn_actor_may_decide(new.approved_by, new.created_by) then
      raise exception 'Apni entry khud manzoor nahi kar sakte.';
    end if;
  elsif tg_table_name = 'maintenance_logs' then
    if new.branch_verified_by is not null and not public.fn_actor_may_decide(new.branch_verified_by, new.created_by) then
      raise exception 'Apni entry khud manzoor nahi kar sakte.';
    end if;
    if new.approved_by is not null and not public.fn_actor_may_decide(new.approved_by, new.created_by, new.branch_verified_by) then
      raise exception 'Apni entry khud manzoor nahi kar sakte.';
    end if;
  elsif tg_table_name = 'pos_returns' and tg_op = 'UPDATE' then
    if new.admin_review_status is distinct from old.admin_review_status then
      if old.admin_review_status <> 'pending' then
        raise exception 'Is wapsi ka review ho chuka hai.';
      end if;
      if new.admin_reviewed_by is null
         or not public.fn_actor_may_decide(new.admin_reviewed_by, old.created_by, old.authorized_by) then
        raise exception 'Wapsi ka review doosra Owner/Admin kare.';
      end if;
      if not exists (
        select 1 from public.profiles p
        where p.id = new.admin_reviewed_by
          and p.role::text in ('owner', 'admin', 'super_admin')
          and coalesce(p.is_active, true)
      ) then
        raise exception 'POS wapsi ka review sirf Owner/Admin kar sakta hai.';
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.fn_install_shared_approval_guards()
returns void
language plpgsql
as $$
declare
  t text;
begin
  foreach t in array array['fuel_logs', 'generator_logs', 'maintenance_logs'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    if t = 'fuel_logs' then
      execute 'alter table public.fuel_logs drop constraint if exists chk_fuel_no_self_approval';
    elsif t = 'generator_logs' then
      execute 'alter table public.generator_logs drop constraint if exists chk_generator_no_self_approval';
    else
      execute 'alter table public.maintenance_logs drop constraint if exists chk_maint_verifier_not_maker';
      execute 'alter table public.maintenance_logs drop constraint if exists chk_maint_approver_not_maker';
      execute 'alter table public.maintenance_logs drop constraint if exists chk_maint_approver_not_verifier';
    end if;
    execute format('drop trigger if exists trg_shared_approval_guard on public.%I', t);
    execute format(
      'create trigger trg_shared_approval_guard before insert or update on public.%I for each row execute function public.fn_shared_approval_row_guard()',
      t
    );
  end loop;

  if to_regclass('public.pos_returns') is not null then
    execute 'drop trigger if exists trg_pos_return_review_guard on public.pos_returns';
    execute 'drop trigger if exists trg_shared_approval_guard on public.pos_returns';
    execute 'create trigger trg_shared_approval_guard before update on public.pos_returns for each row execute function public.fn_shared_approval_row_guard()';
  end if;
end $$;

select public.fn_install_shared_approval_guards();

create or replace function public.fn_pending_escalation_set_sla(p_category text, p_hours int)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then raise exception 'Login karein'; end if;
  select p.role::text into v_role from public.profiles p where p.id = v_uid and coalesce(p.is_active, true);
  if v_role is null or v_role not in ('owner', 'admin', 'super_admin') then
    raise exception 'SLA sirf Admin/Owner badal sakte hain';
  end if;
  if p_category is null or p_category not in (select key from public.fn_admin_pending_sources()) then
    raise exception 'Ye qism pending fehrist mein nahi';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 720 then
    raise exception 'SLA 1 se 720 ghante ke darmiyan honi chahiye';
  end if;
  insert into public.pending_escalation_settings as s (category, manager_hours, updated_at, updated_by)
  values (p_category, p_hours, now(), v_uid)
  on conflict (category) do update
    set manager_hours = excluded.manager_hours, updated_at = now(), updated_by = v_uid;
  return p_hours;
end $$;

create or replace function public.fn_pending_delay_note(p_category text, p_item_id text, p_note text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_level text;
  v_maker uuid;
  v_id uuid;
  v_note text := left(btrim(coalesce(p_note, '')), 500);
begin
  if v_uid is null then raise exception 'Login karein'; end if;
  if char_length(v_note) < 3 then raise exception 'Delay ki wajah kam az kam 3 harf'; end if;
  select p.role::text into v_role from public.profiles p where p.id = v_uid and coalesce(p.is_active, true);
  if v_role is null then raise exception 'Account nahi mila'; end if;
  select st.level, st.maker_id into v_level, v_maker
  from public.pending_escalation_state st
  where st.category = p_category and st.item_id = p_item_id and st.closed_at is null;
  if v_level is null then raise exception 'Ye item pending nahi'; end if;
  if v_role in ('owner', 'admin', 'super_admin') then
    null;
  elsif v_role = 'manager' and v_level = 'manager' and v_maker is distinct from v_uid then
    null;
  else
    raise exception 'Delay ki wajah sirf jis ke paas item hai wo likh sakta hai';
  end if;
  insert into public.pending_escalation_events (category, item_id, kind, from_level, reason, note, actor_id)
  values (p_category, p_item_id, 'delay_note', v_level, 'Delay ki wajah', v_note, v_uid)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.fn_pending_log_self_decision(p_category text, p_item_id text, p_decision text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_maker uuid;
  s record;
  v_label text;
  v_existing text;
begin
  if v_uid is null then return null; end if;
  if p_decision not in ('approve', 'reject') then return null; end if;
  select p.role::text into v_role from public.profiles p where p.id = v_uid and coalesce(p.is_active, true);
  if v_role is null or v_role not in ('owner', 'admin', 'super_admin') then return null; end if;

  select e.reason into v_existing
  from public.pending_escalation_events e
  where e.category = p_category and e.item_id = p_item_id and e.kind = 'self_decision'
    and e.actor_id = v_uid
  order by e.created_at desc
  limit 1;
  if v_existing is not null and v_existing like 'Khud ' || p_decision || '%' then
    return v_existing;
  end if;

  select st.maker_id into v_maker
  from public.pending_escalation_state st
  where st.category = p_category and st.item_id = p_item_id;

  if v_maker is null then
    select * into s from public.fn_admin_pending_sources() x where x.key = p_category;
    if s.maker_col is not null then
      begin
        execute format('select (t.%I)::uuid from public.%I t where t.id::text = $1 limit 1', s.maker_col, s.tbl)
          into v_maker using p_item_id;
      exception when others then
        v_maker := null;
      end;
    end if;
  end if;
  if v_maker is distinct from v_uid then return null; end if;

  v_label := case
    when v_role = 'owner' and p_decision = 'reject' then 'Khud reject (Owner)'
    when v_role = 'owner' then 'Khud approve (Owner)'
    when p_decision = 'reject' then 'Khud reject (Admin)'
    else 'Khud approve (Admin)'
  end;
  insert into public.pending_escalation_events (category, item_id, kind, reason, actor_id)
  values (p_category, p_item_id, 'self_decision', v_label, v_uid);
  return v_label;
end $$;

-- ---------------------------------------------------------------------------
-- Sweep. Har non-info source. Missing table = skip (sifar nahi likhte).
create or replace function public.fn_pending_escalate()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s record;
  r record;
  v_sql text;
  v_hours int;
  v_now timestamptz := now();
  v_opened int := 0;
  v_escalated int := 0;
  v_notified int := 0;
  v_level text;
  v_since timestamptz;
  v_reason text;
  v_wait int;
  v_n int;
begin
  create temp table if not exists _pe_open (
    category text not null,
    item_id text not null,
    primary key (category, item_id)
  ) on commit drop;
  create temp table if not exists _pe_read (category text primary key) on commit drop;
  truncate _pe_open;
  truncate _pe_read;

  for s in select * from public.fn_admin_pending_sources() x where not x.is_info loop
    select coalesce(
      (select manager_hours from public.pending_escalation_settings where category = s.key),
      24
    ) into v_hours;

    v_sql := format(
      'select t.id::text as item_id, t.%1$I as created_at, (%2$s)::uuid as maker_id, (%3$s)::uuid as branch_id from public.%4$I t where (%5$s)',
      s.created_col,
      case when s.maker_col is null then 'null::uuid' else format('t.%I', s.maker_col) end,
      case when s.branch_col is null then 'null::uuid' else format('t.%I', s.branch_col) end,
      s.tbl,
      s.cond
    );
    begin
      for r in execute v_sql loop
        if r.item_id is null or r.created_at is null then continue; end if;
        insert into _pe_open (category, item_id) values (s.key, r.item_id) on conflict do nothing;

        insert into public.pending_escalation_state as st
          (category, item_id, level, opened_at, level_since, maker_id, branch_id)
        values (s.key, r.item_id, 'manager', r.created_at, r.created_at, r.maker_id, r.branch_id)
        on conflict (category, item_id) do update set
          maker_id = excluded.maker_id,
          branch_id = excluded.branch_id,
          closed_at = null,
          opened_at = excluded.opened_at
        where st.closed_at is not null
           or st.maker_id is distinct from excluded.maker_id
           or st.opened_at is distinct from excluded.opened_at;

        if not exists (
          select 1 from public.pending_escalation_events e
          where e.category = s.key and e.item_id = r.item_id and e.kind = 'opened'
        ) then
          insert into public.pending_escalation_events (category, item_id, kind, to_level, created_at)
          values (s.key, r.item_id, 'opened', 'manager', r.created_at);
          v_opened := v_opened + 1;
        end if;

        select st.level, st.opened_at into v_level, v_since
        from public.pending_escalation_state st
        where st.category = s.key and st.item_id = r.item_id;

        if v_level = 'manager' and v_now >= v_since + make_interval(hours => v_hours) then
          update public.pending_escalation_state st
             set level = 'escalated', level_since = v_now, escalated_at = v_now
           where st.category = s.key and st.item_id = r.item_id and st.level = 'manager' and st.closed_at is null;
          if found then
            v_wait := greatest(0, extract(epoch from (v_now - v_since))::int);
            v_reason := format('Manager ne %s ghante mein approve nahi kiya', v_hours);
            begin
              insert into public.pending_escalation_events
                (category, item_id, kind, from_level, to_level, reason, waited_seconds)
              values (s.key, r.item_id, 'escalated', 'manager', 'escalated', v_reason, v_wait);
            exception when unique_violation then
              null;
            end;
            insert into public.notifications (recipient_user_id, title, message, link_url)
            select p.id,
                   'Manzoori escalate ho gayi',
                   v_reason || ' (' || s.key || ')',
                   '/admin/my-work/pending?f=escalated'
            from public.profiles p
            where coalesce(p.is_active, true)
              and p.role::text in ('admin', 'super_admin', 'owner');
            get diagnostics v_n = row_count;
            v_notified := v_notified + v_n;
            v_escalated := v_escalated + 1;
          end if;
        end if;
      end loop;
      insert into _pe_read (category) values (s.key) on conflict do nothing;
    exception when others then
      -- source parhi nahi ja saki: band mat karo, sifar mat likho
      null;
    end;
  end loop;

  update public.pending_escalation_state st
     set closed_at = v_now
   where st.closed_at is null
     and st.category in (select category from _pe_read)
     and not exists (
       select 1 from _pe_open o where o.category = st.category and o.item_id = st.item_id
     );

  return jsonb_build_object('opened', v_opened, 'escalated', v_escalated, 'notified', v_notified);
end $$;

revoke all on function public.fn_actor_may_decide(uuid, uuid, uuid) from public, anon;
revoke all on function public.fn_may_decide_entry(uuid, uuid) from public, anon;
revoke all on function public.fn_shared_approval_row_guard() from public, anon;
revoke all on function public.fn_install_shared_approval_guards() from public, anon;
revoke all on function public.fn_pending_escalation_set_sla(text, int) from public, anon;
revoke all on function public.fn_pending_delay_note(text, text, text) from public, anon;
revoke all on function public.fn_pending_log_self_decision(text, text, text) from public, anon;
revoke all on function public.fn_pending_escalate() from public, anon;
grant execute on function public.fn_actor_may_decide(uuid, uuid, uuid) to authenticated;
grant execute on function public.fn_may_decide_entry(uuid, uuid) to authenticated;
grant execute on function public.fn_pending_escalation_set_sla(text, int) to authenticated;
grant execute on function public.fn_pending_delay_note(text, text, text) to authenticated;
grant execute on function public.fn_pending_log_self_decision(text, text, text) to authenticated;
grant execute on function public.fn_pending_escalate() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_pending_escalate() to service_role;
  end if;
end $$;

-- pg_cron ho to har 15 minute. Na ho to /api/cron/pending-escalation.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'agribridge_pending_escalation') then
      perform cron.schedule(
        'agribridge_pending_escalation',
        '*/15 * * * *',
        $job$select public.fn_pending_escalate();$job$
      );
    end if;
  end if;
exception when others then
  raise notice 'pending escalation cron skip: %', sqlerrm;
end $$;

-- Season booking import: table authenticated se band thi, is liye
-- pending ginti "parha nahi ja saka" dikhati thi. Sirf parhna, staff
-- roles ke liye. Likhna pehle jaisa service role.
do $fix$
begin
  if to_regclass('public.season_import_batches') is null then
    return;
  end if;
  execute 'grant select on table public.season_import_batches to authenticated';
  execute 'drop policy if exists season_import_batches_staff_read on public.season_import_batches';
  execute $p$
    create policy season_import_batches_staff_read
      on public.season_import_batches
      for select to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and coalesce(p.is_active, true)
            and p.role::text in ('owner', 'super_admin', 'admin', 'manager', 'finance', 'admin_assistant')
        )
      )
  $p$;
end
$fix$;

-- Help: pending approvals. Feature pehle se na ho to yahin ban jati hai.
do $help$
begin
  if to_regclass('public.features') is null or to_regclass('public.feature_help') is null then
    return;
  end if;
  insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
  values (
    'pending-approvals', 'Pending Approvals', 'Pending Approvals', 'زیر التوا منظوریاں',
    'Har shobe ki manzoori, SLA, aur escalate',
    'Every department approval, SLA, and escalation',
    'ہر شعبے کی منظوری',
    '/admin/my-work/pending', 'CheckCircle2', false, true
  )
  on conflict (key) do update set route = excluded.route, is_active = true, description = excluded.description;

  insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
  values
    ('pending-approvals', 'rm',
     'Har shobe ki pending manzoori ek jagah. Manager ke SLA ke baad Admin aur Owner dono ke paas. Admin/Owner apni entry bhi kar sakte hain. Manager aur baqi staff apni entry nahi.',
     'Manager, Admin, Owner',
     'Jab koi entry SLA se aage ruk jaye.',
     array['Pending with column dekhein — Manager, ya Escalated par Admin / Owner.','Owner upar escalated / delay ki khulasa dekhta hai.','Jis ke paas item hai wo delay ki wajah likh sakta hai.','Timeline par har level ka intezar aur wajah hai.'],
     'Faisla yahin, ya asal safhe par. Cron har 15 minute escalate karta hai.',
     array['Manager apni entry khud approve nahi karta.','Sifar aur parha nahi ja saka ek cheez nahi.','Bahar koi message is escalate se nahi jata.']),
    ('pending-approvals', 'en',
     'Every department pending approval in one place. After the manager SLA it sits with both Admin and Owner. Admin and Owner may decide their own entries. Every other role, including managers, may not.',
     'Manager, Admin, Owner',
     'When an entry waits past its SLA.',
     array['Pending with shows Manager, or Admin / Owner once escalated.','The Owner sees an escalated / delay summary at the top.','The person holding it can write a delay reason.','The timeline records each wait and why it moved.'],
     'Decide here or on the original page. The job escalates every 15 minutes.',
     array['A manager never approves their own entry.','Unread is not zero.','This escalation stays inside the app.']),
    ('pending-approvals', 'ur',
     'ہر شعبے کی زیر التوا منظوری ایک جگہ۔ مینیجر کے وقت کے بعد ایڈمن اور مالک دونوں کے پاس۔ ایڈمن اور مالک اپنی اندراج بھی کر سکتے ہیں۔ باقی عملہ اپنی اندراج نہیں۔',
     'مینیجر، ایڈمن، مالک',
     'جب اندراج وقت سے آگے رک جائے۔',
     array['کس کے پاس: مینیجر، یا Escalated پر ایڈمن / مالک۔','مالک اوپر خلاصہ دیکھتا ہے۔','جس کے پاس کام ہے وہ تاخیر کی وجہ لکھ سکتا ہے۔'],
     'فیصلہ یہیں یا اصل صفحے پر۔',
     array['مینیجر اپنی اندراج خود منظور نہیں کرتا۔'])
  on conflict (feature_key, lang) do update set
    purpose = excluded.purpose,
    who_uses = excluded.who_uses,
    when_use = excluded.when_use,
    how_steps = excluded.how_steps,
    next_step = excluded.next_step,
    mistakes = excluded.mistakes,
    updated_at = now();
exception when others then
  raise notice 'pending-approvals help skip: %', sqlerrm;
end
$help$;
