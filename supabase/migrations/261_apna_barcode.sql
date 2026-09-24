-- =====================================================================
-- AgriBridge — Migration 261: Apna barcode, aur label chhaapna
-- =====================================================================
-- Naqshe (docs/AI-PURCHASE-PIPELINE.md) ka qadam I.
--
-- Karyana mein bahut cheezon par barcode nahi hota (khuli daal, apni
-- packing, chhoti company ka maal). Testing par 272 mein se 244 aisi
-- thin. Bina barcode ke counter par har cheez naam se dhoondni paRti
-- hai -- yehi wo jagah hai jahan waqt jata hai aur ghalat cheez bikti
-- hai.
--
-- Apna barcode: EAN-13, "200" se shuru. GS1 ne 200-299 duniya bhar
-- mein "andar ke istemal" ke liye rakha hua hai -- ye kisi asal
-- company ke barcode se nahi takrayega, aur har aam scanner ise parh
-- leta hai. Baqi 9 adad ek ginti se, aakhri adad check digit.
--
-- products.barcode wohi khana rehta hai jo scanner parhta hai (POS usi
-- se dhoondta hai), is liye apna barcode bhi wahin jata hai. Farq
-- barcode_source mein: 'manufacturer' ya 'internal'. Company ka asal
-- barcode baad mein mile to us par likh sakte hain -- purana label
-- phir bhi chalta rahe, is ke liye internal_barcode alag mehfooz
-- rehta hai aur POS dono se dhoondta hai (code mein).
-- =====================================================================

alter table products
  add column if not exists barcode_source text,
  add column if not exists internal_barcode text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_products_barcode_source') then
    alter table products
      add constraint chk_products_barcode_source
      check (barcode_source is null or barcode_source in ('manufacturer', 'internal'));
  end if;
end;
$$;

create unique index if not exists idx_products_internal_barcode
  on products (internal_barcode) where internal_barcode is not null;

create sequence if not exists internal_barcode_seq start 1;

comment on column products.internal_barcode is
  'Apna EAN-13 (200...). Label par yehi chhapta hai; company ka barcode aa jaye to bhi ye chalta rehta hai (261).';

-- EAN-13 ka check digit
create or replace function fn_ean13_check_digit(p_first12 text)
returns int
language plpgsql
immutable
as $$
declare
  v_sum int := 0;
  i int;
begin
  if p_first12 !~ '^[0-9]{12}$' then
    raise exception 'EAN-13 ke liye 12 adad chahiye';
  end if;
  for i in 1..12 loop
    v_sum := v_sum + (substr(p_first12, i, 1)::int) * (case when i % 2 = 1 then 1 else 3 end);
  end loop;
  return (10 - (v_sum % 10)) % 10;
end;
$$;

-- Ek product ko apna barcode dena. Pehle se ho to wohi wapas.
create or replace function fn_assign_internal_barcode(p_product_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_barcode text;
  v_body text;
  v_code text;
begin
  if not fn_is_any_staff() then
    raise exception 'Sirf staff' using errcode = 'insufficient_privilege';
  end if;

  select internal_barcode, barcode into v_existing, v_barcode
  from products where id = p_product_id and is_deleted = false;
  if not found then
    raise exception 'Product nahi mila';
  end if;
  if v_existing is not null then
    return v_existing;
  end if;

  -- 200 + 9 adad ginti + check digit = 13
  loop
    v_body := '200' || lpad(nextval('internal_barcode_seq')::text, 9, '0');
    v_code := v_body || fn_ean13_check_digit(v_body)::text;
    exit when not exists (select 1 from products where barcode = v_code or internal_barcode = v_code);
  end loop;

  update products
     set internal_barcode = v_code,
         -- Scanner wala khana khali ho to apna barcode wahin; company
         -- ka ho to wo rehta hai, apna sirf label ke liye.
         barcode = coalesce(nullif(btrim(barcode), ''), v_code),
         barcode_source = case when nullif(btrim(barcode), '') is null then 'internal' else coalesce(barcode_source, 'manufacturer') end,
         updated_at = now()
   where id = p_product_id;

  return v_code;
end;
$$;

grant execute on function fn_assign_internal_barcode(uuid) to authenticated;

-- Jin par barcode nahi, sab ko ek sath.
create or replace function fn_assign_internal_barcodes_missing()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_n int := 0;
begin
  if not fn_is_any_staff() then
    raise exception 'Sirf staff' using errcode = 'insufficient_privilege';
  end if;
  for r in
    select id from products
    where is_deleted = false
      and internal_barcode is null
      and (barcode is null or btrim(barcode) = '')
  loop
    perform fn_assign_internal_barcode(r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

grant execute on function fn_assign_internal_barcodes_missing() to authenticated;

-- Purane products jin par barcode hai: wo company ka hai.
update products set barcode_source = 'manufacturer'
where barcode_source is null and barcode is not null and btrim(barcode) <> '';

-- Menu: label chhaapna
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur,
                             route, icon, is_sensitive, is_active) values
  ('products.labels', 'Barcode Label', 'Barcode Labels', 'بارکوڈ لیبل',
   'Apna barcode banayein aur label chhaapein', 'Make internal barcodes and print labels', 'اپنا بارکوڈ بنائیں اور لیبل چھاپیں',
   '/admin/products/labels', 'Barcode', false, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.dashboard_key, 'products.labels', 22
from (select distinct dashboard_key from public.dashboard_features df
      join public.features f on f.key = df.feature_key
      where f.route = '/admin/products') d
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;
