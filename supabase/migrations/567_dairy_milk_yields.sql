-- 567: Har janwar ka rozana doodh (subah/shaam). Additive.
-- Kisan sirf apna; staff parh sakta hai; anon kuch nahi; delete nahi.
-- ERP ka milk_entries sirf PARHA jata hai (fn_my_milk_collection), badla nahi.

create table if not exists public.dairy_milk_yields (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.dairy_animals(id),
  farmer_id uuid not null references public.farmers(id),
  yield_date date not null default current_date,
  shift text not null check (shift in ('am','pm')),
  liters numeric(5,2) not null check (liters >= 0 and liters <= 60),
  fat numeric(4,2) check (fat is null or (fat >= 0 and fat <= 15)),
  snf numeric(4,2) check (snf is null or (snf >= 0 and snf <= 15)),
  withheld boolean not null default false,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (animal_id, yield_date, shift)
);
create index if not exists ix_dairy_yields_farmer_date on public.dairy_milk_yields (farmer_id, yield_date);

create or replace function public.fn_dairy_yields_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if tg_op = 'DELETE' then raise exception 'Doodh ka indraaj delete nahi hota -- 0 likh dein'; end if;
  select farmer_id, status into a from dairy_animals where id = new.animal_id;
  if not found then raise exception 'Janwar nahi mila'; end if;
  new.farmer_id := a.farmer_id;   -- hamesha janwar ke maalik se
  if new.yield_date > current_date then raise exception 'Aage ki tareekh ka doodh nahi likh sakte'; end if;
  if tg_op = 'INSERT' and a.status in ('sold','dead') then raise exception 'Bika/mara janwar -- doodh nahi likh sakte'; end if;
  if tg_op = 'UPDATE' and (new.animal_id <> old.animal_id or new.yield_date <> old.yield_date or new.shift <> old.shift) then
    raise exception 'Janwar/tareekh/waqt badla nahi ja sakta';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_dairy_yields_guard on public.dairy_milk_yields;
create trigger trg_dairy_yields_guard before insert or update or delete on public.dairy_milk_yields
  for each row execute function public.fn_dairy_yields_guard();

alter table public.dairy_milk_yields enable row level security;
revoke all on public.dairy_milk_yields from anon;
grant select, insert, update on public.dairy_milk_yields to authenticated;
revoke delete on public.dairy_milk_yields from authenticated;
drop policy if exists dairy_yields_own_select on public.dairy_milk_yields;
create policy dairy_yields_own_select on public.dairy_milk_yields for select to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id() or public.fn_is_staff(auth.uid()));
drop policy if exists dairy_yields_own_insert on public.dairy_milk_yields;
create policy dairy_yields_own_insert on public.dairy_milk_yields for insert to authenticated
  with check (farmer_id = public.fn_dairy_my_farmer_id()
              and exists (select 1 from dairy_animals d where d.id = animal_id and d.farmer_id = public.fn_dairy_my_farmer_id()));
drop policy if exists dairy_yields_own_update on public.dairy_milk_yields;
create policy dairy_yields_own_update on public.dairy_milk_yields for update to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id()) with check (farmer_id = public.fn_dairy_my_farmer_id());

-- Views: RLS chalti rahe (security_invoker).
create or replace view public.v_dairy_animal_daily with (security_invoker = true) as
  select animal_id, farmer_id, yield_date,
         coalesce(sum(liters) filter (where shift='am'),0) as am,
         coalesce(sum(liters) filter (where shift='pm'),0) as pm,
         sum(liters) as total
    from public.dairy_milk_yields group by animal_id, farmer_id, yield_date;
create or replace view public.v_dairy_herd_daily with (security_invoker = true) as
  select farmer_id, yield_date,
         coalesce(sum(liters) filter (where shift='am'),0) as am,
         coalesce(sum(liters) filter (where shift='pm'),0) as pm,
         sum(liters) as total, count(distinct animal_id) as animals
    from public.dairy_milk_yields group by farmer_id, yield_date;
revoke all on public.v_dairy_animal_daily, public.v_dairy_herd_daily from anon;
grant select on public.v_dairy_animal_daily, public.v_dairy_herd_daily to authenticated;

-- ERP collection (milk_entries) -- sirf apna, sirf parhna. Rate/raqam nahi lautate.
create or replace function public.fn_my_milk_collection(p_from date, p_to date)
returns table (entry_date date, am numeric, pm numeric, total numeric)
language sql stable security definer set search_path = public as $$
  select e.entry_date,
         coalesce(sum(e.quantity_liters) filter (where e.shift in ('morning','am')),0),
         coalesce(sum(e.quantity_liters) filter (where e.shift not in ('morning','am')),0),
         coalesce(sum(e.quantity_liters),0)
    from milk_entries e
   where e.farmer_id = public.fn_dairy_my_farmer_id()
     and e.entry_date between coalesce(p_from, current_date - 29) and coalesce(p_to, current_date)
   group by e.entry_date order by e.entry_date;
$$;
revoke all on function public.fn_my_milk_collection(date, date) from public, anon;
grant execute on function public.fn_my_milk_collection(date, date) to authenticated;

-- Bulk: ek waqt (subah/shaam) mein sab janwar ek saath. Sirf apne janwar.
-- p_rows: [{"animal_id": "...", "liters": 7.2, "fat": 4.1, "withheld": false}]
create or replace function public.fn_dairy_bulk_milk(p_date date, p_shift text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := public.fn_dairy_my_farmer_id(); r jsonb; n int := 0;
begin
  if me is null then raise exception 'Sirf kisan apna doodh likh sakta hai'; end if;
  if p_shift not in ('am','pm') then raise exception 'Waqt am/pm'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 200 then raise exception 'Ghalat rows'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if r->>'liters' is null or r->>'liters' = '' then continue; end if;
    if not exists (select 1 from dairy_animals d where d.id = (r->>'animal_id')::uuid and d.farmer_id = me) then
      raise exception 'Ye janwar aap ka nahi';
    end if;
    insert into dairy_milk_yields (animal_id, farmer_id, yield_date, shift, liters, fat, withheld)
    values ((r->>'animal_id')::uuid, me, p_date, p_shift, (r->>'liters')::numeric,
            nullif(r->>'fat','')::numeric, coalesce((r->>'withheld')::boolean, false))
    on conflict (animal_id, yield_date, shift) do update
      set liters = excluded.liters, fat = coalesce(excluded.fat, dairy_milk_yields.fat), withheld = excluded.withheld;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.fn_dairy_bulk_milk(date, text, jsonb) from public, anon;
grant execute on function public.fn_dairy_bulk_milk(date, text, jsonb) to authenticated;
