/**
 * Naukri ki darkhwast -- interview, number, aur hire karna.
 *
 * PANCH KHANON KE NUMBER JAAN BOOJH KAR ALAG HAIN: rawaiya, tewar,
 * baat cheet, safai. Sab ka ek hi "score" rakhna aasan tha, magar phir
 * do saal baad ye pata na chalta ke bande ko kis cheez par kam number
 * mile the -- aur wohi baat manager ko chahiye hoti hai jab tarraqi ka
 * faisla hota hai.
 *
 * "Official Email (pehle cPanel mein banayein)" wali baat qasdan yahan
 * likhi hai. Login banane se pehle email ka waqai maujood hona zaroori
 * hai; nizam wo khud nahi bana sakta, aur ye jumla na ho to banda login
 * bana kar bhool jata hai ke email hai hi nahi.
 */
export const hrJobsDict = {
  hj_suspend_reason: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  hj_ok: { en: "OK", rm: "Theek", ur: "ٹھیک" },
  hj_email_label: { en: "Email:", rm: "Email:", ur: "ای میل:" },
  hj_phone_label: { en: "Phone:", rm: "Phone:", ur: "فون:" },
  hj_cnic_label: { en: "CNIC:", rm: "CNIC:", ur: "CNIC:" },
  hj_address_label: { en: "Address:", rm: "Pata:", ur: "پتہ:" },
  hj_expected_salary: { en: "Expected Salary:", rm: "Tawaqqo tankhwah:", ur: "توقع تنخواہ:" },
  hj_qualification: { en: "Qualification:", rm: "Taleem:", ur: "تعلیم:" },
  hj_experience: { en: "Experience:", rm: "Tajurba:", ur: "تجربہ:" },
  hj_message: { en: "Message:", rm: "Paighaam:", ur: "پیغام:" },
  hj_eligibility: { en: "Eligibility Decision", rm: "Ahliyat ka faisla", ur: "اہلیت کا فیصلہ" },
  hj_schedule_interview: { en: "Schedule Interview Call", rm: "Interview ka waqt rakhein", ur: "انٹرویو کا وقت رکھیں" },
  hj_online: { en: "Online", rm: "Online", ur: "آن لائن" },
  hj_face_to_face: { en: "Face to Face", rm: "Aamne saamne", ur: "آمنے سامنے" },
  hj_call: { en: "Call", rm: "Call", ur: "کال" },
  hj_schedule: { en: "Schedule", rm: "Waqt rakhein", ur: "وقت رکھیں" },
  hj_score_saved: { en: "Score saved.", rm: "Number mehfooz ho gaye.", ur: "نمبر محفوظ ہو گئے۔" },
  hj_behavior: { en: "Behavior", rm: "Rawaiya", ur: "رویہ" },
  hj_attitude: { en: "Attitude", rm: "Tewar", ur: "تیور" },
  hj_communication: { en: "Communication", rm: "Baat cheet", ur: "بات چیت" },
  hj_cleanliness: { en: "Cleanliness", rm: "Safai", ur: "صفائی" },
  hj_hire: { en: "Hire", rm: "Rakh lein", ur: "رکھ لیں" },
  hj_save_score: { en: "Save Score", rm: "Number mehfooz karein", ur: "نمبر محفوظ کریں" },
  hj_doc_qualification: { en: "Qualification Certificate", rm: "Taleem ki sanad", ur: "تعلیم کی سند" },
  hj_doc_experience: { en: "Experience Certificate", rm: "Tajurbe ki sanad", ur: "تجربے کی سند" },
  hj_doc_cv: { en: "CV / Resume", rm: "CV", ur: "CV" },
  hj_login_created: { en: "Login created.", rm: "Login ban gaya.", ur: "لاگ ان بن گیا۔" },
  hj_official_email: {
    en: "Official Email (create it in cPanel first)",
    rm: "Daftari email (pehle cPanel mein banayein)",
    ur: "دفتری ای میل (پہلے cPanel میں بنائیں)",
  },
  hj_password_min: { en: "Password (at least 6 characters)", rm: "Password (kam az kam 6 harf)", ur: "پاس ورڈ (کم از کم 6 حرف)" },
} as const;

/**
 * Kisan ka apna khata -- admin ki taraf se.
 *
 * MAWESHI KI GINTI PANCH ALAG KHANON MEIN HAI: gaayein, bhainsein,
 * bachhre, doodh dene wale, aur gosht ke. Ek hi "kitne jaanwar" wala
 * khana rakhna aasan tha, magar doodh ka andaza sirf DOODH DENE WALON
 * se lagta hai -- baqi jaanwar us hisaab mein aa jayein to har kisan ka
 * mutawaqqa doodh ghalat nikalta.
 */
export const adminFarmerDict = {
  af_basic_info: { en: "Basic Information", rm: "Buniyadi maloomat", ur: "بنیادی معلومات" },
  af_full_name: { en: "Full Name", rm: "Poora naam", ur: "پورا نام" },
  af_farming_details: { en: "Farming Details", rm: "Kheti ki tafseel", ur: "کھیتی کی تفصیل" },
  af_total_land: { en: "Total Land (acres)", rm: "Kul zameen (acre)", ur: "کل زمین (ایکڑ)" },
  af_total_farms: { en: "Total Number of Farms", rm: "Kitne khet", ur: "کتنے کھیت" },
  af_crop_types: { en: "Type of Crops", rm: "Kaunsi fasalein", ur: "کون سی فصلیں" },
  af_crop_example: { en: "Wheat, Rice", rm: "Gandum, chawal", ur: "گندم، چاول" },
  af_has_livestock: { en: "Has Livestock?", rm: "Maweshi hain?", ur: "مویشی ہیں؟" },
  af_yes: { en: "Yes", rm: "Haan", ur: "ہاں" },
  af_no: { en: "No", rm: "Nahi", ur: "نہیں" },
  af_cows: { en: "Cows", rm: "Gaayein", ur: "گائیں" },
  af_buffaloes: { en: "Buffaloes", rm: "Bhainsein", ur: "بھینسیں" },
  af_calves: { en: "Calves", rm: "Bachhre", ur: "بچھڑے" },
  af_milking_animals: { en: "Milking Animals", rm: "Doodh dene wale", ur: "دودھ دینے والے" },
  af_meat_animals: { en: "Meat Animals", rm: "Gosht wale", ur: "گوشت والے" },
  af_milk_per_day: { en: "Milk (litres/day)", rm: "Doodh (litre roz)", ur: "دودھ (لیٹر روز)" },
  af_milk_rate: { en: "Milk Rate (Rs./litre)", rm: "Doodh ka rate (Rs. fi litre)", ur: "دودھ کا ریٹ (روپے فی لیٹر)" },
  af_milk_buyer: { en: "Milk Buyer", rm: "Doodh kaun leta hai", ur: "دودھ کون لیتا ہے" },
  af_milk_advance: { en: "Milk Advance / Loan (Rs.)", rm: "Doodh par advance / qarza (Rs.)", ur: "دودھ پر ایڈوانس / قرضہ (روپے)" },
  af_cnic_front: { en: "CNIC Front", rm: "CNIC ka aage wala rukh", ur: "CNIC کا آگے والا رخ" },
  af_cnic_back: { en: "CNIC Back", rm: "CNIC ka peeche wala rukh", ur: "CNIC کا پیچھے والا رخ" },
  af_not_uploaded: { en: "Not uploaded", rm: "Laga hua nahi", ur: "لگا ہوا نہیں" },
} as const;

/**
 * Subscription -- kisan ka mahana/salana khata.
 *
 * "Announcement" ki teen qismein alag hain (sirf ittila, raaye, aur
 * link) kyunke teenon ka anjaam alag hai: pehli sirf parhi jati hai,
 * doosri par jawab aata hai, teesri par banda kahin aur chala jata hai.
 * Ek hi qism rakhne par ye teenon ek jaisi dikhtin aur kisi ko pata na
 * chalta ke us se kya chaha ja raha hai.
 */
export const subscriptionDict = {
  sb_total_revenue: { en: "Total Revenue (to date)", rm: "Ab tak ki kul aamdani", ur: "اب تک کی کل آمدنی" },
  sb_month_revenue: { en: "This Month's Revenue", rm: "Is mahine ki aamdani", ur: "اس مہینے کی آمدنی" },
  sb_active_subscribers: { en: "Active Subscribers", rm: "Chalte hue member", ur: "چلتے ہوئے ممبر" },
  sb_min_amount: { en: "Minimum Amount (Rs)", rm: "Kam az kam raqam (Rs)", ur: "کم از کم رقم (روپے)" },
  sb_announcement_sent: { en: "Announcement sent.", rm: "Ittila bhej di gayi.", ur: "اطلاع بھیج دی گئی۔" },
  sb_msg: { en: "Message", rm: "Paighaam", ur: "پیغام" },
  sb_type_notice: { en: "Notice only (closes with X)", rm: "Sirf ittila (X se band ho)", ur: "صرف اطلاع (X سے بند ہو)" },
  sb_type_vote: { en: "Vote (ask yes / no)", rm: "Raaye (haan ya nahi poochhni hai)", ur: "رائے (ہاں یا نہیں پوچھنی ہے)" },
  sb_type_link: { en: "Link / Button", rm: "Link ya button dena hai", ur: "لنک یا بٹن دینا ہے" },
  sb_button_text: { en: "Button Text (if type is Link)", rm: "Button par kya likha ho (agar link wali qism hai)", ur: "بٹن پر کیا لکھا ہو (اگر لنک والی قسم ہے)" },
  sb_link_url: { en: "Link URL (if type is Link)", rm: "Link ka pata (agar link wali qism hai)", ur: "لنک کا پتہ (اگر لنک والی قسم ہے)" },
  sb_activated: { en: "Subscription activated.", rm: "Subscription chalu ho gayi.", ur: "سبسکرپشن چالو ہو گئی۔" },
  sb_lifetime: { en: "Lifetime", rm: "Hamesha ke liye", ur: "ہمیشہ کے لیے" },
  sb_card: { en: "Credit / Debit Card", rm: "Credit / Debit card", ur: "کریڈٹ / ڈیبٹ کارڈ" },
  sb_payment_proof: { en: "Payment Proof / Receipt (photo)", rm: "Adaigi ka saboot / raseed (tasveer)", ur: "ادائیگی کا ثبوت / رسید (تصویر)" },
  sb_payment_history: { en: "Payment History", rm: "Adaigi ki tafseel", ur: "ادائیگی کی تفصیل" },
  sub_none_yet: { en: "No subscription yet.", rm: "Abhi koi subscription nahi.", ur: "ابھی کوئی سبسکرپشن نہیں۔" },
  sb_when_paid: { en: "When Paid", rm: "Kab aaya", ur: "کب آیا" },
  sb_valid_till: { en: "Valid Till", rm: "Kab tak", ur: "کب تک" },
  sb_proof: { en: "Proof", rm: "Saboot", ur: "ثبوت" },
} as const;
