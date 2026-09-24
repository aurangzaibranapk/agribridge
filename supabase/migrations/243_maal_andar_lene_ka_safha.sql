-- =====================================================================
-- AgriBridge — Migration 243: Maal andar lene ka safha (product intake)
-- =====================================================================
-- Bohot si tasveerein ek sath charhti hain, AI un ke khane bharti hai,
-- banda saamne baith kar sab dekh leta hai, aur phir sab ek sath
-- manzoor hote hain. Manzoori ke baad hi products bante hain aur maal
-- MAIN warehouse mein aata hai; wahan se dukanon par stock transfer se
-- jata hai (wo nizam pehle se hai).
--
-- ---------------------------------------------------------------------
-- Ye kaam database mein kyun rakha ja raha hai, browser mein kyun nahi
-- ---------------------------------------------------------------------
-- Aasan raasta ye tha ke tasveerein charhein, AI parhe, aur sab kuch
-- safhe par para rahe jab tak banda "manzoor" na dabaye. Us raaste mein
-- pachaas tasveeron ki mehnat ek safha band hone se khatam ho jati hai
-- -- aur wo safha bijli jane par bhi band hota hai.
--
-- Is liye har tasveer ka kaam ek qatar hai. Banda aaj bees dekhe, kal
-- baqi tees -- kuch nahi jata.
--
-- ---------------------------------------------------------------------
-- Barcode: kahan se aaya, ye adad se ZYADA ahem hai
-- ---------------------------------------------------------------------
-- Barcode teen tarah aa sakta hai:
--   scanner -- barcode ki LAKEEREIN parhi gayin. Ye theek hota hai.
--   ai      -- AI ne tasveer mein likhe adad parhe. Ek adad ghalat ho
--              sakta hai, aur us ka pata dukan par chalta hai jab scan
--              karne par doosra product nikalta hai.
--   manual  -- bande ne khud likha.
--
-- Is liye adad ke sath ye bhi mehfooz hota hai ke wo KAHAN SE aaya, aur
-- EAN-13 ka check digit theek tha ya nahi. Bina is ke ek ghalat barcode
-- aur ek sahi barcode bilkul ek jaise dikhte hain.
--
-- ---------------------------------------------------------------------
-- ai_raw: AI ne kya kaha tha
-- ---------------------------------------------------------------------
-- Jo AI ne kaha wo jyun ka tyun mehfooz rehta hai, chahe banda usay
-- badal de. Wajah: baad mein ye sawal banta hai ke "ye ghalat qeemat
-- AI ne bhari thi ya kisi ne haath se likhi thi" -- aur bina is khane
-- ke us ka koi jawab nahi hota.
-- =====================================================================

create table if not exists product_intake_batches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  warehouse_id uuid references warehouses(id),
  status text not null default 'draft',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references profiles(id),

  constraint chk_intake_batch_status
    check (status in ('draft', 'approved', 'discarded')),
  constraint chk_intake_batch_name check (length(btrim(name)) >= 2),
  constraint chk_intake_batch_approved
    check (status <> 'approved' or (approved_at is not null and approved_by is not null))
);

create index if not exists idx_intake_batches_status
  on product_intake_batches (status, created_at desc);

create table if not exists product_intake_items (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references product_intake_batches(id) on delete cascade,

  image_url text,
  barcode_image_url text,

  barcode text,
  barcode_source text,
  barcode_verified boolean,

  name text,
  brand_name text,
  company_name text,
  category_name text,
  pack_size text,
  unit text,
  manufacture_date date,
  expiry_date date,

  mrp_price numeric(12,2),
  selling_price numeric(12,2),
  purchase_price numeric(12,2),
  opening_qty numeric(14,3) not null default 0,

  ai_raw jsonb,
  ai_read_at timestamptz,

  status text not null default 'draft',
  problem text,
  product_id uuid references products(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_intake_item_status
    check (status in ('draft', 'ready', 'approved', 'skipped')),
  constraint chk_intake_barcode_source
    check (barcode_source is null or barcode_source in ('scanner', 'ai', 'manual')),
  -- Barcode ho to us ka source bhi hona chahiye. Bina source ke adad
  -- ye nahi bata sakta ke us par bharosa kitna hai.
  constraint chk_intake_barcode_has_source
    check (barcode is null or barcode_source is not null),
  constraint chk_intake_qty check (opening_qty >= 0),
  -- Manzoor shuda qatar ka product bana hua hona chahiye.
  constraint chk_intake_approved_has_product
    check (status <> 'approved' or product_id is not null),
  -- "Ready" ka matlab hai ke ye charhne layak hai -- naam aur sale rate
  -- ke baghair wo dawa jhooti hai.
  constraint chk_intake_ready_needs_basics
    check (
      status <> 'ready'
      or (length(btrim(coalesce(name, ''))) >= 2 and selling_price is not null)
    ),
  constraint chk_intake_dates
    check (expiry_date is null or manufacture_date is null or expiry_date >= manufacture_date)
);

create index if not exists idx_intake_items_batch
  on product_intake_items (batch_id, created_at);
create index if not exists idx_intake_items_status
  on product_intake_items (batch_id, status);

-- Ek hi batch mein ek barcode do dafa nahi. Warna ek hi product do
-- qataron mein ban kar stock do jagah baat deta hai.
create unique index if not exists idx_intake_barcode_once
  on product_intake_items (batch_id, barcode)
  where barcode is not null and status <> 'skipped';

create or replace function fn_intake_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_intake_touch on product_intake_items;
create trigger trg_intake_touch
  before update on product_intake_items
  for each row execute function fn_intake_touch();

-- ---------------------------------------------------------------------
-- RLS -- Owner/Admin/warehouse ka kaam
-- ---------------------------------------------------------------------
alter table product_intake_batches enable row level security;
alter table product_intake_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['product_intake_batches', 'product_intake_items'] loop
    execute format('drop policy if exists intake_read_%s on public.%I', t, t);
    execute format(
      'create policy intake_read_%s on public.%I for select to authenticated using (public.fn_is_any_staff())', t, t);

    execute format('drop policy if exists intake_write_%s on public.%I', t, t);
    execute format($p$
      create policy intake_write_%s on public.%I for all to authenticated
      using (exists (select 1 from public.profiles p
                     where p.id = auth.uid() and p.is_active
                       and p.role::text in ('owner','super_admin','admin','warehouse')))
      with check (exists (select 1 from public.profiles p
                     where p.id = auth.uid() and p.is_active
                       and p.role::text in ('owner','super_admin','admin','warehouse')))
    $p$, t, t);
  end loop;
end;
$$;

comment on table product_intake_batches is
  'Maal andar lene ka ek chakkar: tasveerein, AI ka parha hua, aur ek sath manzoori (243).';
comment on column product_intake_items.barcode_source is
  'scanner = lakeerein parhi gayin (theek). ai = tasveer se adad parhe (jaanch lein). manual = haath se likha (243).';
comment on column product_intake_items.ai_raw is
  'AI ne jo kaha tha, jyun ka tyun -- chahe banda badal de. Baad mein "ye ghalat adad kahan se aaya" ka jawab isi se milta hai (243).';
