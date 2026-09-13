/**
 * Bahar ke logon ke safhe -- kisan ki profile, dealer, expert, buyer,
 * naukri ka offer.
 *
 * YE SAFHE ANDAR WALE SE ZIYADA AHEM HAIN. Staff Roman parh leta hai --
 * wo roz us par kaam karta hai. Bahar ka banda nahi: kisan, dealer,
 * ya wo shakhs jise naukri ka offer mila hai. Un ka safha un ki apni
 * zaban mein na ho to wo padhta hi nahi, aur phir bharta ghalat hai.
 *
 * BANKON AUR WALLETON KE NAAM tarjuma nahi hue (JazzCash, Easypaisa,
 * SadaPay, NayaPay). Wo un ki app par usi tarah likhe hain, aur banda
 * unhen wahin dhoondta hai. Tarjuma kar dene se wo apni hi app mein
 * apna wallet na pehchane.
 */
export const outsideDict = {
  // ---- Kisan ki profile ----
  ou_profile: { en: "Profile", rm: "Profile", ur: "پروفائل" },
  ou_my_fields: { en: "My Fields", rm: "Mere khet", ur: "میرے کھیت" },
  ou_land_and_crop: { en: "Land and crops", rm: "Zameen aur fasal", ur: "زمین اور فصل" },
  ou_total_land: { en: "Total land (acres)", rm: "Kul zameen (acre)", ur: "کل زمین (ایکڑ)" },
  ou_crops: { en: "Crops", rm: "Faslein", ur: "فصلیں" },
  ou_eg_crops: { en: "Wheat, Rice", rm: "Gandum, Chawal", ur: "گندم، چاول" },
  ou_identity: { en: "Identity — father's name, CNIC", rm: "Pehchan — walid ka naam, CNIC", ur: "پہچان — والد کا نام، شناختی کارڈ" },
  ou_father_name: { en: "Father's name", rm: "Walid ka naam", ur: "والد کا نام" },
  ou_cnic_photos: { en: "Photos of both sides of the CNIC", rm: "CNIC ki dono taraf ki photo", ur: "شناختی کارڈ کی دونوں طرف کی تصویر" },
  ou_cnic_format: { en: "XXXXX-XXXXXXX-X", rm: "XXXXX-XXXXXXX-X", ur: "XXXXX-XXXXXXX-X" },
  ou_address_full: { en: "Address — village, tehsil, district, full address", rm: "Pata — gaon, tehsil, zila, poora pata", ur: "پتہ — گاؤں، تحصیل، ضلع، پورا پتہ" },
  ou_full_address: { en: "Full address", rm: "Poora pata", ur: "پورا پتہ" },
  ou_home_address: { en: "Address to reach your home", rm: "Ghar tak pahunchne ka pata", ur: "گھر تک پہنچنے کا پتہ" },
  ou_tehsil: { en: "Tehsil", rm: "Tehsil", ur: "تحصیل" },
  ou_mobile: { en: "Mobile", rm: "Mobile", ur: "موبائل" },
  ou_mobile_note: {
    en: "Your mobile is your identity. To change it, contact Al Rana Traders.",
    rm: "Mobile aap ki pehchan hai. Badalwana ho to Al Rana Traders se raabta karein.",
    ur: "موبائل آپ کی پہچان ہے۔ بدلوانا ہو تو الرانا ٹریڈرز سے رابطہ کریں۔",
  },
  ou_lang_q: { en: "Which language for messages?", rm: "Paighaam kis zaban mein?", ur: "پیغام کس زبان میں؟" },
  ou_english: { en: "English", rm: "English", ur: "انگریزی" },
  ou_roman: { en: "Roman Urdu", rm: "Roman Urdu", ur: "رومن اردو" },

  // ---- Paise ka khana ----
  ou_bank_or_wallet: { en: "Bank or mobile wallet", rm: "Bank ya mobile wallet", ur: "بینک یا موبائل والٹ" },
  ou_bank_or_wallet_note: {
    en: "Bank or mobile wallet — either one is enough.",
    rm: "Bank ya mobile wallet — koi ek kaafi hai.",
    ur: "بینک یا موبائل والٹ — کوئی ایک کافی ہے۔",
  },
  ou_bank_name: { en: "Bank name", rm: "Bank ka naam", ur: "بینک کا نام" },
  ou_account_title: { en: "Account is in whose name", rm: "Khata kis naam par", ur: "کھاتہ کس نام پر" },
  ou_account_number: { en: "Account number", rm: "Khata number", ur: "کھاتہ نمبر" },
  ou_wallet: { en: "Mobile wallet", rm: "Mobile wallet", ur: "موبائل والٹ" },
  ou_wallet_number: { en: "Wallet number", rm: "Wallet number", ur: "والٹ نمبر" },
  ou_other: { en: "Other", rm: "Deegar", ur: "دیگر" },

  // ---- Profile ki halat ----
  ou_profile_complete: { en: "Your profile is complete.", rm: "Profile mukammal hai.", ur: "پروفائل مکمل ہے۔" },
  ou_profile_confirmed: { en: "Your profile is confirmed.", rm: "Profile confirm ho chuki hai.", ur: "پروفائل کنفرم ہو چکی ہے۔" },
  ou_profile_verified: { en: "Your profile is verified.", rm: "Profile tasdeeq shuda hai.", ur: "پروفائل تصدیق شدہ ہے۔" },
  ou_verified_note: {
    en: "Al Rana Traders has checked your documents and verified them.",
    rm: "Al Rana Traders ne aap ke kaghazat dekh kar tasdeeq kar di hai.",
    ur: "الرانا ٹریڈرز نے آپ کے کاغذات دیکھ کر تصدیق کر دی ہے۔",
  },
  ou_missing_parts: { en: "These parts are still left to confirm:", rm: "Confirm karne ke liye ye hissay baqi hain:", ur: "کنفرم کرنے کے لیے یہ حصے باقی ہیں:" },

  // ---- Dealer ----
  ou_orders: { en: "Orders", rm: "Orders", ur: "آرڈرز" },
  ou_new_orders: { en: "New Orders", rm: "Naye orders", ur: "نئے آرڈرز" },
  ou_total_orders: { en: "Total Orders", rm: "Kul orders", ur: "کل آرڈرز" },
  ou_no_orders: { en: "There is no order right now.", rm: "Abhi koi order nahi hai.", ur: "ابھی کوئی آرڈر نہیں ہے۔" },
  ou_you_owe: { en: "You owe (Payable)", rm: "Aap ko dena hai (Payable)", ur: "آپ کو دینا ہے" },
  ou_accept: { en: "Accept", rm: "Qabool karein", ur: "قبول کریں" },
  ou_reject: { en: "Reject", rm: "Inkar karein", ur: "انکار کریں" },
  ou_dispatched: { en: "Dispatched", rm: "Bhej diya", ur: "بھیج دیا" },

  // ---- Expert ----
  ou_expert_portal: { en: "Expert Portal", rm: "Expert Portal", ur: "ایکسپرٹ پورٹل" },
  ou_no_escalation: { en: "There is no pending escalation right now.", rm: "Abhi koi pending escalation nahi hai.", ur: "ابھی کوئی زیرِ التوا کیس نہیں ہے۔" },
  ou_write_answer: { en: "Write your expert answer...", rm: "Apna expert jawab likhein...", ur: "اپنا ماہرانہ جواب لکھیں..." },
  ou_answered: { en: "Answered", rm: "Jawab diya gaya", ur: "جواب دیا گیا" },
  ou_answers_given: { en: "Answers given", rm: "Jawab diye gaye", ur: "جواب دیے گئے" },
  ou_answer_sent: {
    en: "Answer sent — it has reached the farmer on WhatsApp.",
    rm: "Jawab bhej diya gaya — kisan ko WhatsApp par pahunch gaya.",
    ur: "جواب بھیج دیا گیا — کسان کو واٹس ایپ پر پہنچ گیا۔",
  },

  // ---- Naukri ka offer ----
  ou_job_offer: { en: "Job Offer", rm: "Naukri ka offer", ur: "نوکری کا آفر" },
  ou_designation: { en: "Designation:", rm: "Ohda:", ur: "عہدہ:" },
  ou_proposed_salary: { en: "Proposed Salary:", rm: "Tajweez karda tankhwah:", ur: "تجویز کردہ تنخواہ:" },
  ou_shop_branch: { en: "Shop/Branch:", rm: "Dukan/Shakh:", ur: "دکان/شاخ:" },
  ou_offer_accepted: {
    en: "Congratulations! An email has been sent for your login — set your password from there.",
    rm: "Mubarak ho! Aap ko login ke liye email bheja gaya hai — wahan se password set karein.",
    ur: "مبارک ہو! آپ کو لاگ اِن کے لیے ای میل بھیجا گیا ہے — وہاں سے پاس ورڈ سیٹ کریں۔",
  },
  ou_offer_rejected: { en: "The offer has been rejected. Thank you.", rm: "Offer reject kar diya gaya hai. Shukriya.", ur: "آفر مسترد کر دیا گیا ہے۔ شکریہ۔" },

  // ---- Buyer marketplace ----
  ou_marketplace: { en: "Produce Marketplace", rm: "Fasal ki mandi", ur: "فصل کی منڈی" },
  ou_no_listings: { en: "No listings available right now.", rm: "Abhi koi cheez fehrist mein nahi.", ur: "ابھی کوئی چیز فہرست میں نہیں۔" },
  ou_place_order: { en: "Place Order", rm: "Order karein", ur: "آرڈر کریں" },
  ou_order_placed: { en: "Order placed! Waiting for the farmer's confirmation.", rm: "Order chala gaya! Kisan ki tasdeeq ka intezar hai.", ur: "آرڈر چلا گیا! کسان کی تصدیق کا انتظار ہے۔" },
  ou_no_buyer_profile: { en: "This account is not linked to a buyer profile.", rm: "Ye khata kisi buyer ki profile se juda hua nahi.", ur: "یہ کھاتہ کسی خریدار کی پروفائل سے جڑا ہوا نہیں۔" },

  // ---- Baqi ----
  ou_bad_link: { en: "This link is wrong or has expired.", rm: "Ye link ghalat hai ya khatam ho chuka hai.", ur: "یہ لنک غلط ہے یا ختم ہو چکا ہے۔" },
  ou_latitude: { en: "Latitude", rm: "Latitude", ur: "عرض بلد" },
  ou_longitude: { en: "Longitude", rm: "Longitude", ur: "طول بلد" },
} as const;
