-- 626: Call-center aur staff complaints Support Dashboard ki queue mein.
--
-- Additive. 624 aur 625 ke baad. Live / Testing par tab tak nahi jab
-- tak backup verify na ho. Purani support tickets ka data nahi mitata.
--
-- Staff complaint: department_id aur assigned_to khali. Koi auto-assign nahi.
-- Caller complaint: category ki tajweez suggested_department mein, assign nahi.
-- Assign sirf owner / super_admin / admin. Maker khud band nahi karta.
-- Paighaam sirf SMS — ye file koi WhatsApp raasta nahi kholti.

alter table public.support_tickets
  add column if not exists intake_source text,
  add column if not exists suggested_department text,
  add column if not exists routed_label text,
  add column if not exists cc_complaint_id uuid;

alter table public.support_tickets drop constraint if exists support_tickets_intake_source_check;
alter table public.support_tickets add constraint support_tickets_intake_source_check
  check (intake_source is null or intake_source in ('support', 'staff', 'call_center'));

alter table public.cc_complaints
  add column if not exists support_ticket_id uuid,
  add column if not exists assigned_to uuid references public.profiles(id),
  add column if not exists routed_department text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'support_tickets_cc_complaint_fkey') then
    alter table public.support_tickets
      add constraint support_tickets_cc_complaint_fkey
      foreign key (cc_complaint_id) references public.cc_complaints(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cc_complaints_support_ticket_fkey') then
    alter table public.cc_complaints
      add constraint cc_complaints_support_ticket_fkey
      foreign key (support_ticket_id) references public.support_tickets(id);
  end if;
end $$;

create index if not exists support_tickets_intake_idx
  on public.support_tickets (organization_id, intake_source, created_at desc);

-- Agent sirf support_ticket_id jod sakta hai (link). Status / assign nahi.
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
    if not exists (
      select 1 from unnest(public.fn_cc_actor_roles()) r(role)
       where r.role in ('owner', 'super_admin', 'admin')
    ) then
      raise exception 'Sirf Admin assign karta hai.';
    end if;
  end if;
  if new.status is distinct from old.status and new.status in ('in_progress', 'resolved') then
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
    intake_source, suggested_department, cc_complaint_id
  ) values (
    new.organization_id, new.created_by, v_title, new.description, v_pri, 'new',
    '/admin/call-center/party/' || new.party_kind || '/' || new.party_id::text,
    'call_center', new.department, new.id
  )
  returning id into v_ticket;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, to_value, note
  ) values (
    v_ticket, new.organization_id, new.created_by, 'status', 'new',
    'Call center shikayat. Tajweez department: ' || new.department || '. Assign nahi — Admin aage bhejega. SMS only.'
  );
  update public.cc_complaints set support_ticket_id = v_ticket where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_cc_open_support_ticket on public.cc_complaints;
create trigger trg_cc_open_support_ticket
  after insert on public.cc_complaints
  for each row execute function public.fn_cc_open_support_ticket();

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
    intake_source, suggested_department, assigned_to, department_id, assigned_kind, assigned_agent
  ) values (
    v_org, auth.uid(), left(btrim(p_title), 160), left(btrim(p_description), 5000), v_pri, 'new',
    nullif(left(coalesce(p_page_url, ''), 1000), ''),
    'staff', null, null, null, null, null
  )
  returning id, ticket_no into v_id, v_no;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, to_value, note
  ) values (
    v_id, v_org, auth.uid(), 'status', 'new',
    'Staff shikayat seedha Admin queue mein. Koi department, koi auto-assign nahi.'
  );
  return jsonb_build_object(
    'id', v_id,
    'ticket_no', v_no,
    'created_at', now(),
    'status', 'new',
    'intake_source', 'staff',
    'assigned_to', null,
    'department_id', null
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
  v_routed text := nullif(btrim(coalesce(p_routed, '')), '');
  v_agent text := nullif(lower(btrim(coalesce(p_agent_key, ''))), '');
begin
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin', 'admin')
  ) then
    raise exception 'Sirf Admin assign karta hai.';
  end if;
  select organization_id, intake_source, cc_complaint_id
    into v_org, v_intake, v_cc
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
  update public.support_tickets
     set assigned_to = p_assignee,
         assigned_kind = case when v_agent is not null then 'agent' when p_assignee is not null then 'person' else assigned_kind end,
         assigned_agent = v_agent,
         department_id = coalesce(p_support_department, department_id),
         routed_label = coalesce(v_routed, routed_label),
         assignment_status = case when v_agent is not null then 'analysis_requested' else 'queued' end,
         assigned_at = now(),
         status = 'assigned',
         updated_at = now()
   where id = p_ticket;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, to_value, note
  ) values (
    p_ticket, v_org, auth.uid(), 'assignee',
    coalesce(v_name, v_agent, v_routed, 'department'),
    'Admin ne aage bheja.'
      || case when v_routed is not null then ' Department: ' || v_routed || '.' else '' end
  );
  if v_cc is not null then
    update public.cc_complaints
       set assigned_to = p_assignee,
           routed_department = coalesce(v_routed, routed_department),
           status = 'in_progress'
     where id = v_cc;
  end if;
  return jsonb_build_object('ok', true, 'assignee', v_name, 'routed', v_routed, 'agent', v_agent);
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
  update public.support_tickets
     set status = p_status,
         updated_at = now(),
         resolved_at = case when p_status = 'resolved' then now() when p_status = 'reopened' then null else resolved_at end,
         resolution_note = case when p_status = 'resolved' then nullif(btrim(coalesce(p_note, '')), '') else resolution_note end
   where id = p_ticket;
  insert into public.support_ticket_events (
    ticket_id, organization_id, actor_id, event_type, from_value, to_value, note
  ) values (
    p_ticket, v_org, auth.uid(), 'status', v_from, p_status, nullif(btrim(coalesce(p_note, '')), '')
  );
  if v_cc is not null then
    v_cc_status := case
      when p_status = 'resolved' then 'resolved'
      when p_status in ('reopened', 'new') then 'open'
      else 'in_progress'
    end;
    update public.cc_complaints set status = v_cc_status where id = v_cc;
  end if;
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

revoke all on function public.fn_staff_file_complaint(text, text, text, text) from public, anon;
revoke all on function public.fn_complaint_forward(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.fn_complaint_set_status(uuid, text, text) from public, anon;
grant execute on function public.fn_staff_file_complaint(text, text, text, text) to authenticated;
grant execute on function public.fn_complaint_forward(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.fn_complaint_set_status(uuid, text, text) to authenticated;
