/**
 * Paisa & Khata (Kharche) — malik ka apna naqsha: paisa diya, paisa mila,
 * udhaar, mazdoori aur general kharcha, sab ek hi safhe par.
 *
 * `src/app/admin/kharche/kharche-client.tsx` mein pehle EK bhi `t()` nahi
 * tha -- puri UI Roman Urdu mein hardcoded thi. Is wajah se language
 * switch (EN / Roman / Urdu) is safhe par kaam nahi karta tha, chahe
 * baaki admin panel mein theek chalta ho. Ye dict wahi tamam alfaz cover
 * karta hai.
 *
 * `kh_` prefix taake kisi doosri file ke keys se collision na ho.
 */
export const kharcheDict = {
  // ---- Khaton ka balance strip ----
  kh_khaton_mein: { en: "Currently in accounts", rm: "Is waqt khaton mein", ur: "اس وقت کھاتوں میں" },
  kh_koi_khata_darj_nahi: { en: "No account recorded.", rm: "Koi khata darj nahi.", ur: "کوئی کھاتہ درج نہیں۔" },
  kh_khaton_baare_mein: {
    en: "These accounts belong to the whole company, not to each shop separately. These numbers only move after approval —",
    rm: "Ye khate poori company ke hain, har dukan ke apne nahi. Manzoori ke baad hi ye adad hilte hain —",
    ur: "یہ کھاتے پوری کمپنی کے ہیں، ہر دکان کے اپنے نہیں۔ منظوری کے بعد ہی یہ عدد ہلتے ہیں —",
  },
  kh_abhi_rs_prefix: { en: "right now Rs", rm: "abhi Rs", ur: "ابھی Rs" },
  kh_manzoori_intezar_suffix: { en: "is waiting for approval.", rm: "manzoori ke intezar mein hai.", ur: "منظوری کے انتظار میں ہے۔" },
  kh_kuch_intezar_nahi: { en: "nothing is waiting right now.", rm: "abhi kuch intezar mein nahi.", ur: "ابھی کچھ انتظار میں نہیں۔" },

  // ---- Naya darj karein — toggle ----
  kh_naya_darj_karein: { en: "Record New Entry", rm: "Naya darj karein", ur: "نیا درج کریں" },
  kh_band_karein: { en: "Close", rm: "Band karein", ur: "بند کریں" },

  // ---- Mazdoori ka form ----
  kh_mazdoori_info: {
    en: "No cash moves here — only the work is recorded. Any old advance is adjusted against it AUTOMATICALLY; whatever is left becomes payable to that person.",
    rm: "Yahan cash nahi hilta — sirf kaam darj hota hai. Purana advance is mein se KHUD adjust ho jata hai; jo bacha wo us bande ko dena ban jata hai.",
    ur: "یہاں کیش نہیں ہلتا — صرف کام درج ہوتا ہے۔ پرانا ایڈوانس اس میں سے خود ایڈجسٹ ہو جاتا ہے؛ جو بچے وہ اس بندے کو دینا بن جاتا ہے۔",
  },
  kh_fehrist: { en: "List", rm: "Fehrist", ur: "فہرست" },
  kh_kis_ne_kaam_kia: { en: "Who did the work", rm: "Kis ne kaam kia", ur: "کس نے کام کیا" },
  kh_chunein_option: { en: "— select —", rm: "— chunein —", ur: "— چنیں —" },
  kh_haal_parha_ja_raha: { en: "Loading their status...", rm: "Is ka haal parha ja raha hai...", ur: "اس کا حال پڑھا جا رہا ہے..." },
  kh_advance_baqi_colon: { en: "Advance balance:", rm: "Advance baqi:", ur: "ایڈوانس باقی:" },
  kh_is_ko_dena_colon: { en: "Owed to them:", rm: "Is ko dena:", ur: "اسے دینا:" },
  kh_poora_khata: { en: "Full ledger", rm: "Poora khata", ur: "پورا کھاتہ" },
  kh_is_mein_se_rs: { en: "Of this, Rs", rm: "Is mein se Rs", ur: "اس میں سے Rs" },
  kh_purane_advance_adjust: {
    en: "will adjust against the old advance; Rs",
    rm: "purane advance mein se adjust hoga; Rs",
    ur: "پرانے ایڈوانس میں سے ایڈجسٹ ہوگا؛ Rs",
  },
  kh_dena_banega: { en: "will become payable.", rm: "dena banega.", ur: "دینا بنے گا۔" },
  kh_kaam_kya_tha: { en: "What was the work", rm: "Kaam kya tha", ur: "کام کیا تھا" },
  kh_ph_kaam_example: { en: "e.g.: unloading 150 fertilizer bags", rm: "jaise: 150 khaad ki boriyan unloading", ur: "مثلاً: 150 کھاد کی بوریاں اتارنا" },
  kh_tareekh: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  kh_ginti: { en: "Quantity", rm: "Ginti", ur: "گنتی" },
  kh_ph_bori: { en: "sack", rm: "bori", ur: "بوری" },
  kh_rate_rs: { en: "Rate (Rs)", rm: "Rate (Rs)", ur: "ریٹ (Rs)" },
  kh_mazdoori_rs: { en: "Labour Pay (Rs)", rm: "Mazdoori (Rs)", ur: "مزدوری (Rs)" },
  kh_ph_ginti_rate_khud: { en: "Auto-calculated from quantity × rate", rm: "Ginti × rate se khud ban jayegi", ur: "گنتی × ریٹ سے خود بن جائے گی" },
  kh_lene_wala_koi_aur: { en: "If someone else is receiving it", rm: "Lene wala koi aur ho to", ur: "لینے والا کوئی اور ہو تو" },
  kh_ph_lene_wala_example: { en: "e.g.: Ali (son)", rm: "jaise: Ali (beta)", ur: "مثلاً: علی (بیٹا)" },
  kh_bhejein_manzoori: { en: "Submit (for approval)", rm: "Bhejein (manzoori ke liye)", ur: "بھیجیں (منظوری کے لیے)" },

  // ---- General kharcha form ----
  kh_ye_kya_hai: { en: "What is this?", rm: "Ye kya hai?", ur: "یہ کیا ہے؟" },
  kh_kaun_le_gaya_kis_se_aaya: { en: "Who took it / who gave it?", rm: "Kaun le gaya / kis se aaya?", ur: "کون لے گیا / کس سے آیا؟" },
  kh_kis_fehrist_se: { en: "From which list", rm: "Kis fehrist se", ur: "کس فہرست سے" },
  kh_naam_fehrist_se: { en: "Name (from list)", rm: "Naam (fehrist se)", ur: "نام (فہرست سے)" },
  kh_jo_fehrist_mein_nahi: {
    en: "Anyone not in the list should be added there first —",
    rm: "Jo fehrist mein nahi, usay pehle darj karein —",
    ur: "جو فہرست میں نہیں، اسے پہلے درج کریں —",
  },
  kh_farmers_membership: { en: "Farmers / Membership", rm: "Farmers / Membership", ur: "کسان / ممبر شپ" },
  kh_ya: { en: "or", rm: "ya", ur: "یا" },
  kh_customers: { en: "Customers", rm: "Customers", ur: "کسٹمرز" },
  kh_ek_dafa_ka_kaam: {
    en: ". It's a one-time task; after that its full record links up on its own.",
    rm: ". Ek dafa ka kaam hai; us ke baad us ka poora hisaab khud jurta rehta hai.",
    ur: "۔ یہ ایک دفعہ کا کام ہے؛ اس کے بعد اس کا پورا حساب خود جڑتا رہتا ہے۔",
  },
  kh_qism_ke_liye_banda_prefix: { en: "For this type, select the person from the", rm: "Is qism ke liye banda", ur: "اس قسم کے لیے بندہ" },
  kh_qism_ke_liye_banda_suffix: {
    en: "list — their ledger is tied to that same list.",
    rm: "ki fehrist se chunein — us ka khata usi fehrist se juda hua hai.",
    ur: "کی فہرست سے چنیں — اس کا کھاتہ اسی فہرست سے جڑا ہوا ہے۔",
  },
  kh_wohi_banda_kisan: {
    en: "The same person could be a farmer, a customer, or a labourer — the ID stays the same, so pick any list.",
    rm: "Wohi banda kisan bhi ho sakta hai, customer bhi aur mazdoor bhi — ID ek hi rehti hai, is liye fehrist koi bhi chunein.",
    ur: "وہی بندہ کسان بھی ہو سکتا ہے، کسٹمر بھی اور مزدور بھی — ID ایک ہی رہتی ہے، اس لیے فہرست کوئی بھی چنیں۔",
  },
  kh_kis_cheez_ka: { en: "For what", rm: "Kis cheez ka", ur: "کس چیز کا" },
  kh_apni_qism_ka_naam: { en: "Name your own category", rm: "Apni qism ka naam", ur: "اپنی قسم کا نام" },
  kh_ph_apni_qism_example: { en: "e.g.: canal cleaning", rm: "jaise: nehar ki safai", ur: "مثلاً: نہر کی صفائی" },
  kh_yehi_naam_qism_ban_kar: {
    en: "This name will be saved as a category — next time it will form its own row in the report.",
    rm: "Yehi naam qism ban kar mehfooz hoga — agli dafa report mein apni alag qatar bana lega.",
    ur: "یہی نام قسم بن کر محفوظ ہوگا — اگلی دفعہ رپورٹ میں اپنی الگ قطار بنائے گا۔",
  },
  kh_raqam_rs: { en: "Amount (Rs)", rm: "Raqam (Rs)", ur: "رقم (Rs)" },
  kh_wo_din_likhein: {
    en: "Enter the day the expense happened — not the day you're recording it.",
    rm: "Wo din likhein jis din kharcha hua — darj karne ka din nahi.",
    ur: "وہ دن لکھیں جس دن خرچہ ہوا — درج کرنے کا دن نہیں۔",
  },
  kh_paisa_kis_khate_se: { en: "Pay from which account", rm: "Paisa kis khate se", ur: "پیسہ کس کھاتے سے" },
  kh_is_ke_baghair_finance: {
    en: "Without this, the account balance won't move on the Finance page.",
    rm: "Is ke baghair Finance ke safhe par khate ka adad nahi hilta.",
    ur: "اس کے بغیر فنانس کے صفحے پر کھاتے کا عدد نہیں ہلتا۔",
  },
  kh_tafseel: { en: "Details", rm: "Tafseel", ur: "تفصیل" },
  kh_ph_tafseel_example: { en: "e.g.: diesel for the shop generator", rm: "jaise: dukan ke generator ka diesel", ur: "مثلاً: دکان کے جنریٹر کا ڈیزل" },
  kh_raseed_tasveer_marzi: { en: "Receipt photo (optional)", rm: "Raseed ki tasveer (marzi)", ur: "رسید کی تصویر (اختیاری)" },

  // ---- Mazdoori ki table ----
  kh_mazdoori_heading: { en: "Labour Work", rm: "Mazdoori", ur: "مزدوری" },
  kh_number: { en: "Number", rm: "Number", ur: "نمبر" },
  kh_banda: { en: "Person", rm: "Banda", ur: "بندہ" },
  kh_kaam_header: { en: "Work", rm: "Kaam", ur: "کام" },
  kh_advance_adjust: { en: "Advance Adjusted", rm: "Advance adjust", ur: "ایڈوانس ایڈجسٹ" },
  kh_dena_bana: { en: "Became Payable", rm: "Dena bana", ur: "دینا بنا" },
  kh_halat: { en: "Status", rm: "Halat", ur: "حالت" },
  kh_faisla: { en: "Decision", rm: "Faisla", ur: "فیصلہ" },
  kh_naam_nahi_mila: { en: "(name not found)", rm: "(naam nahi mila)", ur: "(نام نہیں ملا)" },
  kh_liya_colon: { en: "received by:", rm: "liya:", ur: "لیا:" },
  kh_ph_aap_ki_raye: { en: "Your comment (required)", rm: "Aap ki raye (lazmi)", ur: "آپ کی رائے (لازمی)" },
  kh_manzoor: { en: "Approve", rm: "Manzoor", ur: "منظور" },
  kh_wajah: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  kh_wapas_radd: { en: "Return / Reject", rm: "Wapas / Radd", ur: "واپس / رد" },
  kh_wapas_bhejein: { en: "Send back", rm: "Wapas bhejein", ur: "واپس بھیجیں" },
  kh_tasdeeq: { en: "Verify", rm: "Tasdeeq", ur: "تصدیق" },
  kh_radd_karein: { en: "Reject", rm: "Radd karein", ur: "رد کریں" },
  kh_radd: { en: "Reject", rm: "Radd", ur: "رد" },

  // ---- Paisa ki qatarein — asal table ----
  kh_paisa_ki_qatarein: { en: "Money Entries", rm: "Paisa ki qatarein", ur: "پیسے کی قطاریں" },
  kh_abhi_koi_kharcha_nahi: { en: "No expense has been recorded yet.", rm: "Abhi koi kharcha darj nahi hua.", ur: "ابھی کوئی خرچہ درج نہیں ہوا۔" },
  kh_ye_kya_hai_col: { en: "What is it", rm: "Ye kya hai", ur: "یہ کیا ہے" },
  kh_kaun_le_gaya_header: { en: "Who took it", rm: "Kaun le gaya", ur: "کون لے گیا" },
  kh_khata_header: { en: "Account", rm: "Khata", ur: "کھاتہ" },
  kh_raqam_header: { en: "Amount", rm: "Raqam", ur: "رقم" },
  kh_raseed: { en: "Receipt", rm: "Raseed", ur: "رسید" },
  kh_darj_nahi_dash: { en: "— (not recorded)", rm: "— (darj nahi)", ur: "— (درج نہیں)" },
} as const;
