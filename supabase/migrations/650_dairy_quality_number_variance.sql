-- =====================================================================
-- 650: Dairy review — quality hadd, atomic collection number, ziyadti
-- =====================================================================
-- Koi data nahi mitaya. Naye khane aur ek function. Counter ki likhai
-- ab sirf is function se hoti hai (654 mein seedhi likhai band).
--
-- SNF constant yahan NAHI badla. 0.805 Wasela ke contract ki tasdeeq
-- ka intezar hai (docs/DAIRY-REVIEW-FIXES-2026-10-20.md).

alter table public.milk_entries
  add column if not exists fat_override boolean not null default false,
  add column if not exists lr_override boolean not null default false,
  add column if not exists duplicate_cleared_by uuid,
  add column if not exists duplicate_cleared_at timestamptz,
  add column if not exists duplicate_clear_note varchar(255);

comment on column public.milk_entries.fat_override is
  'Manager ne FAT 1-12 se bahar jaan boojh kar mana. Bina is ke check rokta hai (650).';
comment on column public.milk_entries.duplicate_cleared_at is
  'Mumkin duplicate par FAT tab tak nahi lagta jab tak manager nishan saaf na kare. Saaf karne wala banane wala nahi ho sakta.';

alter table public.milk_entries drop constraint if exists chk_milk_fat_range;
alter table public.milk_entries add constraint chk_milk_fat_range check (
  fat_percentage is null
  or fat_override
  or (fat_percentage >= 1 and fat_percentage <= 12)
);

alter table public.milk_entries drop constraint if exists chk_milk_lr_range;
alter table public.milk_entries add constraint chk_milk_lr_range check (
  lr is null
  or lr_override
  or (lr >= 15 and lr <= 40)
);

alter table public.milk_entries drop constraint if exists chk_milk_no_self_verify;
alter table public.milk_entries add constraint chk_milk_no_self_verify check (
  verified_by_profile_id is null
  or created_by is null
  or verified_by_profile_id <> created_by
);

alter table public.milk_entries drop constraint if exists chk_milk_duplicate_clear_sod;
alter table public.milk_entries add constraint chk_milk_duplicate_clear_sod check (
  duplicate_cleared_by is null
  or created_by is null
  or duplicate_cleared_by <> created_by
);

-- Saal Pakistan ka do-hinda hissa hai (MC-26-000001). Do dafa ek sath
-- parhne se pehle wala number do dafa nahi milta: insert ya update ek
-- hi taale mein last_number badalta hai.
create or replace function public.fn_next_milk_collection_number(p_year integer)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  if p_year is null or p_year < 0 or p_year > 99 then
    raise exception 'Collection number ka saal 0 se 99 ke darmiyan hona chahiye.';
  end if;
  insert into public.milk_collection_counters as c (year, last_number)
  values (p_year, 1)
  on conflict (year) do update
    set last_number = c.last_number + 1
  returning last_number into n;
  return 'MC-' || p_year::text || '-' || lpad(n::text, 6, '0');
end $$;

revoke all on function public.fn_next_milk_collection_number(integer) from public, anon, authenticated;
do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_next_milk_collection_number(integer) to service_role;
  end if;
end
$g$;

alter table public.milk_route_collections
  add column if not exists variance_kind text;

alter table public.milk_route_collections drop constraint if exists chk_route_variance_kind;
alter table public.milk_route_collections add constraint chk_route_variance_kind check (
  variance_kind is null or variance_kind in ('shortage', 'excess', 'ok', 'pending')
);

comment on column public.milk_route_collections.variance_kind is
  'shortage = field zyada, excess = chiller zyada (milawat ka nishan), ok, pending (650).';

create index if not exists idx_milk_route_collections_branch_date
  on public.milk_route_collections (branch_id, collection_date);

create index if not exists idx_milk_payments_created_at
  on public.milk_payments (created_at);
