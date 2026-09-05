-- =====================================================================
-- AgriBridge — Migration 320: Kharabiyon ka ek khata
-- =====================================================================
-- Malik ka kehna (5 September):
--
--   "Mujhe ERP system par koi aisa function laga dein: kahin bhi koi
--    error aaye to mujhe pata chal jaye -- is cheez ka error hai, code
--    mein ya kisi aur jagah, bill duplicating mein, POS, inventory,
--    kahin bhi ho -- mujhe ek page par pata chal jaye, taake developer
--    ko asani se wo khatam kar sake, issue resolve kar sake."
--
-- Aaj kharabi ka pata chalne ka ek hi raasta hai: koi banda screenshot
-- bheje. Jo kharabi kisi ne nahi dekhi, ya jo dekhi magar batai nahi
-- gayi, wo kabhi theek nahi hoti. Aur isi session mein us ki misalein
-- saamne aayin:
--
--   - "Kuch masla ho gaya, dobara koshish karein" (Assistant) -- asal
--     wajah do naamon ka farq thi, magar wo sirf server ke log mein pari
--     rahi jahan malik kabhi nahi jate.
--   - `duplicate key ... uq_machinery_payment_receipt` -- adaigi ruk
--     rahi thi aur wajah kisi ko nazar nahi aa rahi thi.
--   - Tasveer ka 404 -- model ka naam ghalat tha; safha sirf "nahi bani"
--     kehta tha.
--
-- Teenon ek hi shakal ke the: **kharabi hui, aur us ka naam kisi jagah
-- likha nahi gaya.** Jis kharabi ka naam maloom na ho, us par kaam shuru
-- hi nahi hota.
--
-- Ab har kharabi yahan darj hoti hai, aur ek safhe par nazar aati hai.
--
-- TEEN USOOL:
--
-- 1. **Khata likhna kabhi kisi kaam ko nahi rokta.** Kharabi darj na ho
--    sake to bhi asal kaam apni jagah chalta hai. Hisaab rakhne wali
--    cheez ka asal kaam rok dena us se bura hai ke hisaab na rakha jaye.
--
-- 2. **Ek jaisi kharabi ek hi qatar mein ginti hai.** `fingerprint` ek
--    jaisi kharabiyon ko jorta hai -- warna ek hi masla 500 dafa likha
--    jata aur safha parhne ke qabil na rehta. Har waqia phir bhi mehfooz
--    rehta hai; safha unhen jama kar ke dikhata hai.
--
-- 3. **Kharabi mitai nahi jati, "hal ho gayi" ka nishan lagta hai.**
--    Mita dene se ye sawal kabhi jawab nahi paata ke ye masla pehle bhi
--    aaya tha ya nahi.
-- =====================================================================

create table if not exists public.error_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  -- Ek jaisi kharabiyon ko jorne wali chaabi (module + saaf kiya hua
  -- paighaam). Safha isi par jama karta hai.
  fingerprint  text not null,

  -- Kis hisse ki kharabi: 'code', 'pos', 'inventory', 'purchase',
  -- 'machinery', 'finance', 'ai', 'whatsapp'...
  module       text not null,

  -- Kaun sa safha khula hua tha.
  route        text,

  message      text not null,
  -- Poori tafseel: stack, ya database ka asal paighaam.
  detail       text,
  -- Next.js ka `digest` -- server ke log mein bhi wohi hota hai, is liye
  -- asal khata isi se dhoondi ja sakti hai chahe paighaam adhoora ho.
  digest       text,

  -- 'rukawat' = kaam ruk gaya | 'ghalti' = kuch ghalat hua magar kaam
  -- chalta raha | 'khabar' = sirf jaanne ki baat.
  severity     text not null default 'ghalti',

  actor_id     uuid references auth.users(id),

  resolved_at   timestamptz,
  resolved_by   uuid references auth.users(id),
  resolve_note  text,

  constraint chk_error_severity check (severity = any (array['rukawat','ghalti','khabar'])),
  -- Hal hone ka nishan aadha nahi lagta: tareekh ho to wajah bhi ho.
  constraint chk_error_resolved_shape check (
    (resolved_at is null and resolve_note is null)
    or (resolved_at is not null and length(coalesce(resolve_note,'')) >= 3)
  )
);

create index if not exists idx_error_created on public.error_log (created_at desc);
create index if not exists idx_error_fingerprint on public.error_log (fingerprint, created_at desc);
create index if not exists idx_error_open on public.error_log (created_at desc) where resolved_at is null;

alter table public.error_log enable row level security;

-- Parhna: Owner/Admin. Likhna sirf service client se -- kharabi ka khata
-- kisi bande ke haath se nahi banta.
drop policy if exists error_log_read on public.error_log;
create policy error_log_read on public.error_log
  for select using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.is_active
         and p.role::text in ('owner','super_admin','admin')
    )
  );

grant select on public.error_log to authenticated;

comment on table public.error_log is
  'Har kharabi ka indraj -- kis hisse mein, kaunse safhe par, kya paighaam. Mitai nahi jati; hal hone par nishan lagta hai.';

-- ---------------------------------------------------------------------
-- Ek jaisi kharabiyan ek qatar mein
-- ---------------------------------------------------------------------
create or replace view public.v_error_summary as
  select
    e.fingerprint,
    min(e.module)                                   as module,
    (array_agg(e.message order by e.created_at desc))[1] as message,
    (array_agg(e.route   order by e.created_at desc))[1] as route,
    (array_agg(e.detail  order by e.created_at desc))[1] as detail,
    (array_agg(e.digest  order by e.created_at desc))[1] as digest,
    max(e.severity)                                 as severity,
    count(*)                                        as kitni_dafa,
    min(e.created_at)                               as pehli_dafa,
    max(e.created_at)                               as aakhri_dafa,
    count(*) filter (where e.resolved_at is null)   as khuli,
    max(e.resolved_at)                              as hal_hui
  from public.error_log e
  group by e.fingerprint;

grant select on public.v_error_summary to authenticated;

-- ---------------------------------------------------------------------
-- Safha: menu, ijazat aur Help
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'errors',
  'Kharabiyan',
  'Errors',
  'خرابیاں',
  '/admin/errors',
  'AlertTriangle',
  true,
  'Poore system ki kharabiyan ek jagah — code, POS, inventory, bill, kahin bhi.',
  'Every error in one place — code, POS, inventory, bills, anywhere.',
  'پورے سسٹم کی خرابیاں ایک جگہ — کوڈ، پی او ایس، انوینٹری، بل، کہیں بھی۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('admin', 'errors', 5, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'errors',
  'rm',
  'Poore system mein jo bhi kharabi hoti hai -- kisi safhe ka toot jana, AI ka nakaam hona, database ka koi rok lagana, bill ka duplicate -- wo sab yahan khud ba khud aa jati hai. Kisi ko screenshot bhejne ki zaroorat nahi.',
  'Owner aur Admin. Is mein poore idare ki kharabiyan dikhti hain, is liye baqi staff par nahi khulta.',
  'Roz ek dafa, ya jab koi kahe ke "kaam nahi ho raha".',
  ARRAY[
    'Pehle "Khuli" wali fehrist dekhein -- yehi wo masle hain jo abhi tak theek nahi hue.',
    'Laal nishan ("kaam ruk gaya") wale pehle dekhein -- un par kisi ka kaam ruka hua hai.',
    'Qatar par click karein: poora paighaam, kaunsa safha, kitni dafa aaya, aur "digest" (jis se developer server ke log mein wohi kharabi dhoondh leta hai).',
    'Masla theek ho jane par wajah likh kar "Hal ho gayi" dabayein.'
  ],
  'Jo kharabi samajh na aaye, us ka poora paighaam aur digest developer ko bhej dein -- usi se wo asal jagah tak pahunch jata hai.',
  ARRAY[
    'Ek hi masla kai dafa aaya ho to yahan EK qatar aati hai, us par "40 dafa" likha hota hai. Ye ek kharabi hai, chalees nahi.',
    'Hal shuda kharabi mitai nahi jati -- us par nishan lagta hai. Mita dene se ye sawal kabhi jawab nahi paata ke ye masla pehle bhi aaya tha ya nahi.',
    'Khali fehrist ka matlab "koi kharabi nahi" tabhi hai jab upar peela paighaam na ho. Peela paighaam ho to khata khud parha nahi ja saka.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
