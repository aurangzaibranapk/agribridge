/**
 * Public website ke baqi safhe -- naukri, sarmayakari, raabta, ta'aruf,
 * blog, gallery, sawalat aur widgets.
 *
 * Khanon ke naam (Full Name, Email, Phone) ke liye common wale khane
 * dobara nahi banaye gaye jahan wo pehle se maujood hain -- magar in
 * safhon par kuch khanon par sitara hai (Full Name *) aur kuch par nahi.
 * Wo farq jaan boojh kar rakha hai: sitara batata hai ke bharna lazmi
 * hai, aur us ka hona ya na hona ek maloomat hai -- sirf sajawat nahi.
 */
export const sitePagesDict = {
  // ---- Aam khane ----
  sp_full_name: { en: "Full Name", rm: "Poora naam", ur: "پورا نام" },
  sp_full_name_req: { en: "Full Name *", rm: "Poora naam *", ur: "پورا نام *" },
  sp_email: { en: "Email", rm: "Email", ur: "ای میل" },
  sp_phone: { en: "Phone", rm: "Phone", ur: "فون" },
  sp_phone_wa: { en: "Phone / WhatsApp", rm: "Phone / WhatsApp", ur: "فون / واٹس ایپ" },
  sp_address: { en: "Address", rm: "Pata", ur: "پتہ" },
  sp_message: { en: "Message", rm: "Paighaam", ur: "پیغام" },
  sp_message_req: { en: "Message *", rm: "Paighaam *", ur: "پیغام *" },
  sp_cancel: { en: "Cancel", rm: "Rehne dein", ur: "رہنے دیں" },
  sp_other: { en: "Other", rm: "Doosra", ur: "دوسرا" },
  sp_your_name: { en: "Your name", rm: "Aap ka naam", ur: "آپ کا نام" },
  sp_eg_email: { en: "you@example.com", rm: "aap@misal.com", ur: "aap@misal.com" },

  // ---- Naukri ki darkhwast ----
  sp_basic_info: { en: "Basic Information", rm: "Buniyadi maloomat", ur: "بنیادی معلومات" },
  sp_exp_qual: { en: "Experience & Qualification", rm: "Tajurba aur taleem", ur: "تجربہ اور تعلیم" },
  sp_documents: { en: "Documents", rm: "Kaghazat", ur: "کاغذات" },
  sp_cnic_number: { en: "CNIC Number", rm: "Shanakhti card number", ur: "شناختی کارڈ نمبر" },
  sp_cnic_front: { en: "CNIC Front", rm: "Shanakhti card — saamne", ur: "شناختی کارڈ — سامنے" },
  sp_cnic_back: { en: "CNIC Back", rm: "Shanakhti card — peeche", ur: "شناختی کارڈ — پیچھے" },
  sp_cv: { en: "CV / Resume (if any)", rm: "CV / Resume (agar ho)", ur: "سی وی / ریزیومے (اگر ہو)" },
  sp_exp_cert: { en: "Experience Certificate (if any)", rm: "Tajurbe ka certificate (agar ho)", ur: "تجربے کا سرٹیفکیٹ (اگر ہو)" },
  sp_qual_cert: { en: "Qualification Certificate", rm: "Taleem ka certificate", ur: "تعلیم کا سرٹیفکیٹ" },
  sp_qualification: {
    en: "Qualification (e.g. BSc Agriculture, 2022)",
    rm: "Taleem (misal: BSc Agriculture, 2022)",
    ur: "تعلیم (مثال: بی ایس سی ایگریکلچر، 2022)",
  },
  sp_past_work: {
    en: "Past work / experience (where you worked, for how long)",
    rm: "Pichla kaam / tajurba (kahan kaam kiya, kitna arsa)",
    ur: "پچھلا کام / تجربہ (کہاں کام کیا، کتنا عرصہ)",
  },
  sp_about_you: { en: "Tell us a little about yourself (optional)", rm: "Apne bare mein thora batayein (marzi se)", ur: "اپنے بارے میں تھوڑا بتائیں (مرضی سے)" },
  sp_expected_salary: { en: "Expected Salary (Rs.)", rm: "Tawaqqo ki tankhwah (Rs.)", ur: "توقع کی تنخواہ (روپے)" },
  sp_application_received: {
    en: "We have your application. We will contact you soon.",
    rm: "Aap ki darkhwast mil gayi hai. Hum jald aap se raabta karenge.",
    ur: "آپ کی درخواست مل گئی ہے۔ ہم جلد آپ سے رابطہ کریں گے۔",
  },

  // ---- Sarmayakari ka safha ----
  sp_invest_platform: { en: "Business & Investment Platform", rm: "Karobar aur sarmayakari ka platform", ur: "کاروبار اور سرمایہ کاری کا پلیٹ فارم" },
  sp_invest_lead: {
    en: "Pakistan's most transparent agriculture business platform — no cash, only products and livestock, run through halal, written agreements.",
    rm: "Pakistan ka sab se saaf zarai karobari platform — naqad nahi, sirf cheezein aur maweshi, aur har sauda halal aur likhit muahide par.",
    ur: "پاکستان کا سب سے صاف زرعی کاروباری پلیٹ فارم — نقد نہیں، صرف چیزیں اور مویشی، اور ہر سودا حلال اور تحریری معاہدے پر۔",
  },
  sp_choose_model: { en: "Choose Your Business Model", rm: "Apna karobari tareeqa chunein", ur: "اپنا کاروباری طریقہ چنیں" },
  sp_four_models: {
    en: "Four proven partnership models — transparent, halal, and profitable. No cash required.",
    rm: "Sharakat ke chaar aazmaye hue tareeqe — saamne, halal aur nafa-bakhsh. Naqad ki koi zaroorat nahi.",
    ur: "شراکت کے چار آزمائے ہوئے طریقے — سامنے، حلال اور نفع بخش۔ نقد کی کوئی ضرورت نہیں۔",
  },
  sp_discuss_model: { en: "Discuss this model →", rm: "Is tareeqe par baat karein →", ur: "اِس طریقے پر بات کریں ←" },
  sp_startup_to_leader: { en: "From Startup to Market Leader", rm: "Shuruat se market ke sab se aage tak", ur: "شروعات سے مارکیٹ کے سب سے آگے تک" },
  sp_figures_note: {
    en: "Exact revenue and growth figures are shared directly with serious partnership inquiries.",
    rm: "Aamdani aur barhotri ke asal adad sanjeeda sharakat ke sawal par seedha diye jate hain.",
    ur: "آمدنی اور بڑھوتری کے اصل اعداد سنجیدہ شراکت کے سوال پر سیدھا دیے جاتے ہیں۔",
  },
  sp_submit_inquiry: { en: "Submit an Investment Inquiry", rm: "Sarmayakari ka sawal bhejein", ur: "سرمایہ کاری کا سوال بھیجیں" },
  sp_inquiry_note: {
    en: "Tell us a bit about your interest — our team will reach out to discuss details.",
    rm: "Apni dilchaspi ke bare mein thora batayein — hamari team tafseel ke liye raabta karegi.",
    ur: "اپنی دلچسپی کے بارے میں تھوڑا بتائیں — ہماری ٹیم تفصیل کے لیے رابطہ کرے گی۔",
  },
  sp_trusted_partner: { en: "Your trusted agriculture business partner", rm: "Aap ka bharose wala zarai karobari sathi", ur: "آپ کا بھروسے والا زرعی کاروباری ساتھی" },
  sp_interested_in: { en: "Interested In", rm: "Kis mein dilchaspi hai", ur: "کس میں دلچسپی ہے" },
  sp_inquiry_thanks: {
    en: "Thank you — our team will reach out soon.",
    rm: "Shukriya — hamari team jald raabta karegi.",
    ur: "شکریہ — ہماری ٹیم جلد رابطہ کرے گی۔",
  },

  // ---- Raabta ----
  sp_here_to_help: { en: "We're Here to Help", rm: "Hum aap ki madad ke liye hain", ur: "ہم آپ کی مدد کے لیے ہیں" },
  sp_contact_lead: {
    en: "Questions about products, orders, dealership, or partnership — reach us any of these ways.",
    rm: "Cheezon, order, dealership ya sharakat ke bare mein koi sawal ho — in mein se kisi bhi tarah raabta karein.",
    ur: "چیزوں، آرڈر، ڈیلرشپ یا شراکت کے بارے میں کوئی سوال ہو — اِن میں سے کسی بھی طرح رابطہ کریں۔",
  },
  sp_business_hours: { en: "Business Hours", rm: "Kaam ke auqat", ur: "کام کے اوقات" },
  sp_call: { en: "Call", rm: "Phone karein", ur: "فون کریں" },
  sp_location_map: { en: "Location map", rm: "Jagah ka naqsha", ur: "جگہ کا نقشہ" },
  sp_how_help: { en: "How can we help?", rm: "Hum kya madad kar sakte hain?", ur: "ہم کیا مدد کر سکتے ہیں؟" },
  sp_message_sent: {
    en: "Message sent — we'll get back to you soon.",
    rm: "Paighaam chala gaya — hum jald jawab denge.",
    ur: "پیغام چلا گیا — ہم جلد جواب دیں گے۔",
  },

  // ---- Ta'aruf ----
  sp_about_title: { en: "About Al Rana Traders", rm: "Al Rana Traders ke bare mein", ur: "الرانا ٹریڈرز کے بارے میں" },
  sp_about_lead: {
    en: "A Pakistan agriculture platform dedicated to quality products, expert guidance, and connecting every farmer, dealer, company, and investor on one transparent, reliable bridge.",
    rm: "Pakistan ka ek zarai platform — achhi cheezein, mahiron ki rehnumai, aur har kisan, dealer, company aur sarmayakar ko ek hi saaf aur bharose wale pul par jorna.",
    ur: "پاکستان کا ایک زرعی پلیٹ فارم — اچھی چیزیں، ماہرین کی رہنمائی، اور ہر کسان، ڈیلر، کمپنی اور سرمایہ کار کو ایک ہی صاف اور بھروسے والے پُل پر جوڑنا۔",
  },
  sp_our_mission: { en: "Our Mission", rm: "Hamara maqsad", ur: "ہمارا مقصد" },
  sp_our_vision: { en: "Our Vision", rm: "Hamari soch", ur: "ہماری سوچ" },
  sp_our_values: { en: "Our Values", rm: "Hamare usool", ur: "ہمارے اصول" },
  sp_founder_since: { en: "Founder & CEO — Founded 2010", rm: "Bani aur CEO — 2010 mein shuru", ur: "بانی اور سی ای او — 2010 میں شروع" },

  // ---- Cheezon ki fehrist ----
  sp_products: { en: "Products", rm: "Cheezein", ur: "چیزیں" },
  sp_products_lead: {
    en: "Seed, fertilizer, and crop protection — updated directly from our inventory.",
    rm: "Beej, khaad aur fasal ki hifazat ka saman — seedha hamare godam se, roz ka roz.",
    ur: "بیج، کھاد اور فصل کی حفاظت کا سامان — سیدھا ہمارے گودام سے، روز کا روز۔",
  },
  sp_all_categories: { en: "All Categories", rm: "Sab qismein", ur: "سب قسمیں" },
  sp_all_companies: { en: "All Companies", rm: "Sab companies", ur: "سب کمپنیاں" },
  sp_filter: { en: "Filter", rm: "Chhantein", ur: "چھانٹیں" },
  sp_no_products: { en: "No products match your filters.", rm: "Aap ki chhant par koi cheez nahi mili.", ur: "آپ کی چھانٹ پر کوئی چیز نہیں ملی۔" },
  sp_search_products: { en: "Search products...", rm: "Cheezein dhoondein...", ur: "چیزیں ڈھونڈیں..." },

  // ---- Ek cheez ka safha ----
  sp_active_ingredient: { en: "Active Ingredient", rm: "Asal juzw", ur: "اصل جزو" },
  sp_composition: { en: "Composition", rm: "Tarkeeb", ur: "ترکیب" },
  sp_dosage: { en: "Dosage", rm: "Miqdar", ur: "مقدار" },
  sp_pack_size: { en: "Pack Size", rm: "Pack ka size", ur: "پیک کا سائز" },
  sp_unit: { en: "Unit", rm: "Unit", ur: "یونٹ" },
  sp_best_before: { en: "Best Before", rm: "Is tareekh se pehle", ur: "اِس تاریخ سے پہلے" },
  sp_usage: { en: "Usage Instructions", rm: "Istemal ka tareeqa", ur: "استعمال کا طریقہ" },
  sp_safety: { en: "Safety Information", rm: "Hifazat ki baatein", ur: "حفاظت کی باتیں" },
  sp_brochure: { en: "Download Brochure (PDF)", rm: "Kitabcha download karein (PDF)", ur: "کتابچہ ڈاؤن لوڈ کریں (پی ڈی ایف)" },
  sp_order_this: { en: "Order This Product", rm: "Ye cheez order karein", ur: "یہ چیز آرڈر کریں" },
  sp_related_products: { en: "Related Products", rm: "Isi tarah ki cheezein", ur: "اسی طرح کی چیزیں" },
  sp_related_articles: { en: "Related Articles", rm: "Isi tarah ke mazameen", ur: "اسی طرح کے مضامین" },

  // ---- Dhoondna ----
  sp_search: { en: "Search", rm: "Dhoondein", ur: "ڈھونڈیں" },
  sp_search_site: { en: "Search the site...", rm: "Website mein dhoondein...", ur: "ویب سائٹ میں ڈھونڈیں..." },
  sp_search_start: { en: "Type something in the search bar to get started.", rm: "Upar wale khane mein kuch likhein.", ur: "اوپر والے خانے میں کچھ لکھیں۔" },
  sp_no_results: {
    en: "No results found. Try the Contact page if you need direct help.",
    rm: "Kuch nahi mila. Seedhi madad chahiye to Raabta wala safha kholein.",
    ur: "کچھ نہیں ملا۔ سیدھی مدد چاہیے تو رابطہ والا صفحہ کھولیں۔",
  },
  sp_services: { en: "Services", rm: "Khidmaat", ur: "خدمات" },
  sp_services_lead: {
    en: "What Al Rana Traders offers beyond the product catalog.",
    rm: "Cheezon ki fehrist ke ilawa Al Rana Traders kya deta hai.",
    ur: "چیزوں کی فہرست کے علاوہ الرانا ٹریڈرز کیا دیتا ہے۔",
  },
  sp_inquire_service: { en: "Inquire About This Service", rm: "Is khidmat ke bare mein poochein", ur: "اِس خدمت کے بارے میں پوچھیں" },

  // ---- Blog ----
  sp_blog: { en: "Blog", rm: "Blog", ur: "بلاگ" },
  sp_blog_lead: {
    en: "Farming tips, product guides, and stories from the field.",
    rm: "Kheti ke mashware, cheezon ki rehnumai, aur khet se aayi baatein.",
    ur: "کھیتی کے مشورے، چیزوں کی رہنمائی، اور کھیت سے آئی باتیں۔",
  },
  sp_all: { en: "All", rm: "Sab", ur: "سب" },
  sp_no_articles: { en: "No articles found.", rm: "Koi mazmoon nahi mila.", ur: "کوئی مضمون نہیں ملا۔" },
  sp_search_articles: { en: "Search articles...", rm: "Mazameen dhoondein...", ur: "مضامین ڈھونڈیں..." },

  // ---- Naukri ----
  sp_careers_title: { en: "Careers at Al Rana Traders", rm: "Al Rana Traders mein naukri", ur: "الرانا ٹریڈرز میں نوکری" },
  sp_careers_lead: {
    en: "Join our team — see the open positions below.",
    rm: "Hamari team ka hissa banein — neeche khali jagahein dekhein.",
    ur: "ہماری ٹیم کا حصہ بنیں — نیچے خالی جگہیں دیکھیں۔",
  },
  sp_no_vacancy: { en: "No vacancy is open right now.", rm: "Abhi koi jagah khali nahi hai.", ur: "ابھی کوئی جگہ خالی نہیں ہے۔" },
  sp_apply: { en: "Apply", rm: "Darkhwast dein", ur: "درخواست دیں" },

  // ---- Gallery, FAQ, testimonials ----
  sp_gallery: { en: "Gallery", rm: "Gallery", ur: "گیلری" },
  sp_gallery_lead: {
    en: "Farm visits, dealer network events, and product demonstrations.",
    rm: "Kheton ke dauray, dealer ki mehfilein, aur cheezon ka mazahira.",
    ur: "کھیتوں کے دورے، ڈیلر کی محفلیں، اور چیزوں کا مظاہرہ۔",
  },
  sp_no_gallery: { en: "No gallery items yet.", rm: "Abhi gallery mein kuch nahi.", ur: "ابھی گیلری میں کچھ نہیں۔" },
  sp_close: { en: "Close", rm: "Band karein", ur: "بند کریں" },
  sp_faq_title: { en: "Frequently Asked Questions", rm: "Aksar poochhe jane wale sawal", ur: "اکثر پوچھے جانے والے سوال" },
  sp_faq_lead: { en: "Answers to the questions we hear most often.", rm: "Un sawalon ke jawab jo sab se ziyada poochhe jate hain.", ur: "اُن سوالوں کے جواب جو سب سے زیادہ پوچھے جاتے ہیں۔" },
  sp_no_faq: { en: "No FAQs match your search.", rm: "Aap ke dhoondne par koi sawal nahi mila.", ur: "آپ کے ڈھونڈنے پر کوئی سوال نہیں ملا۔" },
  sp_search_faq: { en: "Search FAQs...", rm: "Sawal dhoondein...", ur: "سوال ڈھونڈیں..." },
  sp_no_testimonials: { en: "No testimonials yet.", rm: "Abhi koi baat darj nahi.", ur: "ابھی کوئی بات درج نہیں۔" },
  sp_testimonials_lead: {
    en: "Real stories from farmers, dealers, and partners across Pakistan.",
    rm: "Poore Pakistan ke kisanon, dealeron aur sathiyon ki apni baatein.",
    ur: "پورے پاکستان کے کسانوں، ڈیلروں اور ساتھیوں کی اپنی باتیں۔",
  },

  // ---- Crop Doctor ----
  sp_doctor_title: { en: "AI Crop Doctor", rm: "AI Crop Doctor", ur: "اے آئی کراپ ڈاکٹر" },
  sp_doctor_offline: {
    en: "AI Crop Doctor is not connected yet — please contact the system administrator.",
    rm: "AI Crop Doctor abhi juri nahi — system administrator se raabta karein.",
    ur: "اے آئی کراپ ڈاکٹر ابھی جڑی نہیں — سسٹم ایڈمنسٹریٹر سے رابطہ کریں۔",
  },
  sp_diagnose: { en: "Diagnose", rm: "Jaanch karein", ur: "جانچ کریں" },
  sp_diagnosing: { en: "Diagnosing...", rm: "Jaanch ho rahi hai...", ur: "جانچ ہو رہی ہے..." },
  sp_tap_upload: { en: "Tap to upload a photo of the affected crop", rm: "Kharab fasal ki tasveer bhejne ke liye yahan dabayein", ur: "خراب فصل کی تصویر بھیجنے کے لیے یہاں دبائیں" },
  sp_photo_hint: { en: "JPG or PNG, a clear close-up works best", rm: "JPG ya PNG — qareeb se li hui saaf tasveer sab se behtar", ur: "جے پی جی یا پی این جی — قریب سے لی ہوئی صاف تصویر سب سے بہتر" },
  sp_uploaded_crop: { en: "Uploaded crop", rm: "Bheji hui fasal", ur: "بھیجی ہوئی فصل" },
  sp_treatment: { en: "Treatment", rm: "Ilaj", ur: "علاج" },
  sp_spray_schedule: { en: "Spray Schedule", rm: "Spray ka nizam-ul-auqat", ur: "سپرے کا شیڈول" },

  // ---- Chat widgets ----
  sp_assistant: { en: "AgriBridge Assistant", rm: "AgriBridge Assistant", ur: "ایگری بریج اسسٹنٹ" },
  sp_open_chat: { en: "Open chat assistant", rm: "Chat assistant kholein", ur: "چیٹ اسسٹنٹ کھولیں" },
  sp_ask_question: { en: "Ask a question...", rm: "Koi sawal poochein...", ur: "کوئی سوال پوچھیں..." },
  sp_typing: { en: "Typing...", rm: "Likh raha hai...", ur: "لکھ رہا ہے..." },
  sp_open_page: { en: "Open page →", rm: "Safha kholein →", ur: "صفحہ کھولیں ←" },
  sp_investment_assistant: { en: "Investment Assistant", rm: "Sarmayakari ka assistant", ur: "سرمایہ کاری کا اسسٹنٹ" },
  sp_start_conversation: { en: "Start a Conversation", rm: "Baat shuru karein", ur: "بات شروع کریں" },
  sp_ask_anything: { en: "Ask anything, such as:", rm: "Kuch bhi poochein, jaise:", ur: "کچھ بھی پوچھیں، جیسے:" },
  sp_write_question: { en: "Write your question...", rm: "Apna sawal likhein...", ur: "اپنا سوال لکھیں..." },

  // ---- Newsletter ----
  sp_subscribed: { en: "Subscribed! Thank you.", rm: "Naam darj ho gaya. Shukriya.", ur: "نام درج ہو گیا۔ شکریہ۔" },
} as const;
