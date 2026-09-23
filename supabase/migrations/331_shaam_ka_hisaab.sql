-- =====================================================================
-- AgriBridge — Migration 331: "Shaam ka Hisaab" ka safha
-- =====================================================================
-- Malik ka kehna (6 September): *"hamein shaam ke time check karna hota
-- hai — cash kitna, QR kitna, Easypaisa kitna, JazzCash kitna, bank
-- kitna. Us se sab maloom ho jayega, phir total nikal aayega — kitna
-- sale hua, kitna stock value hai, kis kis khate mein kitni sale, ab
-- kitna available hai."*
--
-- 330 mein har tareeqe ka apna khata ban gaya. Ab wo ek safhe par ek
-- sath dikhta hai.
--
-- =====================================================================
-- YE SAFHA KOI NAYA ADAD NAHI BANATA
-- =====================================================================
--
-- Har khana ledger ki qataron se ginta hai -- wohi qatarein jin par
-- Cash Book, Money Trail aur Bank Reconcile chalte hain. Ye baat safhe
-- par bhi likhi hai.
--
-- Wajah: agar ye safha apna alag hisaab lagata, to ek din wo baqi
-- safhon se hat jata, aur phir do adad hote jin mein se koi nahi jaanta
-- kaun sa sach hai. Yehi ghalti Master Dashboard par pakRi gayi thi --
-- wahan har khana alag table se aata hai, aur is liye "Bank/Cash" Rs
-- 34,521 kam aur "To Receive" Rs 80,450 kam bata raha tha.
--
-- =====================================================================
-- EK BAAT JO SAFHE PAR SAAF LIKHI HAI
-- =====================================================================
--
-- Stock ki qeemat godam ki GINTI se aati hai, ledger se nahi. Ledger ka
-- stock ka khata abhi bharosay ke qabil nahi (POS bikri par sirf lagat
-- ki chhoti qatarein banti hain, maal ka asal aana kabhi ledger mein
-- nahi gaya). Safha ye baat chhupata nahi -- us khane ke neeche likha
-- hai ke ye adad kahan se aaya.
-- =====================================================================

insert into public.features
  (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'shaam-ka-hisaab',
  'Shaam ka Hisaab',
  'Evening close',
  'شام کا حساب',
  '/admin/shaam-ka-hisaab',
  'Scale',
  true,
  'Din ke aakhir mein har khate ka balance — cash, wallet, bank — aur din ki bikri, ek nazar mein.',
  'End of day: every account balance — cash, wallets, bank — and the day''s sales, in one view.',
  'دن کے آخر میں ہر کھاتے کا بیلنس — کیش، والٹ، بینک — اور دن کی فروخت، ایک نظر میں۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values
  ('sales',   'shaam-ka-hisaab', 14, null),
  ('finance', 'shaam-ka-hisaab', 3,  null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager', 'shaam-ka-hisaab', array['view'], 'all'),
  ('finance', 'shaam-ka-hisaab', array['view'], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'shaam-ka-hisaab',
  'rm',
  'Din band karte waqt ek hi safhe par: har khate mein kitna hona chahiye (cash, JazzCash, Easypaisa, QR, Kisan Card, bank), sab ka total, aaj kitni bikri hui aur kis tareeqe se, aur godam mein kitne ka maal para hai.',
  'Malik, Manager aur Finance. Counter wale staff ko cash ki ginti "Cash Closing" par karni hai.',
  'Roz shaam ko, dukan band karne se pehle.',
  ARRAY[
    'Upar har khate ka adad dekhein — yehi wo raqam hai jo us khate mein honi chahiye.',
    'Har app khol kar (JazzCash, Easypaisa, QR) us ka asal balance us adad se milayein.',
    'Cash ki asal ginti "Cash Closing" par karein — wahan note aur sikke ginne ka khana hai.',
    'Bank ka milan "Bank Reconciliation" par karein — wahan statement paste hoti hai.',
    'Neeche dekhein: aaj kitni bikri hui, kis tareeqe se kitni aayi, aur godam mein kitne ka maal hai.'
  ],
  'Farq nikle to Cash Closing ya Bank Reconciliation par ja kar wajah ke saath darj karein.',
  ARRAY[
    'Ye safha koi naya adad nahi banata — sab kuch ledger ki qataron se ginta hai. Is liye yahan kuch "theek" karne ka khana nahi: farq apni jagah (Cash Closing / Bank Reconcile) par wajah ke saath darj hota hai.',
    'Stock ki qeemat godam ki GINTI se aati hai, ledger se nahi — ledger ka stock ka khata abhi bharosay ke qabil nahi. Safha ye baat khud likh kar batata hai.',
    'Naye khate (JazzCash, Easypaisa, QR, Kisan Card) sifar se shuru hue hain aur un ka shuruati balance kabhi darj nahi hua. Pehle milan par un mein bara farq nikle to wo kharabi nahi — wo pehli dafa asal adad darj hona hai.',
    'Khata (udhaar) wali bikri kisi khate mein nahi aati — wo gahak ke zimme likhi jati hai. Is liye "aaj ki bikri" aur "aaj aaya hua paisa" do alag adad hain.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
