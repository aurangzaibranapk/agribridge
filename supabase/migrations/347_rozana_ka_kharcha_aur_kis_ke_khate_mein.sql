-- =====================================================================
-- AgriBridge — Migration 347: Rozana ka kharcha, aur wo kis ke khate mein
-- =====================================================================
-- Malik (6 September):
--
--   *"Expense ka alag se tag hona chahiye slide bar mein, jis mein daily
--   koi bhi bill hai wo add kar sakein, jis ki manzoori manager dega.
--   Kisi ko paisa diya hai to us ke khaate mein add kar sakein; agar
--   aaya to us ke khaate mein jama kar sakein."*
--
-- =====================================================================
-- NAYA TABLE KYUN NAHI BANAYA
-- =====================================================================
--
-- `company_expense_requests` pehle se maujood hai aur wohi jagah hai
-- jahan haath se dala hua bill aur WhatsApp se aaya bill DONO jate hain
-- (ye faisla us waqt likha bhi gaya tha). Naya table banane ka matlab
-- hota ke har report do jagah se jorni pare, aur ek na ek din koi ek
-- jagah dekhna bhool jaye.
--
-- Is liye us table mein wo khane daale ja rahe hain jo abhi nahi the.
--
-- =====================================================================
-- KYA KAMI THI
-- =====================================================================
--
-- Us table mein banda sirf SUPPLIER ho sakta tha (`supplier_id`). Malik
-- ka sawal us se bara hai: staff ko advance, kisan ko peshgi, customer
-- se wasooli -- teeno mein paisa kisi BANDE ke sath juda hota hai, aur
-- teeno ka khata alag jagah hai.
--
-- Doosri kami: ye kahin likha hi nahi tha ke paisa KIS khate se gaya --
-- golak se, Easypaisa se, ya bank se. Us ke baghair Cash Book ki qatar
-- ban hi nahi sakti, aur `finance_accounts.current_balance` (jo sirf
-- Cash Book se banta hai, 127) hilta hi nahi.
--
-- Teesri: `created_at` ko kharche ki tareekh maan liya jata tha. Kal ka
-- bill aaj darj ho to wo aaj ke din mein gin jata -- aur mahine ke
-- aakhir mein do din ke adad ghalat nikalte hain.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Naye khane
-- ---------------------------------------------------------------------
alter table public.company_expense_requests
  add column if not exists party_type text,
  add column if not exists party_id uuid,
  add column if not exists party_name text,
  add column if not exists paid_from_account_id uuid references public.finance_accounts(id),
  add column if not exists expense_date date,
  add column if not exists kind text not null default 'kharcha';

comment on column public.company_expense_requests.party_type is
  'Kis qism ka banda: supplier / staff / farmer / customer. NULL = koi banda nahi (asal kharcha ya aamdani) — 347.';
comment on column public.company_expense_requests.party_id is
  'Us bande ki id apni fehrist mein. NULL ho aur party_type ho to naam party_name se aata hai.';
comment on column public.company_expense_requests.paid_from_account_id is
  'Paisa kis khate se gaya / kis mein aaya. Is ke baghair Cash Book ki qatar nahi ban sakti (127).';
comment on column public.company_expense_requests.expense_date is
  'Kharche ki ASAL tareekh — darj karne ki tareekh nahi. Kal ka bill aaj darj ho sakta hai.';
comment on column public.company_expense_requests.kind is
  'Len-den ki qism (kharcha, supplier_ko_diya, staff_ko_advance, ...). Isi se tay hota hai ke kaun sa khata hilega — 347.';

-- Purani qatarein: unhen wohi maana jata hai jo wo thin -- asal kharcha,
-- jis ki tareekh darj karne wali tareekh hi thi. Koi andaza nahi lagaya
-- ja raha; sirf jo maloom hai wo likha ja raha hai.
update public.company_expense_requests
   set expense_date = created_at::date
 where expense_date is null;

update public.company_expense_requests
   set party_type = 'supplier', party_id = supplier_id
 where supplier_id is not null and party_type is null;


-- ---------------------------------------------------------------------
-- 2) Adhoora banda darj na ho
-- ---------------------------------------------------------------------
-- `party_type` ho magar na id ho na naam -- aisi qatar ka koi matlab
-- nahi: baad mein koi nahi bata sakta ke paisa kis ko gaya. Ye wohi
-- kism ki khamoshi hai jis se supplier ka khata kabhi kam nahi hota.
alter table public.company_expense_requests
  drop constraint if exists chk_kharcha_banda_poora;
alter table public.company_expense_requests
  add constraint chk_kharcha_banda_poora check (
    party_type is null
    or party_id is not null
    or (party_name is not null and length(trim(party_name)) > 0)
  );


-- ---------------------------------------------------------------------
-- 3) Manzoor shuda qatar ab badli nahi ja sakti
-- ---------------------------------------------------------------------
-- Manzoori par ledger aur Cash Book dono mein qatarein ban jati hain.
-- Us ke baad raqam ya qism badal dena kitab ko chup chaap ghalat kar
-- deta hai -- kitab wohi purana adad likhe rehti hai.
--
-- Wohi usool jo posted journal par hai (fn_no_journal_update): ghalti ka
-- ilaaj NAYI ULTI qatar hai, purani ko badalna nahi.
create or replace function public.fn_kharcha_manzoor_ke_baad_taala()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' then
    if new.amount is distinct from old.amount
       or new.kind is distinct from old.kind
       or new.party_type is distinct from old.party_type
       or new.party_id is distinct from old.party_id
       or new.paid_from_account_id is distinct from old.paid_from_account_id
       or new.expense_date is distinct from old.expense_date
       or new.category is distinct from old.category then
      raise exception 'Ye kharcha manzoor ho kar kitab mein ja chuka hai. Raqam ya qism ab badli nahi ja sakti — ulti qatar banayein.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kharcha_manzoor_ke_baad_taala on public.company_expense_requests;
create trigger trg_kharcha_manzoor_ke_baad_taala
  before update on public.company_expense_requests
  for each row execute function public.fn_kharcha_manzoor_ke_baad_taala();


-- ---------------------------------------------------------------------
-- 4) Safha aur us ki ijazat
-- ---------------------------------------------------------------------
insert into public.features (key, label, route, is_active, is_sensitive, icon)
values ('kharche', 'Kharche aur Adaigi', '/admin/kharche', true, false, 'ReceiptText')
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_active = true;

-- Dukan par baitha banda sirf DARJ karta hai. Manzoori us ke paas nahi
-- -- yehi poore safhe ka maqsad hai.
insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values ('sales_staff', 'kharche', ARRAY['view','create'], 'own_shop')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager', 'kharche', ARRAY['view','create','approve','reject'], 'own_branch'),
  ('admin_assistant', 'kharche', ARRAY['view','create','approve','reject'], 'all'),
  ('finance', 'kharche', ARRAY['view','create','approve','reject','export'], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;


-- ---------------------------------------------------------------------
-- 5) Safhe ki madad
-- ---------------------------------------------------------------------
insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'kharche', 'rm',
  'Din bhar ka har bill aur har len-den ek jagah — aur ye saaf likha hua ke wo kis ke khaate mein gaya. Cash bahar jane ka matlab hamesha kharcha nahi hota; yahan wo farq chunna parta hai.',
  'Dukan par baitha banda DARJ karta hai. Manzoori Manager, Admin Assistant ya Finance deti hai. Manzoori se pehle kuch bhi kitab mein nahi jata.',
  'Usi din, jis din bill bane ya paisa haath se nikle. Tareekh alag likhi ja sakti hai — kal ka bill aaj darj karna theek hai.',
  ARRAY[
    'Qism chunein: ye asal kharcha hai, ya kisi ko diya hua paisa, ya kisi se aaya hua paisa. Har qism ke neeche likha hai us ka asar kya hoga.',
    'Banda chunein (agar qism maangti ho) — supplier, staff, kisan ya customer.',
    'Raqam, tareekh aur tafseel likhein. Raseed ki tasveer laga dein to baad mein sawal nahi banta.',
    'Ye batayein ke paisa kis khate se gaya (golak, Easypaisa, JazzCash, bank) — is ke baghair Cash Book ka adad nahi hilta.',
    'Bhej dein. Manager ki manzoori par hi ye kitab mein jata hai.'
  ],
  'Manzoori ke baad teen jagah ek sath hilti hain: ledger, Cash Book, aur us bande ka khata. Us bande ka statement us ke apne safhe par khul jata hai.',
  ARRAY[
    'Supplier ki adaigi ko "kharcha" na likhein. Maal pehle aa chuka hai; usay dobara kharcha likhne se nafa asal se kam nazar aata hai AUR supplier ka khata kabhi kam nahi hota — wo dobara wohi paise mangta hai.',
    'Staff ka advance kharcha nahi hai — wo wapas lena hai. "Kharcha" likh dene se wo dena kahin darj hi nahi hota aur kabhi wapas nahi aata.',
    'Khata chunna na bhoolein. Khali chhorne se kitab to barabar rehti hai magar Finance ke safhe par us khate ka adad hilta hi nahi — aur wohi adad malik parhte hain.',
    'Manzoor shuda qatar badli nahi ja sakti. Ghalti ho jaye to ulti qatar banayein — mitane se ye pata hi nahi chalta ke us din kya hua tha.',
    'Tareekh wo likhein jis din KHARCHA hua, jis din darj kar rahe hain wo nahi. Warna mahine ke aakhir ke do din ke adad ghalat nikalte hain.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
