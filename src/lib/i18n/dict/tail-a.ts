/**
 * Chhote safhe -- har ek par gine chune alfaz.
 *
 * DO JUMLE KHAAS DHYAN MANGTE HAIN:
 *
 * "Faisla hone ke baad badla nahi ja sakta" -- ye jumla wahin likha
 * hai jahan banda faisla bhejta hai, us ke baad nahi. Baad mein batane
 * ka koi faida nahi hota.
 *
 * "Kaun si machine jayegi, ye abhi tay karna zaroori nahi" -- booking
 * ke waqt log aksar machine chunne ki koshish mein ruk jate the.
 * Machine rawangi ke waqt chuni jati hai, aur ye baat form par likhi ho
 * to booking ruakti nahi.
 *
 * "ye rok database mein bhi lagi hui hai" -- department wale safhe par.
 * Ye us bande ke liye hai jo samajhta hai ke safhe se nikalne ka koi
 * raasta hai.
 */
export const tailADict = {
  // ---- Platform (multi-tenant) ----
  pl_onboard: { en: "Onboard New Client", rm: "Naya client shamil karein", ur: "نیا کلائنٹ شامل کریں" },
  pl_company_name: { en: "Company Name *", rm: "Company ka naam *", ur: "کمپنی کا نام *" },
  pl_company_eg: { en: "e.g. XYZ Traders", rm: "misal: XYZ Traders", ur: "مثال: XYZ Traders" },
  pl_admin_name: { en: "Admin Full Name *", rm: "Admin ka poora naam *", ur: "ایڈمن کا پورا نام *" },
  pl_admin_email: { en: "Admin Email * (the invite goes here)", rm: "Admin ka email * (dawat yahin jayegi)", ur: "ایڈمن کا ای میل * (دعوت یہیں جائے گی)" },
  pl_admin_phone: { en: "Admin Phone", rm: "Admin ka phone", ur: "ایڈمن کا فون" },
  pl_created: {
    en: "New organisation created. An invite email went to the admin to set their password.",
    rm: "Naya idara ban gaya. Admin ko password banane ki dawat email par bhej di gayi.",
    ur: "نیا ادارہ بن گیا۔ ایڈمن کو پاس ورڈ بنانے کی دعوت ای میل پر بھیج دی گئی۔",
  },
  pl_isolated_note: {
    en: "This creates a separate, isolated tenant with its own data. The admin invited above sees only their own organisation's data — never yours.",
    rm: "Ye ek bilkul alag idara banata hai, apne data ke saath. Upar bulaya hua admin sirf apne idare ka data dekhega -- aap ka kabhi nahi.",
    ur: "یہ ایک بالکل الگ ادارہ بناتا ہے، اپنے ڈیٹا کے ساتھ۔ اوپر بلایا ہوا ایڈمن صرف اپنے ادارے کا ڈیٹا دیکھے گا — آپ کا کبھی نہیں۔",
  },

  // ---- Mera department ----
  td_team: { en: "Team", rm: "Team", ur: "ٹیم" },
  td_pick_someone: { en: "Pick someone from the team.", rm: "Team ka koi banda chunein.", ur: "ٹیم کا کوئی بندہ چنیں۔" },
  td_whose_data: { en: "Whose data", rm: "Kis ka data", ur: "کس کا ڈیٹا" },
  td_until_when: { en: "Until when (optional)", rm: "Kab tak (marzi ki baat)", ur: "کب تک (مرضی کی بات)" },
  td_reason_eg: { en: "e.g. standing in for Bilal, who is on leave", rm: "Misal: chhutti par gaye Bilal ki jagah", ur: "مثال: چھٹی پر گئے بلال کی جگہ" },
  td_db_lock: { en: "this lock is in the database too.", rm: "ye rok database mein bhi lagi hui hai.", ur: "یہ روک ڈیٹابیس میں بھی لگی ہوئی ہے۔" },

  // ---- Subscription (baqi) ----
  sb_announce_all: { en: "Send an Announcement (to all farmers)", rm: "Sab kisanon ko elaan bhejein", ur: "سب کسانوں کو اعلان بھیجیں" },
  sb_activate_farmer: { en: "Activate a Farmer's Subscription", rm: "Kisan ki subscription chalu karein", ur: "کسان کی سبسکرپشن چالو کریں" },
  sb_enforce: {
    en: "Require subscription (turning this on locks every feature for all farmers — only login stays free)",
    rm: "Subscription lazmi karein (chalu karte hi sab kisanon ke liye har feature band ho jayega, sirf login khula rahega)",
    ur: "سبسکرپشن لازمی کریں (چالو کرتے ہی سب کسانوں کے لیے ہر فیچر بند ہو جائے گا، صرف لاگ ان کھلا رہے گا)",
  },
  sb_view: { en: "View", rm: "Dekhein", ur: "دیکھیں" },

  // ---- Rate master ----
  rm_none: { en: "No rate set.", rm: "Koi rate tay nahi.", ur: "کوئی ریٹ طے نہیں۔" },
  rm_labour_rates: { en: "Labour Rates", rm: "Mazdoori ke rate", ur: "مزدوری کے ریٹ" },
  rm_land_prep: { en: "Land Preparation Rates", rm: "Zameen tayyar karne ke rate", ur: "زمین تیار کرنے کے ریٹ" },
  rm_eg_plough: { en: "e.g. ploughing", rm: "misal: hal chalana", ur: "مثال: ہل چلانا" },
  rm_eg_spray: { en: "e.g. spray labour", rm: "misal: spray ki mazdoori", ur: "مثال: سپرے کی مزدوری" },

  // ---- POS ka saada order ----
  so_select_products: { en: "Select Products", rm: "Cheezein chunein", ur: "چیزیں چنیں" },
  so_total_items: { en: "Total Items", rm: "Kul cheezein", ur: "کل چیزیں" },
  so_order_type: { en: "Order Type", rm: "Order ki qism", ur: "آرڈر کی قسم" },

  // ---- Menu ----
  mn_new_item: { en: "New Menu Item", rm: "Menu mein nayi cheez", ur: "مینو میں نئی چیز" },
  mn_label: { en: "Label *", rm: "Kya likha ho *", ur: "کیا لکھا ہو *" },
  mn_url: { en: "URL *", rm: "Pata *", ur: "پتہ *" },
  mn_header: { en: "Header", rm: "Ooper", ur: "اوپر" },
  mn_footer: { en: "Footer", rm: "Neeche", ur: "نیچے" },

  // ---- Naukri ki jagah ----
  jv_post: { en: "Post a New Vacancy", rm: "Nayi jagah ka elaan karein", ur: "نئی جگہ کا اعلان کریں" },
  jv_posted: { en: "Vacancy posted.", rm: "Jagah ka elaan ho gaya.", ur: "جگہ کا اعلان ہو گیا۔" },
  jv_title_eg: { en: "Job Title (e.g. sales staff)", rm: "Kaam ka naam (misal: sales staff)", ur: "کام کا نام (مثال: سیلز اسٹاف)" },
  jv_seats: { en: "How many seats", rm: "Kitni jagahein chahiyen", ur: "کتنی جگہیں چاہییں" },
  jv_description: { en: "Job Description", rm: "Kaam ki tafseel", ur: "کام کی تفصیل" },
  jv_requirements: { en: "Requirements", rm: "Kya chahiye", ur: "کیا چاہیے" },

  // ---- Godam ----
  wh_new: { en: "New Warehouse", rm: "Naya godam", ur: "نیا گودام" },
  wh_added: { en: "Warehouse added.", rm: "Godam shamil ho gaya.", ur: "گودام شامل ہو گیا۔" },
  wh_name: { en: "Warehouse Name *", rm: "Godam ka naam *", ur: "گودام کا نام *" },
  wh_code: { en: "Code *", rm: "Code *", ur: "کوڈ *" },
  wh_code_eg: { en: "e.g. NORTH", rm: "misal: NORTH", ur: "مثال: NORTH" },
  wh_name_eg: { en: "e.g. North Store", rm: "misal: North Store", ur: "مثال: North Store" },

  // ---- Kisan ka udhaar (baqi) ----
  fc_credit_type: { en: "Credit Type *", rm: "Udhaar ki qism *", ur: "ادھار کی قسم *" },
  fc_which_account_in: { en: "Which account did the money come into? *", rm: "Kaunse khate mein paisa aaya *", ur: "کون سے کھاتے میں پیسہ آیا *" },
  fc_issue_anyway: { en: "Issue it anyway (beyond the limit)", rm: "Phir bhi dena hai (hadd se ziyada)", ur: "پھر بھی دینا ہے (حد سے زیادہ)" },
  fc_total_balance_note: {
    en: "Total Balance (Rs.) — positive if the farmer owes the company, negative if the company owes the farmer *",
    rm: "Kul baqi (Rs.) -- kisan par company ka udhaar ho to positive, company kisan ko de to negative *",
    ur: "کل باقی (روپے) — کسان پر کمپنی کا ادھار ہو تو مثبت، کمپنی کسان کو دے تو منفی *",
  },

  // ---- Department (baqi) ----
  dp_apply_suggestion: { en: "Apply the suggestion", rm: "Tajweez lagayein", ur: "تجویز لگائیں" },
  dp_of_this_dept: { en: "of this department", rm: "is department ke", ur: "اس شعبے کے" },
  dp_all: { en: "all", rm: "sab", ur: "سب" },
  dp_none: { en: "none", rm: "koi nahi", ur: "کوئی نہیں" },
  dp_done_set: { en: "Done — everyone is now on the department's set.", rm: "Ho gaya -- ab sab department ke set par hain.", ur: "ہو گیا — اب سب شعبے کے سیٹ پر ہیں۔" },
  dp_saved_all: {
    en: "Saved — it now applies to every person in this department.",
    rm: "Mehfooz ho gaya -- is department ke har bande par lag gaya.",
    ur: "محفوظ ہو گیا — اس شعبے کے ہر بندے پر لگ گیا۔",
  },

  // ---- Dashboard manager ----
  dm_title: { en: "Dashboard & Feature Manager", rm: "Dashboard aur feature ka intezam", ur: "ڈیش بورڈ اور فیچر کا انتظام" },
  dm_feature: { en: "Feature", rm: "Feature", ur: "فیچر" },
  dm_dashboard: { en: "Dashboard", rm: "Dashboard", ur: "ڈیش بورڈ" },
  dm_on_no_dashboard: { en: "On no dashboard", rm: "Kisi dashboard par nahi", ur: "کسی ڈیش بورڈ پر نہیں" },
  dm_multi_place: { en: "Showing in several places", rm: "Kai jagah nazar aane wale", ur: "کئی جگہ نظر آنے والے" },
  dm_one_thing: { en: "one and the same thing, not a copy", rm: "ek hi cheez, naql nahi", ur: "ایک ہی چیز، نقل نہیں" },

  // ---- Bank ka milaan (client) ----
  bk_which_bank: { en: "Which bank", rm: "Kaunsa bank", ur: "کون سا بینک" },
  bk_paste_rows: { en: "Paste the rows", rm: "Qatarein daalein", ur: "قطاریں ڈالیں" },
  bk_statement_rows: {
    en: "Statement rows (copy from Excel and paste here)",
    rm: "Gosharay ki qatarein (Excel se copy kar ke yahan chipkayein)",
    ur: "گوشوارے کی قطاریں (ایکسل سے کاپی کر کے یہاں چپکائیں)",
  },
  bk_each_line: { en: "Each line:", rm: "Har lakeer:", ur: "ہر لکیر:" },
  bk_date_detail_amount: { en: "date, detail, amount", rm: "tareekh, tafseel, raqam", ur: "تاریخ، تفصیل، رقم" },
  bk_make_entry: { en: "Create an entry", rm: "Indraj banayein", ur: "اندراج بنائیں" },
  bk_what_kind: { en: "What kind is this? (e.g. bank charges)", rm: "Ye kis qism ka hai? (jaise: bank ke charges)", ur: "یہ کس قسم کا ہے؟ (جیسے: بینک کے چارجز)" },

  // ---- Submission ka faisla (baqi) ----
  sb_comment_req: { en: "Comment *", rm: "Aap ki baat *", ur: "آپ کی بات *" },
  sb_which_txn: { en: "What kind of transaction is this? *", rm: "Ye kis qism ka lein dein hai? *", ur: "یہ کس قسم کا لین دین ہے؟ *" },
  sb_which_bill: { en: "What kind of bill is this? *", rm: "Bill kis qism ka hai? *", ur: "بل کس قسم کا ہے؟ *" },
  sb_khata_req: { en: "Account *", rm: "Khata *", ur: "کھاتہ *" },
  sb_can_attach: { en: "You can attach photos", rm: "Tasveerein laga sakte hain", ur: "تصویریں لگا سکتے ہیں" },
  sb_final_note: {
    en: "Once decided it cannot be changed — the original evidence, the AI's guess and your comment all stay in the record.",
    rm: "Faisla hone ke baad badla nahi ja sakta -- asal saboot, AI ka andaza aur aap ki baat, sab record mein reh jayenge.",
    ur: "فیصلہ ہونے کے بعد بدلا نہیں جا سکتا — اصل ثبوت، AI کا اندازہ اور آپ کی بات، سب ریکارڈ میں رہ جائیں گے۔",
  },

  // ---- Stock ledger ----
  sl_balance_after: { en: "Balance After", rm: "Us ke baad baqi", ur: "اس کے بعد باقی" },

  // ---- Nuqsan ki report (baqi) ----
  rl_title_full: { en: "Report Loss (damage / theft / shrinkage)", rm: "Nuqsan darj karein (toot phoot / chori / kami)", ur: "نقصان درج کریں (ٹوٹ پھوٹ / چوری / کمی)" },
  rl_type_req: { en: "Loss Type *", rm: "Nuqsan ki qism *", ur: "نقصان کی قسم *" },
  rl_product_req: { en: "Product *", rm: "Cheez *", ur: "چیز *" },
  rl_qty_req: { en: "Quantity *", rm: "Tadaad *", ur: "تعداد *" },
  rl_shop_req: { en: "Shop *", rm: "Dukan *", ur: "دکان *" },
  rl_reported: { en: "Loss reported — waiting for verification.", rm: "Nuqsan darj ho gaya -- tasdeeq ka intezar hai.", ur: "نقصان درج ہو گیا — تصدیق کا انتظار ہے۔" },

  // ---- Cheez ka form (baqi) ----
  pf_purchase_price: { en: "Purchase Price (Rs.) *", rm: "Kharid ki qeemat (Rs.) *", ur: "خرید کی قیمت (روپے) *" },
  pf_selling_cash: { en: "Selling Price (cash) (Rs.) *", rm: "Bikri ki qeemat (naqad) (Rs.) *", ur: "بکری کی قیمت (نقد) (روپے) *" },
  pf_show_expiry: {
    en: "Show the expiry date to customers on the public product page",
    rm: "Khatam hone ki tareekh gahakon ko cheez ke safhe par dikhayein",
    ur: "ختم ہونے کی تاریخ گاہکوں کو چیز کے صفحے پر دکھائیں",
  },
  pf_sent_for_approval: { en: "Sent for the admin's approval", rm: "Admin ki manzoori ke liye bhej diya gaya", ur: "ایڈمن کی منظوری کے لیے بھیج دیا گیا" },
  pf_generate: { en: "Generate", rm: "Bana dein", ur: "بنا دیں" },
  pf_ai_not_connected: {
    en: "AI photo reading is not connected yet — it needs the Gemini API key (GEMINI_API_KEY). Manual and voice both work right now.",
    rm: "Tasveer se parhne wala AI abhi juRa nahi -- us ke liye Gemini ki chaabi (GEMINI_API_KEY) chahiye. Haath se aur awaz se, dono abhi chalte hain.",
    ur: "تصویر سے پڑھنے والا AI ابھی جڑا نہیں — اس کے لیے Gemini کی چابی (GEMINI_API_KEY) چاہیے۔ ہاتھ سے اور آواز سے، دونوں ابھی چلتے ہیں۔",
  },

  // ---- Paighaam ----
  mg_no_contact: { en: "No contact found.", rm: "Koi raabta nahi mila.", ur: "کوئی رابطہ نہیں ملا۔" },
  mg_pick_contact: { en: "Pick a contact.", rm: "Koi raabta chunein.", ur: "کوئی رابطہ چنیں۔" },
  mg_no_message: { en: "No messages yet. Start the conversation.", rm: "Abhi koi paighaam nahi. Baat shuru karein.", ur: "ابھی کوئی پیغام نہیں۔ بات شروع کریں۔" },
  mg_write: { en: "Write a message...", rm: "Paighaam likhein...", ur: "پیغام لکھیں..." },
  mg_view_file: { en: "View File", rm: "File dekhein", ur: "فائل دیکھیں" },
  mg_attachment: { en: "attachment", rm: "lagi hui file", ur: "لگی ہوئی فائل" },

  // ---- Nayi booking ----
  nb_all_under_id: {
    en: "Advance, rate confirmation, machine dispatch, the actual work, the bill and the payment — all under this same booking ID.",
    rm: "Advance, rate ki tasdeeq, machine ki rawangi, asal kaam, bill aur adaigi -- sab isi booking ID ke neeche.",
    ur: "ایڈوانس، ریٹ کی تصدیق، مشین کی روانگی، اصل کام، بل اور ادائیگی — سب اسی بکنگ ID کے نیچے۔",
  },
  nb_no_machine_yet: {
    en: "Which machine goes is not decided now — it is chosen at dispatch time.",
    rm: "Kaun si machine jayegi, ye abhi tay karna zaroori nahi -- wo rawangi ke waqt chuni jati hai.",
    ur: "کون سی مشین جائے گی، یہ ابھی طے کرنا ضروری نہیں — وہ روانگی کے وقت چنی جاتی ہے۔",
  },
  nb_free_days: { en: "There is full room on these days:", rm: "In dinon mein poori jagah hai:", ur: "ان دنوں میں پوری جگہ ہے:" },
  nb_from_request: {
    en: "You are creating this booking from the farmer's own request. Once the booking is made, that request is marked done.",
    rm: "Kisan ki apni farmaish se booking ban rahi hai. Booking ban'ne par wo farmaish poori ho jayegi.",
    ur: "کسان کی اپنی فرمائش سے بکنگ بن رہی ہے۔ بکنگ بننے پر وہ فرمائش پوری ہو جائے گی۔",
  },
  nb_acre: { en: "acre", rm: "acre", ur: "ایکڑ" },
  nb_kanal: { en: "kanal", rm: "kanal", ur: "کنال" },

  // ---- Sarmaya kaar ki fehrist ----
  iv_none: { en: "No investors yet", rm: "Abhi koi sarmaya kaar nahi", ur: "ابھی کوئی سرمایہ کار نہیں" },
} as const;
