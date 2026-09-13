-- =====================================================================
-- AgriBridge — Migration 292: Dukanon ke safhe ki madad (nayi rokein)
-- =====================================================================
-- 291 ke sath dukan par chaar control aa gaye: tafseel badalna, band
-- karna, rok dena, aur mitana. Malik ka usool (2 September): jo feature
-- bana, us ki madad usi commit mein jaye. Jo rok bandey ko safhe par
-- milegi, us ki wajah usay yahan pehle se likhi mil jani chahiye --
-- warna wo rok "safha kharab hai" lagti hai.
--
-- Sab se ahem baat jo yahan likhi hai: BAND aur ROKI GAYI ek cheez nahi,
-- aur maal wali dukan mit nahi sakti.
-- =====================================================================

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'shops', 'rm',
  'Dukanein: kaun kaun si dukanein hain, kaunsi chal rahi hai, kaunsi band hai aur kaunsi roki gayi hai.',
  'Owner aur Admin. Dukan banane, badalne, rokne aur mitane ka haq sirf inhi ke paas hai.',
  'Nayi dukan khulne par; kisi dukan ka naam ya shaakh badalne par; dukan bandh karni ho ya rokni ho.',
  array[
    'Nayi dukan: naam, shaakh, qism aur code likh kar banayein — phir us ka godam bhi banayein.',
    'Tafseel badalni ho to us dukan ke saamne "Tafseel badlein" dabayein.',
    'Mausami ya waqti tor par bandh karni ho to "Band karein" — dukan rehti hai, bas chalti nahi.',
    'Koi masla ho (licence khatam, ginti ho rahi ho) to "Rok dein" — yahan wajah likhna zaroori hai, aur wo wajah kis ne likhi ye bhi mehfooz hoti hai.',
    'Mitana sirf us dukan ka jis par kuch bhi na ho: na maal, na bikri, na mulazim.'
  ],
  'Dukan ke staff, us ka godam aur kharch ki hadd alag safhon par lagti hai.',
  array[
    'Band aur roki gayi ek cheez samajh lena. Band dukan apni marzi se band hai; roki gayi dukan kisi faisle se ruki hai — aur us faisle ki wajah likhi jati hai. Do mahine baad "ye bandh kyun hui thi" ka jawab sirf wajah se milta hai.',
    'Maal wali dukan mitane ki koshish. Wo mit hi nahi sakti — us ke godam ka maal, us par hui bikri aur us ke mulazim usi dukan ke naam par hain. Mitane ke bajaye band ya roki hui karein.',
    'Godam banaye baghair dukan ko maal nahi bheja ja sakta.',
    'Safhe par "maal —" ya "bikri —" likha ho to matlab ginti ho hi nahi saki, sifar nahi. Aisi soorat mein mitane ka button band rehta hai — aur yehi theek hai.'
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
