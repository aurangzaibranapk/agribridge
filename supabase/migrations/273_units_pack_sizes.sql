-- =====================================================================
-- AgriBridge — Migration 273: Units aur Pack Sizes ke masters (malik ki priority 2)
-- =====================================================================
-- Ab tak unit ek text tha (products.unit) jis mein "Bags (bags)", "bag",
-- "bottle" sab alag alag likhe the -- 238 products par khali. Bill par
-- "5 LTR", "5-liter", "bori", "peti" aata hai aur matching ko ye lafz
-- nahi milte.
--
-- Do masters:
--   units       -- code (kg, ltr, bags...), label, qisam, base + factor,
--                  aur ALIASES (bori -> bags, dabba -> box, litre -> ltr)
--   pack_sizes  -- "5L", "20kg", "500ml"... apne aliases ke sath
--                  ("5 ltr", "5-liter", "panch litre")
--
-- products.unit_code (units par FK) naya; purana products.unit text
-- waise hi rehta hai (display aur purane safhon ke liye) -- form ab
-- dono likhta hai. Backfill: jo text pehle se hai us se code nikala.
--
-- Matching (product-match.ts) ye aliases DB se le kar naam ko pehle
-- saaf karta hai, phir score -- bill aur sheet dono jagah.
-- =====================================================================

create table if not exists units (
  code text primary key,
  label text not null,
  label_en text,
  kind text not null default 'count',
  base_code text references units(code),
  factor numeric,
  aliases text[] not null default '{}',
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_units_kind check (kind in ('count', 'weight', 'volume', 'length', 'time', 'other')),
  constraint chk_units_code check (code = lower(code) and code ~ '^[a-z0-9_]+$')
);
comment on table units is 'Ikai ka master (273): code, label, qisam, base + factor, aliases (bori -> bags). products.unit_code yahan aata hai.';

create table if not exists pack_sizes (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  unit_code text references units(code),
  quantity numeric,
  aliases text[] not null default '{}',
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table pack_sizes is 'Pack size ka master (273): 5L, 20kg, 500ml... aliases ke sath -- bill/sheet ki matching saaf hoti hai.';

alter table products add column if not exists unit_code text references units(code);
create index if not exists idx_products_unit_code on products (unit_code);

-- ---------------------------------------------------------------------
-- Seed: wahi 28 jo code mein the (PRODUCT_UNITS), aur Roman Urdu aliases
-- ---------------------------------------------------------------------
insert into units (code, label, label_en, kind, base_code, factor, aliases, sort_order) values
  ('pcs',  'Pieces (pcs)',    'Pieces',    'count',  null,  null,     array['pc','piece','pieces','adad','nag','unit','units'], 10),
  ('bags', 'Bags (bags)',     'Bags',      'count',  null,  null,     array['bag','bori','boree','thaila','sack','sacks'], 20),
  ('bdl',  'Bundle (bdl)',    'Bundle',    'count',  null,  null,     array['bundle','bundles','gattha'], 30),
  ('kg',   'Kilogram (kg)',   'Kilogram',  'weight', 'kg',  1,        array['kgs','kilo','kilos','kilogram','kilograms','kilogramme'], 40),
  ('gm',   'Gram (gm)',       'Gram',      'weight', 'kg',  0.001,    array['g','gms','gram','grams','gramme'], 50),
  ('mg',   'Milligram (mg)',  'Milligram', 'weight', 'kg',  0.000001, array['milligram','milligrams'], 60),
  ('ltr',  'Litre (ltr)',     'Litre',     'volume', 'ltr', 1,        array['l','lt','lts','litre','litres','liter','liters','ltrs'], 70),
  ('ml',   'Millilitre (ml)', 'Millilitre','volume', 'ltr', 0.001,    array['millilitre','milliliter','mls'], 75),
  ('m',    'Meter (m)',       'Meter',     'length', 'm',   1,        array['meter','meters','metre','metres','mtr'], 80),
  ('tola', 'Tola (tola)',     'Tola',      'weight', 'kg',  0.011664, array['tolay'], 90),
  ('ft',   'Foot (ft)',       'Foot',      'length', 'm',   0.3048,   array['foot','feet','fut'], 100),
  ('box',  'Box (box)',       'Box',       'count',  null,  null,     array['boxes','dabba','dabbay','dibba'], 110),
  ('pkt',  'Packet (pkt)',    'Packet',    'count',  null,  null,     array['packet','packets','pack','packs','pouch','sachet'], 120),
  ('ctn',  'Carton (ctn)',    'Carton',    'count',  null,  null,     array['carton','cartons','peti','gatta','case'], 130),
  ('dzn',  'Dozen (dzn)',     'Dozen',     'count',  'pcs', 12,       array['dozen','darjan','doz'], 140),
  ('rim',  'Rim (rim)',       'Ream',      'count',  null,  null,     array['ream','reams'], 150),
  ('btl',  'Bottles (btl)',   'Bottles',   'count',  null,  null,     array['bottle','bottles','botal','shishi'], 160),
  ('lbs',  'Pound (lbs)',     'Pound',     'weight', 'kg',  0.453592, array['lb','pound','pounds'], 170),
  ('roll', 'Roll (roll)',     'Roll',      'count',  null,  null,     array['rolls'], 180),
  ('gln',  'Gallon (gln)',    'Gallon',    'volume', 'ltr', 3.78541,  array['gallon','gallons','gal'], 190),
  ('qtr',  'Quarter (qtr)',   'Quarter',   'other',  null,  null,     array['quarter'], 200),
  ('can',  'Can (can)',       'Can',       'count',  null,  null,     array['cans','tin','tins','dibbi'], 210),
  ('than', 'Than (than)',     'Than',      'count',  null,  null,     array['thaan'], 220),
  ('mann', 'Mann (mann)',     'Maund',     'weight', 'kg',  40,       array['maund','mun','man'], 230),
  ('ton',  'Ton (ton)',       'Ton',       'weight', 'kg',  1000,     array['tonne','tons','tonnes'], 240),
  ('crt',  'Crate (crt)',     'Crate',     'count',  null,  null,     array['crate','crates'], 250),
  ('yd',   'Yards (yd)',      'Yards',     'length', 'm',   0.9144,   array['yard','yards','gaz'], 260),
  ('hrs',  'Hours (hrs)',     'Hours',     'time',   null,  null,     array['hour','hours','ghanta','ghantay'], 270),
  ('qtl',  'Quintal (qtl)',   'Quintal',   'weight', 'kg',  100,      array['quintal','quintals'], 280)
on conflict (code) do nothing;

insert into pack_sizes (label, unit_code, quantity, aliases, sort_order) values
  ('100ml', 'ml',  100,  array['100 ml'], 10),
  ('250ml', 'ml',  250,  array['250 ml','pao litre'], 20),
  ('500ml', 'ml',  500,  array['500 ml','half litre','adha litre','1/2 ltr','half ltr'], 30),
  ('1L',    'ltr', 1,    array['1 ltr','1ltr','1 litre','1 liter','1-liter','1 l','one litre','ek litre'], 40),
  ('5L',    'ltr', 5,    array['5 ltr','5ltr','5 litre','5 liter','5-liter','5 l','panch litre'], 50),
  ('10L',   'ltr', 10,   array['10 ltr','10ltr','10 litre','10 liter','10 l','das litre'], 60),
  ('20L',   'ltr', 20,   array['20 ltr','20ltr','20 litre','20 liter','20 l','bees litre'], 70),
  ('100g',  'gm',  100,  array['100 gm','100gm','100 g'], 80),
  ('250g',  'gm',  250,  array['250 gm','250gm','250 g','pao'], 90),
  ('500g',  'gm',  500,  array['500 gm','500gm','500 g','half kg','adha kilo','1/2 kg'], 100),
  ('1kg',   'kg',  1,    array['1 kg','1 kilo','ek kilo','1kilo'], 110),
  ('5kg',   'kg',  5,    array['5 kg','5 kilo','panch kilo'], 120),
  ('10kg',  'kg',  10,   array['10 kg','10 kilo','das kilo'], 130),
  ('20kg',  'kg',  20,   array['20 kg','20 kilo','bees kilo','half bag'], 140),
  ('25kg',  'kg',  25,   array['25 kg','25 kilo'], 150),
  ('50kg',  'kg',  50,   array['50 kg','50 kilo','pachas kilo','1 bag','ek bori'], 160)
on conflict (label) do nothing;

-- ---------------------------------------------------------------------
-- Text se unit ka code (backfill aur import dono ke liye)
-- ---------------------------------------------------------------------
create or replace function fn_unit_code_for_text(p_text text)
returns text language sql stable as $$
  with q as (select lower(trim(coalesce(p_text, ''))) as t)
  select u.code
    from units u, q
   where q.t <> ''
     and (u.code = q.t or lower(u.label) = q.t or lower(coalesce(u.label_en, '')) = q.t
          or q.t = any (u.aliases)
          or lower(u.label) like '%(' || q.t || ')')
   order by u.sort_order
   limit 1;
$$;

update products p
   set unit_code = fn_unit_code_for_text(p.unit)
 where p.unit_code is null and p.unit is not null and trim(p.unit) <> '';

do $$
declare n int;
begin
  select count(*) into n from products where unit is not null and trim(unit) <> '' and unit_code is null;
  raise notice 'Products jin ka unit text se code nahi bana: % (in ka unit haath se chunna hoga)', n;
end $$;

-- ---------------------------------------------------------------------
-- RLS: parhna sab (products public hain), likhna staff
-- ---------------------------------------------------------------------
alter table units enable row level security;
alter table pack_sizes enable row level security;
drop policy if exists units_read on units;
create policy units_read on units for select using (true);
drop policy if exists units_write on units;
create policy units_write on units for all to authenticated using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
drop policy if exists pack_sizes_read on pack_sizes;
create policy pack_sizes_read on pack_sizes for select using (true);
drop policy if exists pack_sizes_write on pack_sizes;
create policy pack_sizes_write on pack_sizes for all to authenticated using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

-- ---------------------------------------------------------------------
-- Help: Product Masters mein do naye tab
-- ---------------------------------------------------------------------
update feature_help
   set purpose = 'Qismein, brand, companies, ikaiyan (units) aur pack sizes — products ko tarteeb dene ke khane. Units aur pack sizes ke aliases (bori = bag, 5 ltr = 5L) bill aur sheet ki matching saaf karte hain.',
       how_steps = array['Tab chunein: Categories | Brands | Companies | Units | Pack Sizes.', 'Naam likh kar banayein.', 'Units/Pack Sizes par aliases likhein: jo lafz bill ya sheet par aate hain (bori, peti, 5 ltr) -- comma se alag.', 'Product form mein unit ab isi fehrist se chunta hai; pack size mein standard sizes ka sujhaav aata hai.'],
       updated_at = now()
 where feature_key = 'product-masters' and lang = 'rm';
update feature_help
   set purpose = 'Categories, brands, companies, units and pack sizes — the boxes products are sorted into. Unit and pack-size aliases (bori = bag, 5 ltr = 5L) make bill and sheet matching cleaner.',
       how_steps = array['Pick a tab: Categories | Brands | Companies | Units | Pack Sizes.', 'Type a name and add.', 'On Units / Pack Sizes add aliases: the words that appear on bills and sheets (bori, peti, 5 ltr), comma-separated.', 'The product form now picks the unit from this list; pack size suggests the standard sizes.'],
       updated_at = now()
 where feature_key = 'product-masters' and lang = 'en';
