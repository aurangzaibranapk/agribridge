-- 566: Kisan portal Dairy (Phase 3) -- har janwar ka apna tag.
-- Additive. Kisan sirf apne janwar dekh/likh sakta hai (RLS + auth.uid()).
-- Staff parh sakta hai. Anon ko kuch nahi. Delete nahi -- sirf sold/dead.

create or replace function public.fn_dairy_my_farmer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select f.id from farmers f where f.user_id = auth.uid() limit 1;
$$;
revoke all on function public.fn_dairy_my_farmer_id() from public, anon;
grant execute on function public.fn_dairy_my_farmer_id() to authenticated;

create table if not exists public.dairy_animals (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  farm_id uuid references public.farms(id),
  tag_no text not null check (length(btrim(tag_no)) between 1 and 30),
  rfid_tag text,
  name text check (name is null or length(name) <= 60),
  species text not null default 'cow' check (species in ('cow','buffalo','goat')),
  breed text,
  sex text not null default 'F' check (sex in ('F','M')),
  dob date check (dob is null or dob <= current_date),
  dob_estimated boolean not null default false,
  dam_id uuid references public.dairy_animals(id),
  sire_text text,
  source text not null default 'born' check (source in ('born','purchased')),
  purchase_price numeric(14,2) check (purchase_price is null or purchase_price >= 0),
  status text not null default 'milking' check (status in ('milking','dry','pregnant','heifer','calf','bull','sold','dead')),
  status_date date,
  photo_path text,
  lactation_no int not null default 0 check (lactation_no >= 0),
  last_calving_date date,       -- Phase 4 (breeding) is ko bharega
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_dairy_animals_tag on public.dairy_animals (farmer_id, lower(btrim(tag_no)));
create unique index if not exists ux_dairy_animals_rfid on public.dairy_animals (rfid_tag) where rfid_tag is not null;
create index if not exists ix_dairy_animals_farmer on public.dairy_animals (farmer_id, status);

-- Maa (dam) sirf usi kisan ki ho; farmer_id badla nahi ja sakta.
create or replace function public.fn_dairy_animals_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Janwar delete nahi hota -- status sold/dead karein';
  end if;
  if tg_op = 'UPDATE' and new.farmer_id <> old.farmer_id then
    raise exception 'Janwar ka maalik badla nahi ja sakta';
  end if;
  if new.dam_id is not null and not exists (select 1 from dairy_animals d where d.id = new.dam_id and d.farmer_id = new.farmer_id) then
    raise exception 'Maa (dam) isi kisan ki honi chahiye';
  end if;
  if new.dam_id = new.id then raise exception 'Janwar apni maa nahi ho sakta'; end if;
  if new.farm_id is not null and not exists (select 1 from farms m where m.id = new.farm_id and m.farmer_id = new.farmer_id) then
    raise exception 'Farm isi kisan ka hona chahiye';
  end if;
  new.tag_no := btrim(new.tag_no);
  new.updated_at := now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then new.status_date := coalesce(new.status_date, current_date); end if;
  return new;
end $$;
drop trigger if exists trg_dairy_animals_guard on public.dairy_animals;
create trigger trg_dairy_animals_guard before insert or update or delete on public.dairy_animals
  for each row execute function public.fn_dairy_animals_guard();

alter table public.dairy_animals enable row level security;
revoke all on public.dairy_animals from anon;
grant select, insert, update on public.dairy_animals to authenticated;
revoke delete on public.dairy_animals from authenticated;

drop policy if exists dairy_animals_own_select on public.dairy_animals;
create policy dairy_animals_own_select on public.dairy_animals for select to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id() or public.fn_is_staff(auth.uid()));
drop policy if exists dairy_animals_own_insert on public.dairy_animals;
create policy dairy_animals_own_insert on public.dairy_animals for insert to authenticated
  with check (farmer_id = public.fn_dairy_my_farmer_id());
drop policy if exists dairy_animals_own_update on public.dairy_animals;
create policy dairy_animals_own_update on public.dairy_animals for update to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id())
  with check (farmer_id = public.fn_dairy_my_farmer_id());
