-- 575: Dairy ka har kharcha (rupay tak). Additive. Delete nahi -- void (wajah ke saath).
-- Dukaan (ERP POS) se khareedi khal/wanda/vets "shamil" ki ja sakti hai -- ek item ek hi baar.
create table if not exists public.dairy_expenses (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  expense_date date not null default current_date,
  category text not null check (category in ('chara','wanda','khal','tori','minerals','vets','labour','other')),
  sub_type text check (sub_type is null or sub_type in ('green','silage','toori','bhoosa')),
  qty numeric(12,3) check (qty is null or qty > 0),
  unit text check (unit is null or unit in ('maund','kg','bori','bag','din','litre','other')),
  rate numeric(12,2) check (rate is null or rate >= 0),
  amount numeric(14,2) not null check (amount > 0 and amount <= 10000000),
  animal_id uuid references public.dairy_animals(id),
  paid_to text check (paid_to is null or length(paid_to) <= 80),
  payment text not null default 'cash' check (payment in ('cash','udhaar','bank')),
  note text check (note is null or length(note) <= 300),
  source text not null default 'manual' check (source in ('manual','erp_pos')),
  source_ref uuid,
  voided boolean not null default false,
  void_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (qty is null or rate is null or amount = round(qty * rate, 2)),
  check (sub_type is null or category = 'chara'),
  check (not voided or length(coalesce(void_reason,'')) >= 3)
);
create unique index if not exists ux_dairy_expenses_source on public.dairy_expenses (source_ref) where source_ref is not null;
create index if not exists ix_dairy_expenses_farmer_date on public.dairy_expenses (farmer_id, expense_date);

create or replace function public.fn_dairy_money_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'Hisaab ka indraaj delete nahi hota -- void karein'; end if;
  if tg_op = 'UPDATE' then
    if new.farmer_id <> old.farmer_id then raise exception 'Maalik badla nahi ja sakta'; end if;
    if old.voided then raise exception 'Void indraaj badla nahi ja sakta'; end if;
    if tg_table_name = 'dairy_expenses' then  -- nested: dairy_income mein source column nahi
      if new.source is distinct from old.source or new.source_ref is distinct from old.source_ref then
        raise exception 'Source badla nahi ja sakta';
      end if;
      if old.source = 'erp_pos' and not new.voided then
        raise exception 'Dukaan wala indraaj badla nahi ja sakta -- sirf void';
      end if;
    end if;
  end if;
  if new.animal_id is not null and not exists (select 1 from dairy_animals a where a.id = new.animal_id and a.farmer_id = new.farmer_id) then
    raise exception 'Janwar isi kisan ka hona chahiye';
  end if;
  if tg_table_name = 'dairy_expenses' then
    if new.expense_date > current_date then raise exception 'Aage ki tareekh nahi'; end if;
    if tg_op = 'INSERT' and new.source = 'erp_pos' and current_setting('dairy.from_shop', true) is distinct from '1' then
      raise exception 'Dukaan wala kharcha sirf "Shamil" se aata hai';
    end if;
  else
    if new.income_date > current_date then raise exception 'Aage ki tareekh nahi'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_dairy_expenses_guard on public.dairy_expenses;
create trigger trg_dairy_expenses_guard before insert or update or delete on public.dairy_expenses
  for each row execute function public.fn_dairy_money_guard();

alter table public.dairy_expenses enable row level security;
revoke all on public.dairy_expenses from anon;
grant select, insert, update on public.dairy_expenses to authenticated;
revoke delete on public.dairy_expenses from authenticated;
drop policy if exists dairy_expenses_own_select on public.dairy_expenses;
create policy dairy_expenses_own_select on public.dairy_expenses for select to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id() or public.fn_is_staff(auth.uid()));
drop policy if exists dairy_expenses_own_insert on public.dairy_expenses;
create policy dairy_expenses_own_insert on public.dairy_expenses for insert to authenticated
  with check (farmer_id = public.fn_dairy_my_farmer_id());
drop policy if exists dairy_expenses_own_update on public.dairy_expenses;
create policy dairy_expenses_own_update on public.dairy_expenses for update to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id()) with check (farmer_id = public.fn_dairy_my_farmer_id());

-- Dukaan ki cheez -> dairy category (naam/shop se). null = dairy ki nahi.
create or replace function public.fn_dairy_shop_category(p_name text, p_category text, p_shop_type text)
returns text language sql immutable as $$
  select case
    when p_shop_type = 'vet' or coalesce(p_category,'') ~* '(vet|medic|dawa|vaccine|injection)' then 'vets'
    when coalesce(p_name,'') || ' ' || coalesce(p_category,'') ~* '(khal|khall|binola|cotton ?seed cake|sarson cake|کھل)' then 'khal'
    when coalesce(p_name,'') || ' ' || coalesce(p_category,'') ~* '(wanda|vanda|feed|chokar|ونڈا)' then 'wanda'
    when coalesce(p_name,'') || ' ' || coalesce(p_category,'') ~* '(mineral|salt|namak|calcium|dcp)' then 'minerals'
    when coalesce(p_name,'') || ' ' || coalesce(p_category,'') ~* '(tori|toori|bhoosa|silage|ٹوری)' then 'tori'
    else null end;
$$;

-- Apni dukaan wali khareedari (sirf parhna). added = pehle se shamil.
create or replace function public.fn_my_shop_dairy_suggestions(p_from date, p_to date)
returns table (item_id uuid, sale_date date, ref text, product text, qty numeric, rate numeric, amount numeric, category text, added boolean)
language sql stable security definer set search_path = public as $$
  with me as (select public.fn_dairy_my_farmer_id() as fid),
  cust as (select c.id from customers c, me where c.farmer_id = me.fid)
  select i.id, (s.created_at at time zone 'Asia/Karachi')::date, 'POS-' || upper(left(s.id::text, 6)),
         p.name, i.quantity, i.unit_price, i.subtotal,
         public.fn_dairy_shop_category(p.name, cat.name, sh.business_type),
         exists (select 1 from dairy_expenses e where e.source_ref = i.id)
    from pos_sale_items i
    join pos_sales s on s.id = i.sale_id
    left join products p on p.id = i.product_id
    left join categories cat on cat.id = p.category_id
    left join shops sh on sh.id = s.shop_id
   where s.customer_id in (select id from cust)
     and (s.created_at at time zone 'Asia/Karachi')::date between coalesce(p_from, current_date - 60) and coalesce(p_to, current_date)
     and public.fn_dairy_shop_category(p.name, cat.name, sh.business_type) is not null
     and coalesce(i.subtotal, 0) > 0
   order by s.created_at desc
   limit 100;
$$;
revoke all on function public.fn_my_shop_dairy_suggestions(date, date) from public, anon;
grant execute on function public.fn_my_shop_dairy_suggestions(date, date) to authenticated;

-- "Shamil karein": dukaan ka item kharche mein (ek hi baar).
create or replace function public.fn_dairy_add_from_shop(p_item uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := public.fn_dairy_my_farmer_id(); s record; new_id uuid;
begin
  if me is null then raise exception 'Sirf kisan'; end if;
  select * into s from public.fn_my_shop_dairy_suggestions(current_date - 365, current_date) x where x.item_id = p_item;
  if not found then raise exception 'Ye khareedari aap ki nahi ya dairy ki nahi'; end if;
  if s.added then raise exception 'Pehle se shamil hai'; end if;
  perform set_config('dairy.from_shop', '1', true);
  insert into dairy_expenses (farmer_id, expense_date, category, qty, rate, amount, paid_to, payment, note, source, source_ref)
  values (me, s.sale_date, s.category, null, null, round(s.amount, 2), 'Al Rana Traders', 'udhaar',
          left(coalesce(s.product,'') || ' · ' || s.ref || ' · ' || trim(to_char(s.qty, 'FM999990.###')), 300), 'erp_pos', p_item)
  returning id into new_id;
  perform set_config('dairy.from_shop', '', true);
  return new_id;
end $$;
revoke all on function public.fn_dairy_add_from_shop(uuid) from public, anon;
grant execute on function public.fn_dairy_add_from_shop(uuid) to authenticated;
