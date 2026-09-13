-- =====================================================================
-- Migration 101: Milk Collection ka ek hi engine (teen raaste)
-- =====================================================================
-- Doodh teen tareeqon se aata hai: website, offline (baad mein sync),
-- aur WhatsApp. Aage chal kar Play Store wali app bhi. Teenon --
-- chauthi bhi -- yahi khana istemal karti hain. Alag alag table banate
-- to har report teen jagah se jorni parti, aur ek na ek din koi jagah
-- dekhna bhool jate.
--
-- Do bunyadi tabdeeliyan:
--
-- 1) FAT ab jama karne ke waqt nahi aata. MCA sirf litre, LR aur photo
--    bhejta hai; FAT chiller par lagta hai. Is liye rate aur raqam ab
--    khali reh sakti hain -- entry pehle "FAT ka intezar" mein rehti
--    hai, aur farmer ke khate mein tabhi jati hai jab FAT lag jaye.
--    Warna ghalat raqam khate mein chali jati aur baad mein wapas
--    nikalni parti, jo hamesha jhagre ki jarh banti hai.
--
-- 2) Har entry ka apna client_uuid hai, jo device par banta hai. Offline
--    mode mein ek hi entry kai dafa sync ho sakti hai (network toota,
--    dobara koshish ki). client_uuid par taala laga hua hai, is liye
--    dusri koshish khud-ba-khud nakaam ho jati hai -- entry do dafa
--    nahi banti.

-- ---- Rate aur raqam ab FAT ke baad aati hain ----
alter table milk_entries alter column rate_per_liter drop not null;
alter table milk_entries alter column total_amount drop not null;

alter table milk_entries
  add column if not exists collection_number text,
  add column if not exists client_uuid uuid,
  add column if not exists source text not null default 'website',
  add column if not exists mca_profile_id uuid references profiles(id),
  add column if not exists route_name text,
  add column if not exists chiller_name text,
  add column if not exists lr_image_path text,
  add column if not exists status text not null default 'pending_fat',
  add column if not exists ts_value numeric(6,2),
  add column if not exists collected_at timestamptz,
  add column if not exists synced_at timestamptz,
  add column if not exists fat_by_profile_id uuid references profiles(id),
  add column if not exists fat_at timestamptz,
  add column if not exists verified_by_profile_id uuid references profiles(id),
  add column if not exists verified_at timestamptz,
  add column if not exists verified_comment varchar(255),
  add column if not exists possible_duplicate_of uuid references milk_entries(id),
  add column if not exists flags jsonb not null default '[]'::jsonb;

comment on column milk_entries.client_uuid is
  'Device par bana nishan. Offline sync ki dobara koshish par entry do dafa banne se rokta hai.';
comment on column milk_entries.possible_duplicate_of is
  'Usi farmer, usi din, usi shift ki pehli entry -- roka nahi jata, sirf nishan lagta hai. Faisla manager ka.';

alter table milk_entries drop constraint if exists chk_milk_source;
alter table milk_entries add constraint chk_milk_source
  check (source in ('website', 'offline', 'whatsapp', 'app'));

alter table milk_entries drop constraint if exists chk_milk_status;
alter table milk_entries add constraint chk_milk_status
  check (status in ('pending_fat', 'priced', 'verified', 'rejected'));

-- ===== HARD RULE 1 =====
-- Raqam wali halat mein FAT, rate aur raqam teenon maujood hone chahiyen.
-- Ye rok database mein hai, sirf code mein nahi -- taake koi bhi raasta
-- (naya code, seedhi SQL, koi aur tool) adhoori entry ko paise wali
-- halat mein na le ja sake.
alter table milk_entries drop constraint if exists chk_milk_priced_complete;
alter table milk_entries add constraint chk_milk_priced_complete check (
  status = 'pending_fat'
  or status = 'rejected'
  or (fat_percentage is not null and rate_per_liter is not null and total_amount is not null)
);

-- ===== HARD RULE 2 =====
-- Manager ki tasdeeq bagair wajah likhe nahi hoti.
alter table milk_entries drop constraint if exists chk_milk_verify_comment;
alter table milk_entries add constraint chk_milk_verify_comment check (
  status <> 'verified'
  or (
    verified_by_profile_id is not null
    and verified_comment is not null
    and length(btrim(verified_comment)) >= 5
  )
);

create unique index if not exists idx_milk_entries_client_uuid
  on milk_entries(client_uuid) where client_uuid is not null;
create unique index if not exists idx_milk_entries_collection_number
  on milk_entries(collection_number) where collection_number is not null;
create index if not exists idx_milk_entries_status on milk_entries(status);
create index if not exists idx_milk_entries_mca on milk_entries(mca_profile_id);
create index if not exists idx_milk_entries_date_shift on milk_entries(entry_date, shift);

create table if not exists milk_collection_counters (
  year int primary key,
  last_number int not null default 0
);

alter table milk_collection_counters enable row level security;
drop policy if exists staff_manage_milk_counters on milk_collection_counters;
create policy staff_manage_milk_counters on milk_collection_counters
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

-- ---- MCA ka route aur chiller ----
-- MCA WhatsApp par sirf farmer ka number likhta hai; route aur chiller
-- kabhi nahi likhta. Wo yahan se aate hain.
alter table staff_details
  add column if not exists milk_route_name text,
  add column if not exists milk_chiller_name text;

-- ---- LR ki photo ----
-- Ye saboot hai (bill jaisa), is liye bucket jaan boojh kar PRIVATE hai.
insert into storage.buckets (id, name, public, file_size_limit)
values ('milk-lr', 'milk-lr', false, 10485760)
on conflict (id) do nothing;

-- ---- Wallet mein doodh ki aamdani ka khana ----
-- Purana code 'milk_income' likhta tha magar ye qism enum mein thi hi
-- nahi -- yani wo insert hamesha nakaam hota. Pakra is liye nahi gaya
-- ke ab tak ek bhi milk entry bani hi nahi thi.
alter type wallet_transaction_type add value if not exists 'milk_income';
alter type wallet_transaction_type add value if not exists 'milk_payment';
