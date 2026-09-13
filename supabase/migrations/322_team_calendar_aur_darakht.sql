-- =====================================================================
-- AgriBridge — Migration 322: Team ki chhutti ka calendar aur
--                              team ka darakht (organogram)
-- =====================================================================
-- Malik ne 5 September ko do cheezein maangin:
--   *"ye team board bhi ok krna hy"*  — team ki chhutti ka calendar
--   *"kon kis k oper hy kis trha sy tree bni hy pori team ki"* — darakht
--
-- Dono cheezon ka data PEHLE SE maujood tha, magar us shakal mein nahi
-- jis mein sawal poocha jata hai:
--
--   * `/admin/hr/leave` par chhutti ki FEHRIST thi. Fehrist se ye jawab
--     nahi milta ke "agle hafte kaun kaun nahi hoga" -- wo jawab
--     tareekhon mein bikhra hota hai. Calendar mein ek nazar mein hai.
--
--   * `/admin/hr/team` par reporting ki FEHRIST thi -- naam ke saamne
--     afsar ka naam. Us se ek banda dhoondhna asaan hai, magar poore
--     idare ka dhaancha nahi dikhta. Darakht mein shakhein dikhti hain.
--
-- DO USOOL JO IN DONO SAFHON MEIN LIKHE HUE HAIN:
--
-- 1. **Manzoor shuda aur manzoori-baqi ek jaise nahi dikhte.** Sirf
--    manzoor shuda dikhana adhoora hai (jis din paanch darkhwastein pari
--    hon us din ka kaam bhi khatre mein hai), aur dono ko ek rang dena
--    us se bura -- manager us din par bharosa kar ke kaam baant deta hai
--    jo abhi tay hi nahi hua.
--
-- 2. **Jis ka afsar darj nahi, wo darakht se gayab nahi hota.** Wo jaR
--    par alag nishan ke sath aata hai, aur jin ka HR record hi nahi un
--    ki ginti safhe par saaf likhi jati hai. Khamoshi se chhorna
--    "company mein bas itne log hain" jaisa ghalat jawab de deta.
--
-- Dono safhon par sirf DEKHNA hai -- koi tabdeeli nahi. Tabdeeli wahin
-- hoti hai jahan pehle hoti thi: chhutti ki darkhwast par faisla
-- `/admin/hr/leave`, aur reporting line `/admin/hr/team`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Team ki chhutti ka calendar
-- ---------------------------------------------------------------------
insert into public.features
  (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'hr.leave-calendar',
  'Team ki Chhutti',
  'Team Leave Calendar',
  'ٹیم کی چھٹی',
  '/admin/hr/leave/calendar',
  'CalendarDays',
  false,
  'Kaun kis din nahi hoga — poore mahine ka ek nazar mein naqsha.',
  'Who is off on which day — the whole month at a glance.',
  'کون کس دن نہیں ہوگا — پورے مہینے کا ایک نظر میں نقشہ۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('hr', 'hr.leave-calendar', 15, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

-- HR aur Manager ko sirf DEKHNE ki ijazat -- faisla wahin hota hai jahan
-- pehle hota tha. Admin/Owner ko ijazat ki qatar nahi chahiye (wo
-- UNRESTRICTED_ROLES mein hain).
insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('hr', 'hr.leave-calendar', array['view'], 'all'),
  ('manager', 'hr.leave-calendar', array['view'], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'hr.leave-calendar',
  'rm',
  'Poori team ki chhutti ek mahine ke naqshe par: kis din kaun nahi hoga, kis ki manzoori ho chuki aur kis ki abhi baqi hai, aur idare ki apni chhuttiyan (jaise 14 August) kis din hain.',
  'HR, Manager, Admin aur Malik. Aam staff apni chhutti "Mera HR" par dekhta hai -- poori team ki nahi.',
  'Kaam baantne se pehle, chhutti manzoor karne se pehle, aur mahine ke shuru mein.',
  ARRAY[
    'Upar teer ke nishanon se mahina aage peeche karein ("Aaj" se wapas is mahine par).',
    'Bhare hue (hare) naam manzoor shuda chhutti hain -- wo banda us din pakka nahi hoga.',
    'Khaali khaanay wale (peele, tootti lakeer wale) naam manzoori-baqi hain -- abhi faisla nahi hua.',
    'Neele khane idare ki chhutti hain -- us din koi bhi kaam par nahi.',
    'Naam par maus rakhein to kism (salana/bimari) aur aadha din bhi dikh jata hai.',
    'Faisla karne ke liye "Chhutti" wale safhe par jayein.'
  ],
  'Manzoori baqi darkhwaston par faisla /admin/hr/leave par karein.',
  ARRAY[
    'Manzoori-baqi naam ko manzoor shuda samajh kar kaam mat baantein -- us din wo banda ho bhi sakta hai. Isi liye dono alag dikhte hain.',
    'Khaali din ka matlab "sab hazir" nahi -- us ka matlab sirf itna hai ke us din ki koi chhutti darj nahi. Hazri ka hisaab Hazri Board par hai.',
    'Ye safha sirf 6 mahine peeche se 6 mahine aage tak ka record dikhata hai. Us se bahar ke mahine ka teer band rehta hai -- khaali calendar dikhane ke bajaye.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();


-- ---------------------------------------------------------------------
-- 2) Team ka darakht (organogram)
-- ---------------------------------------------------------------------
insert into public.features
  (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'hr.org-tree',
  'Team ka Darakht',
  'Org Chart',
  'ٹیم کا شجرہ',
  '/admin/hr/team/tree',
  'Network',
  false,
  'Kaun kis ke ooper hai — poore idare ka dhaancha shakhon ki shakal mein.',
  'Who reports to whom — the whole organisation as a tree.',
  'کون کس کے اوپر ہے — پورے ادارے کا ڈھانچہ شاخوں کی شکل میں۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('hr', 'hr.org-tree', 16, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

-- data_scope yahan 'all' hai kyunki asal rok safhe ki nahi, database ki
-- hai: fn_hr_staff_directory har bande ko sirf wohi log dikhati hai jo
-- fn_hr_can_view_staff ijazat de -- manager ko sirf apni shakh.
insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('hr', 'hr.org-tree', array['view'], 'all'),
  ('manager', 'hr.org-tree', array['view'], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'hr.org-tree',
  'rm',
  'Poore idare ka dhaancha: kaun kis ke ooper hai, kis ke neeche kitne log hain, aur kaun kaun aisa hai jis ka afsar abhi darj nahi.',
  'HR, Manager, Admin aur Malik. Manager ko sirf apni shakh dikhti hai -- ye rok database mein hai, safhe mein nahi.',
  'Naya banda rakhte waqt, kisi ki reporting line badalte waqt, aur ye dekhne ke liye ke kis manager par kitna bojh hai.',
  ARRAY[
    'Har naam ke aage teer se us ki shakh kholein ya band karein.',
    'Naam ke saath ohda, role, shoba aur shakha likhi hoti hai; daayen taraf ka adad us ke seedhe neeche walon ki ginti hai.',
    'Talash ke khane mein naam, ohda ya shoba likhein -- milta hua naam darakht mein numayan ho jata hai.',
    'Reporting line badalni ho to "Fehrist aur tabdeeli" (Team aur Reporting) par jayein.'
  ],
  'Afsar darj karne ya badalne ke liye /admin/hr/team par jayein.',
  ARRAY[
    'Jo banda jaR par "afsar darj nahi" ke nishan ke sath hai, wo Malik nahi -- us ka afsar likha hi nahi gaya. Us ki har darkhwast seedhi HR ke paas jati hai.',
    'Darakht mein sirf wo log aate hain jin ka HR record (staff_details) bana hua hai. Jo bahar reh jayein un ki ginti aur naam safhe ke neeche saaf likhe hote hain -- unhen nazarandaz na karein.',
    'Manager ko poori company ka darakht nazar nahi aata, sirf apni team. Ye kami nahi, jaan boojh kar hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();


-- ---------------------------------------------------------------------
-- 3) "Mera HR" ki madad se organogram nikaalna
-- ---------------------------------------------------------------------
-- 321 mein likha tha ke organogram abhi nahi bana. Ab ban gaya hai, is
-- liye us jhooti fehrist se nikalna zaroori hai -- warna madad ka safha
-- khud purani baat batata rahega.
update public.feature_help
set mistakes = array[
      'Calendar par KHALI din ka matlab "hazir" nahi -- us ka matlab hai ke us din koi indraj hi nahi hua. Chhutti, ghair-hazri aur "indraj nahi" teenon alag cheezein hain.',
      'Chhutti ke khane par "—" ka matlab hai ke company ki chhutti policy abhi darj nahi -- ye "sifar chhutti" nahi hai.',
      'Safar ki darkhwast, ghar se kaam, policies aur istifa abhi bane nahi. Safha khud ye baat likh kar batata hai -- inhen dhoondhne mein waqt zaya na karein.'
    ],
    updated_at = now()
where feature_key = 'my-hr' and lang = 'rm';
