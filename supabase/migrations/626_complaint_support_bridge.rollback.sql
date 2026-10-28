-- 626 rollback. Support tickets aur CMP numbers rehte hain.
-- Sirf bridge columns, trigger aur functions.

drop trigger if exists trg_cc_open_support_ticket on public.cc_complaints;
drop function if exists public.fn_cc_open_support_ticket();
drop function if exists public.fn_staff_file_complaint(text, text, text, text);
drop function if exists public.fn_complaint_forward(uuid, uuid, text, text, uuid);
drop function if exists public.fn_complaint_set_status(uuid, text, text);

-- 625 wala guard wapas. 626 ne usay replace kiya tha.
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
  if new.status is distinct from old.status and new.status in ('in_progress', 'resolved') then
    if not public.fn_cc_can_close(new.department) then
      raise exception 'Sirf assigned department is shikayat ko aage barha sakta hai.';
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

alter table public.cc_complaints drop constraint if exists cc_complaints_support_ticket_fkey;
alter table public.support_tickets drop constraint if exists support_tickets_cc_complaint_fkey;
alter table public.support_tickets drop constraint if exists support_tickets_intake_source_check;

alter table public.cc_complaints drop column if exists support_ticket_id;
alter table public.cc_complaints drop column if exists assigned_to;
alter table public.cc_complaints drop column if exists routed_department;
alter table public.support_tickets drop column if exists intake_source;
alter table public.support_tickets drop column if exists suggested_department;
alter table public.support_tickets drop column if exists routed_label;
alter table public.support_tickets drop column if exists cc_complaint_id;
