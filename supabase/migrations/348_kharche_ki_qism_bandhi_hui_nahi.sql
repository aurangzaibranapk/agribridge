-- =====================================================================
-- AgriBridge — Migration 348: Kharche ki qism bandhi hui fehrist nahi
-- =====================================================================
-- Malik (6 September):
--
--   *"Expense kis kis cheez ka ho sakta hai wo bhi andar add kar dena,
--   aur agar koi us se alag expense ke andar add karna chahe to naam kar
--   sake."*
--
-- =====================================================================
-- JO CHEEZ RAASTE MEIN THI
-- =====================================================================
--
-- `company_expense_requests.category` par SAAT naamon ka taala laga hua
-- tha:
--
--   inventory_purchase, rent, salary, utility_bill, supplier_payment,
--   maintenance, other
--
-- Aur is se ek KHAMOSH kharabi pehle se chal rahi thi: safhe ki apni
-- fehrist (`bill-cash.ts`) mein `fuel`, `transport`, `tea_food`,
-- `stationery`, `cleaning` bhi maujood the -- jo is taale mein hain hi
-- nahi. Yani un mein se koi qism chun kar bill bhejne par qatar
-- database par ruk jati thi. Safha qism dikhata tha jo qubool hi nahi
-- hoti thi.
--
-- =====================================================================
-- BANDHI HUI FEHRIST HAMESHA "DEEGAR" MEIN JAA GIRTI HAI
-- =====================================================================
--
-- Aisi fehrist ka anjaam hamesha ek hi hota hai: banda "Deegar" chunta
-- hai aur asal baat tafseel mein likh deta hai -- "spray wala", "nehar
-- ki safai", "mazdoori". Phir koi report qism ke hisaab se jorr hi nahi
-- sakti, kyunke aadha mahina "Deegar" mein para hota hai.
--
-- Is liye taala uthaya nahi ja raha, BADLA ja raha hai: naam koi bhi ho
-- sakta hai, magar khali nahi ho sakta aur bohot lamba nahi ho sakta.
-- Wo cheez rok li gayi hai jo waqai nuqsan karti hai (khali qism, aur
-- poori tafseel ko qism bana dena), aur wo cheez khol di gayi hai jo
-- malik ne maangi.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Purana taala
-- ---------------------------------------------------------------------
alter table public.company_expense_requests
  drop constraint if exists company_expense_requests_category_check;


-- ---------------------------------------------------------------------
-- 2) Naya taala -- shakal par, fehrist par nahi
-- ---------------------------------------------------------------------
-- 60 harf ki hadd jaan boojh kar: us se lamba jo cheez likhi jati hai wo
-- qism nahi, tafseel hoti hai -- aur tafseel ka apna khana maujood hai.
alter table public.company_expense_requests
  drop constraint if exists chk_kharcha_qism_shakal;
alter table public.company_expense_requests
  add constraint chk_kharcha_qism_shakal check (
    category is not null
    and length(trim(category)) between 1 and 60
  );

comment on column public.company_expense_requests.category is
  'Kharche ki qism. Bandhi hui fehrist nahi -- malik apna naam bhi likh sakta hai (348). Naam chhote harf mein aur ek space par saaf kiya jata hai taake "Spray Wala" aur "spray wala" do qismein na banein.';


-- ---------------------------------------------------------------------
-- 3) Len-den ki qism pehchani hui honi chahiye
-- ---------------------------------------------------------------------
-- Ye wo fehrist hai jis par KHATON ka faisla hota hai (`lib/kharche.ts`).
-- Ye khuli nahi chhori ja sakti: anjaana `kind` aane par manzoori ke
-- waqt koi khata pehchana hi nahi jata, aur qatar chup chaap suspense
-- (9999) mein ja girti hai.
alter table public.company_expense_requests
  drop constraint if exists chk_kharcha_kind;
alter table public.company_expense_requests
  add constraint chk_kharcha_kind check (
    kind in (
      'kharcha',
      'supplier_ko_diya',
      'staff_ko_advance',
      'kisan_ko_advance',
      'customer_se_wasooli',
      'staff_se_wapas',
      'kisan_se_wapas',
      'aamdani'
    )
  );


-- ---------------------------------------------------------------------
-- 4) Bande ki qism bhi pehchani hui
-- ---------------------------------------------------------------------
alter table public.company_expense_requests
  drop constraint if exists chk_kharcha_party_qism;
alter table public.company_expense_requests
  add constraint chk_kharcha_party_qism check (
    party_type is null
    or party_type in ('supplier', 'staff', 'farmer', 'customer')
  );


-- ---------------------------------------------------------------------
-- 5) Har bande ka saara len-den -- chahe us ka balance na hila ho
-- ---------------------------------------------------------------------
-- Malik: *"agar koi farmer aa jata hai to wo already register hoga, us
-- ki id aani chahiye -- yahan gaya, us ke ledger mein bhi khaate mein
-- darj ho raha hoga."*
--
-- Purane statement wale function (jaise `fn_customer_ledger`) ek KHATE
-- par band hain -- customer ka 1100, kisan ka 1140. Wo theek hai, kyunki
-- unhen BAQI batana hota hai.
--
-- Magar malik ka sawal alag hai: "is bande ke sath aaj tak kya kya
-- hua". Us mein wo qatarein bhi aati hain jin se us ka baqi nahi hilta
-- -- jaise "spray wala 3000 le gaya". Wo ek kharcha hai (6xxx par), us
-- par udhaar nahi -- magar us bande ke naam se dhoondi ja sakni chahiye.
--
-- Is liye ye function KHATE se nahi, NAAM se dhoondta hai.
--
-- `SECURITY DEFINER` us wajah se jo CLAUDE.md mein likhi hai: RLS ke
-- peeche khali jawab ko "kuch nahi hua" samajh liya jata hai, jab ke
-- asal baat "dekhne ki ijazat nahi" hoti hai.
create or replace function public.fn_bande_ka_saara_lenden(
  p_party_type text,
  p_party_id   uuid,
  p_start      date default null,
  p_end        date default null
)
returns table (
  entry_date   date,
  entry_number text,
  tafseel      text,
  module       text,
  khata_code   text,
  khata_naam   text,
  debit        numeric,
  credit       numeric,
  baqi_par_asar boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.entry_date,
         e.entry_number,
         coalesce(l.memo, e.description) as tafseel,
         e.source_module,
         l.account_code,
         coalesce(a.name, l.account_code),
         coalesce(l.debit, 0),
         coalesce(l.credit, 0),
         -- Ye qatar us bande ke BAQI wale khate par hai ya nahi. Safha
         -- is se batata hai ke ye "udhaar" hai ya sirf record.
         l.account_code in ('1100','1120','1130','1140','1150','1160','2000','2005','2010','2020')
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
    left join gl_accounts a on a.code = l.account_code
   where fn_is_any_staff()
     and l.party_type = p_party_type
     and l.party_id = p_party_id
     and (p_start is null or e.entry_date >= p_start)
     and (p_end   is null or e.entry_date <= p_end)
   order by e.entry_date, e.entry_number;
$$;

comment on function public.fn_bande_ka_saara_lenden(text, uuid, date, date) is
  'Kisi bande ke naam par lagi HAR ledger qatar -- chahe us se us ka baqi na hila ho (jaise us ke haath gaya kharcha). Baqi ke liye khate wale function alag hain (348).';

revoke all on function public.fn_bande_ka_saara_lenden(text, uuid, date, date) from public;
grant execute on function public.fn_bande_ka_saara_lenden(text, uuid, date, date) to authenticated;
