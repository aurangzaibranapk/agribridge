/**
 * Kisan portal -- baqi safhe.
 *
 * portal.ts mein 290 alfaz pehle se hain (dashboard, sidebar, profile,
 * khet). Ye file un safhon ka baqi matn hai jo us waqt chhoot gaye the:
 * fasal bechna, khaad ka order, marketplace, jaanwar, kharche ka
 * gosharah, aur wo yaad dahaniyan jo khud ubharti hain.
 *
 * Jo lafz portal.ts ya commonDict mein pehle se the, un ke liye yahan
 * naya key NAHI banaya gaya -- Cancel, Edit, Total, Tadaad, Note, Qism,
 * Zila, Fasal, Acre, Kanal, Marla, "Dashboard par wapas", Haan, Nahi,
 * "Mehfooz ho gaya." Ek cheez ka ek naam; do key ka anjaam ye hota hai
 * ke kal koi ek badalta hai aur doosra wahin reh jata hai.
 *
 * DO BAATEIN JO YAHAN SOCH KAR LIKHI GAYIN:
 *
 * 1. Score wale card ka jumla ("Abhi itna record nahi bana...") us
 *    kisan ke liye hai jis ka koi darja abhi nahi bana. Us mein "koi
 *    kami nahi" jaan boojh kar likha hai: khali darja NA HONA hai, bura
 *    hona nahi. Teen zabanon mein yehi farq rakha gaya hai -- warna
 *    tarjuma khud wo maana daal deta jis se poora nizam bachne ki
 *    koshish kar raha hai.
 *
 * 2. "kg", "maund", "ton" ke Urdu naam wohi hain jo mandi mein bole
 *    jate hain (کلو، من، ٹن). "maund" ko "40 کلو" likh dena naap ko
 *    hisaab bana dena hota -- mandi mein banda "man" kehta hai.
 */
export const portalMoreDict = {
  // ---- Fasal bechna ----
  pm_sell_title: { en: "Sell Your Produce", rm: "Apni fasal bechein", ur: "اپنی فصل بیچیں" },
  pm_sell_intro: {
    en: "List your harvested crops for sale - verified buyers will place orders, and we'll route the payment to you.",
    rm: "Apni kaati hui fasal bikri ke liye lagayein - tasdeeq shuda kharidar order karenge, aur paisa hum aap tak pahuncha denge.",
    ur: "اپنی کاٹی ہوئی فصل بکری کے لیے لگائیں - تصدیق شدہ خریدار آرڈر کریں گے، اور پیسہ ہم آپ تک پہنچا دیں گے۔",
  },
  pm_my_listings: { en: "My Listings", rm: "Meri fehrist", ur: "میری فہرست" },
  pm_new_listing: { en: "New Listing", rm: "Nayi fehrist", ur: "نئی فہرست" },
  pm_new_produce_listing: { en: "New Produce Listing", rm: "Fasal bikri ke liye lagayein", ur: "فصل بکری کے لیے لگائیں" },
  pm_listing_created: { en: "Listing created.", rm: "Fehrist ban gayi.", ur: "فہرست بن گئی۔" },
  pm_no_listings: {
    en: "No listings yet. Create one to start selling your produce.",
    rm: "Abhi koi fehrist nahi. Fasal bechne ke liye ek banayein.",
    ur: "ابھی کوئی فہرست نہیں۔ فصل بیچنے کے لیے ایک بنائیں۔",
  },
  pm_crop_name: { en: "Crop Name *", rm: "Fasal ka naam *", ur: "فصل کا نام *" },
  pm_eg_crops: { en: "e.g. Wheat, Rice, Maize", rm: "misal: gandum, chawal, makai", ur: "مثال: گندم، چاول، مکئی" },
  pm_qty_available: { en: "Quantity Available *", rm: "Kitni tadaad maujood hai *", ur: "کتنی تعداد موجود ہے *" },
  pm_asking_price: { en: "Asking Price per Unit (Rs.) *", rm: "Fi akai qeemat (Rs.) *", ur: "فی اکائی قیمت (Rs.) *" },
  pm_quality_grade: { en: "Quality Grade", rm: "Maal ka darja", ur: "مال کا درجہ" },
  pm_eg_grade: { en: "e.g. A, Premium", rm: "misal: A, Premium", ur: "مثال: A، Premium" },
  pm_kg: { en: "kg", rm: "kilo", ur: "کلو" },
  pm_maund: { en: "maund", rm: "man", ur: "من" },
  pm_ton: { en: "ton", rm: "ton", ur: "ٹن" },
  pm_orders_needing: { en: "Orders Needing Your Response", rm: "Jin order ka jawab aap ne dena hai", ur: "جن آرڈر کا جواب آپ نے دینا ہے" },
  pm_order_history: { en: "Order History", rm: "Purane order", ur: "پرانے آرڈر" },
  pm_accept: { en: "Accept", rm: "Qabool karein", ur: "قبول کریں" },
  pm_reject: { en: "Reject", rm: "Mana karein", ur: "منع کریں" },

  // ---- Jaanwar ----
  pm_livestock_details: { en: "Livestock Details", rm: "Jaanwaron ki tafseel", ur: "جانوروں کی تفصیل" },
  pm_have_livestock: { en: "Do you keep livestock?", rm: "Kya aap jaanwar rakhte hain?", ur: "کیا آپ جانور رکھتے ہیں؟" },
  pm_cows: { en: "Cows", rm: "Gaayein", ur: "گائیں" },
  pm_buffaloes: { en: "Buffaloes", rm: "Bhainsein", ur: "بھینسیں" },
  pm_calves: { en: "Calves", rm: "Bachay", ur: "بچے" },
  pm_milking_animals: { en: "Milking Animals", rm: "Doodh dene wale jaanwar", ur: "دودھ دینے والے جانور" },
  pm_meat_animals: { en: "Meat Animals", rm: "Gosht wale jaanwar", ur: "گوشت والے جانور" },
  pm_milk_per_day: { en: "Milk (Litres/Day)", rm: "Doodh (litre roz)", ur: "دودھ (لیٹر روز)" },
  pm_milk_rate: { en: "Milk Rate (Rs./Litre)", rm: "Doodh ka rate (Rs. fi litre)", ur: "دودھ کا ریٹ (Rs. فی لیٹر)" },
  pm_milk_buyer: { en: "Milk Buyer (who do you sell to)", rm: "Doodh kis ko bechte hain", ur: "دودھ کس کو بیچتے ہیں" },
  pm_milk_advance: { en: "Advance / Loan against Milk (Rs.)", rm: "Doodh ke against advance ya qarz (Rs.)", ur: "دودھ کے عوض ایڈوانس یا قرض (Rs.)" },

  // ---- Khaad ka order ----
  pm_products_needed: { en: "Products Needed", rm: "Kya cheezein chahiyein", ur: "کیا چیزیں چاہئیں" },
  pm_add_product: { en: "Add Product", rm: "Cheez shamil karein", ur: "چیز شامل کریں" },
  pm_eg_fertilizer: { en: "e.g. Urea, DAP, Nitrophos", rm: "misal: Urea, DAP, Nitrophos", ur: "مثال: Urea، DAP، Nitrophos" },
  pm_crop_type: { en: "Crop Type", rm: "Fasal ki qism", ur: "فصل کی قسم" },
  pm_eg_crop_type: { en: "e.g. Wheat, Sugarcane, Cotton", rm: "misal: gandum, ganna, kapas", ur: "مثال: گندم، گنا، کپاس" },
  pm_cultivation_date: { en: "Cultivation Date", rm: "Kaasht ki tareekh", ur: "کاشت کی تاریخ" },
  pm_village_name: { en: "Village / area name", rm: "Gaon ya ilaqe ka naam", ur: "گاؤں یا علاقے کا نام" },
  pm_extra_notes: { en: "Additional Notes (optional)", rm: "Koi aur baat (marzi se)", ur: "کوئی اور بات (مرضی سے)" },
  pm_anything_else: { en: "Anything else we should know?", rm: "Aur kuch batana chahte hain?", ur: "اور کچھ بتانا چاہتے ہیں؟" },
  pm_fert_submitted: {
    en: "Your fertilizer request has been submitted. We'll be in touch soon.",
    rm: "Aap ki khaad ki darkhwast pahunch gayi. Hum jald raabta karenge.",
    ur: "آپ کی کھاد کی درخواست پہنچ گئی۔ ہم جلد رابطہ کریں گے۔",
  },
  pm_continue_livestock: { en: "Continue to Livestock Loan", rm: "Jaanwaron ke qarz ki taraf", ur: "جانوروں کے قرض کی طرف" },

  // ---- Fasal ka kharcha ----
  pm_add_expense: { en: "Add an Expense", rm: "Kharcha shamil karein", ur: "خرچہ شامل کریں" },
  pm_added: { en: "Added.", rm: "Shamil ho gaya.", ur: "شامل ہو گیا۔" },
  pm_amount_rs: { en: "Amount (Rs.)", rm: "Raqam (Rs.)", ur: "رقم (Rs.)" },
  pm_where_from: { en: "Where did it come from?", rm: "Kahan se liya?", ur: "کہاں سے لیا؟" },
  pm_from_our_system: { en: "From our system", rm: "Hamare nizam se", ur: "ہمارے نظام سے" },
  pm_from_outside: { en: "From outside", rm: "Bahar se", ur: "باہر سے" },
  pm_rate_autofill: {
    en: "Selecting one fills the rate automatically - you can still adjust it below.",
    rm: "Chunne par rate khud aa jayega - neeche badla bhi ja sakta hai.",
    ur: "چننے پر ریٹ خود آ جائے گا - نیچے بدلا بھی جا سکتا ہے۔",
  },
  pm_notes_optional: { en: "Notes (optional)", rm: "Note (marzi se)", ur: "نوٹ (مرضی سے)" },
  pm_eg_expense: { en: "e.g. DAP 1 bag", rm: "misal: DAP ek bori", ur: "مثال: DAP ایک بوری" },
  pm_crop_ready: { en: "Your crop is ready!", rm: "Aap ki fasal tayyar hai!", ur: "آپ کی فصل تیار ہے!" },
  pm_harvest_booked: {
    en: "The harvest is already booked - record it on the Harvest page.",
    rm: "Kattai book ho chuki hai - Harvest ke safhe par darj karein.",
    ur: "کٹائی بک ہو چکی ہے - ہارویسٹ کے صفحے پر درج کریں۔",
  },

  // ---- Fasal badalna ----
  pm_edit_crop: { en: "Edit Crop", rm: "Fasal tabdeel karein", ur: "فصل تبدیل کریں" },
  pm_sowing_date: { en: "Sowing Date", rm: "Bijai ki tareekh", ur: "بجائی کی تاریخ" },
  pm_area_optional: { en: "Area - optional (Acre / Kanal / Marla)", rm: "Raqba - marzi se (acre / kanal / marla)", ur: "رقبہ - مرضی سے (ایکڑ / کنال / مرلہ)" },
  pm_save_changes: { en: "Save Changes", rm: "Tabdeeli mehfooz karein", ur: "تبدیلی محفوظ کریں" },

  // ---- User ID ----
  pm_your_user_id: { en: "Your User ID", rm: "Aap ki User ID", ur: "آپ کی یوزر آئی ڈی" },
  pm_make_user_id: { en: "Create your User ID", rm: "Apni User ID banayein", ur: "اپنی یوزر آئی ڈی بنائیں" },
  pm_user_id: { en: "User ID", rm: "User ID", ur: "یوزر آئی ڈی" },
  pm_eg_username: { en: "e.g. aurangzeb", rm: "misal: aurangzeb", ur: "مثال: aurangzeb" },
  pm_user_id_rule: {
    en: "Start with a small letter, 4 to 20 characters. Only letters, digits, dot and underscore.",
    rm: "Chhote harf se shuru, 4 se 20 tak. Sirf harf, hindse, nuqta aur underscore.",
    ur: "چھوٹے حرف سے شروع، 4 سے 20 تک۔ صرف حرف، ہندسے، نقطہ اور انڈر سکور۔",
  },
  pm_user_id_once: {
    en: "The User ID is created once. To change it, contact the office.",
    rm: "User ID ek dafa banti hai. Badalni ho to daftar se raabta karein.",
    ur: "یوزر آئی ڈی ایک دفعہ بنتی ہے۔ بدلنی ہو تو دفتر سے رابطہ کریں۔",
  },
  pm_password: { en: "Password", rm: "Password", ur: "پاس ورڈ" },
  pm_password_again: { en: "Password again", rm: "Password dobara", ur: "پاس ورڈ دوبارہ" },
  pm_checking: { en: "Checking...", rm: "Dekh rahe hain...", ur: "دیکھ رہے ہیں..." },

  // ---- Order ----
  pm_place_order: { en: "Place an Order", rm: "Order karein", ur: "آرڈر کریں" },
  pm_your_order: { en: "Your Order", rm: "Aap ka order", ur: "آپ کا آرڈر" },
  pm_no_items: { en: "No items yet", rm: "Abhi koi cheez nahi", ur: "ابھی کوئی چیز نہیں" },
  pm_no_products: { en: "No products found.", rm: "Koi cheez nahi mili.", ur: "کوئی چیز نہیں ملی۔" },
  pm_search_products: { en: "Search products...", rm: "Cheez dhoondein...", ur: "چیز تلاش کریں..." },
  pm_tehsil: { en: "Tehsil (optional)", rm: "Tehsil (marzi se)", ur: "تحصیل (مرضی سے)" },
  pm_order_placed: { en: "Order placed successfully!", rm: "Order lag gaya!", ur: "آرڈر لگ گیا!" },
  pm_order_routed: {
    en: "Your order will be routed to a verified dealer in your area, delivered under Al Rana Traders.",
    rm: "Aap ka order aap ke ilaqe ke tasdeeq shuda dealer ko jayega, aur Al Rana Traders ke taht pahunchega.",
    ur: "آپ کا آرڈر آپ کے علاقے کے تصدیق شدہ ڈیلر کو جائے گا، اور الرعنا ٹریڈرز کے تحت پہنچے گا۔",
  },
  pm_dealer_notified: {
    en: "A verified dealer in your area has been notified. You'll be updated as your order progresses.",
    rm: "Aap ke ilaqe ke tasdeeq shuda dealer ko khabar ho gayi. Order aage barhta rahega aur aap ko bataya jata rahega.",
    ur: "آپ کے علاقے کے تصدیق شدہ ڈیلر کو خبر ہو گئی۔ آرڈر آگے بڑھتا رہے گا اور آپ کو بتایا جاتا رہے گا۔",
  },

  // ---- Marketplace ----
  pm_marketplace_intro: {
    en: "Browse fertilizer, seeds, and other inputs - we automatically find you the best price.",
    rm: "Khaad, beej aur baqi cheezein dekhein - behtareen qeemat hum khud dhoond dete hain.",
    ur: "کھاد، بیج اور باقی چیزیں دیکھیں - بہترین قیمت ہم خود تلاش کر دیتے ہیں۔",
  },
  pm_search_inputs: { en: "Search fertilizer, seeds, pesticide...", rm: "Khaad, beej, spray dhoondein...", ur: "کھاد، بیج، سپرے تلاش کریں..." },
  pm_select_product: { en: "Select a product to order", rm: "Order ke liye cheez chunein", ur: "آرڈر کے لیے چیز چنیں" },
  pm_will_match_best: {
    en: "We'll automatically match you with the seller offering the best price for your quantity.",
    rm: "Aap ki tadaad par jo bechne wala behtareen qeemat de raha ho, hum khud us se mila denge.",
    ur: "آپ کی تعداد پر جو بیچنے والا بہترین قیمت دے رہا ہو، ہم خود اس سے ملا دیں گے۔",
  },
  pm_matched_best: {
    en: "We automatically matched you with the best available price. You'll be updated as your order progresses.",
    rm: "Jo behtareen qeemat maujood thi, hum ne khud us se mila diya. Order aage barhta rahega aur aap ko bataya jata rahega.",
    ur: "جو بہترین قیمت موجود تھی، ہم نے خود اس سے ملا دیا۔ آرڈر آگے بڑھتا رہے گا اور آپ کو بتایا جاتا رہے گا۔",
  },

  // ---- Khet ----
  pm_farming_overview: { en: "Farming Overview", rm: "Kaasht ka khaka", ur: "کاشت کا خاکہ" },
  pm_crop_types: { en: "Type of Crops", rm: "Kaunsi fasalein", ur: "کون سی فصلیں" },
  pm_eg_wheat_rice: { en: "Wheat, Rice", rm: "gandum, chawal", ur: "گندم، چاول" },
  pm_see_on_map: { en: "See on the map", rm: "Naqshe par dekhein", ur: "نقشے پر دیکھیں" },

  // ---- Charts ----
  pm_chart_machine_type: { en: "Requests by Machine Type", rm: "Machine ki qism ke hisaab se", ur: "مشین کی قسم کے حساب سے" },
  pm_chart_animals: { en: "Animals by Type", rm: "Jaanwar qism ke hisaab se", ur: "جانور قسم کے حساب سے" },
  pm_chart_crop_type: { en: "Requests by Crop Type", rm: "Fasal ki qism ke hisaab se", ur: "فصل کی قسم کے حساب سے" },
  pm_chart_progress: { en: "Progress Overview", rm: "Kaam kahan tak pahuncha", ur: "کام کہاں تک پہنچا" },

  // ---- Kharche ka gosharah ----
  pm_expense_income_stmt: { en: "Expense and Income Statement", rm: "Kharche aur kamai ka gosharah", ur: "خرچے اور کمائی کا گوشوارہ" },
  pm_expense_by_category: { en: "Expense by Category", rm: "Qism ke hisaab se kharcha", ur: "قسم کے حساب سے خرچہ" },
  pm_total_expense: { en: "Total Expense", rm: "Kul kharcha", ur: "کل خرچہ" },
  pm_total_income: { en: "Total Income", rm: "Kul kamai", ur: "کل کمائی" },
  pm_net_profit: { en: "Net Profit", rm: "Saaf nafa", ur: "صاف نفع" },
  pm_no_expense: { en: "No expense recorded yet.", rm: "Abhi koi kharcha darj nahi.", ur: "ابھی کوئی خرچہ درج نہیں۔" },

  // ---- Score ka card ----
  // "Koi kami nahi" yahan jaan boojh kar hai: khali darja NA HONA hai,
  // bura hona nahi.
  pm_kisan_score: { en: "Farmer Credit Score", rm: "Kisan Credit Score", ur: "کسان کریڈٹ سکور" },
  pm_score_building: { en: "Building up", rm: "Ban raha hai", ur: "بن رہا ہے" },
  pm_score_building_msg: {
    en: "There is not enough record yet to give a rating. This is not a shortcoming — the counting has only just begun.",
    rm: "Abhi itna record nahi bana ke koi darja diya ja sake. Ye koi kami nahi — hisaab shuru hua hai.",
    ur: "ابھی اتنا ریکارڈ نہیں بنا کہ کوئی درجہ دیا جا سکے۔ یہ کوئی کمی نہیں — حساب شروع ہوا ہے۔",
  },
  pm_time_with_us: { en: "Time with us", rm: "Hamare saath waqt", ur: "ہمارے ساتھ وقت" },
  pm_recorded_work: { en: "Recorded work", rm: "Darj shuda kaam", ur: "درج شدہ کام" },

  // ---- Rok aur yaad dahani ----
  pm_subscription_needed: { en: "Subscription Required", rm: "Subscription zaroori hai", ur: "سبسکرپشن ضروری ہے" },
  pm_subscription_msg: {
    en: "An active subscription is required to use this feature. Minimum amount:",
    rm: "Ye cheez istemal karne ke liye subscription chalu honi chahiye. Kam az kam raqam:",
    ur: "یہ چیز استعمال کرنے کے لیے سبسکرپشن چالو ہونی چاہیے۔ کم از کم رقم:",
  },
  pm_contact_whatsapp: { en: "Contact us on WhatsApp", rm: "WhatsApp par raabta karein", ur: "WhatsApp پر رابطہ کریں" },
  pm_profile_gate_title: { en: "Complete Your Profile First", rm: "Pehle apni profile mukammal karein", ur: "پہلے اپنی پروفائل مکمل کریں" },
  pm_profile_gate_msg: {
    en: "Basic Information and Documents must be completed before using this section.",
    rm: "Is hisse ko istemal karne se pehle buniyadi maloomat aur kaghaz mukammal karna zaroori hai.",
    ur: "اس حصے کو استعمال کرنے سے پہلے بنیادی معلومات اور کاغذ مکمل کرنا ضروری ہے۔",
  },
  pm_profile_complete_btn: { en: "Complete Profile", rm: "Profile mukammal karein", ur: "پروفائل مکمل کریں" },
  pm_machinery_time: { en: "Machinery Booking Time Is Near", rm: "Machinery booking ka waqt aa raha hai", ur: "مشینری بکنگ کا وقت آ رہا ہے" },
  pm_harvest_ready_in: {
    en: "the harvest will be ready. Do you want to book machinery?",
    rm: "mein harvest tayyar hoga. Machinery book karni hai?",
    ur: "میں فصل تیار ہوگی۔ مشینری بک کرنی ہے؟",
  },
  pm_book_machinery: { en: "Book Machinery", rm: "Machinery book karein", ur: "مشینری بک کریں" },
  pm_watering_time: { en: "Time to Water", rm: "Pani dene ka waqt", ur: "پانی دینے کا وقت" },
  pm_see_my_crops: { en: "See My Crops", rm: "Meri fasalein dekhein", ur: "میری فصلیں دیکھیں" },
};
