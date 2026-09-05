/**
 * Paise ka raasta, gaariyan, kisan ka qarza, test data ka reset, aur
 * qism ka dashboard.
 *
 * MONEY TRAIL PAR "SUSPENSE" KI QATAREIN KABHI CHHUPAYI NAHI JATIN. Wo
 * wahi raqmein hain jin ki wajah abhi maloom nahi. Aam nizam aisi
 * cheezein chhupa deta hai taake safha saaf lage -- aur wohi wajah hai
 * ke wo raqmein saalon tak pari rehti hain. Yahan un ka apna khana hai
 * aur saath likha hai ke wo tab tak nazar aati rahengi jab tak wajah na
 * mile.
 *
 * GAARIYON KE SAFHE PAR "GAARI KISI KE NAAM NAHI" ek chetawni hai,
 * khali khana nahi. Us staff ki bheji hui meter ki tasveer kis gaari ki
 * hai -- ye nizam pehchan hi nahi sakta. Is liye wahan saaf likha hai
 * ke un ka WhatsApp wala hisaab banega hi nahi.
 *
 * TEST DATA WALE SAFHE PAR "WE ARE LIVE" aur "DELETE TEST DATA"
 * ANGREZI HI RAHE. Ye wo alfaz hain jo banda haath se likh kar tasdeeq
 * karta hai. Inhen tarjuma kar dene se zaban badalte hi taala tootta
 * hai: kisi ne English mein likha hua yaad rakha aur Urdu wale safhe
 * par kaam na kiya -- ya us se bhi bura, dono chalne lagein aur taala
 * aadha reh jaye.
 */
export const opsExtraDict = {
  // ---- Money trail ----
  mt_title: { en: "Money Trail — Where the Money Is", rm: "Paise ka raasta -- paisa kahan hai", ur: "پیسے کا راستہ — پیسہ کہاں ہے" },
  mt_where_now: { en: "Where the money is right now", rm: "Paisa is waqt kahan hai", ur: "پیسہ اس وقت کہاں ہے" },
  mt_in: { en: "In", rm: "Aaya", ur: "آیا" },
  mt_out: { en: "Out", rm: "Gaya", ur: "گیا" },
  mt_we_owe: { en: "We owe", rm: "Hum ne dena hai", ur: "ہم نے دینا ہے" },
  mt_empty_account: { en: "No rows in this account yet.", rm: "Is khate mein abhi koi qatar nahi.", ur: "اس کھاتے میں ابھی کوئی قطار نہیں۔" },
  mt_from_where: { en: "From where", rm: "Kahan se", ur: "کہاں سے" },
  mt_suspense_note: {
    en: "is money whose reason is not yet known (suspense).",
    rm: "aisi raqam hai jis ki wajah abhi maloom nahi (Suspense).",
    ur: "ایسی رقم ہے جس کی وجہ ابھی معلوم نہیں (سسپینس)۔",
  },
  mt_never_hidden: {
    en: "This is never hidden — until the reason is found, it keeps showing here.",
    rm: "Ye kabhi chhupayi nahi jati -- jab tak wajah nahi milti, yahin nazar aati rahegi.",
    ur: "یہ کبھی چھپائی نہیں جاتی — جب تک وجہ نہیں ملتی، یہیں نظر آتی رہے گی۔",
  },
  mt_close: { en: "close", rm: "band karein", ur: "بند کریں" },

  // ---- Gaariyan ----
  vh_title: { en: "Vehicles & Daily Log", rm: "Gaariyan aur rozana hisaab", ur: "گاڑیاں اور روزانہ حساب" },
  vh_who_has_which: { en: "Who has which vehicle", rm: "Kaun si gaari kis ke paas", ur: "کون سی گاڑی کس کے پاس" },
  vh_none: { en: "No vehicle recorded.", rm: "Koi gaari darj nahi hai.", ur: "کوئی گاڑی درج نہیں ہے۔" },
  vh_unassigned: { en: "Vehicle not assigned to anyone", rm: "Gaari kisi ke naam nahi", ur: "گاڑی کسی کے نام نہیں" },
  vh_no_whatsapp_log: { en: "Their WhatsApp log will not be built", rm: "In ka WhatsApp wala hisaab nahi banega", ur: "ان کا واٹس ایپ والا حساب نہیں بنے گا" },
  vh_unassigned_note: {
    en: "Without a vehicle assigned, the system cannot tell which vehicle that staff member's meter photo belongs to.",
    rm: "Gaari kisi ke naam kiye baghair, us bande ki bheji hui meter ki tasveer kis gaari ki hai -- nizam pehchan nahi payega.",
    ur: "گاڑی کسی کے نام کیے بغیر، اس بندے کی بھیجی ہوئی میٹر کی تصویر کس گاڑی کی ہے — نظام پہچان نہیں پائے گا۔",
  },
  vh_daily_log: { en: "Daily Log", rm: "Rozana hisaab", ur: "روزانہ حساب" },
  vh_no_daily_log: { en: "No daily log yet.", rm: "Abhi tak koi rozana hisaab nahi bana.", ur: "ابھی تک کوئی روزانہ حساب نہیں بنا۔" },
  vh_ran: { en: "Ran", rm: "Chale", ur: "چلے" },
  vh_morning_evening: { en: "Morning / Evening", rm: "Subah / shaam", ur: "صبح / شام" },
  vh_waiting_manager: { en: "Waiting for the manager", rm: "Manager ke intezar mein", ur: "منیجر کے انتظار میں" },
  vh_system_caught: { en: "The system caught this:", rm: "Nizam ne ye pakRa:", ur: "نظام نے یہ پکڑا:" },

  // ---- Kisan ka qarza ----
  fl_new_loan: { en: "Give a New Loan", rm: "Naya qarza dein", ur: "نیا قرضہ دیں" },
  fl_none: { en: "No loans.", rm: "Koi qarza nahi hai.", ur: "کوئی قرضہ نہیں ہے۔" },
  fl_loan_amount: { en: "Loan Amount", rm: "Qarze ki raqam", ur: "قرضے کی رقم" },
  fl_loan_amount_req: { en: "Loan Amount (Rs.) *", rm: "Qarze ki raqam (Rs.) *", ur: "قرضے کی رقم (روپے) *" },
  fl_farmer_req: { en: "Farmer *", rm: "Kisan *", ur: "کسان *" },
  fl_weekly: { en: "Weekly Installment", rm: "Hafte ki qist", ur: "ہفتے کی قسط" },
  fl_weekly_req: { en: "Weekly Installment (Rs.) *", rm: "Hafte ki qist (Rs.) *", ur: "ہفتے کی قسط (روپے) *" },
  fl_how_it_works: {
    en: "The loan amount goes straight into the farmer's wallet. Each week the installment is deducted from that wallet automatically and the loan comes down.",
    rm: "Qarze ki raqam foran kisan ke batwe mein chali jayegi. Har hafte usi batwe se qist khud kat kar qarza kam hota rahega.",
    ur: "قرضے کی رقم فوراً کسان کے بٹوے میں چلی جائے گی۔ ہر ہفتے اسی بٹوے سے قسط خود کٹ کر قرضہ کم ہوتا رہے گا۔",
  },
  fl_eg_10000: { en: "e.g. 10000", rm: "jaise 10000", ur: "جیسے 10000" },
  fl_eg_500: { en: "e.g. 500", rm: "jaise 500", ur: "جیسے 500" },

  // ---- Test data ka reset ----
  rt_delete_test: { en: "Delete Test Data", rm: "Test data mita dein", ur: "ٹیسٹ ڈیٹا مٹا دیں" },
  rt_deleted: { en: "Test data deleted. Refresh the page.", rm: "Test data mit gaya. Safha dobara kholein.", ur: "ٹیسٹ ڈیٹا مٹ گیا۔ صفحہ دوبارہ کھولیں۔" },
  rt_survives: {
    en: "These survive: products, staff/admin, branches/shops, website content, and settings.",
    rm: "Ye bach jayenge: cheezein, staff/admin, shakhein/dukanein, website ka mawad, aur settings.",
    ur: "یہ بچ جائیں گے: چیزیں، عملہ/ایڈمن، شاخیں/دکانیں، ویب سائٹ کا مواد، اور سیٹنگز۔",
  },
  rt_type_exactly: { en: "To confirm, type exactly", rm: "Tasdeeq ke liye neeche bilkul", ur: "تصدیق کے لیے نیچے بالکل" },
  rt_type_word: { en: "below:", rm: "likhein:", ur: "لکھیں:" },
  rt_yes_delete_all: { en: "Yes, delete everything", rm: "Haan, sab mita dein", ur: "ہاں، سب مٹا دیں" },
  rt_will_delete_forever: { en: "will delete forever", rm: "hamesha ke liye mita dega", ur: "ہمیشہ کے لیے مٹا دے گا" },
  rt_we_are_live_lock: { en: "We are LIVE — lock it", rm: "Hum LIVE hain -- taala laga dein", ur: "ہم لائیو ہیں — تالا لگا دیں" },
  rt_permanent_lock: { en: "We are LIVE (permanent lock)", rm: "Hum LIVE hain (hamesha ka taala)", ur: "ہم لائیو ہیں (ہمیشہ کا تالا)" },
  rt_yes_lock_forever: { en: "Yes, lock it forever", rm: "Haan, hamesha ke liye taala laga dein", ur: "ہاں، ہمیشہ کے لیے تالا لگا دیں" },
  rt_locked: { en: "LIVE mode is locked. Refresh the page.", rm: "LIVE mode par taala lag gaya. Safha dobara kholein.", ur: "لائیو موڈ پر تالا لگ گیا۔ صفحہ دوبارہ کھولیں۔" },
  rt_system_live: { en: "The system is LIVE", rm: "Nizam LIVE hai", ur: "نظام لائیو ہے" },
  rt_will_close_forever: { en: "will be closed forever", rm: "hamesha ke liye band ho jayega", ur: "ہمیشہ کے لیے بند ہو جائے گا" },
  rt_will_do: { en: "will do.", rm: "kar dega.", ur: "کر دے گا۔" },

  // ---- Qism ka dashboard ----
  cd_products_in_stock: { en: "Products and their stock", rm: "Cheezein aur un ka stock", ur: "چیزیں اور ان کا اسٹاک" },
  cd_with_stock: {
    en: "{n} of {kul} have stock",
    rm: "{kul} mein se {n} par stock hai",
    ur: "{kul} میں سے {n} پر اسٹاک ہے",
  },
  cd_no_threshold: {
    en: "no minimum set on any product — so this is not being tracked",
    rm: "kisi cheez par hadd nahi lagi — is liye ye hisaab rakha hi nahi ja raha",
    ur: "کسی چیز پر حد نہیں لگی — اس لیے یہ حساب رکھا ہی نہیں جا رہا",
  },
  cd_stock_error: {
    en: "Stock could not be read — the numbers below are incomplete",
    rm: "Stock nahi mil saka — neeche ke adad adhoore hain",
    ur: "اسٹاک نہیں مل سکا — نیچے کے اعداد ادھورے ہیں",
  },
  cd_stock_value: { en: "Stock Value", rm: "Stock ki qeemat", ur: "اسٹاک کی قیمت" },
  cd_low_stock: { en: "Low Stock", rm: "Stock kam", ur: "اسٹاک کم" },
  cd_expiring_60: { en: "Expiring (60 days)", rm: "Saath din mein khatam", ur: "ساٹھ دن میں ختم" },
  cd_no_products_cat: { en: "No products in this category yet.", rm: "Is qism mein abhi koi cheez nahi.", ur: "اس قسم میں ابھی کوئی چیز نہیں۔" },
  cd_recent_purchases: { en: "Recent Purchases", rm: "Aakhri kharidari", ur: "آخری خریداری" },
  cd_no_purchases: { en: "No purchases yet.", rm: "Abhi koi kharidari nahi.", ur: "ابھی کوئی خریداری نہیں۔" },
} as const;
