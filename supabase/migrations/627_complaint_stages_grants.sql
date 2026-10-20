-- 627: Complaint stages, private images, Manager assign grant, AI mark.
--
-- 626 ke baad. Live / Testing par tab tak nahi jab tak backup verify na ho.
-- Purani complaints nahi mit-tin. Manager ki ijazat default band:
-- cc_assign_grants mein qatar na ho to forward nahi.
-- Owner, super_admin, Admin hamesha assign karte hain.
-- Manager ka har forward note "Forwarded by Manager <naam>" rehta hai.
-- Stage badalne par SMS queue nahi banti.

alter table public.support_tickets
  add column if not exists complaint_stage text,
  add column if not exists stage_percent integer,
  add column if not exists manager_forward_label text;

alter table public.support_tickets drop constraint if exists support_tickets_complaint_stage_check;
alter table public.support_tickets add constraint support_tickets_complaint_stage_check
  check (complaint_stage is null or complaint_stage in (
    'received', 'assigned', 'in_progress', 'review', 'completed', 'rejected'
  ));

alter table public.support_tickets drop constraint if exists support_tickets_stage_percent_check;
alter table public.support_tickets add constraint support_tickets_stage_percent_check
  check (stage_percent is null or (stage_percent >= 0 and stage_percent <= 100));

create table if not exists public.cc_assign_grants (
  profile_id uuid primary key references public.profiles(id),
  organization_id uuid not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists cc_assign_grants_org_idx on public.cc_assign_grants (organization_id);

create table if not exists public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id),
  organization_id uuid not null,
  uploaded_by uuid,
  storage_path text not null,
  mime text not null,
  size_bytes integer not null,
  note text,
  created_at timestamptz not null default now(),
  constraint support_ticket_attachments_mime_check check (mime in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  constraint support_ticket_attachments_size_check check (size_bytes > 0 and size_bytes <= 8388608)
);

create index if not exists support_ticket_attachments_ticket_idx
  on public.support_ticket_attachments (ticket_id, created_at);

alter table public.cc_assign_grants enable row level security;
alter table public.support_ticket_attachments enable row level security;
revoke all on public.cc_assign_grants from public, anon, authenticated;
revoke all on public.support_ticket_attachments from public, anon, authenticated;

create or replace function public.fn_cc_can_assign()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin', 'admin')
  )
  or (
    exists (
      select 1 from unnest(public.fn_cc_actor_roles()) r(role)
       where r.role = 'manager'
    )
    and exists (
      select 1 from public.cc_assign_grants g
       where g.profile_id = auth.uid() and g.active
    )
  );
$$;

create or replace function public.fn_cc_complaint_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Shikayat mitai nahi ja sakti.';
  end if;
  if public.fn_cc_is_agent() then
    if new.support_ticket_id is distinct from old.support_ticket_id
       and new.status is not distinct from old.status
       and new.assigned_to is not distinct from old.assigned_to
       and new.routed_department is not distinct from old.routed_department
       and new.resolved_by is not distinct from old.resolved_by
       and new.complaint_number is not distinct from old.complaint_number
    then
      return new;
    end if;
    raise exception 'Call Center Agent shikayat ka status nahi badal sakta. Sirf naya darj hota hai.';
  end if;
  if new.complaint_number is distinct from old.complaint_number
     or new.created_by is distinct from old.created_by
     or new.category is distinct from old.category
     or new.department is distinct from old.department
     or new.caller_phone is distinct from old.caller_phone
     or new.caller_name is distinct from old.caller_name
     or new.party_id is distinct from old.party_id
     or new.party_kind is distinct from old.party_kind
     or new.description is distinct from old.description
     or new.channel is distinct from old.channel
     or new.priority is distinct from old.priority
     or new.sla_hours is distinct from old.sla_hours
  then
    raise exception 'Sirf status badla ja sakta hai.';
  end if;
  if new.assigned_to is distinct from old.assigned_to
     or new.routed_department is distinct from old.routed_department
  then
    if not public.fn_cc_can_assign() then
      raise exception 'Sirf Admin assign karta hai.';
    end if;
  end if;
  if new.status is distinct from old.status and new.status = 'in_progress' then
    if not (
      public.fn_cc_can_close(new.department)
      or public.fn_cc_can_close(coalesce(new.routed_department, new.department))
      or new.assigned_to = auth.uid()
      or public.fn_cc_can_assign()
    ) then
      raise exception 'Sirf Admin ya jis ko ye shikayat mili, wo aage barha sakta hai.';
    end if;
  end if;
  if new.status is distinct from old.status and new.status = 'resolved' then
    if not (
      public.fn_cc_can_close(new.department)
      or public.fn_cc_can_close(coalesce(new.routed_department, new.department))
      or new.assigned_to = auth.uid()
      or exists (
        select 1 from unnest(public.fn_cc_actor_roles()) r(role)
         where r.role in ('owner', 'super_admin', 'admin')
      )
    ) then
      raise exception 'Sirf Admin ya jis ko ye shikayat mili, wo aage barha sakta hai.';
    end if;
  end if;
  if new.status = 'resolved' then
    if new.resolved_by is null then
      new.resolved_by := auth.uid();
    end if;
    if new.resolved_at is null then
      new.resolved_at := now();
    end if;
    if new.resolved_by is not distinct from new.created_by then
      raise exception 'Jis ne shikayat banayi, wo khud band nahi kar sakta.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.fn_cc_open_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket uuid;
  v_title text;
  v_pri text;
begin
  if new.organization_id is null or new.support_ticket_id is not null then
    return new;
  end if;
  v_title := left(new.complaint_number || ' · ' || coalesce(new.caller_name, 'Caller'), 160);
  v_pri := case when new.priority = 'high' then 'urgent' else 'normal' end;
  insert into public.support_tickets (
    organization_id, reporter_id, title, description, priority, status, page_url,
    intake_source, suggested_department, cc_complaint_id, complaint_stage, stage_percent
  ) values (
    new.organization_id, new.created_by, v_title, new.description, v_pri, 'new',
    '/admin/call-center/party/' || new.party_kind || '/' || new.party_id::text,
    'call_center', new.department, new.id, 'received', 10
  )
  returning id into v_ticket;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, to_value, note
  ) values (
    v_ticket, new.organization_id, new.created_by, 'status', 'received',
    'Call center shikayat. Tajweez department: ' || new.department || '. Assign nahi — Admin aage bhejega. SMS only.'
  );
  update public.cc_complaints set support_ticket_id = v_ticket where id = new.id;
  return new;
end;
$$;

create or replace function public.fn_staff_file_complaint(
  p_title text,
  p_description text,
  p_priority text,
  p_page_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
  v_no bigint;
  v_pri text := coalesce(nullif(p_priority, ''), 'normal');
begin
  if auth.uid() is null then
    raise exception 'Login zaroori hai.';
  end if;
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in (
       'owner', 'super_admin', 'admin', 'admin_assistant', 'manager',
       'sales_staff', 'finance', 'warehouse', 'hr', 'procurement',
       'milk_collection', 'machinery', 'call_center_agent'
     )
  ) then
    raise exception 'Shikayat sirf staff darj karta hai.';
  end if;
  if length(btrim(coalesce(p_title, ''))) < 3 or length(btrim(coalesce(p_description, ''))) < 3 then
    raise exception 'Title aur tafseel likhein.';
  end if;
  if v_pri not in ('normal', 'urgent', 'work_stopped') then
    raise exception 'Priority theek nahi hai.';
  end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'Organization nahi mili.';
  end if;
  insert into public.support_tickets (
    organization_id, reporter_id, title, description, priority, status, page_url,
    intake_source, suggested_department, assigned_to, department_id, assigned_kind, assigned_agent,
    complaint_stage, stage_percent
  ) values (
    v_org, auth.uid(), left(btrim(p_title), 160), left(btrim(p_description), 5000), v_pri, 'new',
    nullif(left(coalesce(p_page_url, ''), 1000), ''),
    'staff', null, null, null, null, null,
    'received', 10
  )
  returning id, ticket_no into v_id, v_no;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, to_value, note
  ) values (
    v_id, v_org, auth.uid(), 'status', 'received',
    'Staff shikayat seedha Admin queue mein. Koi department, koi auto-assign nahi.'
  );
  return jsonb_build_object(
    'id', v_id,
    'ticket_no', v_no,
    'created_at', now(),
    'status', 'new',
    'intake_source', 'staff',
    'assigned_to', null,
    'department_id', null,
    'complaint_stage', 'received'
  );
end;
$$;

create or replace function public.fn_complaint_forward(
  p_ticket uuid,
  p_assignee uuid,
  p_routed text,
  p_agent_key text,
  p_support_department uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_intake text;
  v_cc uuid;
  v_name text;
  v_role text;
  v_actor text;
  v_routed text := nullif(btrim(coalesce(p_routed, '')), '');
  v_agent text := nullif(lower(btrim(coalesce(p_agent_key, ''))), '');
  v_label text;
  v_note text;
  v_prev text;
begin
  if not public.fn_cc_can_assign() then
    raise exception 'Sirf Admin assign karta hai.';
  end if;
  select organization_id, intake_source, cc_complaint_id, coalesce(complaint_stage, 'received')
    into v_org, v_intake, v_cc, v_prev
    from public.support_tickets
   where id = p_ticket;
  if v_org is null then
    raise exception 'Ticket nahi mili.';
  end if;
  if v_intake is null or v_intake not in ('staff', 'call_center') then
    raise exception 'Ye support issue complaint queue ka nahi.';
  end if;
  if p_assignee is null and v_routed is null and v_agent is null and p_support_department is null then
    raise exception 'Department, user, agent ya developer chunein.';
  end if;
  if p_assignee is not null then
    select full_name into v_name
      from public.profiles
     where id = p_assignee and organization_id = v_org and is_active;
    if v_name is null then
      raise exception 'Assignee active staff nahi mila.';
    end if;
  end if;
  select role::text, full_name into v_role, v_actor from public.profiles where id = auth.uid();
  if v_role = 'manager' then
    v_label := 'Forwarded by Manager ' || coalesce(nullif(btrim(v_actor), ''), 'Manager');
  else
    v_label := 'Admin ne aage bheja.';
  end if;
  v_note := v_label || case when v_routed is not null then ' Department: ' || v_routed || '.' else '' end;
  update public.support_tickets
     set assigned_to = p_assignee,
         assigned_kind = case when v_agent is not null then 'agent' when p_assignee is not null then 'person' else assigned_kind end,
         assigned_agent = v_agent,
         department_id = coalesce(p_support_department, department_id),
         routed_label = coalesce(v_routed, routed_label),
         assignment_status = case when v_agent is not null then 'analysis_requested' else 'queued' end,
         assigned_at = now(),
         status = 'assigned',
         complaint_stage = 'assigned',
         stage_percent = 30,
         manager_forward_label = case when v_role = 'manager' then v_label else manager_forward_label end,
         updated_at = now()
   where id = p_ticket;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, to_value, note
  ) values (
    p_ticket, v_org, auth.uid(), 'assignee',
    coalesce(v_name, v_agent, v_routed, 'department'),
    v_note
  );
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, from_value, to_value, note
  ) values (
    p_ticket, v_org, auth.uid(), 'status', v_prev, 'assigned', v_note
  );
  if v_cc is not null then
    update public.cc_complaints
       set assigned_to = p_assignee,
           routed_department = coalesce(v_routed, routed_department),
           status = 'in_progress'
     where id = v_cc;
  end if;
  return jsonb_build_object('ok', true, 'assignee', v_name, 'routed', v_routed, 'agent', v_agent, 'label', v_label);
end;
$$;

create or replace function public.fn_complaint_set_status(p_ticket uuid, p_status text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid;
  v_assignee uuid;
  v_org uuid;
  v_intake text;
  v_cc uuid;
  v_from text;
  v_cc_status text;
  v_stage text;
  v_pct int;
begin
  if p_status not in ('new', 'assigned', 'investigating', 'testing', 'resolved_pending_verify', 'resolved', 'reopened') then
    raise exception 'Status theek nahi hai.';
  end if;
  select reporter_id, assigned_to, organization_id, intake_source, cc_complaint_id, status
    into v_reporter, v_assignee, v_org, v_intake, v_cc, v_from
    from public.support_tickets where id = p_ticket;
  if v_org is null or v_intake not in ('staff', 'call_center') then
    raise exception 'Complaint ticket nahi mili.';
  end if;
  if public.fn_cc_is_agent() then
    raise exception 'Call Center Agent shikayat band nahi karta.';
  end if;
  if p_status = 'resolved' and v_reporter = auth.uid() then
    raise exception 'Jis ne shikayat banayi, wo khud band nahi kar sakta.';
  end if;
  if not (
    p_status = 'reopened' and v_reporter = auth.uid()
    or exists (
      select 1 from unnest(public.fn_cc_actor_roles()) r(role)
       where r.role in ('owner', 'super_admin', 'admin')
    )
    or v_assignee = auth.uid()
  ) then
    raise exception 'Sirf Admin ya assigned user status badalta hai.';
  end if;
  v_stage := case p_status
    when 'new' then 'received'
    when 'assigned' then 'assigned'
    when 'investigating' then 'in_progress'
    when 'testing' then 'review'
    when 'resolved_pending_verify' then 'review'
    when 'resolved' then 'completed'
    else 'in_progress'
  end;
  v_pct := case v_stage
    when 'received' then 10
    when 'assigned' then 30
    when 'in_progress' then 55
    when 'review' then 80
    else 100
  end;
  update public.support_tickets
     set status = p_status,
         complaint_stage = v_stage,
         stage_percent = v_pct,
         updated_at = now(),
         resolved_at = case when p_status = 'resolved' then now() when p_status = 'reopened' then null else resolved_at end,
         resolution_note = case when p_status = 'resolved' then nullif(btrim(coalesce(p_note, '')), '') else resolution_note end
   where id = p_ticket;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, from_value, to_value, note
  ) values (
    p_ticket, v_org, auth.uid(), 'status', v_from, v_stage, nullif(btrim(coalesce(p_note, '')), '')
  );
  if v_cc is not null then
    v_cc_status := case
      when p_status = 'resolved' then 'resolved'
      when p_status in ('reopened', 'new') then 'open'
      else 'in_progress'
    end;
    update public.cc_complaints set status = v_cc_status where id = v_cc;
  end if;
  return jsonb_build_object('ok', true, 'status', p_status, 'stage', v_stage);
end;
$$;

create or replace function public.fn_complaint_set_stage(p_ticket uuid, p_stage text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid;
  v_assignee uuid;
  v_org uuid;
  v_intake text;
  v_cc uuid;
  v_from text;
  v_stage text := nullif(lower(btrim(coalesce(p_stage, ''))), '');
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 3000), '');
  v_admin boolean;
  v_is_assignee boolean;
  v_order text[] := array['received', 'assigned', 'in_progress', 'review', 'completed'];
  v_from_i int;
  v_to_i int;
  v_status text;
  v_pct int;
  v_cc_status text;
begin
  if public.fn_cc_is_agent() then
    raise exception 'Call Center Agent shikayat ka stage nahi badalta.';
  end if;
  select reporter_id, assigned_to, organization_id, intake_source, cc_complaint_id, coalesce(complaint_stage, 'received')
    into v_reporter, v_assignee, v_org, v_intake, v_cc, v_from
    from public.support_tickets where id = p_ticket;
  if v_org is null or v_intake not in ('staff', 'call_center') then
    raise exception 'Complaint ticket nahi mili.';
  end if;
  if v_reporter = auth.uid() then
    raise exception 'Jis ne shikayat banayi, wo khud band nahi kar sakta.';
  end if;
  v_admin := exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin', 'admin')
  );
  v_is_assignee := v_assignee is not null and v_assignee = auth.uid();
  if not v_admin and not v_is_assignee then
    raise exception 'Sirf assigned banda ya Admin stage aage barhata hai.';
  end if;
  if v_stage is null then
    if v_note is null then
      raise exception 'Note ya agla stage likhein.';
    end if;
    insert into public.support_ticket_events (
      ticket_id, organization_id, actor_id, event_type, from_value, to_value, note
    ) values (
      p_ticket, v_org, auth.uid(), 'comment', v_from, v_from, v_note
    );
    return jsonb_build_object('ok', true, 'stage', v_from, 'changed', false);
  end if;
  if v_stage not in ('received', 'assigned', 'in_progress', 'review', 'completed', 'rejected') then
    raise exception 'Stage theek nahi hai.';
  end if;
  if v_stage = v_from then
    raise exception 'Yahi stage pehle se hai.';
  end if;
  if v_stage = 'rejected' then
    null;
  elsif v_stage = 'completed' then
    if v_is_assignee and not v_admin and v_from is distinct from 'review' then
      raise exception 'Pehle Check tak le aayein.';
    end if;
  else
    v_from_i := array_position(v_order, v_from);
    v_to_i := array_position(v_order, v_stage);
    if v_from_i is null or v_to_i is null or v_to_i <= v_from_i then
      raise exception 'Stage peeche nahi jaata.';
    end if;
    if not v_admin and v_to_i <> v_from_i + 1 then
      raise exception 'Ek qadam aage barhein.';
    end if;
  end if;
  v_pct := case v_stage
    when 'received' then 10
    when 'assigned' then 30
    when 'in_progress' then 55
    when 'review' then 80
    else 100
  end;
  v_status := case v_stage
    when 'received' then 'new'
    when 'assigned' then 'assigned'
    when 'in_progress' then 'investigating'
    when 'review' then 'testing'
    when 'completed' then 'resolved'
    else 'reopened'
  end;
  update public.support_tickets
     set complaint_stage = v_stage,
         stage_percent = v_pct,
         status = v_status,
         updated_at = now(),
         resolved_at = case when v_stage = 'completed' then now() when v_stage = 'rejected' then null else resolved_at end,
         resolution_note = case when v_stage = 'completed' then coalesce(v_note, resolution_note) else resolution_note end
   where id = p_ticket;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, from_value, to_value, note
  ) values (
    p_ticket, v_org, auth.uid(), 'status', v_from, v_stage, v_note
  );
  if v_cc is not null then
    v_cc_status := case
      when v_stage = 'completed' then 'resolved'
      when v_stage in ('rejected', 'received') then 'open'
      else 'in_progress'
    end;
    update public.cc_complaints
       set status = v_cc_status,
           resolved_by = case when v_stage = 'completed' then auth.uid() else resolved_by end,
           resolved_at = case when v_stage = 'completed' then now() else resolved_at end
     where id = v_cc;
  end if;
  return jsonb_build_object('ok', true, 'stage', v_stage, 'percent', v_pct, 'changed', true);
end;
$$;

create or replace function public.fn_cc_set_assign_grant(p_profile uuid, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_org uuid;
  v_actor_org uuid;
  v_active boolean;
begin
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin', 'admin')
  ) then
    raise exception 'Sirf Owner ya Admin ijazat deta hai.';
  end if;
  select role::text, organization_id, is_active
    into v_role, v_org, v_active
    from public.profiles where id = p_profile;
  if v_role is null or v_active is not true then
    raise exception 'Manager nahi mila.';
  end if;
  if v_role <> 'manager' then
    raise exception 'Yeh ijazat sirf Manager ko milti hai.';
  end if;
  select organization_id into v_actor_org from public.profiles where id = auth.uid();
  if v_org is distinct from v_actor_org then
    raise exception 'Dusri organization ka manager nahi.';
  end if;
  if coalesce(p_on, false) then
    insert into public.cc_assign_grants (profile_id, organization_id, granted_by, granted_at, active)
    values (p_profile, v_org, auth.uid(), now(), true)
    on conflict (profile_id) do update
      set granted_by = excluded.granted_by,
          granted_at = now(),
          organization_id = excluded.organization_id,
          active = true;
  else
    update public.cc_assign_grants
       set active = false, granted_by = auth.uid(), granted_at = now()
     where profile_id = p_profile;
  end if;
  return jsonb_build_object('ok', true, 'profile_id', p_profile, 'on', coalesce(p_on, false));
end;
$$;

create or replace function public.fn_complaint_can_see(p_ticket uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reporter uuid;
  v_assignee uuid;
  v_org uuid;
  v_role text;
  v_my_org uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  select reporter_id, assigned_to, organization_id
    into v_reporter, v_assignee, v_org
    from public.support_tickets where id = p_ticket;
  if v_org is null then
    return false;
  end if;
  select role::text, organization_id into v_role, v_my_org from public.profiles where id = auth.uid() and is_active;
  if v_my_org is distinct from v_org then
    return false;
  end if;
  if v_role in ('owner', 'super_admin', 'admin', 'manager', 'admin_assistant') then
    return true;
  end if;
  if v_reporter = auth.uid() or v_assignee = auth.uid() then
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.fn_complaint_forward_label(p_ticket uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if not public.fn_complaint_can_see(p_ticket) then
    raise exception 'Ijazat nahi hai.';
  end if;
  select manager_forward_label into v_label from public.support_tickets where id = p_ticket;
  return v_label;
end;
$$;

create or replace function public.fn_complaint_mark_ai(p_ticket uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_intake text;
  v_stage text;
begin
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin', 'admin')
  ) then
    raise exception 'AI ko sirf Owner ya Admin bhejta hai.';
  end if;
  select organization_id, intake_source, coalesce(complaint_stage, 'received')
    into v_org, v_intake, v_stage
    from public.support_tickets where id = p_ticket;
  if v_org is null or v_intake not in ('staff', 'call_center') then
    raise exception 'Complaint ticket nahi mili.';
  end if;
  update public.support_tickets
     set assigned_kind = 'agent',
         assigned_agent = 'ai_webhook',
         assignment_status = 'analysis_requested',
         assigned_at = now(),
         status = case when status = 'new' then 'assigned' else status end,
         complaint_stage = case when v_stage = 'received' then 'assigned' else complaint_stage end,
         stage_percent = case when v_stage = 'received' then 30 else stage_percent end,
         updated_at = now()
   where id = p_ticket;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, to_value, note
  ) values (
    p_ticket, v_org, auth.uid(), 'assignee', 'AI agent', 'AI agent ko bheja.'
  );
  return jsonb_build_object('ok', true, 'assignee', 'AI agent');
end;
$$;

create or replace function public.fn_cc_complaint_ticket(p_complaint uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ticket uuid;
  v_created uuid;
begin
  select support_ticket_id, created_by into v_ticket, v_created
    from public.cc_complaints where id = p_complaint;
  if v_ticket is null then
    return null;
  end if;
  if auth.uid() = v_created or public.fn_complaint_can_see(v_ticket) then
    return v_ticket;
  end if;
  raise exception 'Ijazat nahi hai.';
end;
$$;

create or replace function public.fn_support_attachment_guard()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.support_ticket_attachments where ticket_id = new.ticket_id) >= 6 then
    raise exception 'Ek ticket par 6 images tak.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_support_attachment_guard on public.support_ticket_attachments;
create trigger trg_support_attachment_guard
  before insert on public.support_ticket_attachments
  for each row execute function public.fn_support_attachment_guard();

revoke all on function public.fn_cc_can_assign() from public, anon;
revoke all on function public.fn_complaint_set_stage(uuid, text, text) from public, anon;
revoke all on function public.fn_cc_set_assign_grant(uuid, boolean) from public, anon;
revoke all on function public.fn_complaint_can_see(uuid) from public, anon;
revoke all on function public.fn_complaint_forward_label(uuid) from public, anon;
revoke all on function public.fn_complaint_mark_ai(uuid) from public, anon;
revoke all on function public.fn_cc_complaint_ticket(uuid) from public, anon;
revoke all on function public.fn_support_attachment_guard() from public, anon;

grant execute on function public.fn_cc_can_assign() to authenticated;
grant execute on function public.fn_complaint_set_stage(uuid, text, text) to authenticated;
grant execute on function public.fn_cc_set_assign_grant(uuid, boolean) to authenticated;
grant execute on function public.fn_complaint_can_see(uuid) to authenticated;
grant execute on function public.fn_complaint_forward_label(uuid) to authenticated;
grant execute on function public.fn_complaint_mark_ai(uuid) to authenticated;
grant execute on function public.fn_cc_complaint_ticket(uuid) to authenticated;

update public.support_tickets
   set complaint_stage = case status
         when 'assigned' then 'assigned'
         when 'investigating' then 'in_progress'
         when 'testing' then 'review'
         when 'resolved' then 'completed'
         when 'resolved_pending_verify' then 'review'
         when 'reopened' then 'rejected'
         else 'received'
       end,
       stage_percent = case status
         when 'assigned' then 30
         when 'investigating' then 55
         when 'testing' then 80
         when 'resolved' then 100
         when 'resolved_pending_verify' then 80
         when 'reopened' then 100
         else 10
       end
 where intake_source in ('staff', 'call_center')
   and complaint_stage is null;

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values ('support.dashboard', 'Support Dashboard', 'Support Dashboard', 'سپورٹ ڈیش بورڈ',
  'Complaint queue, stages, aur Manager ki assign ijazat.',
  'Complaint queue, stages, and the Manager assign grant.',
  'شکایت کی قطار، مراحل، اور مینیجر کی اجازت۔',
  '/admin/my-work/support-dashboard', 'Bug', true, true)
on conflict (key) do nothing;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
('support.dashboard', 'rm',
 'Call center aur staff ki shikayat yahin aati hai. Owner, super admin aur Admin assign karte hain. Manager sirf us waqt jab Owner ne "Complaint assign kar sakta hai" on kiya ho.',
 'Owner, Admin, aur ijazat-yafta Manager. Staff apni shikayat ka stage dekhta hai.',
 'Jab nayi shikayat aaye, stage badle, ya Manager ko ijazat deni ho.',
 array['Queue mein Forwarded by Manager wala label dekhein.','Department, user, agent ya developer ko aage bhejein.','Assignee stage aage barhaye aur note likhe.','Tasveer sirf unhein dikhe jinhein ticket dikhti hai.','AI button tab kaam karta hai jab server par webhook URL ho.'],
 'Mukammal Admin ya koi doosra banda kare. Banane wala khud band nahi karta.',
 array['Manager ko baghair ijazat assign na samjhein. Toggle default band hai.','Staff ke form par department na dikhayein.','Stage par naya SMS na bhejein.']),
('support.dashboard', 'en',
 'Caller and staff complaints land here. Owner, super admin and Admin assign them. A Manager assigns only after the Owner turns on Complaint assign kar sakta hai.',
 'Owner, Admin, and a Manager who was granted. Staff watch their own stage.',
 'When a complaint arrives, a stage changes, or a Manager needs the grant.',
 array['Read the Forwarded by Manager label on the queue.','Forward to a department, user, agent or developer.','The assignee moves the stage and adds a note.','Images stay private to people who can see the ticket.','The AI button works only when the webhook URL is set.'],
 'Completed is by Admin or someone other than the maker.',
 array['A Manager without the grant cannot assign. The toggle is off by default.','Do not show a department picker on the staff form.','Do not send a new SMS on a stage change.']),
('support.dashboard', 'ur',
 'کال سینٹر اور سٹاف کی شکایت یہیں آتی ہے۔ تفویض اونر، سپر ایڈمن اور ایڈمن کرتے ہیں۔ مینیجر صرف اجازت کے بعد۔',
 'اونر، ایڈمن، اور مجاز مینیجر۔ سٹاف اپنا مرحلہ دیکھتا ہے۔',
 'جب نئی شکایت آئے یا مرحلہ بدلے۔',
 array['قطار میں مینیجر کا فارورڈ پڑھیں۔','آگے بھیجیں۔','ذمہ دار مرحلہ بڑھائے۔','تصویر صرف دیکھنے والے کو۔'],
 'مکمل ایڈمن یا کوئی اور بندہ کرے۔',
 array['بغیر اجازت مینیجر تفویض نہیں کرتا۔'])
on conflict (feature_key, lang) do nothing;
