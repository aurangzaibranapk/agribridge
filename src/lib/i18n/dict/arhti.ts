/**
 * Fasal uthane wale (arhti) -- fehrist, booking par qadam 8, khata aur board.
 *
 * DO LAFZ JAAN BOOJH KAR AISE HI RAKHE GAYE:
 *
 *   "Arhti" -- Urdu mein آڑھتی, aur English mein bhi "Arhti". Us ka koi
 *   angrezi lafz hai hi nahi jo yehi cheez kehta ho; "commission agent"
 *   likhne se wo banda apne hi naam se pehchana na jata. Gaon mein use
 *   arhti hi kehte hain, chahe baat kisi zaban mein ho.
 *
 *   "Kattai" -- wohi wajah. English mein "harvesting" us amal ka naam
 *   hai, magar yahan wo ek karobari khana hai (kattai ka bill), aur us
 *   ka naam nizam bhar mein ek hi rehna chahiye.
 */
export const arhtiDict = {
  // ---- Fehrist ka safha ----
  cl_title: { en: "Crop Lifters", rm: "Fasal Uthane Wale", ur: "فصل اٹھانے والے" },
  ar_subtitle: {
    en: "Arhtis and traders who lift the farmer's crop. The harvesting balance and the farmer's older dues move onto them.",
    rm: "Arhti aur beopari — jo kisan ki fasal uthate hain. Kattai ka baqi aur kisan ka purana udhaar in ke zimme jata hai.",
    ur: "آڑھتی اور بیوپاری — جو کسان کی فصل اٹھاتے ہیں۔ کٹائی کا باقی اور کسان کا پرانا ادھار اِن کے ذمے جاتا ہے۔",
  },
  ar_board_link: {
    en: "Crop Lifter Board — where our money is standing →",
    rm: "Arhti Board — hamara paisa kis ke paas khara hai →",
    ur: "آڑھتی بورڈ — ہمارا پیسہ کس کے پاس کھڑا ہے ←",
  },
  ar_active: { en: "Active", rm: "Chalu", ur: "چالو" },
  ar_to_collect: { en: "To collect from them", rm: "In se lena", ur: "اِن سے لینا" },
  ar_lifted_bookings: { en: "Bookings lifted", rm: "Uthai hui bookings", ur: "اٹھائی ہوئی بکنگز" },
  cl_none_yet: { en: "No crop lifter recorded yet.", rm: "Abhi koi uthane wala darj nahi.", ur: "ابھی کوئی اٹھانے والا درج نہیں۔" },
  ar_new: { en: "New crop lifter", rm: "Naya uthane wala", ur: "نیا اٹھانے والا" },
  ar_closed: { en: "Closed", rm: "Band", ur: "بند" },
  ar_edit: { en: "Edit", rm: "Theek karein", ur: "ٹھیک کریں" },
  ar_close: { en: "Close", rm: "Band karein", ur: "بند کریں" },
  ar_reopen: { en: "Reopen", rm: "Chalu karein", ur: "چالو کریں" },
  ar_ok: { en: "Done", rm: "Theek hai", ur: "ٹھیک ہے" },
  ar_save: { en: "Save", rm: "Mehfooz karein", ur: "محفوظ کریں" },
  ar_saving: { en: "Saving...", rm: "Mehfooz ho raha hai...", ur: "محفوظ ہو رہا ہے..." },

  // ---- Bande ki tafseel ----
  ar_name: { en: "Name", rm: "Naam", ur: "نام" },
  ar_name_req: { en: "Name *", rm: "Naam *", ur: "نام *" },
  ar_phone: { en: "Phone", rm: "Phone", ur: "فون" },
  ar_phone_req: { en: "Phone *", rm: "Phone *", ur: "فون *" },
  ar_phone_note: {
    en: "This is how he is identified — one person per phone.",
    rm: "Isi se ye banda pehchana jata hai — ek phone par ek hi.",
    ur: "اسی سے یہ بندہ پہچانا جاتا ہے — ایک فون پر ایک ہی۔",
  },
  ar_contact: { en: "Contact person", rm: "Raabte ka banda", ur: "رابطے کا بندہ" },
  ar_cnic: { en: "CNIC", rm: "CNIC", ur: "شناختی کارڈ" },
  ar_village: { en: "Village", rm: "Gaon", ur: "گاؤں" },
  ar_address: { en: "Address", rm: "Pata", ur: "پتہ" },
  cl_note: { en: "Note", rm: "Note", ur: "نوٹ" },
  ar_eg_name: { en: "e.g. Haji Ashraf Arhti", rm: "Misal: Haji Ashraf Arhti", ur: "مثال: حاجی اشرف آڑھتی" },
  ar_rate_req: { en: "Our commission (%) *", rm: "Hamara commission (%) *", ur: "ہمارا کمیشن (%) *" },
  ar_rate_note: {
    en: "A share of the crop's value — not of the harvesting bill. Change the rate and older deals stay on their own old rate.",
    rm: "Fasal ki qeemat ka fisad — kattai ke bill ka nahi. Rate badla to purane saude apne purane rate par khare rahenge.",
    ur: "فصل کی قیمت کا فیصد — کٹائی کے بل کا نہیں۔ ریٹ بدلا تو پرانے سودے اپنے پرانے ریٹ پر کھڑے رہیں گے۔",
  },

  // ---- Teen sabab ----
  ar_kattai_zimma: { en: "Harvesting charge held", rm: "Kattai ka zimma", ur: "کٹائی کا ذمہ" },
  ar_purana_baqi: { en: "Farmer's older dues", rm: "Purana baqi", ur: "پرانا باقی" },
  ar_commission_made: { en: "Commission earned", rm: "Commission bana", ur: "کمیشن بنا" },
  ar_commission: { en: "Commission", rm: "Commission", ur: "کمیشن" },
  ar_our_commission: { en: "Our commission", rm: "Hamara commission", ur: "ہمارا کمیشن" },
  ar_paid: { en: "Paid", rm: "Diya", ur: "دیا" },
  ar_balance: { en: "Balance", rm: "Baqi", ur: "باقی" },

  // ---- Khata ----
  ar_lifted_crops: { en: "Crops lifted", rm: "Uthai hui fasal", ur: "اٹھائی ہوئی فصل" },
  ar_no_bookings: { en: "No booking under his name yet.", rm: "Abhi is ke naam par koi booking nahi.", ur: "ابھی اِس کے نام پر کوئی بکنگ نہیں۔" },
  ar_payments: { en: "Payments", rm: "Adaigi", ur: "ادائیگی" },
  ar_no_payments: { en: "No payment recorded yet.", rm: "Abhi koi adaigi darj nahi.", ur: "ابھی کوئی ادائیگی درج نہیں۔" },
  ar_record_payment: { en: "Record a payment", rm: "Adaigi darj karein", ur: "ادائیگی درج کریں" },
  ar_record_more: { en: "Record another payment", rm: "Aur adaigi darj karein", ur: "اور ادائیگی درج کریں" },
  ar_lifted: { en: "Lifted", rm: "Utha chuki", ur: "اٹھ چکی" },
  ar_to_lift: { en: "Still to lift", rm: "Abhi uthani hai", ur: "ابھی اٹھانی ہے" },
  ar_settled: { en: "Settled", rm: "Hisaab saaf", ur: "حساب صاف" },
  ar_all_lifters: { en: "All crop lifters", rm: "Sab uthane wale", ur: "سب اٹھانے والے" },
  ar_lifters_list: { en: "Crop lifters list", rm: "Uthane walon ki fehrist", ur: "اٹھانے والوں کی فہرست" },

  // ---- Bill ki lakeerein ----
  ar_crop_value: { en: "Crop value", rm: "Fasal ki qeemat", ur: "فصل کی قیمت" },
  ar_kattai_bill: { en: "Harvesting bill", rm: "Kattai ka bill", ur: "کٹائی کا بل" },
  ar_farmer_old_due: { en: "Farmer's older dues", rm: "Kisan ka purana baqi", ur: "کسان کا پرانا باقی" },
  ar_farmer_was_paid: { en: "Was to be paid to the farmer", rm: "Kisan ko diya jana tha", ur: "کسان کو دیا جانا تھا" },
  ar_farmer_payable: { en: "To be paid to the farmer", rm: "Kisan ko dena", ur: "کسان کو دینا" },
  ar_owes_us: { en: "Owes us", rm: "Hamein dena", ur: "ہمیں دینا" },
  ar_unreliable_bill: {
    en: "This bill was made when some amounts had not reached the ledger — the older dues may be incomplete.",
    rm: "Ye bill us waqt bana jab kuch raqam ledger tak nahi pahunchi thi — purana baqi adhoora ho sakta hai.",
    ur: "یہ بل اُس وقت بنا جب کچھ رقم لیجر تک نہیں پہنچی تھی — پرانا باقی ادھورا ہو سکتا ہے۔",
  },
  ar_unreliable_short: {
    en: "older dues may be incomplete",
    rm: "purana baqi adhoora ho sakta hai",
    ur: "پرانا باقی ادھورا ہو سکتا ہے",
  },

  // ---- Adaigi ka khana ----
  ar_method: { en: "Method", rm: "Tareeqa", ur: "طریقہ" },
  ar_cash: { en: "Cash", rm: "Cash", ur: "نقد" },
  ar_bank: { en: "Bank", rm: "Bank", ur: "بینک" },
  ar_wallet: { en: "Wallet", rm: "Wallet", ur: "والٹ" },
  ar_other: { en: "Other", rm: "Doosra", ur: "دوسرا" },
  ar_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  ar_account: { en: "Account", rm: "Khata", ur: "کھاتہ" },
  ar_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  ar_reference: { en: "Reference", rm: "Reference", ur: "حوالہ" },
  ar_eg_reference: { en: "Cheque / transaction number", rm: "Cheque / transaction number", ur: "چیک / ٹرانزیکشن نمبر" },
  ar_cash_note: {
    en: "Cash stays with the person who took it — no account is asked for.",
    rm: "Cash lene wale ke haath mein rehta hai — us ka khata nahi poochha jata.",
    ur: "نقد لینے والے کے ہاتھ میں رہتا ہے — اُس کا کھاتہ نہیں پوچھا جاتا۔",
  },
  ar_recording: { en: "Recording...", rm: "Darj ho rahi hai...", ur: "درج ہو رہی ہے..." },

  // ---- Booking par qadam 8 ----
  ar_step_title: { en: "Crop lifter", rm: "Fasal uthane wala", ur: "فصل اٹھانے والا" },
  ar_who_lifts: {
    en: "This farmer said he would sell the crop to us. Who will lift it?",
    rm: "Is kisan ne kaha tha ke fasal hamein bechega. Kaun uthayega?",
    ur: "اِس کسان نے کہا تھا کہ فصل ہمیں بیچے گا۔ کون اٹھائے گا؟",
  },
  ar_lifter: { en: "Crop lifter", rm: "Uthane wala", ur: "اٹھانے والا" },
  ar_eg_note: { en: "Anything worth remembering", rm: "Koi baat jo yaad rakhni ho", ur: "کوئی بات جو یاد رکھنی ہو" },
  ar_attach: { en: "Attach", rm: "Lagayein", ur: "لگائیں" },
  ar_attaching: { en: "Attaching...", rm: "Lag raha hai...", ur: "لگ رہا ہے..." },
  ar_add_first: { en: "Add one to the list first", rm: "Pehle fehrist mein daalein", ur: "پہلے فہرست میں ڈالیں" },
  ar_none_listed: { en: "No crop lifter recorded yet.", rm: "Abhi koi uthane wala darj nahi.", ur: "ابھی کوئی اٹھانے والا درج نہیں۔" },
  ar_rate_from_person: {
    en: "Our commission {rate}% — on the crop's value. The rate comes from that person's own details.",
    rm: "Hamara commission {rate}% — fasal ki qeemat par. Rate is bande ki apni tafseel se aata hai.",
    ur: "ہمارا کمیشن {rate}% — فصل کی قیمت پر۔ ریٹ اِس بندے کی اپنی تفصیل سے آتا ہے۔",
  },
  ar_rate_on_value: {
    en: "Our commission {rate}% — on the crop's value",
    rm: "Hamara commission {rate}% — fasal ki qeemat par",
    ur: "ہمارا کمیشن {rate}% — فصل کی قیمت پر",
  },
  ar_farmer_due_now: { en: "This farmer's dues right now", rm: "Is kisan ka baqi is waqt", ur: "اِس کسان کا باقی اِس وقت" },
  ar_purana_with_eg: { en: "Older dues (inputs / credit)", rm: "Purana baqi (khaad/udhaar)", ur: "پرانا باقی (کھاد/ادھار)" },
  ar_lifted_make_bill: { en: "Crop lifted — make the bill", rm: "Fasal utha li — bill banayein", ur: "فصل اٹھا لی — بل بنائیں" },
  ar_crop_value_q: { en: "What did the crop go for?", rm: "Fasal kitne ki gayi?", ur: "فصل کتنے کی گئی؟" },
  ar_make_bill: { en: "Make the bill", rm: "Bill banayein", ur: "بل بنائیں" },
  ar_making_bill: { en: "Making...", rm: "Ban raha hai...", ur: "بن رہا ہے..." },
  ar_not_now: { en: "Not now", rm: "Abhi nahi", ur: "ابھی نہیں" },
  ar_remove_lifter: { en: "Remove the crop lifter", rm: "Uthane wala hata dein", ur: "اٹھانے والا ہٹا دیں" },
  ar_his_khata: { en: "His account", rm: "Us ka khata", ur: "اُس کا کھاتہ" },
  ar_commission_not_from_farmer: {
    en: "The commission is not taken out of the crop's value — it comes from {name}'s own pocket.",
    rm: "Commission fasal ki qeemat mein se nahi katta — wo {name} ki apni jeb se hai.",
    ur: "کمیشن فصل کی قیمت میں سے نہیں کٹتا — وہ {name} کی اپنی جیب سے ہے۔",
  },
  ar_due_unreadable: {
    en: "The farmer's dues could not be read. The bill cannot be made — get this fixed first.",
    rm: "Kisan ka baqi parha nahi ja saka. Bill nahi banaya ja sakta — pehle ye theek karwayein.",
    ur: "کسان کا باقی پڑھا نہیں جا سکا۔ بل نہیں بنایا جا سکتا — پہلے یہ ٹھیک کروائیں۔",
  },
  ar_due_more_than_value: {
    en: "The farmer's dues are more than the crop's value — this bill cannot be made like this.",
    rm: "Kisan ka baqi fasal ki qeemat se zyada hai — ye bill aise nahi ban sakta.",
    ur: "کسان کا باقی فصل کی قیمت سے زیادہ ہے — یہ بل ایسے نہیں بن سکتا۔",
  },
  ar_x_owes_us: { en: "{name} owes us", rm: "{name} ne hamein dena", ur: "{name} نے ہمیں دینا" },
  ar_unposted_warn: {
    en: "{n} entries in the Money Trail have not reached the ledger — the older dues may be incomplete. Clear those first, then make the bill.",
    rm: "Money Trail mein {n} qatarein aisi hain jo ledger tak nahi pahunchin — purana baqi adhoora ho sakta hai. Pehle wo saaf karein, phir bill banayein.",
    ur: "منی ٹریل میں {n} قطاریں ایسی ہیں جو لیجر تک نہیں پہنچیں — پرانا باقی ادھورا ہو سکتا ہے۔ پہلے وہ صاف کریں، پھر بل بنائیں۔",
  },
  ar_moved_note: {
    en: "The farmer's harvesting balance now sits with {name} — it is cleared on this page.",
    rm: "Kisan ka kattai wala baqi ab {name} ke zimme hai — is safhe par wo saaf ho chuka hai.",
    ur: "کسان کا کٹائی والا باقی اب {name} کے ذمے ہے — اِس صفحے پر وہ صاف ہو چکا ہے۔",
  },

  // ---- Board ----
  ar_board_title: { en: "Crop Lifter Board", rm: "Arhti Board", ur: "آڑھتی بورڈ" },
  ar_board_subtitle: {
    en: "Where our money is standing right now — and which farmer it was owed by.",
    rm: "Hamara paisa is waqt kis ke paas khara hai — aur wo asal mein kis kisan se lena tha.",
    ur: "ہمارا پیسہ اِس وقت کس کے پاس کھڑا ہے — اور وہ اصل میں کس کسان سے لینا تھا۔",
  },
  ar_money_with_them: { en: "Our money with crop lifters", rm: "Arhtiyon ke paas hamara paisa", ur: "آڑھتیوں کے پاس ہمارا پیسہ" },
  ar_held_by_n: { en: "held by {n} crop lifters", rm: "{n} arhti ke zimme", ur: "{n} آڑھتی کے ذمے" },
  ar_farmers_old_dues: { en: "Farmers' older dues", rm: "Kisanon ka purana baqi", ur: "کسانوں کا پرانا باقی" },
  ar_oldest_line: {
    en: "The oldest amount has been standing for {n} days.",
    rm: "Sab se purani raqam {n} din se khari hai.",
    ur: "سب سے پرانی رقم {n} دن سے کھڑی ہے۔",
  },
  ar_who_holds: { en: "Which crop lifter holds how much", rm: "Kis arhti ke paas kitna", ur: "کس آڑھتی کے پاس کتنا" },
  ar_arhti: { en: "Arhti", rm: "Arhti", ur: "آڑھتی" },
  ar_kattai: { en: "Harvesting", rm: "Kattai", ur: "کٹائی" },
  ar_older: { en: "Older", rm: "Purana", ur: "پرانا" },
  ar_standing: { en: "Standing", rm: "Khara hai", ur: "کھڑا ہے" },
  ar_since: { en: "Since", rm: "Kab se", ur: "کب سے" },
  ar_days: { en: "days", rm: "din", ur: "دن" },
  ar_total: { en: "Total", rm: "Kul", ur: "کل" },
  ar_nothing_held: { en: "Nothing is held by any crop lifter yet.", rm: "Abhi kisi arhti ke zimme kuch nahi.", ur: "ابھی کسی آڑھتی کے ذمے کچھ نہیں۔" },
  ar_trace_title: { en: "Which farmer's money went to whom", rm: "Kis kisan ka paisa kis ke paas gaya", ur: "کس کسان کا پیسہ کس کے پاس گیا" },
  ar_trace_note: {
    en: "These farmers' accounts are cleared — the amount now sits with the crop lifter.",
    rm: "In kisanon ke khate saaf ho chuke hain — ye raqam ab arhti ke zimme hai.",
    ur: "اِن کسانوں کے کھاتے صاف ہو چکے ہیں — یہ رقم اب آڑھتی کے ذمے ہے۔",
  },
  ar_trace_empty: {
    en: "No farmer's money has gone to a crop lifter yet.",
    rm: "Abhi kisi kisan ka paisa kisi arhti ke paas nahi gaya.",
    ur: "ابھی کسی کسان کا پیسہ کسی آڑھتی کے پاس نہیں گیا۔",
  },
  ar_farmer: { en: "Farmer", rm: "Kisan", ur: "کسان" },
  ar_booking: { en: "Booking", rm: "Booking", ur: "بکنگ" },
  ar_now_with: { en: "Now with", rm: "Ab kis ke paas", ur: "اب کس کے پاس" },
  ar_recent_recovery: { en: "Recent recovery", rm: "Haal ki wasooli", ur: "حالیہ وصولی" },
  ar_recovery_note: {
    en: "Payments settle the whole account, not one booking — so no booking name is shown here.",
    rm: "Adaigi poore khate par hoti hai, kisi ek booking par nahi — is liye yahan booking ka naam nahi.",
    ur: "ادائیگی پورے کھاتے پر ہوتی ہے، کسی ایک بکنگ پر نہیں — اس لیے یہاں بکنگ کا نام نہیں۔",
  },
} as const;
