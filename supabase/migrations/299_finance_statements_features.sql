-- =====================================================================
-- AgriBridge — Migration 299: Maali gosharay nizam mein darj
-- =====================================================================
-- Teen naye safhe (Finance ka markaz, gosharay, aur haath se journal
-- entry) code mein aa chuke. Malik ka usool (2 September) ye hai ke
-- feature tab tak poora nahi jab tak us ki IJAZAT, MADAD aur MENU ka
-- raasta bhi na ho.
--
-- Ye us usool ka baqi hissa hai. Bina is ke safhe maujood hote hain aur
-- kisi ko nazar nahi aate -- aur jo safha nazar na aaye wo bana hi nahi.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.center', 'Maali Hisaab Kitab', 'Financial Accounting', 'مالی حساب کتاب',
   '/admin/finance/center', true, false,
   'Poore finance ka ek markaz -- paanch group, aur jo abhi nahi bana wo bhi saaf likha.'),
  ('finance.statements', 'Maali Gosharay', 'Financial Statements', 'مالی گوشوارے',
   '/admin/finance/statements', true, false,
   'Trial Balance, Nafa Nuqsan, Balance Sheet aur poora Journal -- usi ledger se jo pehle se chal raha hai.'),
  ('finance.journal-entry', 'Journal Entry', 'Journal Entry', 'جرنل انٹری',
   '/admin/finance/journal-entry', true, true,
   'Haath se entry -- sirf un cheezon ke liye jin ka koi safha hai hi nahi.')
on conflict (key) do update set
  label        = excluded.label,
  label_en     = excluded.label_en,
  label_ur     = excluded.label_ur,
  route        = excluded.route,
  is_active    = true,
  is_sensitive = excluded.is_sensitive,
  description  = excluded.description;

-- ---------------------------------------------------------------------
-- Ijazat
-- ---------------------------------------------------------------------
-- Gosharay dekhna manager aur finance dono ka kaam hai -- ye faisle ki
-- buniyad hain, aur inhen sirf malik tak mehdood kar dene ka matlab hai
-- ke faisla har dafa malik ke intezar mein rukta hai.
--
-- HAATH SE ENTRY ka mamla alag hai. Jo banda apne haath se koi bhi khata
-- debit-credit kar sakta ho, wo hisaab ki har rok se bahar ho jata hai.
-- Is liye wo sirf finance ke paas hai (aur owner/admin, jin par nizam
-- mein waise hi koi rok nahi). Manager ko wo ijazat yahan se NAHI di
-- ja rahi -- chahiye to malik jaan boojh kar de sakte hain.
insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager', 'finance.center',     array['view'], 'all'),
  ('finance', 'finance.center',     array['view'], 'all'),
  ('manager', 'finance.statements', array['view'], 'all'),
  ('finance', 'finance.statements', array['view'], 'all'),
  ('finance', 'finance.journal-entry', array['view','create'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

-- ---------------------------------------------------------------------
-- Menu par jagah
-- ---------------------------------------------------------------------
insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values
  ('finance', 'finance.center',        0, 'Maali Hisaab', 0),
  ('finance', 'finance.statements',    1, 'Maali Hisaab', 0),
  ('finance', 'finance.journal-entry', 2, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

-- ---------------------------------------------------------------------
-- Madad
-- ---------------------------------------------------------------------
insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.statements', 'rm',
  'Chaar maali gosharay: Trial Balance, Nafa Nuqsan, Balance Sheet, aur poora Journal.',
  'Owner, Admin, Manager aur Finance.',
  'Mahine ke aakhir mein, ya jab bhi ye sawal ho ke "asal mein bacha kitna".',
  array[
    'Upar patti se goshara chunein.',
    'Tareekh ki hadd chun kar "Dikhayein" dabayein.',
    'Nafa Nuqsan DO tareekhon ke darmiyan ka hota hai; Balance Sheet EK tareekh par.',
    'Trial Balance par dono taraf ka jama barabar hona chahiye.'
  ],
  'Kisi adad par shak ho to "Poora Journal" par ja kar wo entry dekhein jis se wo bana.',
  array[
    'Trial Balance ke farq ko safhe ki ghalti samajh lena. Wo farq LEDGER ka masla hai, dikhane ka nahi — us par foran dekha jana chahiye.',
    'Balance Sheet mein "is saal ka nafa" ko doosra adad samajh lena. Nafa nuqsan ke khate saal ke aakhir mein sarmaye mein jate hain; jab tak wo band na hon, ye qatar dikhaye baghair dono taraf barabar nahi hoti.',
    'Ye samajhna ke ye adad kisi alag jagah se gine gaye hain. Ye wohi journal hai jis mein POS, kharid, doodh, grain aur machinery pehle se likhte hain — yahan koi cheez dobara nahi gini jati.'
  ]
),
(
  'finance.journal-entry', 'rm',
  'Haath se journal entry -- sirf un cheezon ke liye jin ka apna koi safha nahi.',
  'Owner, Admin aur Finance.',
  'Malik ka sarmaya daalna, bank ka munafa, ya purane khaton ka opening balance.',
  array[
    'Tareekh aur wajah likhein.',
    'Har qatar par khata chunein aur debit YA credit likhein — ek qatar mein dono nahi.',
    'Debit aur credit barabar hon, tabhi entry darj hoti hai.',
    'Guzri hui tareekh chunein to us ki alag wajah likhni parti hai.'
  ],
  'Entry darj hone ke baad wo "Poora Journal" aur audit trail dono par nazar aati hai.',
  array[
    'Bikri, kharid, doodh ya machinery ki entry yahan haath se likh dena. Wo apne safhe se KHUD bunti hai — yahan dobara likhne ka matlab hai wahi raqam do dafa gin lena, aur us ka pata mahine baad chalta hai.',
    'Guzri hui tareekh chup chaap daal dena. Wo jaiz hai (entry waqai us din ki ho sakti hai) magar yehi wo jagah hai jahan haath ki safai chhup sakti hai — is liye us par wajah maangi jati hai aur wo audit par nishaan ke sath aati hai.',
    'Darj entry ko mitane ki koshish. Wo mitti nahi — us ke ulat ek nayi entry (reversal) jati hai, taake dono baatein nazar mein rahein.'
  ]
),
(
  'finance.center', 'rm',
  'Poore finance ka ek markaz: paanch group, aur har group ke safhe ek jagah.',
  'Owner, Admin, Manager aur Finance.',
  'Jab ye dhoondna ho ke maali kaam ka kaunsa safha kahan hai.',
  array[
    'Paanch group: Finance, Adaigi aur Wasooli, Finance ka Nizam, Mustaqil Asaasay, aur Maali Reports.',
    'Har group mein wo safhe hain jo bane hue hain.',
    'Jo abhi nahi bana wo "Abhi nahi bana" ke neeche saaf likha hai.'
  ],
  'Roz ka kaam apne apne safhe se hota hai; ye sirf raasta dikhata hai.',
  array[
    'Ye samajhna ke accountant ko har entry yahan dobara likhni hai. Har hissa apna hisaab KHUD likhta hai — yahan ka kaam dekhna, milaana, durust karna aur band karna hai.',
    '"Abhi nahi bana" wali fehrist ko nazar andaz karna. Wo jaan boojh kar likhi gayi hai: na-maujood cheez ka naam menu mein laga dene se banda us par dabata hai, kuch nahi hota, aur phir wo poore nizam par shak karne lagta hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose    = excluded.purpose,
  who_uses   = excluded.who_uses,
  when_use   = excluded.when_use,
  how_steps  = excluded.how_steps,
  next_step  = excluded.next_step,
  mistakes   = excluded.mistakes,
  updated_at = now();
