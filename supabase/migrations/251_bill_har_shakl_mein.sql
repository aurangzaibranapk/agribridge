-- =====================================================================
-- AgriBridge — Migration 251: Bill har shakl mein aata hai
-- =====================================================================
-- Migration 248 ne ye maan liya tha ke bill ek saaf tasveer ki shakl
-- mein aayega. Asal mein aisa nahi hota:
--
--   * Supplier ka bill aksar PDF mein aata hai, tasveer mein nahi.
--   * Ek bill do ya teen safhon ka hota hai.
--   * Kabhi bill hota hi nahi -- rate ki ek sheet aati hai.
--
-- Teenon soorton mein sawal wohi hai: kaun si cheez, kis rate par. Is
-- liye milaan aur manzoori ka poora nizam waise ka waisa rehta hai --
-- sirf rate ke aane ka raasta khulta hai.
--
-- ---------------------------------------------------------------------
-- File ki apni qatar kyun banti hai
-- ---------------------------------------------------------------------
-- Ek khana (image_url) mein kai file nahi samati. Aur agar teen safhon
-- mein se doosra safha dhundla ho, to sawal banta hai "kaun sa safha
-- parha nahi gaya" -- us ka jawab tabhi milta hai jab har file ka apna
-- indraj ho.
--
-- ---------------------------------------------------------------------
-- Sheet wale bill ki koi tasveer nahi hoti
-- ---------------------------------------------------------------------
-- Is liye image_url ab lazmi nahi raha. Magar khali chhoR dena kaafi
-- nahi: `source` batata hai ke ye rate aaye kahan se -- tasveer se, PDF
-- se, ya sheet se. Baad mein "ye rate kis bunyad par charha tha" ka
-- jawab isi se milta hai, aur teenon par bharosa ek jaisa nahi hota.
-- =====================================================================

alter table supplier_bill_reads
  alter column image_url drop not null;

alter table supplier_bill_reads
  add column if not exists source text not null default 'photo';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_bill_read_source') then
    alter table supplier_bill_reads
      add constraint chk_bill_read_source
      check (source in ('photo', 'pdf', 'sheet', 'mixed'));
  end if;
end;
$$;

comment on column supplier_bill_reads.source is
  'Rate aaya kahan se: photo / pdf / sheet / mixed. Teenon par bharosa ek jaisa nahi hota (251).';

-- ---------------------------------------------------------------------
-- Ek bill ki saari file
-- ---------------------------------------------------------------------
create table if not exists supplier_bill_files (
  id uuid primary key default uuid_generate_v4(),
  bill_read_id uuid not null references supplier_bill_reads(id) on delete cascade,

  file_url text not null,
  mime_type text,
  -- Bill par ka safha number nahi -- hamare charhane ki tarteeb. Bill
  -- par apna number ho bhi sakta hai aur nahi bhi.
  page_no integer not null default 1,

  ai_read_at timestamptz,
  -- Ye file parhi nahi ja saki to wajah yahan likhi jati hai. Khamoshi
  -- se chhoR dene par banda samajhta hai ke poora bill parh liya gaya.
  problem text,
  lines_found integer,

  created_at timestamptz not null default now()
);

create index if not exists idx_bill_files_read
  on supplier_bill_files (bill_read_id, page_no);

comment on table supplier_bill_files is
  'Ek bill ki saari file -- tasveerein aur PDF. Har ek ka apna indraj, taake "kaun sa safha parha nahi gaya" ka jawab mile (251).';

-- ---------------------------------------------------------------------
-- Qatar kis safhe se aayi
-- ---------------------------------------------------------------------
alter table supplier_bill_lines
  add column if not exists page_no integer;

comment on column supplier_bill_lines.page_no is
  'Ye qatar kis file/safhe se nikli (251). Sheet se aayi ho to khali.';

-- Purane bill (248 wale) ki tasveer ko bhi qatar mein le aayein, taake
-- aage ek hi raasta rahe.
insert into supplier_bill_files (bill_read_id, file_url, mime_type, page_no, ai_read_at)
select r.id, r.image_url, 'image/jpeg', 1, r.ai_read_at
from supplier_bill_reads r
where r.image_url is not null
  and not exists (select 1 from supplier_bill_files f where f.bill_read_id = r.id);

-- ---------------------------------------------------------------------
-- RLS -- wohi qanoon jo 248 mein tha
-- ---------------------------------------------------------------------
alter table supplier_bill_files enable row level security;

drop policy if exists billfile_read on public.supplier_bill_files;
create policy billfile_read on public.supplier_bill_files
  for select to authenticated using (public.fn_is_any_staff());

drop policy if exists billfile_write on public.supplier_bill_files;
create policy billfile_write on public.supplier_bill_files
  for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('owner','super_admin','admin','warehouse')))
  with check (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('owner','super_admin','admin','warehouse')));

-- ---------------------------------------------------------------------
-- Fehrist mein source bhi
-- ---------------------------------------------------------------------
-- Khanon ki tarteeb badal rahi hai, is liye replace kaafi nahi.
drop view if exists v_bill_lines_baqi;
create view v_bill_lines_baqi as
select
  l.id,
  l.bill_read_id,
  r.bill_number,
  r.bill_date,
  r.source,
  r.supplier_name_raw,
  s.name as supplier_name,
  l.line_no,
  l.page_no,
  l.raw_text,
  l.item_name,
  l.pack_size,
  l.qty,
  l.rate,
  l.product_id,
  l.match_source,
  l.status,
  l.problem
from supplier_bill_lines l
join supplier_bill_reads r on r.id = l.bill_read_id
left join suppliers s on s.id = r.supplier_id
where l.status in ('draft', 'ready')
  and r.status = 'draft';
