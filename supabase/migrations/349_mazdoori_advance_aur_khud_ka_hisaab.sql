-- =====================================================================
-- AgriBridge — Migration 349: Mazdoori, advance, aur khud-ba-khud hisaab
-- =====================================================================
-- Malik (6 September), poora naqsha dete hue:
--
--   *"Farmer ID #125 — Muhammad Aslam aap ki dukaan par mazdoori karta
--   hai... agar us ne pehle Rs 3,000 advance liye aur agle din Rs 2,000
--   ki mazdoori ki: Labour Earned 2,000, Advance Adjusted 2,000, Advance
--   remaining 1,000... Yehi automatic settlement chahiye."*
--
-- Aur us se bhi ahem baat:
--
--   *"Advance diya lekin kaam abhi nahi hua — us ko turant Labour
--   Expense banana accounting-wise ghalat hoga. Wo pehle Labour/Worker
--   Advance (Recoverable/Asset) rahega."*
--
-- Wo bilkul theek keh rahe hain, aur ye farq is poore module ki jar hai.
--
-- =====================================================================
-- TEEN NAYE KHATE -- AUR TEENON ZAROORI HAIN
-- =====================================================================
--
--   1145  Mazdoor ko advance (wapas lena hai)     -- ASSET
--   2015  Mazdoori dena                            -- LIABILITY
--   6015  Mazdoori                                 -- EXPENSE
--
-- Sawal ye uthta hai ke 1140 (Farmer ko advance) aur 2010 (Farmer ko
-- dena) pehle se maujood hain -- naye khaton ki kya zaroorat?
--
-- Zaroorat isi liye hai ke wo DOOSRE sawal ke khate hain. 1140 fasal ki
-- peshgi hai: us ke badle maal aana hai. 1145 mazdoori ka advance hai:
-- us ke badle KAAM aana hai. Ek hi bande par dono ho sakte hain, aur
-- unhen ek khate mein rakh dene se koi report ye nahi bata sakti ke
-- "is bande ki kitni mazdoori baqi hai" -- jo malik ka rozana ka sawal
-- hai.
--
-- Aur khud-ba-khud adjust karne ke liye ye alag hona LAZMI hai: agar
-- dono ek khate mein hon to nayi mazdoori kisan ki fasal wali peshgi ko
-- bhi kha jayegi -- chup chaap, aur kisi ko pata bhi na chalega.
--
-- =====================================================================
-- CHUP CHAAP SET-OFF NAHI
-- =====================================================================
--
-- Malik: *"System silently balance overwrite na kare... Farmer se Lena
-- 10,000, Farmer ko Dena 3,000, Net Exposure 7,000 Lena. Phir authorized
-- settlement... Is adjustment ka proper journal + audit trail hoga.
-- Silent set-off bilkul nahi."*
--
-- Is liye yahan sirf WOHI adjust hota hai jo ek hi sawal ka hai:
-- mazdoori ka advance (1145) mazdoori ke against. Khaad ka udhaar
-- (1150) mazdoori ke dene (2015) se KHUD nahi katta -- us ke liye alag,
-- manzoor shuda qadam hai (`party_settlements`).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Naye khate
-- ---------------------------------------------------------------------
insert into public.gl_accounts (code, name, account_type, normal_side, is_active, sort_order)
values
  ('1145', 'Mazdoor ko advance (kaam abhi nahi hua)', 'asset',     'debit',  true, 145),
  ('2015', 'Mazdoori dena',                            'liability', 'credit', true, 215),
  ('6015', 'Mazdoori',                                 'expense',   'debit',  true, 615)
on conflict (code) do update set
  name = excluded.name, is_active = true;


-- ---------------------------------------------------------------------
-- 2) Mazdoori ki qatar
-- ---------------------------------------------------------------------
create table if not exists public.labour_work_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number text unique not null,

  -- Banda -- ek hi ID, chahe wo kisan bhi ho aur mazdoor bhi.
  party_type text not null check (party_type in ('farmer', 'staff', 'customer', 'supplier')),
  party_id   uuid not null,

  work_date   date not null default current_date,
  work_detail text not null,

  -- Ginti aur rate alag rakhe gaye hain, sirf raqam nahi.
  --
  -- Malik ka misaal: *"Qty: 100 bags, Rate: Rs 20/bag, Mazdoori: Rs
  -- 2,000."* Sirf 2,000 likh dene se agle mahine ye sawal jawab nahi
  -- paata ke "bori ka rate kya chal raha hai" -- aur wohi sawal rate
  -- barhne par poochha jata hai.
  quantity numeric(14,3),
  unit     text,
  rate     numeric(14,2),
  amount   numeric(14,2) not null check (amount > 0),

  -- Us waqt ka hisaab -- qatar par hi mehfooz, taake baad mein dobara
  -- lagana na pare aur adad badla hua na lage.
  advance_adjusted numeric(14,2) not null default 0 check (advance_adjusted >= 0),
  payable_added    numeric(14,2) not null default 0 check (payable_added >= 0),

  -- Paisa ya saman lene wala -- aur us ka NAYA khata nahi banta.
  --
  -- Malik (6 September): *"Agar us ka beta, beti, biwi ya koi aur banda
  -- paisa/saman lene aaye, naya ledger nahi banega. Received By mein us
  -- ka naam/relationship/note save hoga."*
  --
  -- Ye theek hai aur zaroori bhi: khata us bande ka hai jis ka kaam hai.
  -- Lene wale ka apna khata bana dena ek hi bande ke do khate bana deta
  -- hai, aur phir dono kabhi milte nahi.
  received_by_name text,
  received_by_note text,

  branch_id uuid references public.branches(id),
  shop_id   uuid references public.shops(id),

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,

  journal_entry_id uuid references public.journal_entries(id),

  created_by  uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at  timestamptz not null default now(),

  -- Adjust + payable hamesha poori raqam banate hain. Ye jorr yahin
  -- rok liya jata hai: agar kabhi code mein hisaab bigra to qatar
  -- database par rukegi, kitab mein aadhi ja kar nahi.
  constraint chk_mazdoori_jor check (advance_adjusted + payable_added = amount)
);

comment on table public.labour_work_entries is
  'Kis ne ART ke liye kaam kiya, kitna bana, aur us mein se kitna purane advance mein se adjust hua (349).';

create index if not exists idx_mazdoori_banda on public.labour_work_entries (party_type, party_id, work_date);
create index if not exists idx_mazdoori_halat on public.labour_work_entries (status, work_date);

alter table public.labour_work_entries enable row level security;

drop policy if exists mazdoori_staff_parh_sakta on public.labour_work_entries;
create policy mazdoori_staff_parh_sakta on public.labour_work_entries
  for select using (fn_is_any_staff());


-- ---------------------------------------------------------------------
-- 3) Manzoori ke baad taala
-- ---------------------------------------------------------------------
-- Wohi usool jo har posted qatar par hai: manzoori ke baad raqam badalna
-- kitab ko chup chaap ghalat kar deta hai.
create or replace function public.fn_mazdoori_manzoor_ke_baad_taala()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' then
    if new.amount is distinct from old.amount
       or new.party_id is distinct from old.party_id
       or new.party_type is distinct from old.party_type
       or new.work_date is distinct from old.work_date
       or new.advance_adjusted is distinct from old.advance_adjusted
       or new.payable_added is distinct from old.payable_added then
      raise exception 'Ye mazdoori manzoor ho kar kitab mein ja chuki hai. Ab badli nahi ja sakti — ulti qatar banayein.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mazdoori_taala on public.labour_work_entries;
create trigger trg_mazdoori_taala
  before update on public.labour_work_entries
  for each row execute function public.fn_mazdoori_manzoor_ke_baad_taala();


-- ---------------------------------------------------------------------
-- 4) Is bande ki mazdoori ka haal
-- ---------------------------------------------------------------------
-- Do adad, aur dono ledger se -- kisi alag khane se nahi. Wajah wohi jo
-- 127 ne sikhayi thi: jo adad do jagah rakha jaye, wo ek din do alag
-- jawab dene lagta hai.
--
-- `SECURITY DEFINER` is liye ke RLS ke peeche khali jawab ko "kuch nahi
-- hua" samajh liya jata hai, jab ke asal baat "dekhne ki ijazat nahi"
-- hoti hai. Ye ghalti is project mein teen dafa ghalat adad de chuki
-- hai.
create or replace function public.fn_mazdoori_haal(
  p_party_type text,
  p_party_id   uuid
)
returns table (
  advance_baqi numeric,   -- 1145 -- is se hamein wapas lena hai (kaam ya paisa)
  dena_baqi    numeric    -- 2015 -- is ko hamein dena hai
)
language sql
stable
security definer
set search_path = public
as $$
  select
    greatest(coalesce(sum(case when l.account_code = '1145'
                               then coalesce(l.debit,0) - coalesce(l.credit,0) end), 0), 0),
    greatest(coalesce(sum(case when l.account_code = '2015'
                               then coalesce(l.credit,0) - coalesce(l.debit,0) end), 0), 0)
    from journal_lines l
   where fn_is_any_staff()
     and l.party_type = p_party_type
     and l.party_id = p_party_id
     and l.account_code in ('1145', '2015');
$$;

comment on function public.fn_mazdoori_haal(text, uuid) is
  'Is bande par mazdoori ka advance kitna baqi hai (1145) aur us ko mazdoori ka kitna dena hai (2015) — dono ledger se (349).';

revoke all on function public.fn_mazdoori_haal(text, uuid) from public;
grant execute on function public.fn_mazdoori_haal(text, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 5) Bande ka 360 khulasa -- LENA aur DENA alag, sirf net nahi
-- ---------------------------------------------------------------------
-- Malik: *"UI mein gross Lena aur Dena bhi alag dikhna chahiye, sirf net
-- balance nahi."*
--
-- Wo theek keh rahe hain, aur wajah un ke apne misaal mein hai: khaad ka
-- Rs 10,000 lena aur mazdoori ka Rs 3,000 dena -- sirf "Rs 7,000 lena"
-- likh dena DONO baaton ko chhupa deta hai. Wasooli karne wala nahi
-- jaanta ke us bande ki mazdoori bhi baqi hai, aur mazdoori dene wala
-- nahi jaanta ke us par udhaar hai.
create or replace function public.fn_bande_ka_khulasa(
  p_party_type text,
  p_party_id   uuid
)
returns table (
  khata_code text,
  khata_naam text,
  lena       numeric,   -- hamein is bande se lena hai (asset)
  dena       numeric    -- hamein is bande ko dena hai (liability)
)
language sql
stable
security definer
set search_path = public
as $$
  select l.account_code,
         coalesce(a.name, l.account_code),
         case when a.account_type = 'asset'
              then greatest(sum(coalesce(l.debit,0) - coalesce(l.credit,0)), 0)
              else 0 end,
         case when a.account_type = 'liability'
              then greatest(sum(coalesce(l.credit,0) - coalesce(l.debit,0)), 0)
              else 0 end
    from journal_lines l
    left join gl_accounts a on a.code = l.account_code
   where fn_is_any_staff()
     and l.party_type = p_party_type
     and l.party_id = p_party_id
     and a.account_type in ('asset', 'liability')
   group by l.account_code, a.name, a.account_type
  having sum(coalesce(l.debit,0) - coalesce(l.credit,0)) <> 0
  order by l.account_code;
$$;

comment on function public.fn_bande_ka_khulasa(text, uuid) is
  'Is bande ka har baqi wala khata alag — Lena aur Dena alag alag, net nahi. Net dikhane se dono baatein chhup jati hain (349).';

revoke all on function public.fn_bande_ka_khulasa(text, uuid) from public;
grant execute on function public.fn_bande_ka_khulasa(text, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 6) Safha, ijazat aur madad
-- ---------------------------------------------------------------------
insert into public.features (key, label, route, is_active, is_sensitive, icon)
values ('mazdoori', 'Mazdoori / Daily Work', '/admin/mazdoori', true, false, 'HardHat')
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_active = true;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('sales_staff',     'mazdoori', ARRAY['view','create'], 'own_shop'),
  ('manager',         'mazdoori', ARRAY['view','create','approve','reject'], 'own_branch'),
  ('admin_assistant', 'mazdoori', ARRAY['view','create','approve','reject'], 'all'),
  ('finance',         'mazdoori', ARRAY['view','create','approve','reject','export'], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'mazdoori', 'rm',
  'Kis ne ART ke liye kaam kiya aur us ki kitni mazdoori bani. Purana advance us mein se KHUD adjust ho jata hai — staff ko hisaab haath se nahi lagana parta.',
  'Dukan par baitha banda darj karta hai. Manzoori Manager, Admin Assistant ya Finance deti hai.',
  'Usi din jab kaam ho jaye. Paisa usi waqt diya ho ya na diya ho — dono soorat mein qatar aaj hi banni chahiye.',
  ARRAY[
    'Banda dhoondein — naam, mobile ya ID se. Jo pehle se register hai us ka dobara khata nahi banta.',
    'Safha wahin us ka haal dikha deta hai: kitna advance baqi hai, aur kitna us ko dena hai.',
    'Kaam likhein, aur ginti + rate daal dein (jaise 100 bori × Rs 20). Raqam khud ban jati hai.',
    'Bhej dein. Manzoori par kitab mein qatar banti hai: mazdoori kharcha, aur us mein se jitna purane advance mein se adjust hua wo advance kam kar deta hai.',
    'Jo bacha, wo "mazdoori dena" ban jata hai — us ki adaigi Kharche ke safhe se hoti hai.'
  ],
  'Manzoori ke baad us bande ke 360 khaate par teen adad alag nazar aate hain: kitna advance baqi, kitna dena, aur kitna lena.',
  ARRAY[
    'Advance dete waqt usay mazdoori ka KHARCHA na likhein — kaam abhi hua hi nahi. Wo "Mazdoor ko advance" hai, jo hamein wapas lena hai. Kharcha usi din banta hai jis din kaam hota hai.',
    'Advance sirf MAZDOORI wale advance mein se adjust hota hai. Kisan ki fasal wali peshgi (1140) aur khaad ka udhaar (1150) is se khud nahi katte — un ke liye alag, manzoor shuda adjustment hai. Chup chaap kaat dena wo ghalti hai jis se koi khata phir kabhi milta nahi.',
    'Ginti aur rate khali na chhorein. Sirf raqam likhne se agle mahine ye sawal jawab nahi paata ke bori ka rate kya chal raha tha.',
    'Manzoor shuda qatar badli nahi ja sakti — ghalti par ulti qatar banayein.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();


-- ---------------------------------------------------------------------
-- 7) Kharche ki qatar par bhi "lene wala"
-- ---------------------------------------------------------------------
-- Wohi baat kharche ke safhe par bhi lagti hai: paisa Muhammad Aslam ka
-- hai, lene us ka beta aaya.
alter table public.company_expense_requests
  add column if not exists received_by_name text,
  add column if not exists received_by_note text;

comment on column public.company_expense_requests.received_by_name is
  'Paisa ya saman kis ne wusool kia. Khata phir bhi us bande ka rehta hai jis ka kaam hai — lene wale ka apna khata NAHI banta (349).';


-- ---------------------------------------------------------------------
-- 8) EK BANDA, EK KHATA -- ye usool kahan likha hai
-- ---------------------------------------------------------------------
-- Malik ka markazi usool (6 September):
--
--   *"One Person -> One ID -> One General Khata -> Many Activities ->
--   One Financial Truth. Alag Labour Khata, Milk Khata, Shop Khata,
--   Expense Khata bana dena system ko mushkil karega."*
--
-- Ye usool is nizam mein PEHLE SE aisa hi chal raha hai, aur ye baat
-- likh dena zaroori hai warna koi ise ghalat samajh kar do jagah khata
-- bana dega:
--
--   * **Bande ka khata ek hi hai** -- wo `party_type` + `party_id` se
--     bana ek NAZARIYA hai, koi alag table nahi. `fn_bande_ka_khulasa`
--     aur `fn_bande_ka_saara_lenden` wohi ek khata parhte hain.
--
--   * **GL khate (1145, 2015, 1150, 2010...) bande ke khate nahi hain**
--     -- wo hisaab ki QISM hain. Advance ek asset hai aur dena ek
--     liability: unhen ek khate mein rakhna Balance Sheet ko ghalat kar
--     deta hai. Bande ko ye kabhi nazar nahi aate; usay Lena, Dena aur
--     Net nazar aate hain.
--
--   * **Module sirf ye batate hain ke qatar kahan se aayi**
--     (`journal_entries.source_module`) -- Milk, Mazdoori, Shop, Grain,
--     Machinery. Safhe par ye chhanti banti hai, alag khate nahi.
--
-- Yani jo cheez ek honi chahiye (banda aur us ka khata) wo ek hai, aur
-- jo cheez alag honi chahiye (asset aur liability) wo alag hai.
comment on function public.fn_bande_ka_saara_lenden(text, uuid, date, date) is
  'Kisi bande ka EK hi khata -- har module ki qatar, source ke sath. Alag khate nahi bante; module sirf batata hai ke qatar kahan se aayi (348, 349).';


-- ---------------------------------------------------------------------
-- 9) Safhe ka naam: "Expense" nahi, "Paisa & Khata"
-- ---------------------------------------------------------------------
-- Malik (6 September):
--
--   *"Main 'Expense' naam nahi rakhunga, kyunke is screen mein sirf
--   kharcha nahi hoga. Is mein paisa dena, paisa lena, udhaar, mazdoori,
--   general kharcha aur settlement sab aa rahe hain. Accounting mein
--   farmer ko Rs 5,000 udhaar dena zaroori nahi ke expense ho... Mera
--   recommended naam: Paisa & Khata."*
--
-- Wajah unhon ne khud likhi: *"'Expense' rakhne se staff har cash-out ko
-- expense samajhne lagega aur baad mein reports/P&L mein confusion
-- hoga."*
update public.features
   set label = 'Paisa & Khata'
 where key = 'kharche';

update public.feature_help
   set purpose = 'Paisa dena, lena, udhaar, kharcha aur mazdoori — sab ek jagah, aur ye saaf likha hua ke wo kis ke khaate mein gaya. Cash bahar jane ka matlab hamesha kharcha nahi hota; yahan wo farq chunna parta hai.',
       updated_at = now()
 where feature_key = 'kharche';


-- ---------------------------------------------------------------------
-- 10) Mazdoori wali do nayi qismein bhi qubool hon
-- ---------------------------------------------------------------------
-- 348 ne `kind` par taala lagaya tha (aur wo theek tha: anjaani qism
-- aane par manzoori ke waqt koi khata pehchana nahi jata aur qatar chup
-- chaap suspense mein ja girti hai). Ab do nayi qismein us fehrist mein
-- shamil ho rahi hain.
alter table public.company_expense_requests drop constraint if exists chk_kharcha_kind;
alter table public.company_expense_requests add constraint chk_kharcha_kind check (
  kind in (
    'kharcha',
    'supplier_ko_diya',
    'staff_ko_advance',
    'kisan_ko_advance',
    'mazdoor_ko_advance',
    'mazdoori_ki_adaigi',
    'customer_se_wasooli',
    'staff_se_wapas',
    'kisan_se_wapas',
    'aamdani'
  )
);
