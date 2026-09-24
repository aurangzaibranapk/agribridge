/**
 * Website ka intezam (hero slider, blog), audit log, sarmaya kaaron ke
 * sawal, aur "Meri Gaari".
 *
 * MERI GAARI KA SAFHA DRIVER KHUD BHARTA HAI, aur wahan teen qadam
 * jaan boojh kar ginti ke saath likhe gaye hain (1 subah ka meter, 3
 * shaam ka meter). Ye safha din mein do dafa, mukhtalif waqton par
 * khulta hai -- number lagane se banda foran samajh jata hai ke ab kis
 * qadam par hai.
 *
 * "Din mein jitni baar petrol daalein, utni baar" wala jumla qasdan
 * hai: bill EK nahi hota. Ek khana rakhne par doosri dafa ka petrol
 * kabhi darj hi nahi hota tha.
 *
 * AUDIT LOG PAR "KISNE" pehla khana hai, "kya kiya" doosra. Ulta rakhne
 * par fehrist kaam ke hisaab se parhi jati hai; is tarah wo bande ke
 * hisaab se parhi jati hai -- aur sawal hamesha "ye kis ne kiya" se
 * shuru hota hai.
 */
export const siteAdminDict = {
  // ---- Audit log ----
  al_title: { en: "Audit Log", rm: "Audit log", ur: "آڈٹ لاگ" },
  al_all_modules: { en: "All Modules", rm: "Sab hissay", ur: "سب حصے" },
  al_all_actions: { en: "All Actions", rm: "Sab kaam", ur: "سب کام" },
  al_create: { en: "Create", rm: "Banaya", ur: "بنایا" },
  al_update: { en: "Update", rm: "Badla", ur: "بدلا" },
  al_delete: { en: "Delete", rm: "Mitaya", ur: "مٹایا" },
  al_approve: { en: "Approve", rm: "Manzoor kiya", ur: "منظور کیا" },
  al_reject: { en: "Reject", rm: "Rad kiya", ur: "رد کیا" },
  al_login: { en: "Login", rm: "Login", ur: "لاگ ان" },
  al_filter_by_staff: { en: "Filter by staff name", rm: "Bande ke naam se chhaantein", ur: "بندے کے نام سے چھانٹیں" },
  al_filter: { en: "Filter", rm: "Chhaantein", ur: "چھانٹیں" },
  al_none_yet: { en: "No activity yet", rm: "Abhi tak koi kaam nahi hua", ur: "ابھی تک کوئی کام نہیں ہوا" },
  al_who: { en: "Who", rm: "Kis ne", ur: "کس نے" },
  al_module: { en: "Module", rm: "Hissa", ur: "حصہ" },
  al_when: { en: "When", rm: "Kab", ur: "کب" },

  // ---- Blog ----
  bg_blog: { en: "Blog", rm: "Blog", ur: "بلاگ" },
  bg_new_post: { en: "New Post", rm: "Nayi tehreer", ur: "نئی تحریر" },
  bg_new_post_page: { en: "New Blog Post", rm: "Nayi blog tehreer", ur: "نئی بلاگ تحریر" },
  bg_edit_post: { en: "Edit Blog Post", rm: "Blog tehreer tabdeel karein", ur: "بلاگ تحریر تبدیل کریں" },
  bg_none_yet: { en: "No blog posts yet", rm: "Abhi koi tehreer nahi", ur: "ابھی کوئی تحریر نہیں" },
  bg_created: { en: "Created", rm: "Bani", ur: "بنی" },
  bg_draft_note: {
    en: "Draft filled in below — please review and edit before publishing.",
    rm: "Neeche khaka bhar diya gaya hai -- shaya karne se pehle dekh aur theek kar lein.",
    ur: "نیچے خاکہ بھر دیا گیا ہے — شائع کرنے سے پہلے دیکھ اور ٹھیک کر لیں۔",
  },
  bg_cat_farming_tips: { en: "Farming Tips", rm: "Kheti ke mashware", ur: "کھیتی کے مشورے" },
  bg_cat_product_guides: { en: "Product Guides", rm: "Cheezon ki rehnumai", ur: "چیزوں کی رہنمائی" },
  bg_cat_company_news: { en: "Company News", rm: "Company ki khabrein", ur: "کمپنی کی خبریں" },
  bg_cat_success_stories: { en: "Success Stories", rm: "Kamyabi ke qissay", ur: "کامیابی کے قصے" },
  bg_featured_image: { en: "Featured Image", rm: "Numaya tasveer", ur: "نمایاں تصویر" },
  bg_excerpt: { en: "Excerpt", rm: "Chhota khulasa", ur: "چھوٹا خلاصہ" },
  bg_title_eg: { en: "e.g. Wheat sowing tips for Punjab", rm: "misal: Punjab mein gandum bone ke mashware", ur: "مثال: پنجاب میں گندم بونے کے مشورے" },

  // ---- Hero slider ----
  hs_title: { en: "Hero Slider", rm: "Hero slider", ur: "ہیرو سلائیڈر" },
  hs_none_yet: { en: "No slides yet", rm: "Abhi koi slide nahi", ur: "ابھی کوئی سلائیڈ نہیں" },
  hs_new_slide: { en: "New Slide", rm: "Nayi slide", ur: "نئی سلائیڈ" },
  hs_edit_slide: { en: "Edit Slide", rm: "Slide tabdeel karein", ur: "سلائیڈ تبدیل کریں" },
  hs_desktop_image: { en: "Desktop Image", rm: "Computer wali tasveer", ur: "کمپیوٹر والی تصویر" },
  hs_mobile_image: { en: "Mobile Image", rm: "Mobile wali tasveer", ur: "موبائل والی تصویر" },
  hs_mobile_url_optional: { en: "Mobile Image URL (optional)", rm: "Mobile tasveer ka pata (marzi se)", ur: "موبائل تصویر کا پتہ (مرضی سے)" },
  hs_mobile_url_note: {
    en: "Mobile Image URL (optional — leave it blank and the desktop image is used)",
    rm: "Mobile tasveer ka pata (marzi se -- khali chhoRein to computer wali hi chalegi)",
    ur: "موبائل تصویر کا پتہ (مرضی سے — خالی چھوڑیں تو کمپیوٹر والی ہی چلے گی)",
  },
  hs_no_mobile: {
    en: "No mobile image — the desktop one will be used",
    rm: "Mobile wali tasveer nahi hai -- computer wali hi chalegi",
    ur: "موبائل والی تصویر نہیں ہے — کمپیوٹر والی ہی چلے گی",
  },
  hs_subheadline: { en: "Subheadline", rm: "Chhota unwan", ur: "چھوٹا عنوان" },
  hs_order: { en: "Order", rm: "Tarteeb", ur: "ترتیب" },

  // ---- Sarmaya kaaron ke sawal ----
  ii_title: { en: "Investor Inquiries", rm: "Sarmaya kaaron ke sawal", ur: "سرمایہ کاروں کے سوال" },
  ii_none_yet: { en: "No inquiries yet", rm: "Abhi koi sawal nahi", ur: "ابھی کوئی سوال نہیں" },
  ii_create_dealer: { en: "Create Dealer Account", rm: "Dealer ka khata banayein", ur: "ڈیلر کا کھاتہ بنائیں" },
  ii_create_investor: { en: "Create Investor Account", rm: "Sarmaya kaar ka khata banayein", ur: "سرمایہ کار کا کھاتہ بنائیں" },
  ii_deal_type: { en: "Deal Type", rm: "Sauday ki qism", ur: "سودے کی قسم" },
  ii_product_investment: { en: "Product Investment", rm: "Cheezon mein sarmaya", ur: "چیزوں میں سرمایہ" },
  ii_dairy_livestock: { en: "Dairy & Livestock", rm: "Doodh aur maweshi", ur: "دودھ اور مویشی" },
  ii_franchise: { en: "Franchise", rm: "Franchise", ur: "فرنچائز" },
  ii_eg_15: { en: "e.g. 15", rm: "misal: 15", ur: "مثال: 15" },
  ii_closed: { en: "Closed", rm: "Band", ur: "بند" },

  // ---- Meri gaari ----
  mv_title: { en: "My Vehicle", rm: "Meri gaari", ur: "میری گاڑی" },
  mv_morning_meter: { en: "Morning meter", rm: "Subah ka meter", ur: "صبح کا میٹر" },
  mv_evening_meter: { en: "Evening meter", rm: "Shaam ka meter", ur: "شام کا میٹر" },
  mv_today_run: { en: "Ran today", rm: "Aaj chale", ur: "آج چلے" },
  mv_step1_morning: { en: "1 — Morning meter", rm: "1 — Subah ka meter", ur: "1 — صبح کا میٹر" },
  mv_step1_enter: { en: "Enter the morning meter", rm: "Subah ka meter darj karein", ur: "صبح کا میٹر درج کریں" },
  mv_step3_evening: { en: "3 — Evening meter", rm: "3 — Shaam ka meter", ur: "3 — شام کا میٹر" },
  mv_step3_enter: { en: "Enter the evening meter", rm: "Shaam ka meter darj karein", ur: "شام کا میٹر درج کریں" },
  mv_todays_bills: { en: "Today's petrol bills", rm: "Aaj ke petrol ke bill", ur: "آج کے پٹرول کے بل" },
  mv_promise: { en: "Promise", rm: "Waada", ur: "وعدہ" },
  mv_meter_reading: { en: "What the meter reads (km)", rm: "Meter par kitna likha hai (km)", ur: "میٹر پر کتنا لکھا ہے (کلومیٹر)" },
  mv_as_many_times: {
    en: "As many times as you fill petrol in a day, that many entries.",
    rm: "Din mein jitni baar petrol daalein, utni baar.",
    ur: "دن میں جتنی بار پٹرول ڈالیں، اتنی بار۔",
  },
  mv_litre: { en: "Litre", rm: "Litre", ur: "لیٹر" },
  mv_enter_bill: { en: "Enter the bill", rm: "Bill darj karein", ur: "بل درج کریں" },
} as const;
