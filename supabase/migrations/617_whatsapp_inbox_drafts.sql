-- 617: WhatsApp Inbox -- chat se DRAFT (order / payment / demand) + number link. ADDITIVE ONLY. NOT applied.
-- * Draft PURANE approval tables mein jata hai -- naya approval raasta nahi:
--     order, payment -> whatsapp_submissions (status 'pending', /admin/submissions)
--     demand         -> farmer_product_demands (status 'pending', /admin/demand-center)
-- * Maker = jis ne inbox se draft banaya (auth.uid()). Checker koi aur.
--   Do naye guard triggers SIRF inbox wali qataron par (purani qataron ka
--   rawaiya bilkul wohi): maker apna draft approve / reject nahi kar sakta.
-- * Link number: sirf conversation ko party se jorta hai (audit ke sath).
--   farmers / customers ka phone NAHI badalta (login / OTP par asar nahi).

create table if not exists public.wa_inbox_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,
  kind text not null check (kind in ('order','payment','demand')),
  target_table text not null check (target_table in ('whatsapp_submissions','farmer_product_demands')),
  target_id uuid not null,
  maker_id uuid not null,
  created_at timestamptz not null default now(),
  unique (target_table, target_id)
);
alter table public.wa_inbox_drafts enable row level security;
revoke all on table public.wa_inbox_drafts from public, anon, authenticated;
grant select on table public.wa_inbox_drafts to authenticated;
grant all on table public.wa_inbox_drafts to service_role;
drop policy if exists wa_dr_read on public.wa_inbox_drafts;
create policy wa_dr_read on public.wa_inbox_drafts for select to authenticated using (public.fn_wa_inbox_can_see(conversation_id));

create or replace function public.fn_wa_inbox_next_submission_number() returns text
language plpgsql volatile security definer set search_path = public
as $$
declare y int := (extract(year from now() at time zone 'Asia/Karachi')::int % 100); n int;
begin
  insert into public.whatsapp_submission_counters as k (year, last_number) values (y, 1)
  on conflict (year) do update set last_number = k.last_number + 1
  returning last_number into n;
  return 'WA-' || y || '-' || lpad(n::text, 5, '0');
end $$;
revoke all on function public.fn_wa_inbox_next_submission_number() from public, anon, authenticated;

-- p_payload: {amount, note, items, product_name, quantity, unit, needed_by}
create or replace function public.fn_wa_inbox_create_draft(p_conv uuid, p_kind text, p_payload jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public, auth
as $$
declare c record; me record; v_id uuid; v_no text; v_amt numeric; v_qty numeric; v_branch uuid;
begin
  if auth.uid() is null then raise exception 'wa inbox: login zaroori'; end if;
  if not public.fn_wa_inbox_can_see(p_conv) then raise exception 'wa inbox: ijazat nahi'; end if;
  select * into c from public.wa_conversations where id = p_conv;
  select p.id, p.branch_id into me from public.profiles p where p.id = auth.uid();
  v_branch := coalesce(c.branch_id, me.branch_id);
  if p_kind in ('order','payment') then
    if c.party_kind in ('unknown','ambiguous') then raise exception 'wa inbox: pehle number link karein'; end if;
    v_amt := nullif(p_payload->>'amount', '')::numeric;
    if p_kind = 'payment' and (v_amt is null or v_amt <= 0) then raise exception 'wa inbox: raqam likhein'; end if;
    if p_kind = 'order' and length(trim(coalesce(p_payload->>'items', ''))) < 2 then raise exception 'wa inbox: items likhein'; end if;
    v_no := public.fn_wa_inbox_next_submission_number();
    insert into public.whatsapp_submissions (submission_number, staff_profile_id, branch_id, whatsapp_number, kind, raw_text,
                                             ai_extracted, ai_summary, original_amount, status)
    values (v_no, auth.uid(), v_branch, '92' || c.phone_key,
            case when p_kind = 'payment' then 'cash_received' else 'other' end,
            left(coalesce(p_payload->>'note', p_payload->>'items', ''), 2000),
            jsonb_build_object('source', 'wa_inbox', 'type', p_kind, 'conversation_id', p_conv, 'farmer_id', c.farmer_id,
                               'customer_id', c.customer_id, 'items', p_payload->>'items'),
            left(case when p_kind = 'order' then 'Inbox order draft: ' || coalesce(p_payload->>'items', '') else 'Inbox payment draft' end, 300),
            v_amt, 'pending')
    returning id into v_id;
    insert into public.wa_inbox_drafts (conversation_id, kind, target_table, target_id, maker_id)
    values (p_conv, p_kind, 'whatsapp_submissions', v_id, auth.uid());
  elsif p_kind = 'demand' then
    if c.farmer_id is null then raise exception 'wa inbox: demand sirf kisan ke liye (pehle link karein)'; end if;
    v_qty := nullif(p_payload->>'quantity', '')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'wa inbox: miqdar likhein'; end if;
    insert into public.farmer_product_demands (farmer_id, branch_id, product_name, quantity, unit, needed_by, notes, status)
    values (c.farmer_id, v_branch, trim(p_payload->>'product_name'), v_qty, nullif(p_payload->>'unit', ''),
            nullif(p_payload->>'needed_by', '')::date, left('WhatsApp inbox: ' || coalesce(p_payload->>'note', ''), 1000), 'pending')
    returning id into v_id;
    v_no := null;
    insert into public.wa_inbox_drafts (conversation_id, kind, target_table, target_id, maker_id)
    values (p_conv, p_kind, 'farmer_product_demands', v_id, auth.uid());
  else
    raise exception 'wa inbox: draft ki qism ghalat';
  end if;
  insert into public.wa_conversation_events (conversation_id, event, actor_id, detail)
  values (p_conv, 'draft', auth.uid(), jsonb_build_object('kind', p_kind, 'target_id', v_id, 'number', v_no));
  return jsonb_build_object('kind', p_kind, 'id', v_id, 'number', v_no,
    'route', case when p_kind = 'demand' then '/admin/demand-center' else '/admin/submissions' end);
end $$;

-- Maker-checker: inbox draft ka maker khud faisla nahi kar sakta.
create or replace function public.fn_wa_inbox_guard_submission() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status <> 'pending'
     and exists (select 1 from public.wa_inbox_drafts d where d.target_table = 'whatsapp_submissions' and d.target_id = new.id
                   and d.maker_id = new.manager_profile_id) then
    raise exception 'wa inbox: draft banane wala khud faisla nahi kar sakta (maker-checker)';
  end if;
  return new;
end $$;
drop trigger if exists trg_wa_inbox_guard_submission on public.whatsapp_submissions;
create trigger trg_wa_inbox_guard_submission before update on public.whatsapp_submissions
  for each row execute function public.fn_wa_inbox_guard_submission();

create or replace function public.fn_wa_inbox_guard_demand() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.wa_inbox_drafts d where d.target_table = 'farmer_product_demands' and d.target_id = new.id
               and (d.maker_id = new.reviewed_by and new.reviewed_by is distinct from old.reviewed_by
                    or d.maker_id = new.decided_by and new.decided_by is distinct from old.decided_by)) then
    raise exception 'wa inbox: draft banane wala khud faisla nahi kar sakta (maker-checker)';
  end if;
  return new;
end $$;
drop trigger if exists trg_wa_inbox_guard_demand on public.farmer_product_demands;
create trigger trg_wa_inbox_guard_demand before update on public.farmer_product_demands
  for each row execute function public.fn_wa_inbox_guard_demand();

-- Anjaan number ko farmer / customer se jorna (sirf conversation; audit).
create or replace function public.fn_wa_inbox_link(p_conv uuid, p_party text, p_party_id uuid)
returns void
language plpgsql volatile security definer set search_path = public, auth
as $$
declare c record; v_user uuid; v_branch uuid; v_farmer uuid;
begin
  if not public.fn_wa_inbox_can_see(p_conv) then raise exception 'wa inbox: ijazat nahi'; end if;
  select * into c from public.wa_conversations where id = p_conv for update;
  if c.party_kind not in ('unknown','ambiguous') and not public.fn_wa_inbox_is_admin() then
    raise exception 'wa inbox: ye number pehle se pehchana hua hai (sirf admin badal sakta)';
  end if;
  if p_party = 'farmer' then
    select f.user_id, f.branch_id into v_user, v_branch from public.farmers f where f.id = p_party_id and not coalesce(f.is_deleted, false);
    if not found then raise exception 'wa inbox: kisan nahi mila'; end if;
    update public.wa_conversations set party_kind = 'farmer', farmer_id = p_party_id, customer_id = null, party_user_id = v_user,
           branch_id = coalesce(v_branch, branch_id), linked_by = auth.uid(), linked_at = now(), updated_at = now() where id = p_conv;
  elsif p_party = 'customer' then
    select cu.user_id, cu.branch_id, cu.farmer_id into v_user, v_branch, v_farmer from public.customers cu where cu.id = p_party_id and not coalesce(cu.is_deleted, false);
    if not found then raise exception 'wa inbox: customer nahi mila'; end if;
    update public.wa_conversations set party_kind = case when v_farmer is not null then 'farmer' else 'customer' end,
           customer_id = p_party_id, farmer_id = v_farmer, party_user_id = v_user,
           branch_id = coalesce(v_branch, branch_id), linked_by = auth.uid(), linked_at = now(), updated_at = now() where id = p_conv;
  else
    raise exception 'wa inbox: farmer ya customer';
  end if;
  insert into public.wa_conversation_events (conversation_id, event, actor_id, detail)
  values (p_conv, 'link', auth.uid(), jsonb_build_object('party', p_party, 'id', p_party_id, 'was', c.party_kind));
end $$;

revoke all on function public.fn_wa_inbox_create_draft(uuid,text,jsonb), public.fn_wa_inbox_link(uuid,text,uuid),
  public.fn_wa_inbox_guard_submission(), public.fn_wa_inbox_guard_demand() from public, anon;
grant execute on function public.fn_wa_inbox_create_draft(uuid,text,jsonb), public.fn_wa_inbox_link(uuid,text,uuid) to authenticated;
