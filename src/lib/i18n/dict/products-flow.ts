/**
 * Maal andar lene, CSV se charhane, aur bill se rate bharne ke safhe.
 *
 * TEEN LAFZ JAAN BOOJH KAR AISE HI:
 *
 *   "Trade rate" teenon zabanon mein wohi rehta hai. Dukan par ye lafz
 *   isi tarah bola jata hai; "purchase price" likhna daftari lagta hai
 *   aur counter par koi nahi pehchanta.
 *
 *   "Baqi" aur "sifar" ka farq har zaban mein RAKHA gaya hai. Jahan
 *   rate abhi maloom nahi, wahan "—" ya "baqi" aata hai, Rs 0 nahi.
 *   Ye is project ka wohi usool hai: "hisaab nahi rakha jata" aur
 *   "sifar" ek cheez nahi.
 *
 *   "Barcode", "CSV", "MRP" waise ke waise hain -- ye chhape hue lafz
 *   hain, tarjuma un ko pehchanne se rok deta hai.
 */
export const productsFlowDict = {
  // =====================================================================
  // Maal Andar (intake)
  // =====================================================================
  pf_intake_title: { en: "Product Intake", rm: "Maal Andar", ur: "مال اندر" },
  pf_intake_desc: {
    en: "Scan the barcode, add a photo of the pack, and AI fills the fields. Check everything, approve it all at once — then the goods enter the warehouse.",
    rm: "Barcode scan karein, dabbe ki tasveer lagayein, AI khane bhar degi. Sab dekh kar ek sath manzoor karein — phir maal warehouse mein aa jayega.",
    ur: "بارکوڈ اسکین کریں، ڈبے کی تصویر لگائیں، AI خانے بھر دے گی۔ سب دیکھ کر ایک ساتھ منظور کریں — پھر مال گودام میں آ جائے گا۔",
  },
  pf_intake_gate: {
    en: "This page is for the Owner, Admin and Warehouse staff — products are created here and stock comes in here.",
    rm: "Ye safha Owner, Admin aur Warehouse wale ke liye hai — yahin se products bante hain aur stock andar aata hai.",
    ur: "یہ صفحہ مالک، ایڈمن اور گودام والے کے لیے ہے — یہیں سے پروڈکٹ بنتے ہیں اور اسٹاک اندر آتا ہے۔",
  },
  pf_intake_gate_short: {
    en: "This page is for the Owner, Admin and Warehouse staff.",
    rm: "Ye safha Owner, Admin aur Warehouse wale ke liye hai.",
    ur: "یہ صفحہ مالک، ایڈمن اور گودام والے کے لیے ہے۔",
  },
  pf_past_batches: { en: "Past rounds", rm: "Pichhle chakkar", ur: "پچھلے چکر" },
  pf_no_batches: {
    en: "No rounds yet. Start a new one above.",
    rm: "Abhi koi chakkar nahi. Upar se naya shuru karein.",
    ur: "ابھی کوئی چکر نہیں۔ اوپر سے نیا شروع کریں۔",
  },
  pf_rows: { en: "rows", rm: "qatarein", ur: "قطاریں" },
  pf_approved: { en: "approved", rm: "manzoor", ur: "منظور" },
  pf_ready: { en: "ready", rm: "tayyar", ur: "تیار" },
  pf_running: { en: "in progress", rm: "chal raha hai", ur: "چل رہا ہے" },

  pf_batch_name: { en: "Name this round", rm: "Is chakkar ka naam", ur: "اس چکر کا نام" },
  pf_ka_maal: { en: "goods", rm: "ka maal", ur: "کا مال" },
  pf_where_goods: { en: "Where the goods will go", rm: "Maal kahan aayega", ur: "مال کہاں آئے گا" },
  pf_start: { en: "Start", rm: "Shuru karein", ur: "شروع کریں" },
  pf_back: { en: "Back", rm: "Wapas", ur: "واپس" },

  pf_after_approve_wh: {
    en: 'After approval the goods enter "{warehouse}". From there they move to the shops by stock transfer.',
    rm: 'Manzoori ke baad maal "{warehouse}" mein aayega. Wahan se dukanon par stock transfer se jayega.',
    ur: 'منظوری کے بعد مال "{warehouse}" میں آئے گا۔ وہاں سے دکانوں پر اسٹاک ٹرانسفر سے جائے گا۔',
  },
  pf_after_approve: {
    en: "After approval the goods enter the warehouse.",
    rm: "Manzoori ke baad maal warehouse mein aayega.",
    ur: "منظوری کے بعد مال گودام میں آئے گا۔",
  },

  pf_scan_barcode: { en: "Scan barcode", rm: "Barcode scan karein", ur: "بارکوڈ اسکین کریں" },
  pf_without_barcode: { en: "Without a barcode", rm: "Bina barcode ke", ur: "بغیر بارکوڈ کے" },
  pf_incomplete: { en: "incomplete", rm: "adhoori", ur: "ادھوری" },
  pf_nothing_yet: {
    en: "Nothing here yet. Pick up a pack and press Scan barcode.",
    rm: "Abhi kuch nahi. Dabba haath mein lein aur Barcode scan karein dabayein.",
    ur: "ابھی کچھ نہیں۔ ڈبہ ہاتھ میں لیں اور بارکوڈ اسکین کریں دبائیں۔",
  },
  pf_approve_n: { en: "Approve {n} products", rm: "{n} products manzoor karein", ur: "{n} پروڈکٹ منظور کریں" },
  pf_incomplete_warn: {
    en: "{n} rows are incomplete (name or sale rate missing) — those will not go up",
    rm: "{n} qatarein adhoori hain (naam ya sale rate baqi) — wo charhengi nahi",
    ur: "{n} قطاریں ادھوری ہیں (نام یا سیل ریٹ باقی) — وہ چڑھیں گی نہیں",
  },
  pf_batch_done: {
    en: "This round is approved — the goods are in the warehouse.",
    rm: "Ye chakkar manzoor ho chuka hai — maal warehouse mein aa gaya.",
    ur: "یہ چکر منظور ہو چکا ہے — مال گودام میں آ گیا۔",
  },
  pf_ai_filled: { en: "AI filled this", rm: "AI ne bhara", ur: "AI نے بھرا" },
  pf_expiry_from_batch: {
    en: "Expiry belongs to the batch. Once stock with an expiry arrives (purchase, sheet, or Maal Andar), this shows the nearest batch's date and hand edits are overridden.",
    rm: "Miyaad batch ki hoti hai. Jab miyaad wala maal aaye (purchase, sheet ya Maal Andar), yahan sab se qareeb batch ki tareekh dikhti hai aur haath se likhi tareekh nahi tikti.",
    ur: "میعاد بیچ کی ہوتی ہے۔ جب میعاد والا مال آئے (پرچیز، شیٹ یا مال اندر)، یہاں سب سے قریب بیچ کی تاریخ دکھتی ہے اور ہاتھ سے لکھی تاریخ نہیں ٹکتی۔",
  },
  pf_photo_uploading: { en: "Uploading…", rm: "Charh rahi hai…", ur: "چڑھ رہی ہے…" },
  pf_photo_change: { en: "Change photo", rm: "Tasveer badlein", ur: "تصویر بدلیں" },
  pf_photo_add: { en: "Add photo", rm: "Tasveer lagayein", ur: "تصویر لگائیں" },
  pf_photo_failed: {
    en: "The photo could not be uploaded.",
    rm: "Tasveer charh nahi saki.",
    ur: "تصویر چڑھ نہیں سکی۔",
  },

  pf_f_name: { en: "Product name", rm: "Product ka naam", ur: "پروڈکٹ کا نام" },
  pf_f_brand: { en: "Brand", rm: "Brand", ur: "برانڈ" },
  pf_f_company: { en: "Company", rm: "Company", ur: "کمپنی" },
  pf_f_category: { en: "Category", rm: "Qism", ur: "قسم" },
  pf_f_pack: { en: "Pack size", rm: "Pack size", ur: "پیک سائز" },
  pf_f_unit: { en: "Unit", rm: "Ikai", ur: "اکائی" },
  pf_f_qty_in: { en: "How many came in", rm: "Kitne aaye", ur: "کتنے آئے" },
  pf_f_trade: { en: "Trade rate", rm: "Trade rate", ur: "ٹریڈ ریٹ" },
  pf_f_trade_ph: { en: "from the bill", rm: "bill se", ur: "بل سے" },
  pf_f_trade_hint: {
    en: "Not printed on the pack — fill it from the bill or leave it blank",
    rm: "Dabbe par nahi hota — bill se bharein ya khali chhoRein",
    ur: "ڈبے پر نہیں ہوتا — بل سے بھریں یا خالی چھوڑیں",
  },
  pf_f_sale: { en: "Sale rate", rm: "Sale rate", ur: "سیل ریٹ" },
  pf_f_mrp: { en: "Printed price (MRP)", rm: "Chhapi hui qeemat (MRP)", ur: "چھپی ہوئی قیمت (MRP)" },
  pf_f_wholesale: { en: "Wholesale rate", rm: "Thok ka rate", ur: "تھوک کا ریٹ" },
  pf_f_wholesale_ph: {
    en: "not sold wholesale",
    rm: "thok par nahi milta",
    ur: "تھوک پر نہیں ملتا",
  },
  pf_f_wholesale_hint: {
    en: "Blank = not sold wholesale",
    rm: "Khali = thok par nahi milta",
    ur: "خالی = تھوک پر نہیں ملتا",
  },
  pf_f_mfg: { en: "Manufacturing", rm: "Manufacturing", ur: "تیاری کی تاریخ" },
  pf_f_expiry: { en: "Expiry", rm: "Expiry", ur: "میعاد" },
  pf_f_barcode: { en: "Barcode", rm: "Barcode", ur: "بارکوڈ" },

  pf_bc_scanner: {
    en: "from the scanner — the bars were read",
    rm: "scanner se — lakeerein parhi gayin",
    ur: "اسکینر سے — لکیریں پڑھی گئیں",
  },
  pf_bc_ai: { en: "AI read it — please check", rm: "AI ne parha — jaanch lein", ur: "AI نے پڑھا — جانچ لیں" },
  pf_bc_manual: { en: "typed by hand", rm: "haath se likha", ur: "ہاتھ سے لکھا" },
  pf_bc_bad_digit: {
    en: " · check digit is wrong",
    rm: " · check digit theek nahi",
    ur: " · چیک ڈیجٹ ٹھیک نہیں",
  },

  pf_save: { en: "Save", rm: "Mehfooz karein", ur: "محفوظ کریں" },
  pf_saved: { en: "Saved.", rm: "Mehfooz ho gaya.", ur: "محفوظ ہو گیا۔" },
  pf_drop_row: { en: "drop this row", rm: "ye qatar chhoR dein", ur: "یہ قطار چھوڑ دیں" },

  // =====================================================================
  // CSV se charhana (import)
  // =====================================================================
  pf_import_title: { en: "Import products from CSV", rm: "Products CSV se charhayein", ur: "پروڈکٹ CSV سے چڑھائیں" },
  pf_import_desc: {
    en: "Preview first — what will be created, what will be skipped, where the mistakes are. Only then does it go up.",
    rm: "Pehle preview — kya banega, kya chhoRa jayega, kahan ghalti hai. Us ke baad hi charhega.",
    ur: "پہلے پیش نظارہ — کیا بنے گا، کیا چھوڑا جائے گا، کہاں غلطی ہے۔ اس کے بعد ہی چڑھے گا۔",
  },
  pf_import_gate: {
    en: "This page is for the Owner and Admin only. One file builds the whole catalogue — that is why this door is not left open.",
    rm: "Ye safha sirf Owner aur Admin ke liye hai. Ek file poora catalogue banati hai — is liye ye darwaza khula nahi rakha gaya.",
    ur: "یہ صفحہ صرف مالک اور ایڈمن کے لیے ہے۔ ایک فائل پورا کیٹلاگ بناتی ہے — اس لیے یہ دروازہ کھلا نہیں رکھا گیا۔",
  },
  pf_pending_rate_warn: {
    en: "products have no trade rate filled in yet. Their profit cannot be worked out. Fill it in when the supplier's bill arrives.",
    rm: "products aise hain jin ka trade rate abhi nahi bhara. Un par munafa ka hisaab abhi nahi banta. Supplier ka bill aane par bhar dein.",
    ur: "پروڈکٹ ایسے ہیں جن کا ٹریڈ ریٹ ابھی نہیں بھرا۔ ان پر منافع کا حساب ابھی نہیں بنتا۔ سپلائر کا بل آنے پر بھر دیں۔",
  },
  pf_pick_csv: { en: "Choose a CSV file", rm: "CSV file chunein", ur: "CSV فائل چنیں" },
  pf_or_paste: {
    en: "— or select the cells in Excel, copy them, and paste below",
    rm: "— ya Excel mein khane chun kar copy karein aur neeche paste kar dein",
    ur: "— یا ایکسل میں خانے چن کر کاپی کریں اور نیچے پیسٹ کر دیں",
  },
  pf_preview_first: { en: "Preview first", rm: "Pehle dekhein", ur: "پہلے دیکھیں" },
  pf_fill_sample: { en: "fill in a sample", rm: "namoona bhar dein", ur: "نمونہ بھر دیں" },
  pf_column_names: { en: "Column names", rm: "Khanon ke naam", ur: "خانوں کے نام" },
  pf_required: { en: "Required:", rm: "Lazmi:", ur: "لازمی:" },
  pf_optional: { en: "Optional:", rm: "Ikhtiyari:", ur: "اختیاری:" },
  pf_date_rule: {
    en: "A date like {sample} is read as {day} (day first). Write only the month ({month}) and the last day of that month is used.",
    rm: "Tareekh {sample} ka matlab {day} liya jayega (din pehle). Sirf mahina likhein ({month}) to us mahine ka aakhri din.",
    ur: "تاریخ {sample} کا مطلب {day} لیا جائے گا (دن پہلے)۔ صرف مہینہ لکھیں ({month}) تو اس مہینے کا آخری دن۔",
  },
  pf_day_5_sep: { en: "5 September", rm: "5 September", ur: "5 ستمبر" },
  pf_exact_names: {
    en: "Category, brand and company names must match exactly what is already on record — otherwise the field stays empty. New ones are not created automatically (one wrong letter makes two separate brands).",
    rm: "Qism, brand aur company ka naam hu ba hu wohi hona chahiye jo pehle se darj hai — warna khali reh jayega. Naya khud se nahi banta (ek harf ki ghalti do alag brand bana deti hai).",
    ur: "قسم، برانڈ اور کمپنی کا نام ہو بہو وہی ہونا چاہیے جو پہلے سے درج ہے — ورنہ خالی رہ جائے گا۔ نیا خود سے نہیں بنتا (ایک حرف کی غلطی دو الگ برانڈ بنا دیتی ہے)۔",
  },
  pf_existing_cats: { en: "Categories on record:", rm: "Maujood qismein:", ur: "موجود قسمیں:" },
  pf_existing_brands: { en: "Brands on record:", rm: "Maujood brands:", ur: "موجود برانڈز:" },
  pf_existing_companies: { en: "Companies on record:", rm: "Maujood companies:", ur: "موجود کمپنیاں:" },

  pf_will_create: { en: "{n} will be created", rm: "{n} banenge", ur: "{n} بنیں گے" },
  pf_already_there: { en: "{n} already exist", rm: "{n} pehle se hain", ur: "{n} پہلے سے ہیں" },
  pf_has_errors: { en: "{n} have mistakes", rm: "{n} mein ghalti", ur: "{n} میں غلطی" },
  pf_no_trade_n: { en: "{n} have no trade rate", rm: "{n} ka trade rate nahi", ur: "{n} کا ٹریڈ ریٹ نہیں" },
  pf_no_wholesale_n: { en: "{n} have no wholesale rate", rm: "{n} par thok ka rate nahi", ur: "{n} پر تھوک کا ریٹ نہیں" },

  pf_th_name: { en: "Name", rm: "Naam", ur: "نام" },
  pf_th_pack: { en: "Pack", rm: "Pack", ur: "پیک" },
  pf_th_trade: { en: "Trade", rm: "Trade", ur: "ٹریڈ" },
  pf_th_sale: { en: "Sale", rm: "Sale", ur: "سیل" },
  pf_th_wholesale: { en: "Wholesale", rm: "Thok", ur: "تھوک" },
  pf_th_expiry: { en: "Expiry", rm: "Expiry", ur: "میعاد" },
  pf_th_state: { en: "State", rm: "Haalat", ur: "حالت" },

  pf_row_new: { en: "will be created", rm: "banega", ur: "بنے گا" },
  pf_row_dup: { en: "already there", rm: "pehle se hai", ur: "پہلے سے ہے" },
  pf_row_error: { en: "mistake", rm: "ghalti", ur: "غلطی" },
  pf_pending_word: { en: "pending", rm: "baqi", ur: "باقی" },

  pf_upload_n: { en: "Upload {n} products", rm: "{n} products charhayein", ur: "{n} پروڈکٹ چڑھائیں" },
  pf_skipped_note: {
    en: "{skipped} rows will be left out — only {ready} will be created.",
    rm: "{skipped} qatarein chhoR di jayengi — sirf {ready} banenge.",
    ur: "{skipped} قطاریں چھوڑ دی جائیں گی — صرف {ready} بنیں گے۔",
  },
  pf_see_products: { en: "See products", rm: "Products dekhein", ur: "پروڈکٹ دیکھیں" },

  // =====================================================================
  // Bill se Trade Rate
  // =====================================================================
  pf_bill_title: { en: "Trade Rate from Bill", rm: "Bill se Trade Rate", ur: "بل سے ٹریڈ ریٹ" },
  pf_bill_desc: {
    en: "Add a photo of the supplier's bill. AI reads the rate on every line — you place it against the product and approve, then the cost goes up.",
    rm: "Supplier ke bill ki photo lagayein. AI har qatar ka rate parhta hai — aap product ke saamne rakh kar manzoor karte hain, phir lagat charh jati hai.",
    ur: "سپلائر کے بل کی تصویر لگائیں۔ AI ہر قطار کا ریٹ پڑھتا ہے — آپ پروڈکٹ کے سامنے رکھ کر منظور کرتے ہیں، پھر لاگت چڑھ جاتی ہے۔",
  },
  pf_bill_gate: {
    en: "This page is for the Owner, Admin and Warehouse staff — product cost changes from here.",
    rm: "Ye safha Owner, Admin aur Warehouse wale ke liye hai — yahan se products ki lagat badalti hai.",
    ur: "یہ صفحہ مالک، ایڈمن اور گودام والے کے لیے ہے — یہاں سے پروڈکٹ کی لاگت بدلتی ہے۔",
  },
  pf_bill_pending_note: {
    en: "products have no known trade rate yet. Their profit is not real profit — until the rate goes up, do not read them at zero cost.",
    rm: "products aise hain jin ka trade rate abhi maloom nahi. Un ka munafa asal munafa nahi — jab tak rate na charhe, unhen sifar lagat par na parhein.",
    ur: "پروڈکٹ ایسے ہیں جن کا ٹریڈ ریٹ ابھی معلوم نہیں۔ ان کا منافع اصل منافع نہیں — جب تک ریٹ نہ چڑھے، انہیں صفر لاگت پر نہ پڑھیں۔",
  },
  pf_bill_photo: { en: "Photo of the bill", rm: "Bill ki photo", ur: "بل کی تصویر" },
  pf_bill_photo_add: {
    en: "Add a photo or take one with the camera",
    rm: "Photo lagayein ya camera se lein",
    ur: "تصویر لگائیں یا کیمرے سے لیں",
  },
  pf_bill_photo_other: { en: "use a different one", rm: "doosri lagayein", ur: "دوسری لگائیں" },
  pf_bill_supplier: { en: "Supplier (if known)", rm: "Supplier (agar maloom ho)", ur: "سپلائر (اگر معلوم ہو)" },
  pf_bill_supplier_none: {
    en: "— whatever name is on the bill —",
    rm: "— bill par jo naam ho wohi —",
    ur: "— بل پر جو نام ہو وہی —",
  },
  pf_bill_supplier_hint: {
    en: "Choosing a supplier is not required. The name written on the bill is kept either way.",
    rm: "Supplier chunna zaroori nahi. Bill par likha naam waise bhi mehfooz rehta hai.",
    ur: "سپلائر چننا ضروری نہیں۔ بل پر لکھا نام ویسے بھی محفوظ رہتا ہے۔",
  },
  pf_bill_read_it: { en: "Read the bill", rm: "Bill parhwayein", ur: "بل پڑھوائیں" },
  pf_bill_reading: { en: "AI is reading…", rm: "AI parh rahi hai…", ur: "AI پڑھ رہی ہے…" },
  pf_bill_past: { en: "Past bills", rm: "Pichhle bill", ur: "پچھلے بل" },
  pf_bill_none: {
    en: "No bills yet. Add a photo above.",
    rm: "Abhi koi bill nahi. Upar se photo lagayein.",
    ur: "ابھی کوئی بل نہیں۔ اوپر سے تصویر لگائیں۔",
  },
  pf_bill_no_name: { en: "Name was not read", rm: "Naam nahi parha gaya", ur: "نام نہیں پڑھا گیا" },
  pf_bill_applied_n: { en: "{n} went up", rm: "{n} charh gaye", ur: "{n} چڑھ گئے" },
  pf_bill_to_check: { en: "to check", rm: "dekhna baqi", ur: "دیکھنا باقی" },
  pf_bill_all: { en: "All bills", rm: "Sab bill", ur: "سب بل" },
  pf_bill_of_supplier: { en: "Supplier's bill", rm: "Supplier ka bill", ur: "سپلائر کا بل" },
  pf_bill_total_on: { en: "Bill total Rs {amount}", rm: "Bill par kul Rs {amount}", ur: "بل پر کل Rs {amount}" },
  pf_bill_unread_head: {
    en: "The bill details could not be read — please go through the lines yourself.",
    rm: "Bill ki tafseel parhi nahi ja saki — qatarein khud dekh lein.",
    ur: "بل کی تفصیل پڑھی نہیں جا سکی — قطاریں خود دیکھ لیں۔",
  },
  pf_bill_ai_off: {
    en: "AI could not read this bill. The lines are empty — either GEMINI_API_KEY is not set, or the photo was not clear. Rates can also be typed by hand.",
    rm: "Is bill ko AI parh nahi saki. Qatarein khali hain — ya to GEMINI_API_KEY nahi laga, ya tasveer saaf nahi thi. Rate haath se bhi likhe ja sakte hain.",
    ur: "اس بل کو AI پڑھ نہیں سکی۔ قطاریں خالی ہیں — یا تو GEMINI_API_KEY نہیں لگا، یا تصویر صاف نہیں تھی۔ ریٹ ہاتھ سے بھی لکھے جا سکتے ہیں۔",
  },
  pf_bill_mismatch: {
    en: "The lines add up to Rs {lines}, and the bill total is Rs {total} — a difference of Rs {diff}. A line may not have been read, or the bill may show discount/tax separately. Check before applying.",
    rm: "Qataron ka jorh Rs {lines} hai, aur bill par kul Rs {total} — Rs {diff} ka farq. Ho sakta hai koi qatar parhi na gayi ho, ya bill par discount/tax alag likha ho. Charhane se pehle dekh lein.",
    ur: "قطاروں کا جوڑ Rs {lines} ہے، اور بل پر کل Rs {total} — Rs {diff} کا فرق۔ ہو سکتا ہے کوئی قطار پڑھی نہ گئی ہو، یا بل پر ڈسکاؤنٹ/ٹیکس الگ لکھا ہو۔ چڑھانے سے پہلے دیکھ لیں۔",
  },
  pf_bill_hide_photo: { en: "hide the bill photo", rm: "bill ki photo chhupayein", ur: "بل کی تصویر چھپائیں" },
  pf_bill_show_photo: { en: "see the bill photo", rm: "bill ki photo dekhein", ur: "بل کی تصویر دیکھیں" },
  pf_bill_no_lines: {
    en: "No lines were read from this bill.",
    rm: "Is bill par koi qatar nahi parhi gayi.",
    ur: "اس بل پر کوئی قطار نہیں پڑھی گئی۔",
  },
  pf_bill_applied_badge: { en: "applied · Rs {rate}", rm: "charh gaya · Rs {rate}", ur: "چڑھ گیا · Rs {rate}" },
  pf_bill_line_item: { en: "This item on the bill", rm: "Bill par ye cheez", ur: "بل پر یہ چیز" },
  pf_bill_line_rate: { en: "Trade rate (per unit)", rm: "Trade rate (ek ka)", ur: "ٹریڈ ریٹ (ایک کا)" },
  pf_bill_rate_ph: { en: "was not clear on the bill", rm: "bill par saaf nahi tha", ur: "بل پر صاف نہیں تھا" },
  pf_bill_rate_blank: {
    en: "This rate was not clear on the bill — read it yourself and write it. Leaving it blank is better than writing zero.",
    rm: "Bill par ye rate saaf nahi tha — khud dekh kar likhein. Khali chhoRna sifar likhne se behtar hai.",
    ur: "بل پر یہ ریٹ صاف نہیں تھا — خود دیکھ کر لکھیں۔ خالی چھوڑنا صفر لکھنے سے بہتر ہے۔",
  },
  pf_bill_which_product: { en: "Which product of ours", rm: "Hamara kaun sa product", ur: "ہمارا کون سا پروڈکٹ" },
  // ---- Product Setup workspace (265) ----
  pf_ps_t_queue: { en: "Setup Queue", rm: "Adhoore", ur: "ادھورے" },
  pf_ps_t_propose: { en: "New / Propose", rm: "Naya / Tajweez", ur: "نیا / تجویز" },
  pf_ps_t_pending: { en: "Pending Approval", rm: "Manzoori Baqi", ur: "منظوری باقی" },
  pf_ps_t_edits: { en: "Pending Edits", rm: "Tabdeeli Baqi", ur: "تبدیلی باقی" },
  pf_ps_t_intake: { en: "Intake (scan/photo)", rm: "Maal Andar", ur: "مال اندر" },
  pf_ps_t_bill: { en: "Rate from Bill", rm: "Bill se Rate", ur: "بل سے ریٹ" },
  pf_ps_t_rates: { en: "Missing Rate", rm: "Rate Baqi", ur: "ریٹ باقی" },
  pf_ps_t_labels: { en: "Barcode Labels", rm: "Barcode Label", ur: "بارکوڈ لیبل" },
  pf_ps_t_import: { en: "Import CSV", rm: "CSV se", ur: "CSV سے" },
  pf_ps_t_export: { en: "Export", rm: "Export", ur: "ایکسپورٹ" },
  pd_all_categories: { en: "All", rm: "Sab", ur: "سب" },

  // ---- Needs Attention + Agla Qadam (Guided ERP B) ----
  na_title: { en: "Needs attention", rm: "Aaj kya baqi hai", ur: "آج کیا باقی ہے" },
  na_today: { en: "live counts", rm: "asal ginti", ur: "اصل گنتی" },
  na_clear: { en: "Nothing pending on your pages.", rm: "Aap ke safhon par kuch baqi nahi.", ur: "آپ کے صفحات پر کچھ باقی نہیں۔" },
  na_purchase_approval: { en: "purchases awaiting approval", rm: "purchase manzoori ke intezar mein", ur: "پرچیز منظوری کے انتظار میں" },
  na_purchase_sent_back: { en: "purchases sent back — reply needed", rm: "purchase wapas aayi — jawab chahiye", ur: "پرچیز واپس آئی — جواب چاہیے" },
  na_purchase_receive: { en: "approved purchases to count in", rm: "manzoor purchases — maal ginna baqi", ur: "منظور پرچیز — مال گننا باقی" },
  na_bill_drafts: { en: "supplier bills not finished", rm: "supplier ke bill adhoore", ur: "سپلائر کے بل ادھورے" },
  na_shop_orders_approval: { en: "shop orders in approval chain", rm: "shop orders manzoori ki chain mein", ur: "شاپ آرڈر منظوری کی چین میں" },
  na_shop_orders_grn: { en: "shop orders to receive (GRN)", rm: "shop orders receive karne baqi (GRN)", ur: "شاپ آرڈر ریسیو کرنے باقی" },
  na_products_rate: { en: "products with no sale rate — not selling", rm: "products bina sale rate — bik nahi rahe", ur: "پروڈکٹ بغیر سیل ریٹ — بک نہیں رہے" },
  na_products_setup: { en: "products incomplete", rm: "products adhoore", ur: "پروڈکٹ ادھورے" },
  na_products_expiry: { en: "products near or past expiry", rm: "products miyaad qareeb ya guzri", ur: "پروڈکٹ میعاد قریب یا گزری" },
  na_products_approval: { en: "proposed products to approve", rm: "tajweez kiye products manzoori baqi", ur: "تجویز کیے پروڈکٹ منظوری باقی" },
  na_product_edits: { en: "product edits to approve", rm: "product ki tabdeeliyan manzoori baqi", ur: "پروڈکٹ کی تبدیلیاں منظوری باقی" },
  na_intake_open: { en: "Maal Andar batches open", rm: "Maal Andar ke chakkar khule", ur: "مال اندر کے چکر کھلے" },
  na_due_overdue: { en: "supplier payments overdue", rm: "supplier ki adaigi ki tareekh guzar gayi", ur: "سپلائر کی ادائیگی کی تاریخ گزر گئی" },
  na_due_soon: { en: "supplier payments due in 7 days", rm: "supplier ki adaigi 7 din mein", ur: "سپلائر کی ادائیگی 7 دن میں" },
  na_reorder_urgent: { en: "products out or under 7 days of stock", rm: "cheezein khatam ya 7 din se kam stock", ur: "چیزیں ختم یا 7 دن سے کم اسٹاک" },
  na_ai_requests: { en: "AI proposals to review", rm: "AI ki tajweezein manzoori baqi", ur: "AI کی تجاویز منظوری باقی" },
  ns_p_draft: { en: "Draft", rm: "Draft", ur: "ڈرافٹ" },
  ns_p_approval: { en: "Approval", rm: "Manzoori", ur: "منظوری" },
  ns_p_receive: { en: "Count goods in", rm: "Maal ginna", ur: "مال گننا" },
  ns_p_setup: { en: "Product setup", rm: "Product setup", ur: "پروڈکٹ سیٹ اپ" },
  ns_p_ready: { en: "Sale ready", rm: "Sale Ready", ur: "سیل ریڈی" },
  ns_b_upload: { en: "Bill uploaded", rm: "Bill charha", ur: "بل چڑھا" },
  ns_b_check: { en: "Check AI reading", rm: "AI ka parha dekhein", ur: "AI کا پڑھا دیکھیں" },
  ns_b_rates: { en: "Apply rates", rm: "Rate charhayein", ur: "ریٹ چڑھائیں" },
  ns_b_purchase: { en: "Make purchase", rm: "Purchase banayein", ur: "پرچیز بنائیں" },

  // ---- "?" Is Page Ko Samjhein (266) ----
  hp_button: { en: "Help", rm: "Samjhein", ur: "سمجھیں" },
  hp_title: { en: "About this page", rm: "Is safhe ke baare mein", ur: "اس صفحے کے بارے میں" },
  hp_unknown: { en: "This page", rm: "Ye safha", ur: "یہ صفحہ" },
  hp_no_feature: { en: "This page is not in the feature list yet.", rm: "Ye safha abhi features ki fehrist mein nahi.", ur: "یہ صفحہ ابھی فیچرز کی فہرست میں نہیں۔" },
  hp_not_written: { en: "Help for this page has not been written yet.", rm: "Is safhe ki maloomat abhi likhi nahi gayi.", ur: "اس صفحے کی معلومات ابھی لکھی نہیں گئی۔" },
  hp_write: { en: "Write it", rm: "Likhein", ur: "لکھیں" },
  hp_edit: { en: "Edit help", rm: "Maloomat badlein", ur: "معلومات بدلیں" },
  hp_purpose: { en: "What is this page for?", rm: "Ye safha kis liye hai?", ur: "یہ صفحہ کس لیے ہے؟" },
  hp_who: { en: "Who uses it", rm: "Kaun istemal karta hai", ur: "کون استعمال کرتا ہے" },
  hp_when: { en: "When", rm: "Kab", ur: "کب" },
  hp_how: { en: "Normal steps", rm: "Aam raasta", ur: "عام راستہ" },
  hp_next: { en: "What happens next", rm: "Aage kya hota hai", ur: "آگے کیا ہوتا ہے" },
  hp_mistakes: { en: "Common mistakes", rm: "Aam ghaltiyan", ur: "عام غلطیاں" },
  hp_video: { en: "Watch the 2-minute video", rm: "2 minute ki video dekhein", ur: "2 منٹ کی ویڈیو دیکھیں" },
  hp_faq: { en: "Questions people ask", rm: "Log kya poochte hain", ur: "لوگ کیا پوچھتے ہیں" },
  hp_related: { en: "Related pages", rm: "Mutalliqa safhe", ur: "متعلقہ صفحات" },
  hp_ask_ai: { en: "Ask AI", rm: "AI se poochein", ur: "AI سے پوچھیں" },
  hp_ask_default: { en: "explain this page to me", rm: "ye safha mujhe samjhao", ur: "یہ صفحہ مجھے سمجھاؤ" },
  hp_lang_fallback: { en: "(shown in Roman Urdu — not written in your language yet)", rm: "(Roman mein — aap ki zaban mein abhi nahi likha)", ur: "(رومن میں — آپ کی زبان میں ابھی نہیں لکھا)" },
  hp_admin_title: { en: "Page Help", rm: "Safhon ki Maloomat", ur: "صفحات کی معلومات" },
  hp_admin_desc: { en: "{n} of {total} features have help written. Every new feature must have one before it counts as done.", rm: "{total} mein se {n} features ki maloomat likhi hui hai. Har naya feature tab poora hai jab us ki maloomat likhi ho.", ur: "{total} میں سے {n} فیچرز کی معلومات لکھی ہوئی ہے۔" },
  hp_admin_pick: { en: "Pick a feature on the left.", rm: "Baen se feature chunein.", ur: "بائیں سے فیچر چنیں۔" },
  hp_one_per_line: { en: "one per line", rm: "har satar ek", ur: "ہر سطر ایک" },
  hp_save: { en: "Save help", rm: "Maloomat mehfooz karein", ur: "معلومات محفوظ کریں" },
  hp_saved: { en: "Saved.", rm: "Mehfooz.", ur: "محفوظ۔" },

  // ---- Kya mangwana hai (262) ----
  pf_ro_title: { en: "What to Reorder", rm: "Kya Mangwana Hai", ur: "کیا منگوانا ہے" },
  pf_ro_desc: {
    en: "From the last 30 days of sales: how many days of stock are left, and how much to order (7 days lead + 14 days cover).",
    rm: "Pichhle 30 din ki bikri se: kitne din ka stock baqi hai, aur kitna mangwayein (7 din raasta + 14 din ka stock).",
    ur: "پچھلے 30 دن کی بکری سے: کتنے دن کا اسٹاک باقی ہے، اور کتنا منگوائیں (7 دن راستہ + 14 دن کا اسٹاک)۔",
  },
  pf_ro_hint: {
    en: "These are suggestions, not orders. Fix the quantity, cost and supplier, tick the rows, and make purchase drafts — one per supplier — which then go for approval.",
    rm: "Ye sujhaav hain, hukm nahi. Tadad, rate aur supplier theek karein, qatarein chunein, aur purchase ke draft banayein — har supplier ki alag — jo phir manzoori par jate hain.",
    ur: "یہ تجاویز ہیں، حکم نہیں۔ تعداد، ریٹ اور سپلائر ٹھیک کریں، قطاریں چنیں، اور پرچیز کے ڈرافٹ بنائیں — ہر سپلائر کی الگ — جو پھر منظوری پر جاتے ہیں۔",
  },
  pf_ro_none: {
    en: "Nothing to reorder right now — every selling product has more than 21 days of stock.",
    rm: "Abhi kuch mangwane ki zaroorat nahi — har bikne wali cheez ka 21 din se zyada ka stock hai.",
    ur: "ابھی کچھ منگوانے کی ضرورت نہیں — ہر بکنے والی چیز کا 21 دن سے زیادہ کا اسٹاک ہے۔",
  },
  pf_ro_u_out: { en: "Out of stock", rm: "Khatam", ur: "ختم" },
  pf_ro_u_critical: { en: "Under 7 days", rm: "7 din se kam", ur: "7 دن سے کم" },
  pf_ro_u_soon: { en: "Under 21 days", rm: "21 din se kam", ur: "21 دن سے کم" },
  pf_ro_u_low: { en: "Below minimum", rm: "Kam az kam se neeche", ur: "کم از کم سے نیچے" },
  pf_ro_u_ok: { en: "OK", rm: "Theek", ur: "ٹھیک" },
  pf_ro_th_urgency: { en: "State", rm: "Halat", ur: "حالت" },
  pf_ro_th_sold30: { en: "Sold 30d", rm: "30 din bikri", ur: "30 دن بکری" },
  pf_ro_th_sold7: { en: "Sold 7d", rm: "7 din", ur: "7 دن" },
  pf_ro_th_stock: { en: "In stock", rm: "Stock", ur: "اسٹاک" },
  pf_ro_th_days: { en: "Days left", rm: "Din baqi", ur: "دن باقی" },
  pf_ro_th_qty: { en: "Order qty", rm: "Mangwayein", ur: "منگوائیں" },
  pf_ro_th_cost: { en: "Cost", rm: "Rate", ur: "ریٹ" },
  pf_ro_th_supplier: { en: "Supplier", rm: "Supplier", ur: "سپلائر" },
  pf_ro_last_buy: { en: "last bought", rm: "aakhri kharid", ur: "آخری خرید" },
  pf_ro_make: { en: "Make purchase drafts ({n})", rm: "Purchase draft banayein ({n})", ur: "پرچیز ڈرافٹ بنائیں ({n})" },
  pf_ro_made: { en: "{n} purchase draft(s) made — now awaiting approval on Purchases.", rm: "{n} purchase draft ban gaye — ab Purchases par manzoori ke liye.", ur: "{n} پرچیز ڈرافٹ بن گئے — اب Purchases پر منظوری کے لیے۔" },
  pf_ro_submit_hint: {
    en: "One purchase per supplier. Nothing reaches stock or the supplier's account until it is approved and received.",
    rm: "Har supplier ki ek purchase. Manzoor aur receive hone tak na stock badalta hai na supplier ka dena.",
    ur: "ہر سپلائر کی ایک پرچیز۔ منظور اور ریسیو ہونے تک نہ اسٹاک بدلتا ہے نہ سپلائر کا دینا۔",
  },

  // ---- Apna barcode aur label (261) ----
  pf_lb_title: { en: "Barcode Labels", rm: "Barcode Label", ur: "بارکوڈ لیبل" },
  pf_lb_desc: {
    en: "Make an internal barcode (EAN-13, starts with 200) for products that have none, and print labels for the counter.",
    rm: "Jin cheezon par barcode nahi, un ke liye apna barcode (EAN-13, 200 se shuru) banayein aur counter ke liye label chhaapein.",
    ur: "جن چیزوں پر بارکوڈ نہیں، ان کے لیے اپنا بارکوڈ (EAN-13، 200 سے شروع) بنائیں اور کاؤنٹر کے لیے لیبل چھاپیں۔",
  },
  pf_lb_missing_n: { en: "{n} products have no barcode", rm: "{n} products par barcode nahi", ur: "{n} پروڈکٹ پر بارکوڈ نہیں" },
  pf_lb_internal_hint: {
    en: "An internal barcode scans like any other. If the company's real barcode turns up later, enter it — the printed label keeps working.",
    rm: "Apna barcode scanner par aam barcode ki tarah chalta hai. Baad mein company ka asal barcode mil jaye to wo likh dein — chhapa hua label phir bhi chalta rahega.",
    ur: "اپنا بارکوڈ سکینر پر عام بارکوڈ کی طرح چلتا ہے۔ بعد میں کمپنی کا اصل بارکوڈ مل جائے تو وہ لکھ دیں — چھپا ہوا لیبل پھر بھی چلتا رہے گا۔",
  },
  pf_lb_make_all: { en: "Make internal barcodes for all", rm: "Sab ke liye apna barcode banayein", ur: "سب کے لیے اپنا بارکوڈ بنائیں" },
  pf_lb_made_n: { en: "{n} products got an internal barcode.", rm: "{n} products ko apna barcode mil gaya.", ur: "{n} پروڈکٹ کو اپنا بارکوڈ مل گیا۔" },
  pf_lb_f_all: { en: "All", rm: "Sab", ur: "سب" },
  pf_lb_f_missing: { en: "No barcode", rm: "Barcode nahi", ur: "بارکوڈ نہیں" },
  pf_lb_f_internal: { en: "Internal", rm: "Apna barcode", ur: "اپنا بارکوڈ" },
  pf_lb_print: { en: "Print labels", rm: "Label chhaapein", ur: "لیبل چھاپیں" },
  pf_lb_copies: { en: "Copies", rm: "Kitne", ur: "کتنے" },
  pf_lb_b_internal: { en: "internal", rm: "apna", ur: "اپنا" },
  pf_lb_b_company: { en: "company", rm: "company ka", ur: "کمپنی کا" },
  pf_lb_empty: { en: "No products match.", rm: "Koi product nahi mila.", ur: "کوئی پروڈکٹ نہیں ملا۔" },
  pf_lb_preview: {
    en: "Label sheet — tick products above and set copies; print puts only this sheet on paper.",
    rm: "Label ki sheet — upar products par nishan lagayein aur ginti likhein; print par sirf yehi sheet kaghaz par aati hai.",
    ur: "لیبل کی شیٹ — اوپر پروڈکٹ پر نشان لگائیں اور گنتی لکھیں؛ پرنٹ پر صرف یہی شیٹ کاغذ پر آتی ہے۔",
  },
  pf_sq_make_internal: { en: "or make an internal barcode", rm: "ya apna barcode bana dein", ur: "یا اپنا بارکوڈ بنا دیں" },
  pf_sq_labels_hint: {
    en: "No barcode on many items? Make internal barcodes and print labels:",
    rm: "Bahut cheezon par barcode nahi? Apna barcode bana kar label chhaapein:",
    ur: "بہت چیزوں پر بارکوڈ نہیں؟ اپنا بارکوڈ بنا کر لیبل چھاپیں:",
  },
  // ---- Bill ki qatar par nishan (263) ----
  pf_bill_c_ok: { en: "Looks right", rm: "Theek lagta hai", ur: "ٹھیک لگتا ہے" },
  pf_bill_c_warn: { en: "Check this", rm: "Ye dekh lein", ur: "یہ دیکھ لیں" },
  pf_bill_c_none: { en: "Not read", rm: "Parha nahi gaya", ur: "پڑھا نہیں گیا" },
  pf_bill_c_high: { en: "AI: clear", rm: "AI: saaf parha", ur: "AI: صاف پڑھا" },
  pf_bill_c_medium: { en: "AI: fairly clear", rm: "AI: theek theek", ur: "AI: ٹھیک ٹھیک" },
  pf_bill_c_low: { en: "AI: unclear — verify", rm: "AI: dhundla — mila lein", ur: "AI: دھندلا — ملا لیں" },
  pf_bill_c_not_adding: {
    en: "Qty × rate = {calc}, but the line total on the bill is {total}. One of the three is misread.",
    rm: "Tadad × rate = {calc}, magar bill par is qatar ka kul {total} hai. Teenon mein se ek ghalat parha gaya.",
    ur: "تعداد × ریٹ = {calc}، مگر بل پر اس قطار کا کل {total} ہے۔ تینوں میں سے ایک غلط پڑھا گیا۔",
  },
  pf_bill_fuzzy_match: {
    en: "Guessed match ({score}%) — not confirmed. Check the product, then press Save; the rate will not apply before that.",
    rm: "Andaze se mila ({score}%) — abhi tasdeeq nahi. Product dekh kar Save dabayein; us se pehle rate nahi charhega.",
    ur: "اندازے سے ملا ({score}%) — ابھی تصدیق نہیں۔ پروڈکٹ دیکھ کر Save دبائیں؛ اس سے پہلے ریٹ نہیں چڑھے گا۔",
  },
  pf_bill_auto_match: {
    en: "This matched automatically by name — check it once before applying.",
    rm: "Ye naam se apne aap mila hai — charhane se pehle ek dafa dekh lein.",
    ur: "یہ نام سے خود بخود ملا ہے — چڑھانے سے پہلے ایک دفعہ دیکھ لیں۔",
  },
  pf_bill_line_total: { en: "this line is Rs {amount} on the bill", rm: "bill par is qatar ka Rs {amount}", ur: "بل پر اس قطار کا Rs {amount}" },
  pf_bill_drop_line: { en: "Drop this line", rm: "Ye qatar chhoR dein", ur: "یہ قطار چھوڑ دیں" },
  pf_bill_search_product: { en: "Type the product name…", rm: "Product ka naam likhein…", ur: "پروڈکٹ کا نام لکھیں…" },
  pf_bill_no_product: {
    en: "No product found with that name. Create the product first, then choose it here.",
    rm: "Is naam ka koi product nahi mila. Pehle product banayein, phir yahan chunein.",
    ur: "اس نام کا کوئی پروڈکٹ نہیں ملا۔ پہلے پروڈکٹ بنائیں، پھر یہاں چنیں۔",
  },
  pf_bill_rate_was_none: {
    en: "trade rate was not known until now",
    rm: "trade rate abhi tak nahi tha",
    ur: "ٹریڈ ریٹ ابھی تک نہیں تھا",
  },
  pf_bill_rate_now: { en: "current trade rate Rs {rate}", rm: "abhi ka trade rate Rs {rate}", ur: "ابھی کا ٹریڈ ریٹ Rs {rate}" },
  pf_bill_rate_pending_short: { en: "rate pending", rm: "rate baqi", ur: "ریٹ باقی" },
  pf_bill_change: { en: "change", rm: "badlein", ur: "بدلیں" },
  pf_bill_ready_note: {
    en: "{n} lines are ready to apply. Applying changes these products' trade rate, and the old rate is kept on record.",
    rm: "{n} qatarein charhne ke liye tayyar hain. Charhne par in products ka trade rate badal jayega, aur purana rate indraj mein mehfooz ho jayega.",
    ur: "{n} قطاریں چڑھنے کے لیے تیار ہیں۔ چڑھنے پر ان پروڈکٹ کا ٹریڈ ریٹ بدل جائے گا، اور پرانا ریٹ اندراج میں محفوظ ہو جائے گا۔",
  },
  pf_bill_apply_n: { en: "Apply {n} rates", rm: "{n} rate charhayein", ur: "{n} ریٹ چڑھائیں" },
  pf_bill_done: {
    en: "This bill is finished — {n} products now have their trade rate.",
    rm: "Is bill ka kaam mukammal hai — {n} products ka trade rate charh chuka hai.",
    ur: "اس بل کا کام مکمل ہے — {n} پروڈکٹ کا ٹریڈ ریٹ چڑھ چکا ہے۔",
  },

  // =====================================================================
  // Thok (POS aur product form)
  // =====================================================================
  pf_pos_retail_customer: { en: "Regular customer", rm: "Aam gahak", ur: "عام گاہک" },
  pf_pos_wholesale_shop: { en: "Wholesale (shop)", rm: "Thok (dukan)", ur: "تھوک (دکان)" },
  pf_pos_no_shops: {
    en: 'No wholesale shops on record yet. In CRM set a customer\u2019s type to "wholesale shop", and it will appear here.',
    rm: 'Abhi koi thok wali dukan darj nahi. CRM mein gahak ka darja "thok wali dukan" rakhein, phir wo yahan aayegi.',
    ur: 'ابھی کوئی تھوک والی دکان درج نہیں۔ CRM میں گاہک کا درجہ "تھوک والی دکان" رکھیں، پھر وہ یہاں آئے گی۔',
  },
  pf_pos_pick_shop: { en: "— choose a shop —", rm: "— dukan chunein —", ur: "— دکان چنیں —" },
  pf_pos_wholesale_on: {
    en: "Wholesale rates are being applied. Anything without a wholesale rate on record goes at retail.",
    rm: "Thok ka rate lag raha hai. Jis cheez par thok ka rate darj nahi, us par retail lagega.",
    ur: "تھوک کا ریٹ لگ رہا ہے۔ جس چیز پر تھوک کا ریٹ درج نہیں، اس پر ریٹیل لگے گا۔",
  },
  pf_pos_no_wholesale_rate: {
    en: "\u00b7 no wholesale rate, retail applied",
    rm: "\u00b7 thok ka rate nahi, retail laga",
    ur: "\u00b7 تھوک کا ریٹ نہیں، ریٹیل لگا",
  },

  // ---- Bill har shakl mein (251) ----
  pf_bill_tab_files: { en: "Bill file", rm: "Bill ki file", ur: "بل کی فائل" },
  pf_bill_tab_sheet: { en: "From a sheet", rm: "Sheet se", ur: "شیٹ سے" },
  pf_bill_files_add: {
    en: "Add photos or a PDF — more than one is fine",
    rm: "Tasveerein ya PDF lagayein — ek se zyada bhi chalti hain",
    ur: "تصویریں یا PDF لگائیں — ایک سے زیادہ بھی چلتی ہیں",
  },
  pf_bill_files_hint: {
    en: "A bill of two or three pages stays one bill. Add every page.",
    rm: "Do ya teen safhon ka bill ek hi bill rehta hai. Har safha laga dein.",
    ur: "دو یا تین صفحوں کا بل ایک ہی بل رہتا ہے۔ ہر صفحہ لگا دیں۔",
  },
  pf_bill_files_n: { en: "{n} file added", rm: "{n} file lagi hain", ur: "{n} فائل لگی ہیں" },
  pf_bill_file_remove: { en: "remove", rm: "hatayein", ur: "ہٹائیں" },
  pf_bill_sheet_label: { en: "Paste the sheet here", rm: "Sheet yahan paste karein", ur: "شیٹ یہاں پیسٹ کریں" },
  pf_bill_sheet_hint: {
    en: 'Row 1 must have the column names. "name" (or "naam") and "trade rate" (or "rate") are required; "pack" and "qty" are optional. Copying straight from Excel or Google Sheets works.',
    rm: 'Pehli lakeer khanon ke naam ki honi chahiye. "name" (ya "naam") aur "trade rate" (ya "rate") lazmi hain; "pack" aur "qty" ikhtiyari. Excel ya Google Sheet se seedha copy kar ke paste karna kaam karta hai.',
    ur: 'پہلی لکیر خانوں کے نام کی ہونی چاہیے۔ "name" (یا "naam") اور "trade rate" (یا "rate") لازمی ہیں؛ "pack" اور "qty" اختیاری۔ ایکسل یا گوگل شیٹ سے سیدھا کاپی کر کے پیسٹ کرنا کام کرتا ہے۔',
  },
  pf_bill_sheet_go: { en: "Read the sheet", rm: "Sheet parhwayein", ur: "شیٹ پڑھوائیں" },
  pf_bill_sheet_sample: { en: "fill in a sample", rm: "namoona bhar dein", ur: "نمونہ بھر دیں" },
  pf_bill_number: { en: "Bill number (optional)", rm: "Bill number (ikhtiyari)", ur: "بل نمبر (اختیاری)" },
  pf_bill_date: { en: "Bill date (optional)", rm: "Bill ki tareekh (ikhtiyari)", ur: "بل کی تاریخ (اختیاری)" },
  pf_bill_from_sheet: { en: "from a sheet", rm: "sheet se", ur: "شیٹ سے" },
  pf_bill_from_pdf: { en: "PDF", rm: "PDF", ur: "PDF" },
  pf_bill_pages_n: { en: "{n} pages", rm: "{n} safhe", ur: "{n} صفحات" },
  pf_bill_page_failed: {
    en: "This file could not be read — write those lines in by hand.",
    rm: "Ye file parhi nahi ja saki — us ki qatarein khud likh lein.",
    ur: "یہ فائل پڑھی نہیں جا سکی — اس کی قطاریں خود لکھ لیں۔",
  },
  pf_bill_page_label: { en: "Page {n}", rm: "Safha {n}", ur: "صفحہ {n}" },
  pf_bill_open_file: { en: "open", rm: "kholein", ur: "کھولیں" },
  pf_bill_no_photo: {
    en: "This bill came from a sheet — there is no photo.",
    rm: "Ye bill sheet se aaya hai — is ki koi tasveer nahi.",
    ur: "یہ بل شیٹ سے آیا ہے — اس کی کوئی تصویر نہیں۔",
  },

  // ---- Preview mein durusti (252) ----
  pf_row_skipped: { en: "left out", rm: "chhoR di", ur: "چھوڑ دی" },
  pf_skipped_n: { en: "{n} left out", rm: "{n} chhoR di", ur: "{n} چھوڑ دی" },
  pf_edit_hint: {
    en: "Anything below can be corrected right here. Change a name that repeats, fix a rate, or leave a row out — then press Preview again.",
    rm: "Neeche har khana yahin theek ho sakta hai. Jo naam bar bar aa raha hai usay badlein, rate durust karein, ya qatar chhoR dein — phir dobara Pehle dekhein dabayein.",
    ur: "نیچے ہر خانہ یہیں ٹھیک ہو سکتا ہے۔ جو نام بار بار آ رہا ہے اسے بدلیں، ریٹ درست کریں، یا قطار چھوڑ دیں — پھر دوبارہ پہلے دیکھیں دبائیں۔",
  },
  pf_edit_rerun: {
    en: "Press Preview again to see the corrections",
    rm: "Durusti dekhne ke liye dobara Pehle dekhein dabayein",
    ur: "درستی دیکھنے کے لیے دوبارہ پہلے دیکھیں دبائیں",
  },
  pf_row_skip: { en: "leave out", rm: "chhoR dein", ur: "چھوڑ دیں" },
  pf_row_unskip: { en: "take back", rm: "wapas lein", ur: "واپس لیں" },
  pf_dup_hint: {
    en: "The same name appears more than once. Only the first one is created — give each its own name (add the pack size), or leave the extra rows out.",
    rm: "Ek hi naam kai dafa aaya hai. Sirf pehli wali banti hai — har ek ko apna naam dein (pack size laga dein), ya baqi qatarein chhoR dein.",
    ur: "ایک ہی نام کئی دفعہ آیا ہے۔ صرف پہلی والی بنتی ہے — ہر ایک کو اپنا نام دیں (پیک سائز لگا دیں)، یا باقی قطاریں چھوڑ دیں۔",
  },

  // ---- Rate baqi (252) ----
  pos_rate_baqi_hidden: {
    en: "{n} items are not shown here — their sale rate is not filled in yet.",
    rm: "{n} cheezein yahan nahi dikh rahin — un ka sale rate abhi bhara nahi gaya.",
    ur: "{n} چیزیں یہاں نہیں دکھ رہیں — ان کا سیل ریٹ ابھی بھرا نہیں گیا۔",
  },
  pos_rate_baqi_link: { en: "fill the rates", rm: "rate bhar dein", ur: "ریٹ بھر دیں" },

  pf_rb_title: { en: "Rates Pending", rm: "Rate Baqi", ur: "ریٹ باقی" },
  pf_rb_desc: {
    en: "Products that were saved without a rate. Until the sale rate is filled in, they are not sold — a blank rate would otherwise reach the counter as Rs 0.",
    rm: "Wo products jo bina rate ke mehfooz hue. Jab tak sale rate na bhara jaye, ye bikte nahi — warna khali rate counter par Rs 0 ban kar pahunch jata.",
    ur: "وہ پروڈکٹ جو بغیر ریٹ کے محفوظ ہوئے۔ جب تک سیل ریٹ نہ بھرا جائے، یہ بکتے نہیں — ورنہ خالی ریٹ کاؤنٹر پر Rs 0 بن کر پہنچ جاتا۔",
  },
  pf_rb_none: {
    en: "Nothing pending — every product has its rate.",
    rm: "Kuch baqi nahi — har product ka rate maujood hai.",
    ur: "کچھ باقی نہیں — ہر پروڈکٹ کا ریٹ موجود ہے۔",
  },
  pf_rb_sale_missing: { en: "sale rate missing", rm: "sale rate baqi", ur: "سیل ریٹ باقی" },
  pf_rb_trade_missing: { en: "trade rate missing", rm: "trade rate baqi", ur: "ٹریڈ ریٹ باقی" },
  pf_rb_not_sold: {
    en: "not being sold",
    rm: "bik nahi raha",
    ur: "بک نہیں رہا",
  },
  pf_rb_save: { en: "Save the rates", rm: "Rate mehfooz karein", ur: "ریٹ محفوظ کریں" },
  pf_rb_saved: {
    en: "{n} products now have their rate.",
    rm: "{n} products ka rate charh gaya.",
    ur: "{n} پروڈکٹ کا ریٹ چڑھ گیا۔",
  },
  pf_rb_hint: {
    en: "Fill in what you know and save. A rate you do not know stays blank — never write 0, because 0 means free.",
    rm: "Jo maloom hai wo bhar kar mehfooz karein. Jo rate maloom nahi wo khali rehne dein — 0 hargiz na likhein, kyunke 0 ka matlab muft hai.",
    ur: "جو معلوم ہے وہ بھر کر محفوظ کریں۔ جو ریٹ معلوم نہیں وہ خالی رہنے دیں — 0 ہرگز نہ لکھیں، کیونکہ 0 کا مطلب مفت ہے۔",
  },

  // ---- Adhoore products: setup queue (258) ----
  pf_sq_title: { en: "Product Setup Queue", rm: "Adhoore Products", ur: "ادھورے پروڈکٹ" },
  pf_sq_desc: {
    en: "Everything still pending on a product — rate, barcode, photo, expiry, approval — in one list. Tap a box above to filter.",
    rm: "Product par jo bhi baqi hai — rate, barcode, tasveer, miyaad, manzoori — ek fehrist mein. Upar ke khane par dabayein to fehrist usi par chhant jati hai.",
    ur: "پروڈکٹ پر جو بھی باقی ہے — ریٹ، بارکوڈ، تصویر، میعاد، منظوری — ایک فہرست میں۔ اوپر کے خانے پر دبائیں تو فہرست اسی پر چھنٹ جاتی ہے۔",
  },
  pf_sq_c_total: { en: "Products pending", rm: "Adhoore", ur: "ادھورے" },
  pf_sq_c_rate: { en: "Rate", rm: "Rate", ur: "ریٹ" },
  pf_sq_c_barcode: { en: "Barcode", rm: "Barcode", ur: "بارکوڈ" },
  pf_sq_c_image: { en: "Photo", rm: "Tasveer", ur: "تصویر" },
  pf_sq_c_expiry: { en: "Expiry", rm: "Miyaad", ur: "میعاد" },
  pf_sq_c_approval: { en: "Approval", rm: "Manzoori", ur: "منظوری" },
  pf_sq_intake_open: {
    en: "{n} Maal Andar round(s) are still open — products in them are not on this list until approved.",
    rm: "Maal Andar ke {n} chakkar abhi khule hain — un ke products manzoori tak is fehrist mein nahi aate.",
    ur: "مال اندر کے {n} چکر ابھی کھلے ہیں — ان کے پروڈکٹ منظوری تک اس فہرست میں نہیں آتے۔",
  },
  pf_sq_intake_link: { en: "Open Maal Andar", rm: "Maal Andar kholein", ur: "مال اندر کھولیں" },
  pf_sq_none: {
    en: "Nothing pending — every product has its rate, barcode, photo and approval.",
    rm: "Kuch baqi nahi — har product ka rate, barcode, tasveer aur manzoori poori hai.",
    ur: "کچھ باقی نہیں — ہر پروڈکٹ کا ریٹ، بارکوڈ، تصویر اور منظوری پوری ہے۔",
  },
  pf_sq_filter_empty: { en: "Nothing in this box.", rm: "Is khane mein kuch nahi.", ur: "اس خانے میں کچھ نہیں۔" },
  pf_sq_hint: {
    en: "Fill in what you know and save. Blank stays blank. Never write 0 for a rate — 0 means free. Barcode: click the box and scan.",
    rm: "Jo maloom hai wo bhar kar mehfooz karein. Khali khali rehta hai. Rate mein 0 hargiz na likhein — 0 ka matlab muft. Barcode: khane par click kar ke scan karein.",
    ur: "جو معلوم ہے وہ بھر کر محفوظ کریں۔ خالی خالی رہتا ہے۔ ریٹ میں 0 ہرگز نہ لکھیں — 0 کا مطلب مفت۔ بارکوڈ: خانے پر کلک کر کے اسکین کریں۔",
  },
  pf_sq_saved: { en: "{n} products updated.", rm: "{n} products theek ho gaye.", ur: "{n} پروڈکٹ ٹھیک ہو گئے۔" },
  pf_sq_th_issues: { en: "What's missing", rm: "Kya baqi hai", ur: "کیا باقی ہے" },
  pf_sq_th_barcode: { en: "Barcode", rm: "Barcode", ur: "بارکوڈ" },
  pf_sq_th_expiry: { en: "Expiry", rm: "Miyaad", ur: "میعاد" },
  pf_sq_th_fix: { en: "Fix", rm: "Theek karein", ur: "ٹھیک کریں" },
  pf_sq_b_barcode: { en: "no barcode", rm: "barcode nahi", ur: "بارکوڈ نہیں" },
  pf_sq_b_image: { en: "no photo", rm: "tasveer nahi", ur: "تصویر نہیں" },
  pf_sq_b_expired: { en: "expired", rm: "miyaad guzar gayi", ur: "میعاد گزر گئی" },
  pf_sq_b_expiry_soon: { en: "expiring soon", rm: "miyaad qareeb", ur: "میعاد قریب" },
  pf_sq_b_approval: { en: "approval pending", rm: "manzoori baqi", ur: "منظوری باقی" },
  pf_sq_scan_here: { en: "scan here", rm: "yahan scan karein", ur: "یہاں اسکین کریں" },
  pf_sq_add_photo: { en: "Add photo", rm: "Tasveer lagayein", ur: "تصویر لگائیں" },
  pf_sq_see_stock: { en: "See stock", rm: "Stock dekhein", ur: "اسٹاک دیکھیں" },
  pf_sq_approve: { en: "Approve", rm: "Manzoor", ur: "منظور" },
  pf_sq_approve_admin_only: { en: "Owner/Admin approves", rm: "Owner/Admin manzoor karega", ur: "اونر/ایڈمن منظور کرے گا" },
  pf_sq_save: { en: "Save", rm: "Mehfooz karein", ur: "محفوظ کریں" },

  // ---- Purane product par charhna, aur stock (253) ----
  pf_row_update: { en: "rate will change", rm: "rate badlega", ur: "ریٹ بدلے گا" },
  pf_updates_n: { en: "{n} rates will change", rm: "{n} ka rate badlega", ur: "{n} کا ریٹ بدلے گا" },
  pf_wh_label: { en: "Where the goods are lying", rm: "Maal kahan para hai", ur: "مال کہاں پڑا ہے" },
  pf_wh_none: { en: "— do not add stock —", rm: "— stock nahi charhana —", ur: "— اسٹاک نہیں چڑھانا —" },
  pf_wh_hint: {
    en: 'The "how many came" column is used only when you choose a place. Stock always has a place — an amount without one stands in mid-air, and that shows up on counting day.',
    rm: '"Kitne aaye" wala khana tabhi chalta hai jab aap jagah chunein. Stock ki hamesha ek jagah hoti hai — bina jagah ke adad hawa mein khaRa rehta hai, aur us ka pata ginti ke din chalta hai.',
    ur: '"کتنے آئے" والا خانہ تبھی چلتا ہے جب آپ جگہ چنیں۔ اسٹاک کی ہمیشہ ایک جگہ ہوتی ہے — بغیر جگہ کے عدد ہوا میں کھڑا رہتا ہے، اور اس کا پتہ گنتی کے دن چلتا ہے۔',
  },
  pf_upload_mixed: {
    en: "Save {n} rows",
    rm: "{n} qatarein charhayein",
    ur: "{n} قطاریں چڑھائیں",
  },

  // ---- Maal kahan se aaya (253) ----
  pf_src_label: { en: "Where did the goods come from?", rm: "Ye maal kahan se aaya?", ur: "یہ مال کہاں سے آیا؟" },
  pf_src_supplier: { en: "From a supplier", rm: "Supplier se", ur: "سپلائر سے" },
  pf_src_opening: { en: "Opening stock (no supplier)", rm: "Shuru ka stock (koi supplier nahi)", ur: "شروع کا اسٹاک (کوئی سپلائر نہیں)" },
  pf_src_supplier_hint: {
    en: "A purchase is created and it goes to Purchases. The goods do not come in yet — press Receive there, and at that moment the stock comes in and the supplier's payable goes up.",
    rm: "Ek purchase ban jayegi aur wo Purchases par jayegi. Maal abhi andar nahi aayega — wahan Receive dabayein, usi waqt stock andar aayega aur supplier ka dena bhi charhega.",
    ur: "ایک پرچیز بن جائے گی اور وہ پرچیز پر جائے گی۔ مال ابھی اندر نہیں آئے گا — وہاں ریسیو دبائیں، اسی وقت اسٹاک اندر آئے گا اور سپلائر کا دینا بھی چڑھے گا۔",
  },
  pf_src_opening_hint: {
    en: "For the first stock-take, when the goods are already lying in the shop. Nobody is owed anything — so no payable is created. The goods come in straight away.",
    rm: "Pehli ginti ke liye, jab maal pehle se dukan mein para ho. Kisi ka kuch dena nahi banta — is liye koi payable nahi charhta. Maal seedha andar aa jata hai.",
    ur: "پہلی گنتی کے لیے، جب مال پہلے سے دکان میں پڑا ہو۔ کسی کا کچھ دینا نہیں بنتا — اس لیے کوئی پیبل نہیں چڑھتا۔ مال سیدھا اندر آ جاتا ہے۔",
  },
  pf_src_supplier_pick: { en: "Which supplier", rm: "Kaun sa supplier", ur: "کون سا سپلائر" },
  pf_src_pick_one: { en: "— choose —", rm: "— chunein —", ur: "— چنیں —" },
  pf_left_out_note: {
    en: "{skipped} rows will be left out.",
    rm: "{skipped} qatarein chhoR di jayengi.",
    ur: "{skipped} قطاریں چھوڑ دی جائیں گی۔",
  },
  pf_will_do_note: {
    en: "{created} will be created, {updated} rates will change.",
    rm: "{created} banenge, {updated} ka rate badlega.",
    ur: "{created} بنیں گے، {updated} کا ریٹ بدلے گا۔",
  },

  // ---- Bill se Purchase (254) ----
  pf_po_title: { en: "Make a purchase from this bill", rm: "Is bill se Purchase banayein", ur: "اس بل سے پرچیز بنائیں" },
  pf_po_note: {
    en: "{n} lines are ready. A purchase (pending) is created with these items and the trade rates are applied. The goods do NOT come in yet — press Receive on the Purchases page; at that moment the stock comes in and the supplier's payable goes up.",
    rm: "{n} qatarein tayyar hain. In se ek purchase (pending) banegi aur trade rate charh jayenge. Maal ABHI andar nahi aayega — Purchases ke safhe par Receive dabayein; usi waqt stock andar aayega aur supplier ka dena charhega.",
    ur: "{n} قطاریں تیار ہیں۔ ان سے ایک پرچیز (pending) بنے گی اور ٹریڈ ریٹ چڑھ جائیں گے۔ مال ابھی اندر نہیں آئے گا — پرچیز کے صفحے پر ریسیو دبائیں؛ اسی وقت اسٹاک اندر آئے گا اور سپلائر کا دینا چڑھے گا۔",
  },
  pf_po_supplier: { en: "Supplier", rm: "Supplier", ur: "سپلائر" },
  pf_po_supplier_req: {
    en: "A purchase needs a supplier — that is whose payable goes up.",
    rm: "Purchase ke liye supplier zaroori hai — dena usi ka charhta hai.",
    ur: "پرچیز کے لیے سپلائر ضروری ہے — دینا اسی کا چڑھتا ہے۔",
  },
  pf_po_branch: { en: "Branch", rm: "Branch", ur: "برانچ" },
  pf_po_go: { en: "Make the purchase", rm: "Purchase banayein", ur: "پرچیز بنائیں" },
  pf_po_rates_only: { en: "Only apply the rates (no purchase)", rm: "Sirf rate charhayein (purchase nahi)", ur: "صرف ریٹ چڑھائیں (پرچیز نہیں)" },
  pf_po_qty_missing: {
    en: "These lines have no quantity — a purchase cannot carry a line without one:",
    rm: "In qataron mein tadad nahi likhi — bina tadad ke qatar purchase par nahi ja sakti:",
    ur: "ان قطاروں میں تعداد نہیں لکھی — بغیر تعداد کے قطار پرچیز پر نہیں جا سکتی:",
  },
  pf_po_made: {
    en: "Purchase {no} created with {n} lines. Go to Purchases and press Receive when the goods arrive.",
    rm: "Purchase {no} ban gayi — {n} qatarein. Maal aane par Purchases par ja kar Receive dabayein.",
    ur: "پرچیز {no} بن گئی — {n} قطاریں۔ مال آنے پر پرچیز پر جا کر ریسیو دبائیں۔",
  },
  pf_po_open: { en: "Open the purchase", rm: "Purchase kholein", ur: "پرچیز کھولیں" },
  pf_po_linked: {
    en: "A purchase was made from this bill.",
    rm: "Is bill se purchase ban chuki hai.",
    ur: "اس بل سے پرچیز بن چکی ہے۔",
  },
} as const;
