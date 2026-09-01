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
} as const;
