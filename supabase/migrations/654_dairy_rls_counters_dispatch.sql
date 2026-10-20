-- =====================================================================
-- 654: Counter aur dispatch — har staff seedha na likh sake
-- =====================================================================
-- Collection number sirf fn_next_milk_collection_number (service) se
-- badhta hai. Dispatch par raseed ek dafa, aur received <= dispatched.

drop policy if exists staff_manage_milk_counters on public.milk_collection_counters;
drop policy if exists milk_counters_read on public.milk_collection_counters;
alter table public.milk_collection_counters enable row level security;
create policy milk_counters_read on public.milk_collection_counters
  for select to authenticated
  using (public.fn_has_dept(array['owner','super_admin','admin','manager','milk_collection']::public.user_role[]));

revoke insert, update, delete, truncate on public.milk_collection_counters from anon, authenticated;

drop policy if exists milk_dispatch_all on public.milk_dispatches;
drop policy if exists milk_dispatch_select on public.milk_dispatches;
drop policy if exists milk_dispatch_insert on public.milk_dispatches;
drop policy if exists milk_dispatch_update on public.milk_dispatches;

alter table public.milk_dispatches enable row level security;

create policy milk_dispatch_select on public.milk_dispatches
  for select to authenticated
  using (public.fn_is_any_staff());

create policy milk_dispatch_insert on public.milk_dispatches
  for insert to authenticated
  with check (public.fn_has_dept(array['owner','super_admin','admin','manager','milk_collection']::public.user_role[]));

create policy milk_dispatch_update on public.milk_dispatches
  for update to authenticated
  using (public.fn_has_dept(array['owner','super_admin','admin','manager','milk_collection']::public.user_role[]))
  with check (public.fn_has_dept(array['owner','super_admin','admin','manager','milk_collection']::public.user_role[]));

revoke delete, truncate on public.milk_dispatches from anon, authenticated;

alter table public.milk_dispatches drop constraint if exists chk_milk_dispatch_received_cap;
alter table public.milk_dispatches add constraint chk_milk_dispatch_received_cap check (
  received_liters is null or received_liters <= dispatched_liters
);

create or replace function public.fn_milk_dispatch_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if old.received_liters is not null and new.received_liters is distinct from old.received_liters then
      raise exception 'Raseed pehle darj ho chuki hai';
    end if;
    if new.dispatched_liters is distinct from old.dispatched_liters then
      raise exception 'Bheji hui miqdar badli nahi ja sakti';
    end if;
  end if;
  if new.received_liters is not null and new.received_liters > new.dispatched_liters then
    raise exception 'Company bheje se zyada nahi maan sakti';
  end if;
  return new;
end $$;

drop trigger if exists trg_milk_dispatch_guard on public.milk_dispatches;
create trigger trg_milk_dispatch_guard
  before insert or update on public.milk_dispatches
  for each row execute function public.fn_milk_dispatch_guard();

comment on constraint chk_milk_dispatch_received_cap on public.milk_dispatches is
  'Company bheje se zyada nahi maan sakti. Raseed ek dafa (654).';
