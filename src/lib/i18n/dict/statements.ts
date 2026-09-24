/**
 * Khaton ke gosharay -- supplier, buyer, sarmaya kaar, driver, batwa.
 *
 * PAANCH SAFHE, EK FEHRIST. In sab ki shakl ek hi hai: tareekh,
 * tafseel, debit, credit, baqi. Alag alag fehristein banate to "Closing
 * Balance" paanch jagah paanch dafa likha jata -- aur ek din kisi ek
 * jagah "aakhri baqi" hota aur doosri jagah kuch aur, jabke wo ek hi
 * hisaab hai.
 *
 * MAGAR SAB EK JAISE NAHI HAIN, aur ye farq jaan boojh kar rakha gaya:
 *
 *   Supplier ka aakhri baqi hamesha DENA hota hai, is liye us par
 *   "(dena hai)" likha hai. Buyer ka dono taraf ja sakta hai, is liye
 *   wahan saada "aakhri baqi" hai.
 *
 *   Sarmaya kaar ke khane "debit/credit" nahi, "sarmaya" aur "wapas
 *   diya" hain. Wohi do lafz us ke saath baat karte waqt bole jate
 *   hain; debit/credit us ke liye kaghazi lafz hain.
 *
 * "Software by ZR Technologies" tarjuma nahi hua -- wo banane wale ka
 * naam hai.
 */
export const statementsDict = {
  st_bank_label: { en: "Bank:", rm: "Bank:", ur: "بینک:" },
  st_title_label: { en: "Title:", rm: "Khate ka naam:", ur: "کھاتے کا نام:" },
  st_iban_label: { en: "IBAN:", rm: "IBAN:", ur: "IBAN:" },

  // ---- Sarmaya kaar ----
  st_investment_period: { en: "Investment (this period)", rm: "Sarmaya (is arse mein)", ur: "سرمایہ (اس عرصے میں)" },
  st_returns_paid: { en: "Returns Paid", rm: "Munafa jo diya", ur: "منافع جو دیا" },
  st_overall_invested: { en: "Overall Total Invested", rm: "Ab tak ka kul sarmaya", ur: "اب تک کا کل سرمایہ" },
  st_investment: { en: "Investment", rm: "Sarmaya", ur: "سرمایہ" },
  st_return_paid: { en: "Return Paid", rm: "Wapas diya", ur: "واپس دیا" },
  st_add_investment: { en: "Add Investment", rm: "Sarmaya shamil karein", ur: "سرمایہ شامل کریں" },
  st_save_investment: { en: "Save Investment", rm: "Sarmaya mehfooz karein", ur: "سرمایہ محفوظ کریں" },
  st_record_return: { en: "Record Profit / Return", rm: "Munafa darj karein", ur: "منافع درج کریں" },
  st_save_return: { en: "Save Return", rm: "Munafa mehfooz karein", ur: "منافع محفوظ کریں" },

  // ---- Buyer ----
  st_we_paid: { en: "We paid", rm: "Hum ne diya", ur: "ہم نے دیا" },
  st_they_paid: { en: "They paid", rm: "Unhon ne diya", ur: "انہوں نے دیا" },

  // ---- Driver ----
  st_no_trip: { en: "No trips.", rm: "Koi trip nahi.", ur: "کوئی ٹرپ نہیں۔" },
  st_no_payment_record: { en: "No payment records.", rm: "Adaigi ka koi indraj nahi.", ur: "ادائیگی کا کوئی اندراج نہیں۔" },
  st_no_vehicle_linked: {
    en: "No vehicle is linked to this driver.",
    rm: "Is driver ke saath koi gaari nahi juRi.",
    ur: "اس ڈرائیور کے ساتھ کوئی گاڑی نہیں جڑی۔",
  },
  st_no_maint_record: { en: "No maintenance / fuel records.", rm: "Marammat ya tel ka koi indraj nahi.", ur: "مرمت یا تیل کا کوئی اندراج نہیں۔" },
  st_add_driver_payment: { en: "Add Driver Payment", rm: "Driver ki adaigi shamil karein", ur: "ڈرائیور کی ادائیگی شامل کریں" },
  st_salary: { en: "Salary", rm: "Tankhwah", ur: "تنخواہ" },
  st_bonus: { en: "Bonus", rm: "Bonus", ur: "بونس" },
  st_add_payment: { en: "Add Payment", rm: "Adaigi shamil karein", ur: "ادائیگی شامل کریں" },
  st_add_maint_record: { en: "Add Maintenance / Fuel Record", rm: "Marammat ya tel ka indraj shamil karein", ur: "مرمت یا تیل کا اندراج شامل کریں" },
  st_diesel_fuel: { en: "Diesel / Fuel", rm: "Diesel / tel", ur: "ڈیزل / تیل" },
  st_general_service: { en: "General Service", rm: "Aam service", ur: "عام سروس" },
  st_repair: { en: "Repair", rm: "Marammat", ur: "مرمت" },
  st_odometer_optional: { en: "Odometer (km) — optional", rm: "Meter (km) -- marzi se", ur: "میٹر (کلومیٹر) — مرضی سے" },
  st_add_record: { en: "Add Record", rm: "Indraj shamil karein", ur: "اندراج شامل کریں" },

  // ---- Batwa ----
  st_wallet_statement: { en: "Wallet Statement", rm: "Batwe ka gosharah", ur: "بٹوے کا گوشوارہ" },
  st_no_transaction: { en: "No transactions.", rm: "Koi lein dein nahi.", ur: "کوئی لین دین نہیں۔" },
} as const;

/**
 * Chaar aur safhe -- anaj ki adaigi ki parchi, doodh ke kisan ki
 * settings, staff ka khata, aur company ke kharche.
 *
 * DOODH WALE KISAN KI DO QISMEIN JAAN BOOJH KAR ALAG HAIN: jo khud
 * chhoR kar jata hai, aur jis ke paas hum jate hain. Dono ka rate alag
 * hai (khud lane wale ko incentive milta hai), aur qism na likhi ho to
 * "Not set" likha jata hai -- sifar ya default nahi. Default rakh dene
 * par kisi din kisi kisan ko wo incentive mil jata jo tay hi nahi hua
 * tha.
 *
 * PARCHI PAR "computer se bani hai" wala jumla qasdan hai: us par dastkhat
 * nahi hote, aur kisan ko ye maloom hona chahiye ke saboot us ki apni
 * signed receiving hai, parchi nahi.
 */
export const opsPagesDict = {
  // ---- Anaj ki adaigi ki parchi ----
  ps_slip_title: { en: "AgriBridge — Grain Payment Slip", rm: "AgriBridge -- anaj ki adaigi ki parchi", ur: "ایگری بریج — اناج کی ادائیگی کی پرچی" },
  ps_payment_amount: { en: "Payment Amount", rm: "Adaigi ki raqam", ur: "ادائیگی کی رقم" },
  ps_signed_receiving: { en: "Farmer's Signed Receiving", rm: "Kisan ki dastkhat shuda rasidgi", ur: "کسان کی دستخط شدہ رسیدگی" },
  ps_notes_label: { en: "Notes:", rm: "Note:", ur: "نوٹ:" },
  ps_computer_generated: {
    en: "This is a computer-generated payment slip from the AgriBridge system.",
    rm: "Ye parchi AgriBridge ke nizam se computer par bani hai.",
    ur: "یہ پرچی ایگری بریج کے نظام سے کمپیوٹر پر بنی ہے۔",
  },
  ps_edit_payment: { en: "Edit Payment", rm: "Adaigi tabdeel karein", ur: "ادائیگی تبدیل کریں" },
  ps_amount_rs_dot: { en: "Amount (Rs.)", rm: "Raqam (Rs.)", ur: "رقم (روپے)" },
  ps_account_correction: { en: "Account (for finance correction)", rm: "Khata (finance ki durusti ke liye)", ur: "کھاتہ (فنانس کی درستی کے لیے)" },
  ps_update: { en: "Update", rm: "Tabdeel karein", ur: "تبدیل کریں" },
  ps_pdf_attached: {
    en: "The PDF slip goes straight into the email as an attachment.",
    rm: "PDF parchi seedha email ke saath attachment ban kar chali jayegi.",
    ur: "PDF پرچی سیدھا ای میل کے ساتھ اٹیچمنٹ بن کر چلی جائے گی۔",
  },

  // ---- Doodh ke kisan ki settings ----
  fs_farmer_type: { en: "Farmer Type", rm: "Kisan ki qism", ur: "کسان کی قسم" },
  fs_rate_settings: { en: "Rate Settings", rm: "Rate ki settings", ur: "ریٹ کی سیٹنگز" },
  fs_migration_history: { en: "Migration History", rm: "Tabdeeli ki tafseel", ur: "تبدیلی کی تفصیل" },
  fs_current_type: { en: "Current Type", rm: "Abhi kaunsi qism", ur: "ابھی کون سی قسم" },
  fs_change: { en: "Change", rm: "Badlein", ur: "بدلیں" },
  fs_self_dropoff: { en: "Self Drop-off", rm: "Khud chhoR kar jata hai", ur: "خود چھوڑ کر جاتا ہے" },
  fs_field_collection: { en: "Field Collection", rm: "Hum khet se lete hain", ur: "ہم کھیت سے لیتے ہیں" },
  fs_not_set: { en: "Not set", rm: "Tay nahi hui", ur: "طے نہیں ہوئی" },
  fs_no_farmer: { en: "No farmer found.", rm: "Koi kisan nahi mila.", ur: "کوئی کسان نہیں ملا۔" },
  fs_settings_saved: { en: "Settings saved.", rm: "Settings mehfooz ho gayin.", ur: "سیٹنگز محفوظ ہو گئیں۔" },
  fs_standard_rate: { en: "Standard Rate (Rs/L)", rm: "Aam rate (Rs/L)", ur: "عام ریٹ (روپے فی لیٹر)" },
  fs_dropoff_incentive: { en: "Self Drop-off Incentive (Rs/L)", rm: "Khud lane par ziyada (Rs/L)", ur: "خود لانے پر زیادہ (روپے فی لیٹر)" },
  fs_snf_constant: { en: "SNF Formula Constant", rm: "SNF formule ka adad", ur: "SNF فارمولے کا عدد" },
  fs_reference_ts: { en: "Reference TS %", rm: "Reference TS %", ur: "ریفرنس TS %" },
  fs_no_change_history: { en: "No change history.", rm: "Tabdeeli ka koi indraj nahi.", ur: "تبدیلی کا کوئی اندراج نہیں۔" },

  // ---- Staff ka khata ----
  sk_balances: { en: "Staff Khata Balances", rm: "Staff ke khaton ka baqi", ur: "عملے کے کھاتوں کا باقی" },
  sk_no_balance: { en: "No staff balances.", rm: "Kisi staff ka koi baqi nahi.", ur: "کسی عملے کا کوئی باقی نہیں۔" },
  sk_recent_ledger: { en: "Recent Ledger", rm: "Aakhri indraj", ur: "آخری اندراج" },
  sk_no_entry: { en: "No entries.", rm: "Koi indraj nahi.", ur: "کوئی اندراج نہیں۔" },
  sk_grocery: { en: "Grocery", rm: "Rashan", ur: "راشن" },
  sk_month_end: { en: "Month-End Process", rm: "Mahine ke aakhir ka amal", ur: "مہینے کے آخر کا عمل" },
  sk_process: { en: "Process", rm: "Chalayein", ur: "چلائیں" },

  // ---- Company ke kharche ----
  ce_no_request: { en: "No expense requests.", rm: "Kharche ki koi darkhwast nahi.", ur: "خرچے کی کوئی درخواست نہیں۔" },
  ce_write_reason: { en: "Write the reason", rm: "Wajah likhein", ur: "وجہ لکھیں" },
  ce_request_expense: { en: "Request Expense", rm: "Kharche ki darkhwast dein", ur: "خرچے کی درخواست دیں" },
  ce_document_upload: { en: "Document / Receipt Upload (optional)", rm: "Kaghaz / raseed lagayein (marzi se)", ur: "کاغذ / رسید لگائیں (مرضی سے)" },
} as const;
