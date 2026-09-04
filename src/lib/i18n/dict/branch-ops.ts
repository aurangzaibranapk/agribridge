/**
 * Dukanein, drivers, produce/bridge orders, business dashboard, aur
 * bank ka milaan.
 *
 * BANK KE MILAAN PAR TEEN KHANE ALAG HAIN: bank ke mutabiq, hamare
 * khate ke mutabiq, aur farq. Sirf "farq" dikhana aasan tha, magar
 * banda pehle ye dekhna chahta hai ke DONO taraf kya likha hai -- warna
 * usay pata nahi chalta ke ghalti kis taraf hai.
 *
 * "Bank ke paas hain, hamare khate mein nahi" alag qatar hai. Ye wo
 * lein dein hain jo bank ne dikha di magar hum ne likhi hi nahi. Inhen
 * "farq" ke andar chhupa dena us kaam ko gum kar deta hai jo asal mein
 * karna hai: unhen apne khate mein darj karna.
 *
 * DUKAN KI QISMEIN (karyana, dairy, anaj, machinery, agri inputs) alag
 * rakhi gayi hain kyunke har qism ka hisaab alag chalta hai -- ek hi
 * "shop" rakhne par report kabhi ye na bata pati ke kaunsa karobar
 * chal raha hai aur kaunsa nahi.
 */
export const branchOpsDict = {
  // ---- Sab supplier ka gosharah ----
  sa_title: { en: "All Suppliers — Statement", rm: "Sab supplier -- gosharah", ur: "سب سپلائر — گوشوارہ" },
  sa_net_payable: { en: "Net Payable", rm: "Saaf dena", ur: "صاف دینا" },
  sa_purchases: { en: "Purchases", rm: "Kharidari", ur: "خریداری" },
  sa_payments: { en: "Payments", rm: "Adaigi", ur: "ادائیگی" },
  sa_view_detail: { en: "View detail", rm: "Tafseel dekhein", ur: "تفصیل دیکھیں" },

  // ---- Digital agreement ----
  ag_company_sign: { en: "Sign on the Company's Behalf", rm: "Company ki taraf se sign karein", ur: "کمپنی کی طرف سے سائن کریں" },
  ag_company_sign_btn: { en: "Company Sign", rm: "Company sign karein", ur: "کمپنی سائن کرے" },
  ag_save_sign: { en: "Save Signature", rm: "Sign mehfooz karein", ur: "سائن محفوظ کریں" },
  ag_email_link: { en: "Email the Link to the Landlord", rm: "Landlord ko link email karein", ur: "لینڈ لارڈ کو لنک ای میل کریں" },
  ag_email_link_btn: { en: "Email the Link", rm: "Link email karein", ur: "لنک ای میل کریں" },
  ag_copy_link: { en: "Copy the Landlord's Link", rm: "Landlord ka link copy karein", ur: "لینڈ لارڈ کا لنک کاپی کریں" },
  ag_landlord_email: { en: "Landlord's email", rm: "Landlord ka email", ur: "لینڈ لارڈ کا ای میل" },

  // ---- Dukanein ----
  sh_none: { en: "No shops", rm: "Koi dukan nahi", ur: "کوئی دکان نہیں" },
  sh_new: { en: "New Shop", rm: "Nayi dukan", ur: "نئی دکان" },
  sh_add_new: { en: "Add a New Shop", rm: "Nayi dukan shamil karein", ur: "نئی دکان شامل کریں" },
  sh_name_eg: { en: "Shop name (e.g. Karyana Shop)", rm: "Dukan ka naam (misal: karyana ki dukan)", ur: "دکان کا نام (مثال: کریانہ کی دکان)" },
  sh_code_eg: { en: "Code (optional, e.g. MB-KAR)", rm: "Code (marzi se, misal: MB-KAR)", ur: "کوڈ (مرضی سے، مثال: MB-KAR)" },
  sh_karyana: { en: "Karyana (grocery)", rm: "Karyana", ur: "کریانہ" },
  sh_dairy: { en: "Dairy", rm: "Doodh", ur: "دودھ" },
  sh_grain: { en: "Grain Procurement", rm: "Anaj ki kharidari", ur: "اناج کی خریداری" },
  sh_machinery: { en: "Machinery & Fleet", rm: "Machinery aur gaariyan", ur: "مشینری اور گاڑیاں" },
  sh_agri_inputs: { en: "Agri Inputs (fertilizer / pesticide / feed)", rm: "Kheti ka saman (khaad / zehr / wanda)", ur: "کھیتی کا سامان (کھاد / زہر / ونڈا)" },

  // Dukan ki tafseel badalna, halat, aur mitana (291)
  sh_edit: { en: "Edit", rm: "Tafseel badlein", ur: "تفصیل بدلیں" },
  sh_edit_title: { en: "Edit the Shop", rm: "Dukan ki tafseel", ur: "دکان کی تفصیل" },
  sh_save: { en: "Save", rm: "Mehfooz karein", ur: "محفوظ کریں" },
  sh_cancel: { en: "Cancel", rm: "Rehne dein", ur: "رہنے دیں" },
  sh_status: { en: "Status", rm: "Halat", ur: "حالت" },
  sh_active: { en: "Running", rm: "Chal rahi hai", ur: "چل رہی ہے" },
  sh_inactive: { en: "Closed", rm: "Band hai", ur: "بند ہے" },
  sh_suspended: { en: "Suspended", rm: "Roki gayi hai", ur: "روکی گئی ہے" },
  sh_make_active: { en: "Reopen", rm: "Chalu karein", ur: "چالو کریں" },
  sh_make_inactive: { en: "Close", rm: "Band karein", ur: "بند کریں" },
  sh_suspend: { en: "Suspend", rm: "Rok dein", ur: "روک دیں" },
  sh_suspend_title: { en: "Suspend this Shop", rm: "Dukan rok dein", ur: "دکان روک دیں" },
  sh_suspend_reason: { en: "Why is it being suspended?", rm: "Rokne ki wajah kya hai?", ur: "روکنے کی وجہ کیا ہے؟" },
  sh_suspend_reason_eg: {
    en: "e.g. licence expired / stock audit under way",
    rm: "misal: licence khatam / maal ki ginti ho rahi hai",
    ur: "مثال: لائسنس ختم / مال کی گنتی ہو رہی ہے",
  },
  sh_suspend_note: {
    en: "A closed shop is closed by choice; a suspended shop is stopped by a decision — so the reason is recorded.",
    rm: "Band dukan apni marzi se band hai; roki hui dukan kisi faisle se ruki hai — is liye wajah likhi jati hai.",
    ur: "بند دکان اپنی مرضی سے بند ہے؛ روکی ہوئی دکان کسی فیصلے سے رکی ہے — اس لیے وجہ لکھی جاتی ہے۔",
  },
  sh_suspended_since: { en: "Suspended since", rm: "Roki gayi", ur: "روکی گئی" },
  sh_delete_locked: {
    en: "A shop holding stock, sales or staff cannot be deleted — close or suspend it instead.",
    rm: "Jis dukan par maal, bikri ya mulazim hon wo nahi mitti — usay band ya roki hui kar dein.",
    ur: "جس دکان پر مال، بکری یا ملازم ہوں وہ نہیں مٹتی — اسے بند یا روکی ہوئی کر دیں۔",
  },

  // ---- Dukan ka kiraya (baqi) ----
  sr_none_yet: { en: "No rent agreement made yet.", rm: "Abhi koi kiraya agreement nahi bani.", ur: "ابھی کوئی کرایہ ایگریمنٹ نہیں بنی۔" },
  sr_make_agreement: { en: "Create a Rent Agreement", rm: "Kiraya agreement banayein", ur: "کرایہ ایگریمنٹ بنائیں" },
  sr_digital_agreement: { en: "Digital Agreement (sign it)", rm: "Digital agreement (sign karein)", ur: "ڈیجیٹل ایگریمنٹ (سائن کریں)" },
  sr_company_stamp_short: { en: "Company Stamp", rm: "Company ki mohar", ur: "کمپنی کی مہر" },
  sr_add_bill: { en: "Add Bill", rm: "Bill shamil karein", ur: "بل شامل کریں" },
  sr_future_month: { en: "You can also pick a future month and", rm: "Aage ke mahine chun kar bhi", ur: "آگے کے مہینے چن کر بھی" },
  sr_can_also: { en: "do it.", rm: "kar sakte hain.", ur: "کر سکتے ہیں۔" },

  // ---- Produce / bridge orders ----
  po_title: { en: "Produce Orders", rm: "Fasal ke order", ur: "فصل کے آرڈر" },
  po_none: { en: "No produce orders yet", rm: "Abhi fasal ka koi order nahi", ur: "ابھی فصل کا کوئی آرڈر نہیں" },
  po_order_hash: { en: "Order #", rm: "Order #", ur: "آرڈر #" },
  bo_title: { en: "Bridge Orders", rm: "Bridge order", ur: "برج آرڈر" },
  bo_none: { en: "No orders yet", rm: "Abhi koi order nahi", ur: "ابھی کوئی آرڈر نہیں" },
  bo_marketplace: { en: "Marketplace", rm: "Marketplace", ur: "مارکیٹ پلیس" },
  bo_area: { en: "Area", rm: "Ilaqa", ur: "علاقہ" },
  bo_action_payment: { en: "Action / Payment", rm: "Kaam / adaigi", ur: "کام / ادائیگی" },

  // ---- Drivers ----
  dr_none: { en: "No driver registered.", rm: "Koi driver darj nahi hai.", ur: "کوئی ڈرائیور درج نہیں ہے۔" },
  dr_add_new: { en: "Add a New Driver", rm: "Naya driver shamil karein", ur: "نیا ڈرائیور شامل کریں" },
  dr_name: { en: "Driver Name", rm: "Driver ka naam", ur: "ڈرائیور کا نام" },
  dr_license: { en: "Licence Number (optional)", rm: "Licence number (marzi se)", ur: "لائسنس نمبر (مرضی سے)" },
  dr_vehicle_no: { en: "Vehicle No.", rm: "Gaari ka number", ur: "گاڑی کا نمبر" },
  dr_vehicle_type: { en: "Vehicle Type (truck / van / etc.)", rm: "Gaari ki qism (truck / van / waghera)", ur: "گاڑی کی قسم (ٹرک / وین / وغیرہ)" },
  dr_vehicle_optional: {
    en: "Vehicle (optional — you can add it now or later)",
    rm: "Gaari (marzi se -- abhi ya baad mein shamil kar sakte hain)",
    ur: "گاڑی (مرضی سے — ابھی یا بعد میں شامل کر سکتے ہیں)",
  },
  dr_view_statement: { en: "View Statement", rm: "Gosharah dekhein", ur: "گوشوارہ دیکھیں" },

  // ---- Business dashboard ----
  bd_title: { en: "Business Dashboard", rm: "Karobar ka dashboard", ur: "کاروبار کا ڈیش بورڈ" },
  bd_sales_month: { en: "Sales (this month)", rm: "Bikri (is mahine)", ur: "بکری (اس مہینے)" },
  bd_purchases_month: { en: "Purchases (this month)", rm: "Kharidari (is mahine)", ur: "خریداری (اس مہینے)" },
  bd_cash_month: { en: "Cash Received (this month)", rm: "Naqad mila (is mahine)", ur: "نقد ملا (اس مہینے)" },
  bd_milk_month: { en: "Milk Collection (this month)", rm: "Doodh jama (is mahine)", ur: "دودھ جمع (اس مہینے)" },
  bd_profit_month: { en: "Profit (this month, est.)", rm: "Nafa (is mahine, andaza)", ur: "نفع (اس مہینے، اندازہ)" },
  bd_khata_outstanding: { en: "Khata Outstanding", rm: "Khaton par baqi", ur: "کھاتوں پر باقی" },
  bd_owed_milk_farmers: { en: "Owed to Milk Farmers", rm: "Doodh wale kisanon ko dena", ur: "دودھ والے کسانوں کو دینا" },
  bd_sales_trend: { en: "Sales Trend (last 7 days)", rm: "Bikri ka rukh (pichle 7 din)", ur: "بکری کا رخ (پچھلے 7 دن)" },

  // ---- Bank ka milaan ----
  br_title: { en: "Reconcile with the Bank", rm: "Bank se milaan", ur: "بینک سے ملان" },
  br_all_banks: { en: "Reconciliation for all banks", rm: "Milaan sab banks ka", ur: "ملان سب بینکوں کا" },
  br_only_finance: {
    en: "This page is for Finance and Admin only — they are the ones who see the bank statement.",
    rm: "Ye safha sirf Finance aur Admin ke liye hai -- bank ka gosharah wohi dekhte hain.",
    ur: "یہ صفحہ صرف فنانس اور ایڈمن کے لیے ہے — بینک کا گوشوارہ وہی دیکھتے ہیں۔",
  },
  br_paste_statement: { en: "Paste the statement", rm: "Gosharah daalein", ur: "گوشوارہ ڈالیں" },
  br_per_bank: { en: "According to the bank", rm: "Bank ke mutabiq", ur: "بینک کے مطابق" },
  br_per_our_books: { en: "According to our books", rm: "Hamare khate ke mutabiq", ur: "ہمارے کھاتے کے مطابق" },
  br_difference: { en: "Difference", rm: "Farq", ur: "فرق" },
  br_bank_only: {
    en: "The bank has these, our books do not",
    rm: "Bank ke paas hain, hamare khate mein nahi",
    ur: "بینک کے پاس ہیں، ہمارے کھاتے میں نہیں",
  },
  br_all_matched: {
    en: "Every row from the bank exists in our books.",
    rm: "Bank ki har qatar hamare khate mein maujood hai.",
    ur: "بینک کی ہر قطار ہمارے کھاتے میں موجود ہے۔",
  },
  br_matched_with: { en: "matched with", rm: "mila kar", ur: "ملا کر" },
} as const;
