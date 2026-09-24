-- =====================================================================
-- Migration 201: Score ka dhaancha
-- =====================================================================
-- Chaar tableain. Har ek ek hi sawal ka jawab rakhti hai:
--
--   score_factor_weights  -- kis cheez ka kitna wazan
--   score_obligations     -- kis par kya zimma, aur kab tak
--   score_events          -- kya hua, kis document mein likha hai
--   score_snapshots       -- us din ka nateeja, apne hisaab samet
--
-- TEEN CHEEZEIN JO IS NIZAM MEIN KABHI EK NAHI HONGI:
--
--   Score       -- is bande ka chaal chalan
--   Coverage    -- ye nateeja kitne saboot par khara hai
--   Eligibility -- is waqt usay kya diya ja sakta hai
--
-- Ye teenon alag rakhne ka faisla malik ka hai, aur wohi is poore kaam
-- ko "ek rangeen card" se asal faisle ke sahare tak le jata hai. 86
-- Platinum aur aadha saboot -- ye do baatein sath likhi jayengi, warna
-- kal koi paanch lakh ka udhaar sirf rang dekh kar de dega.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 1) Wazan -- code mein nahi, yahan
-- ---------------------------------------------------------------
-- Aaj dono database khali hain: na doodh, na udhaar, na wapsi. Yani
-- wazan ke liye koi tajurba maujood hi nahi -- jo bhi number likha
-- jayega wo tajweez hoga. Us ka sahi ghar isi liye table hai, code
-- nahi: chhe mahine baad jab asal hisaab saamne hoga, wazan badalna ek
-- qatar badalna hoga -- build aur deploy ka chakkar nahi.
--
-- is_punitive = false ka matlab: ye factor sirf barha sakta hai. Us par
-- manfi waqia lagta hi nahi.
create table if not exists score_factor_weights (
  subject_type   text not null check (subject_type in ('farmer','staff','vendor','customer','department')),
  factor_key     text not null,
  weight         numeric(5,2) not null check (weight >= 0),
  is_punitive    boolean not null default true,
  -- Phase 1 mein na lagne wale factor. Misal: department ka
  -- staff_compliance -- staff ka score khud abhi saye mein hai, us par
  -- department ka score khara karna ek aazmaishi adad ko asal adad mein
  -- utaar dena hai.
  is_enabled     boolean not null default true,
  label          text not null,
  engine_version int  not null default 1,
  effective_from date not null default current_date,
  primary key (subject_type, factor_key, engine_version)
);

-- ---------------------------------------------------------------
-- 2) Zimmedari -- aur us ki tareekh
-- ---------------------------------------------------------------
-- due_date KHALI REH SAKTA HAI, aur khali rehna jhoot nahi. Jahan
-- tareekh tay hi nahi hui thi, wahan "der" ka sawal paida nahi hota --
-- na "waqt par", na "der se". Wo teesri haalat hai: naapi nahi ja
-- sakti.
create table if not exists score_obligations (
  id             uuid primary key default uuid_generate_v4(),
  subject_type   text not null check (subject_type in ('farmer','staff','vendor','customer')),
  subject_id     uuid not null,
  kind           text not null check (kind in ('credit','bill','installment','settlement','custody')),
  source_table   text not null,
  source_id      uuid not null,
  amount         numeric(14,2) not null check (amount > 0),
  settled_amount numeric(14,2) not null default 0,
  due_date       date,
  -- Tareekh aayi kahan se. Khali due_date ke sath ye bhi khali rehta
  -- hai. Iske baghair kal ye sawal ka jawab na hota ke wo tareekh kisi
  -- ne haath se daali thi ya kisi qaide se bani thi.
  due_date_source text check (due_date_source in ('farmer_promise','bill_terms','rent_agreement','loan_schedule')),
  state          text not null default 'open'
                 check (state in ('open','settled','written_off','cancelled')),
  settled_at     timestamptz,
  organization_id uuid,
  created_at     timestamptz not null default now(),
  unique (source_table, source_id)
);

create index if not exists idx_score_obl_subject on score_obligations (subject_type, subject_id);
create index if not exists idx_score_obl_open on score_obligations (due_date) where state = 'open';

-- ---------------------------------------------------------------
-- 3) Waqiat -- har ek ke peeche asal kaghaz
-- ---------------------------------------------------------------
-- source_table aur source_id LAZMI hain. Score mein kuch bhi haath se
-- nahi likha ja sakta -- na barhane ke liye, na ghatane ke liye. Jo
-- adad kisi document par khara na ho, us ka is nizam mein koi wujood
-- nahi.
create table if not exists score_events (
  id             uuid primary key default uuid_generate_v4(),
  subject_type   text not null check (subject_type in ('farmer','staff','vendor','customer','department')),
  subject_id     uuid not null,
  factor_key     text not null,
  -- event_type kyun: ek hi booking par kisan ne rate confirm kiya
  -- (musbat), kaam ke din maujood tha (musbat), aur paisa waade se das
  -- din baad diya (manfi) -- teenon alag jaiz waqiat hain, aur do to ek
  -- hi factor par hain. Sirf (source, factor) par pehra lagate to sach
  -- ruk jata.
  event_type     text not null,
  direction      smallint not null check (direction in (-1, 1)),
  magnitude      numeric(6,3) not null check (magnitude > 0),
  occurred_at    timestamptz not null,
  -- Waqt kis din se ginna hai. Aam tor par wohi din jab waqia hua.
  -- Magar jo zimmedari hal nahi hui, us ka waqt chalta hi nahi (neeche
  -- never_decays) -- aur hal hone par ginti US DIN SE shuru hoti hai,
  -- pehle din se nahi. Warna qarz ko waqt khud khatam kar deta.
  decay_from     timestamptz,
  never_decays   boolean not null default false,
  source_table   text not null,
  source_id      uuid not null,
  evidence_state text not null default 'pending'
                 check (evidence_state in ('verified','pending','self_reported')),
  verified_by    uuid references profiles(id),
  verified_at    timestamptz,
  note           text,
  organization_id uuid,
  created_at     timestamptz not null default now(),
  unique (source_table, source_id, factor_key, event_type)
);

create index if not exists idx_score_events_subject on score_events (subject_type, subject_id, factor_key);
create index if not exists idx_score_events_when on score_events (occurred_at);

-- ---------------------------------------------------------------
-- 4) Snapshot -- us din ka nateeja
-- ---------------------------------------------------------------
-- score KHALI HO SAKTA HAI, aur ye is poori table ki sab se ahem baat
-- hai. Khali ka matlab hai "darja bana hi nahi" -- na ke "sifar". Jis
-- din ye do cheezein ek samajh li gayin, us din naye kisan ko laal "D"
-- dikhna shuru ho gaya tha.
create table if not exists score_snapshots (
  id             uuid primary key default uuid_generate_v4(),
  subject_type   text not null check (subject_type in ('farmer','staff','vendor','customer','department')),
  subject_id     uuid not null,
  snapshot_date  date not null default current_date,
  score          int check (score between 0 and 100),
  band           text check (band in ('low','bronze','silver','gold','platinum')),
  state          text not null check (state in ('active','score_building','insufficient_data')),
  -- Score ke sath hamesha chalne wala doosra adad. Is ke baghair 86
  -- Platinum apne aap ko poora saboot zahir karta hai.
  evidence_coverage numeric(4,3),
  -- Teesra: udhaar ka apna record. Ye alag se is liye likha jata hai ke
  -- yehi wo kami hai jo qarz ke faisle mein sab se ziyada mayne rakhti
  -- hai -- aur baqi sab acha ho to nazar se chhup jati hai.
  credit_history_state text check (credit_history_state in ('none','insufficient','established')),
  relationship_days int,
  verified_event_count int,
  factors        jsonb not null,
  risk_flags     text[] not null default '{}',
  engine_version int not null,
  reason_summary text,
  organization_id uuid,
  computed_at    timestamptz not null default now(),
  unique (subject_type, subject_id, snapshot_date)
);

create index if not exists idx_score_snap_subject on score_snapshots (subject_type, subject_id, snapshot_date desc);

-- ---------------------------------------------------------------
-- 5) Wazan ka matrix -- engine_version 1
-- ---------------------------------------------------------------
-- Tarteeb malik ki tay kardah hai:
--   payment/credit  >  commitment  >  verification  >  supply
--
-- Supply sab se neeche hai aur saza deta hi nahi. Wajah: ziyada doodh
-- dena taalluq behtar karta hai, magar wo ye nahi batata ke banda paisa
-- wapas karta hai ya nahi. Aur agar supply ka wazan bhaari hota to ye
-- factor khaamoshi se AMEERI ko bharose ka paimana bana deta.
insert into score_factor_weights (subject_type, factor_key, weight, is_punitive, is_enabled, label) values
  ('farmer','credit_repayment',        30, true,  true, 'Udhaar ki wapsi'),
  ('farmer','payment_punctuality',     20, true,  true, 'Waqt ki pabandi'),
  ('farmer','commitment_reliability',  25, true,  true, 'Jo kaha wo kiya'),
  ('farmer','profile_verification',    15, true,  true, 'Kaghaz aur tasdeeq'),
  ('farmer','supply_engagement',       10, false, true, 'Taalluq ka tasalsul'),

  ('customer','credit_repayment',      30, true,  true, 'Udhaar ki wapsi'),
  ('customer','payment_punctuality',   20, true,  true, 'Waqt ki pabandi'),
  ('customer','order_reliability',     25, true,  true, 'Order ka bharosa'),
  ('customer','kyc_verification',      15, true,  true, 'Kaghaz aur tasdeeq'),
  ('customer','engagement',            10, false, true, 'Taalluq ka tasalsul'),

  ('staff','custody_discipline',       30, true,  true, 'Paise aur maal ka zimma'),
  ('staff','task_closure',             25, true,  true, 'Kaam band karna'),
  ('staff','verification_accuracy',    20, true,  true, 'Tasdeeq ki durusti'),
  ('staff','attendance',               15, true,  true, 'Hazri'),
  ('staff','complaints',               10, true,  true, 'Shikayat'),

  ('vendor','settlement_discipline',   30, true,  true, 'Hisaab band karna'),
  ('vendor','job_completion',          25, true,  true, 'Kaam poora karna'),
  ('vendor','farmer_confirmation',     20, true,  true, 'Kisan ki tasdeeq'),
  ('vendor','dispute_rate',            15, true,  true, 'Jhagre'),
  ('vendor','profile_verification',    10, true,  true, 'Kaghaz aur tasdeeq'),

  ('department','financial_accuracy',  30, true,  true,  'Hisaab ka milaan'),
  ('department','sla_closure',         25, true,  true,  'Waqt par kaam band'),
  ('department','backlog',             20, true,  true,  'Latka hua kaam'),
  ('department','complaint_rate',      15, true,  true,  'Shikayat'),
  -- BAND HAI. Staff ka score khud abhi saye mein hai. Us ka darmiyana
  -- yahan lagana ek aazmaishi adad ko chup chaap us adad mein utaar
  -- dena hai jise log asal maan kar dekhte hain. Staff scoring parakh
  -- lene ke baad ya to ye khulega, ya us ki jagah seedhe kaam ke
  -- paimane aayenge.
  ('department','staff_compliance',    10, true,  false, 'Bandon ka darja')
on conflict (subject_type, factor_key, engine_version) do nothing;
