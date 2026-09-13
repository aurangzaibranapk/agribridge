-- =====================================================================
-- AgriBridge — Migration 296: Cheez ki tasveer, aur wo kahan se aayi
-- =====================================================================
-- Malik ka kehna (5 September): jis cheez ki tasveer na ho, us ki
-- tasveer AI bana de -- magar do soorton ka farq rakh kar:
--
--   * Aam cheez (Basmati Chawal 1kg, cheeni, laal mirch) -- AI ki banayi
--     hui tasveer kaam ki hai.
--
--   * NAAM WALI CHEEZ (Surf Excel, Coca-Cola, Cadbury) -- AI ki banayi
--     hui dabbi ko asal tasveer keh dena JHOOT hai. Wo dabba waisa nahi
--     dikhta; us par likhi baat, us ka logo, us ka rang -- sab banaya
--     hua hota hai. Counter par banda wo tasveer dekh kar ghalat dabba
--     uthhata hai, aur gahak ko ghalat cheez chali jati hai.
--
-- Is liye do cheezein yahan darj hoti hain:
--
--   1. TASVEER KAHAN SE AAYI (image_source). Ye sirf record nahi -- isi
--      par ye rok khaRi hai ke AI ki tasveer kisi ASAL tasveer ki jagah
--      chup chaap na le le.
--
--   2. TASVEER PEHLE MASODA (draft) BANTI HAI. Banti AI se hai, LAGTI
--      aadmi ke dekhne ke baad hai. Teen sau tasveerein khud ba khud
--      chaRha dena wo kaam hai jo ek dafa ghalat ho jaye to teen sau
--      jagah ghalat hota hai.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tasveer kahan se aayi
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists image_source text
    check (image_source in ('uploaded','supplier','verified_catalog','ai_generated'));

comment on column public.products.image_source is
  'Tasveer ka source: uploaded / supplier / verified_catalog / ai_generated. AI wali tasveer kisi asal tasveer ki jagah nahi le sakti (296).';

-- Purani qatarein: jin par tasveer pehle se hai, wo kisi ne haath se
-- lagayi thi. Unhen 'uploaded' maan lena theek hai -- AI ka raasta aaj
-- se pehle tha hi nahi. Khali chhoR dena in ko "maloom nahi" ki fehrist
-- mein daal deta, aur wo baat sach nahi.
update public.products
   set image_source = 'uploaded'
 where image_url is not null and btrim(image_url) <> '' and image_source is null;

-- ---------------------------------------------------------------------
-- 2. Masoda tasveerein -- banti AI se, lagti aadmi ke dekhne ke baad
-- ---------------------------------------------------------------------
create table if not exists public.product_image_drafts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  -- Kya maanga gaya tha. Ye is liye rakha jata hai ke ghalat tasveer par
  -- sawal "AI ne ghalat banaya" nahi hota -- sawal ye hota hai ke us se
  -- maanga kya gaya tha.
  prompt text,
  model text,
  -- Naam wali cheez? Aisi cheez par AI ki tasveer sirf NISHAAN hoti hai,
  -- asal dabbe ki tasveer nahi -- aur safha ye baat likh kar batata hai.
  is_branded boolean not null default false,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  -- Jo tasveer is ne hataayi (agar koi thi). Bina is ke "pehle kya laga
  -- tha" ka jawab kabhi nahi milta.
  replaced_image_url text,
  note text
);

create index if not exists ix_img_draft_product on public.product_image_drafts (product_id, generated_at desc);
create index if not exists ix_img_draft_status on public.product_image_drafts (status) where status = 'draft';

alter table public.product_image_drafts enable row level security;

drop policy if exists img_draft_read on public.product_image_drafts;
create policy img_draft_read on public.product_image_drafts
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active
        and p.role::text in ('owner','super_admin','admin','manager','warehouse','procurement','sales_staff')
    )
  );

-- Likhna sirf server ke raaste (service client) se. Masoda banane aur
-- manzoor karne ka apna qanoon hai; browser se seedha qatar daalne par
-- wo qanoon guzar hi nahi hota.
revoke insert, update, delete on public.product_image_drafts from authenticated;

-- ---------------------------------------------------------------------
-- 3. Jin cheezon ki tasveer nahi
-- ---------------------------------------------------------------------
-- Safhe par "Tasveer baqi -- 300" isi se aata hai. Ginti ek hi jagah se
-- aati hai; do jagah ginne se do adad ban jate hain aur phir koi nahi
-- bata sakta ke sahi kaunsa hai.
create or replace view public.v_products_missing_image
with (security_invoker = on) as
select
  p.id            as product_id,
  p.name,
  p.pack_size,
  p.unit_code,
  p.brand_id,
  p.company_id,
  p.category_id,
  -- Naam wali cheez wo hai jis ka brand ya company darj hai. Aisi cheez
  -- par AI se asal dabbe ki tasveer nahi maangi jati.
  (p.brand_id is not null or p.company_id is not null) as is_branded,
  (
    select d.id from public.product_image_drafts d
     where d.product_id = p.id and d.status = 'draft'
     order by d.generated_at desc limit 1
  ) as open_draft_id
from public.products p
where coalesce(p.is_deleted, false) = false
  and (p.image_url is null or btrim(p.image_url) = '');

comment on view public.v_products_missing_image is
  'Jin cheezon ki tasveer nahi lagi, aur un par koi masoda khula hai ya nahi (296).';

notify pgrst, 'reload schema';
