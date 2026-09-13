-- =====================================================================
-- AgriBridge — Migration 252: Jin ka rate abhi nahi mila
-- =====================================================================
-- Malik ki baat: "jahan rate na aa raha ho wo products save ho jayein,
-- lekin jahan hum aur products add karein wahan aa jayein."
--
-- Baat theek hai. Chalees products ki sheet mein do teen ka sale rate
-- reh jata hai, aur us ki wajah se poori qatar rok dena ghalat hai --
-- naam, expiry, trade rate sab to maujood hain.
--
-- ---------------------------------------------------------------------
-- Magar ek khatra pehle band karna paRta hai
-- ---------------------------------------------------------------------
-- products.selling_price NOT NULL hai. Rate na mile to us mein 0 jata
-- hai -- aur POS us 0 ko qeemat samajh kar cheez MUFT bech deta hai.
-- Ye wo ghalti hai jo counter par pakRi nahi jati: bill ban jata hai,
-- gahak chala jata hai, aur pata mahine baad chalta hai.
--
-- Is liye 0 ke sath ek nishan lagta hai: sale_rate_pending. Wo nishan
-- kehta hai "ye sifar qeemat nahi, jawab hi nahi mila" -- bilkul wohi
-- farq jo trade_rate_pending (241) ne trade rate par rakha tha.
--
-- Aur nishan sirf likha nahi jata, us par TAALA bhi hai: aisi cheez
-- bik hi nahi sakti. Rok POS ke safhe par bhi hai aur database par
-- bhi. Sirf safhe par rok lagana kaafi nahi hota -- ek raasta hamesha
-- reh jata hai (dealer ka darwaza, koi purana form, koi script), aur
-- wo raasta usi din milta hai jis din nuqsan hota hai.
--
-- ---------------------------------------------------------------------
-- Purane products ko haath nahi lagaya gaya
-- ---------------------------------------------------------------------
-- Jin ka selling_price pehle se 0 hai, un par ye nishan JAAN BOOJH KAR
-- nahi lagaya ja raha. Wo aaj bik rahe hain; un ko achanak POS se
-- ghayab kar dena ek nayi kharabi hai, chahe niyat theek ho. Wo
-- alag se dekhne ki cheez hai, migration ka kaam nahi.
-- =====================================================================

alter table products
  add column if not exists sale_rate_pending boolean not null default false;

comment on column products.sale_rate_pending is
  'Sale rate abhi maloom nahi. selling_price mein 0 para hai magar wo qeemat NAHI -- aisi cheez bik nahi sakti (252).';

create index if not exists idx_products_sale_rate_pending
  on products (sale_rate_pending) where sale_rate_pending;

-- ---------------------------------------------------------------------
-- Taala: bina rate ke cheez bik nahi sakti
-- ---------------------------------------------------------------------
create or replace function fn_no_sale_without_rate()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  select p.name into v_name
    from public.products p
   where p.id = new.product_id and p.sale_rate_pending;

  if v_name is not null then
    raise exception
      '"%" ka sale rate abhi darj nahi hua. Jab tak rate na bhara jaye, ye cheez bech nahi sakte.', v_name
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_no_sale_without_rate_pos on pos_sale_items;
create trigger trg_no_sale_without_rate_pos
  before insert on pos_sale_items
  for each row execute function fn_no_sale_without_rate();

drop trigger if exists trg_no_sale_without_rate_sale on sale_items;
create trigger trg_no_sale_without_rate_sale
  before insert on sale_items
  for each row execute function fn_no_sale_without_rate();

comment on function fn_no_sale_without_rate is
  'Jis product ka sale rate abhi nahi mila, wo bik nahi sakta -- warna 0 qeemat ban kar bill par chala jata (252).';

-- ---------------------------------------------------------------------
-- Kaam ki fehrist: jin ka koi rate baqi hai
-- ---------------------------------------------------------------------
create or replace view v_products_rate_baqi as
select
  p.id,
  p.name,
  p.pack_size,
  p.barcode,
  p.sale_rate_pending,
  p.trade_rate_pending,
  -- Jo maloom nahi wo NULL aata hai, sifar nahi. Safhe par khali khana
  -- dikhta hai -- aur khali khana jhoot nahi bolta.
  case when p.sale_rate_pending then null else p.selling_price end as selling_price,
  case when p.trade_rate_pending then null else p.purchase_price end as purchase_price,
  p.wholesale_price,
  p.mrp_price,
  p.expiry_date,
  p.created_at
from products p
where p.is_deleted = false
  and (p.sale_rate_pending or p.trade_rate_pending);

comment on view v_products_rate_baqi is
  'Wo products jin ka sale rate ya trade rate abhi maloom nahi (252).';

-- ---------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur,
                             route, icon, is_sensitive, is_active) values
  ('products.rates_baqi', 'Rate Baqi', 'Rates Pending', 'ریٹ باقی',
   'Jin ka rate abhi nahi mila', 'Products still without a rate', 'جن کا ریٹ ابھی نہیں ملا',
   '/admin/products/rates-baqi', 'CircleDollarSign', true, true)
on conflict (key) do update set
  route = excluded.route, icon = excluded.icon,
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  is_sensitive = excluded.is_sensitive, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.dashboard_key, 'products.rates_baqi', 20
from (select distinct dashboard_key from public.dashboard_features df
      join public.features f on f.key = df.feature_key
      where f.route = '/admin/products') d
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;
