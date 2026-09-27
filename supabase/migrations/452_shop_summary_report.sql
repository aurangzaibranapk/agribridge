-- Per-Shop Daily Summary page -- Admin/Manager ke liye ek shop ka poora
-- roz ka jaiza: sale by method, recovery, udhar, load, supplier bills,
-- aur cash control -- sab ek screen par.
-- Route: /admin/reports/shop-summary

insert into features (key, label, label_en, label_ur, route, icon, description)
values (
  'reports.shop-summary',
  'Shop ka Roz ka Jaiza',
  'Per-Shop Daily Summary',
  'شاپ کا روزانہ جائزہ',
  '/admin/reports/shop-summary',
  'LayoutDashboard',
  'Ek shop select karo -- sale (method-wise), recovery, udhaar, stock load, supplier bills, aur cash control sab ek jagah dikhta hai.'
)
on conflict (key) do update
  set route = excluded.route,
      label = excluded.label,
      label_en = excluded.label_en,
      description = excluded.description,
      is_active = true;

-- Reports dashboard mein link
insert into dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('reports', 'reports.shop-summary', 35, null, 0)
on conflict (dashboard_key, feature_key) do nothing;

-- feature_help: Roman Urdu mein
insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'reports.shop-summary', 'rm',
  'Ek shop ka poora roz ka hisaab -- sale kitni huwi (naqad, digital, udhaar), wasooli kitni aayi, maal kitna aaya, supplier bill kitna aaya, aur cash ka farq kya hai -- sab ek jagah bina kisi aur safhe ke.',
  'Admin, Owner, Finance Manager poori company ke liye. Branch Manager apni branch ki shops ke liye. Staff (agar ijazat ho to) sirf apni shop.',
  'Roz ki close karte waqt, ya jab bhi kisi ko ye jaanna ho ke aaj ek khaas shop par kya hua. Mahine ke jaiza ke liye bhi kaam aata hai.',
  array[
    'Shop ka naam dropdown se chunein (agar sirf ek shop assign hai to wo khud hi dikhti hai).',
    '"Waqt" mein: Aaj, Pichle 7 Din, Is Mahina, ya Custom range chunein -- phir "Apply" dabayein.',
    'Sale cards mein Kul Sale, Cash, Digital, aur Khata/Udhaar alag alag dikhte hain.',
    '"Tareeqa-e-Adaigi" table mein har method ki exact raqam hai -- JazzCash, Easypaisa, QR, etc.',
    '"Wasooli" mein purani khata par aaj ki naqad wasooli dikhti hai.',
    '"Stock Load" mein is waqt mein jo maal shop par pahuncha uski purchase price dikhti hai.',
    '"Supplier Bill" mein is dauraan ke bills ki ginti aur total raqam dikhti hai.',
    '"Cash Control" mein expected vs counted vs farq -- agar koi shift khuli rahi ho to warning bhi aati hai.'
  ],
  'Agar farq zyada ho to Cash Handover ya POS Shifts safhe par detail dekhein. Supplier bills ke liye Purchases safhe par jaayen.',
  array[
    'Ye safha sirf read-only hai -- koi cheez yahan se theek nahi hoti, sirf dikhti hai.',
    '"Aaj" filter sirf aaj ki sale dikhata hai -- agar raat ki shift kal raat shuru huwi to Custom mein pichle din bhi lein.',
    'Recovery (wasooli) wali raqam sale se alag hoti hai -- ye nai sale nahi, purani khata ki wapsi hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose   = excluded.purpose,
  who_uses  = excluded.who_uses,
  when_use  = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes  = excluded.mistakes;
