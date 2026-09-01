/**
 * Vendor ka apna portal.
 *
 * Ye un chand safhon mein se hai jinhen DAFTAR SE BAHAR ka banda
 * chalata hai. Admin panel manager parhta hai; ye safha wo aadmi
 * parhta hai jo khet mein khara hai aur jis ki machine chal rahi hai.
 * Is liye yahan Urdu script ki zaroorat admin panel se ziyada hai, kam
 * nahi.
 *
 * TEEN BAATEIN JO YAHAN JAAN BOOJH KAR AISE HAIN:
 *
 * 1. "Al Rana Traders" aur "ART" tarjuma nahi hote. Ye kisi cheez ka
 *    naam nahi, ek karobar ka naam hai. Usay "الرانا ٹریڈرز" likhna ek
 *    nayi hijje ijaad karna hoga jo kisi kaghaz par nahi hai. Wohi
 *    usool jo POS, WhatsApp aur CNIC par lagta hai.
 *
 * 2. "Sabit Parali" aur "Kutra" chaare ki do qismein hain, do lafz
 *    nahi. Urdu mein wo "ثابت پرالی" aur "کترا" hain -- wohi jo mandi
 *    mein bola jata hai. In ka English tarjuma nahi kiya gaya kyunke
 *    English mein ye cheezein isi naam se bikti hain.
 *
 * 3. Tasdeeq wale jumle poore ke poore likhe gaye hain, kaat kar nahi.
 *    "Ye abhi sirf aap ki baat hai" jaisa jumla vendor ko wo farq batata
 *    hai jo us ke paise se juda hai: us ne kya kaha, aur kya sabit hua.
 *    Aisa jumla aadha kar dene se us ka poora matlab hi chala jata hai.
 *
 * Tareekh, Raqam, Baqi aur Jagah ke liye yahan naye lafz nahi banaye
 * gaye -- wo commonDict (c_date, c_amount, c_baqi, c_location) mein
 * pehle se hain. Ek cheez ka ek naam.
 */
export const vendorDict = {
  // ---- Portal ka sar ----
  v_portal: { en: "Machinery Vendor Portal", rm: "Machinery Vendor Portal", ur: "مشینری وینڈر پورٹل" },
  v_account_closed: { en: "Your account is currently closed.", rm: "Aap ka account filhaal band hai.", ur: "آپ کا اکاؤنٹ فی الحال بند ہے۔" },

  // ---- Gosharah aur season ----
  v_my_statement: { en: "My Statement", rm: "Mera Gosharah", ur: "میرا گوشوارہ" },
  v_statement: { en: "Statement", rm: "Gosharah", ur: "گوشوارہ" },
  v_my_season: { en: "My Season", rm: "Mera Season", ur: "میرا سیزن" },
  v_my_machines: { en: "My Machines", rm: "Meri machinein", ur: "میری مشینیں" },
  v_all_machines: { en: "All machines", rm: "Sab machinein", ur: "سب مشینیں" },
  v_no_machine: { en: "No machine recorded", rm: "Koi machine darj nahi", ur: "کوئی مشین درج نہیں" },

  // ---- Kamai aur commission ----
  v_verified_earning: { en: "Verified earning", rm: "Tasdeeq shuda kamai", ur: "تصدیق شدہ کمائی" },
  v_your_verified_earning: { en: "Your verified earning", rm: "Aap ki verified earning", ur: "آپ کی تصدیق شدہ کمائی" },
  v_earning_from_verified: { en: "Earning from verified work", rm: "Verified kaam se kamai", ur: "تصدیق شدہ کام سے کمائی" },
  v_total_verified_earning: { en: "Total Verified Earning", rm: "Kul tasdeeq shuda kamai", ur: "کل تصدیق شدہ کمائی" },
  v_art_commission: { en: "ART Commission", rm: "ART Commission", ur: "ART کمیشن" },
  v_net_vendor_earning: { en: "Net vendor earning", rm: "Vendor ki net kamai", ur: "وینڈر کی نیٹ کمائی" },
  v_commission_already_out: {
    en: "Commission has already been taken out of the verified earning — so it is not deducted again here.",
    rm: "Commission verified kamai mein se pehle hi nikal chuka hai — is liye yahan dobara nahi kata.",
    ur: "کمیشن تصدیق شدہ کمائی میں سے پہلے ہی نکل چکا ہے — اس لیے یہاں دوبارہ نہیں کٹا۔",
  },

  // ---- Paisa kahan hai ----
  v_money: { en: "Money", rm: "Paisa", ur: "پیسہ" },
  v_held_by_art_t: { en: "Held by ART", rm: "ART ke Paas Jama", ur: "ART کے پاس جمع" },
  v_held_by_art: { en: "Held by ART", rm: "ART ke paas jama", ur: "ART کے پاس جمع" },
  v_my_balance_at_art: { en: "My balance held by ART", rm: "ART ke paas mera jama", ur: "ART کے پاس میرا جمع" },
  v_with_farmer_now: { en: "Currently with the farmer", rm: "Abhi kisan ke paas", ur: "ابھی کسان کے پاس" },
  v_farmer_paid: { en: "Farmer Paid", rm: "Farmer Paid", ur: "کسان نے دیا" },
  v_pending_from_farmer_t: { en: "Pending from Farmer", rm: "Farmer se Pending", ur: "کسان سے باقی" },
  v_pending_from_farmer: { en: "Pending from Farmer", rm: "Farmer se pending", ur: "کسان سے باقی" },
  v_art_paid: { en: "ART Paid", rm: "ART ne diya", ur: "ART نے دیا" },
  v_vendor_paid: { en: "Vendor Paid", rm: "Vendor Paid", ur: "وینڈر کو دیا" },
  v_vendor_received_t: { en: "Received by Vendor", rm: "Vendor ko Mil Chuka", ur: "وینڈر کو مل چکا" },
  v_vendor_received: { en: "Vendor received", rm: "Vendor received", ur: "وینڈر کو ملا" },
  v_you_received: { en: "You received", rm: "Aap ko mila", ur: "آپ کو ملا" },
  v_received: { en: "Received", rm: "Mil chuka", ur: "مل چکا" },
  v_net_to_receive: { en: "Net still to receive", rm: "Net abhi milna hai", ur: "نیٹ ابھی ملنا ہے" },
  v_net_outstanding: { en: "Net outstanding", rm: "Net outstanding", ur: "نیٹ باقی" },
  v_after_art_diesel: {
    en: "From what is held by ART, after deducting ART's diesel.",
    rm: "Jo ART ke paas jama hai, us mein se ART ka diesel kaat kar.",
    ur: "جو ART کے پاس جمع ہے، اس میں سے ART کا ڈیزل کاٹ کر۔",
  },

  // ---- Diesel ----
  v_diesel_record: { en: "Record diesel", rm: "Diesel darj karein", ur: "ڈیزل درج کریں" },
  v_art_diesel_recoverable: { en: "ART Diesel Recoverable", rm: "ART ka diesel wapas lena hai", ur: "ART کا ڈیزل واپس لینا ہے" },
  v_art_diesel_will_cut: { en: "ART diesel will be deducted", rm: "ART diesel katega", ur: "ART کا ڈیزل کٹے گا" },
  v_art_diesel_on_payment: { en: "ART diesel (deducted on payment)", rm: "ART ka diesel (adaigi par katega)", ur: "ART کا ڈیزل (ادائیگی پر کٹے گا)" },
  v_art_diesel_cut: { en: "ART diesel (will be deducted)", rm: "ART ka diesel (katega)", ur: "ART کا ڈیزل (کٹے گا)" },
  v_who_put_diesel_q: { en: "Did the farmer put in diesel?", rm: "Kisan ne diesel dala?", ur: "کسان نے ڈیزل ڈالا؟" },
  v_who_put_it: { en: "Who put it in? *", rm: "Kis ne dala? *", ur: "کس نے ڈالا؟ *" },
  v_the_farmer: { en: "The farmer", rm: "Kisan ne", ur: "کسان نے" },
  v_i_did_vendor: { en: "I did (vendor)", rm: "Main ne (vendor)", ur: "میں نے (وینڈر)" },
  v_how_many_litres: { en: "How many litres", rm: "Kitne litre", ur: "کتنے لیٹر" },
  v_how_many_litres_req: { en: "How many litres *", rm: "Kitne litre *", ur: "کتنے لیٹر *" },
  v_rate_per_litre: { en: "Rate per litre", rm: "Rate per litre", ur: "فی لیٹر ریٹ" },
  v_that_day_rate: { en: "That day's rate per litre (Rs) *", rm: "Us din ka rate per litre (Rs) *", ur: "اس دن کا فی لیٹر ریٹ (Rs) *" },
  v_total_litres: { en: "Total Litres", rm: "Kul litre", ur: "کل لیٹر" },
  v_diesel_after_verify: {
    en: "This will count only after verification. Record diesel every time it is put in.",
    rm: "Tasdeeq ke baad hi ye hisaab mein aayega. Diesel jitni dafa dala jaye, utni dafa darj karein.",
    ur: "تصدیق کے بعد ہی یہ حساب میں آئے گا۔ ڈیزل جتنی دفعہ ڈالا جائے، اتنی دفعہ درج کریں۔",
  },

  // ---- Kaam ka silsila ----
  v_todays_work: { en: "Today's Work", rm: "Aaj ka Kaam", ur: "آج کا کام" },
  v_no_work_today: { en: "No work for today", rm: "Aaj ke liye koi kaam nahi", ur: "آج کے لیے کوئی کام نہیں" },
  v_no_work_left: { en: "No work remaining", rm: "Koi baqi kaam nahi", ur: "کوئی باقی کام نہیں" },
  v_reached_field: { en: "Reached the field", rm: "Khet pahunch gaya", ur: "کھیت پہنچ گیا" },
  v_work_started: { en: "Work started", rm: "Kaam shuru", ur: "کام شروع" },
  v_work_completed: { en: "Work completed", rm: "Kaam poora ho gaya", ur: "کام پورا ہو گیا" },
  v_work_date: { en: "Work date", rm: "Kaam ki tareekh", ur: "کام کی تاریخ" },
  v_field_map: { en: "Field map", rm: "Khet ka naqsha", ur: "کھیت کا نقشہ" },
  v_on_map: { en: "On the map", rm: "Naqshe par", ur: "نقشے پر" },
  v_last_location: { en: "Last location", rm: "Aakhri jagah", ur: "آخری جگہ" },
  v_meter_hours: { en: "Meter / hours", rm: "Meter / ghante", ur: "میٹر / گھنٹے" },
  v_location_wise: { en: "Location-wise Work", rm: "Location-wise Work", ur: "جگہ کے حساب سے کام" },

  // ---- Kattai ----
  v_harvest_details: { en: "Send harvest details", rm: "Kattai ki tafseel bhejein", ur: "کٹائی کی تفصیل بھیجیں" },
  v_harvest_done_two_q: { en: "Harvest complete — two questions left", rm: "Kattai mukammal — do sawal baqi", ur: "کٹائی مکمل — دو سوال باقی" },
  v_two_things_before: { en: "Two things before you go", rm: "Jane se pehle do baatein", ur: "جانے سے پہلے دو باتیں" },
  v_how_many_acres: { en: "How many acres", rm: "Kitne acre", ur: "کتنے ایکڑ" },
  v_sabit_parali_acres: { en: "Sabit Parali acres", rm: "Sabit Parali ke acre", ur: "ثابت پرالی کے ایکڑ" },
  v_kutra_acres: { en: "Kutra acres", rm: "Kutra ke acre", ur: "کترا کے ایکڑ" },
  v_both_kinds: {
    en: "This booking has both types — enter Sabit Parali and Kutra separately.",
    rm: "Is booking mein dono qism hain — Sabit Parali aur Kutra alag alag likhein.",
    ur: "اس بکنگ میں دونوں قسمیں ہیں — ثابت پرالی اور کترا الگ الگ لکھیں۔",
  },
  v_mark_last_day_only: {
    en: "Mark only the last day. If the work runs several days, send a separate entry for each day.",
    rm: "Sirf aakhri din nishaan lagayein. Kaam kai din chale to har din ka alag indraj bhejein.",
    ur: "صرف آخری دن نشان لگائیں۔ کام کئی دن چلے تو ہر دن کا الگ اندراج بھیجیں۔",
  },

  // ---- Kisan ki adaigi ----
  v_farmer_paid_q: { en: "Did the farmer pay?", rm: "Kisan ne paisa diya?", ur: "کسان نے پیسہ دیا؟" },
  v_farmer_paid_stmt: { en: "The farmer paid", rm: "Kisan ne paisa diya", ur: "کسان نے پیسہ دیا" },
  v_no_its_credit: { en: "No — it is on credit", rm: "Nahi — udhaar hai", ur: "نہیں — ادھار ہے" },
  v_how_much_paid: { en: "How much was paid (Rs) *", rm: "Kitna diya (Rs) *", ur: "کتنا دیا (Rs) *" },
  v_how_much: { en: "How much", rm: "Kitni raqam", ur: "کتنی رقم" },
  v_when_paid: { en: "When paid", rm: "Kab diya", ur: "کب دیا" },
  v_cash_received: { en: "Cash received", rm: "Cash mila", ur: "نقد ملا" },
  v_what_did_you_do: { en: "What did you do with that money? *", rm: "Us paise ka kya kiya? *", ur: "اس پیسے کا کیا کیا؟ *" },
  v_giving_to_art: { en: "I am handing it to Al Rana Traders", rm: "Al Rana Traders ko de raha hoon", ur: "Al Rana Traders کو دے رہا ہوں" },
  v_kept_my_share: { en: "Kept as my share", rm: "Apne hisse mein rakh liya", ur: "اپنے حصے میں رکھ لیا" },
  v_money_with_you: {
    en: "This money is with you for now. Handing it to AgriBridge is a separate step.",
    rm: "Ye paisa abhi aap ke paas hai. Jab AgriBridge ko dein to us ka apna qadam hai.",
    ur: "یہ پیسہ ابھی آپ کے پاس ہے۔ جب AgriBridge کو دیں تو اس کا اپنا قدم ہے۔",
  },
  v_only_your_word: {
    en: "This is only your word for now — the farmer's balance drops only after verification.",
    rm: "Ye abhi sirf aap ki baat hai — tasdeeq ke baad hi kisan ka baqi kam hoga.",
    ur: "یہ ابھی صرف آپ کی بات ہے — تصدیق کے بعد ہی کسان کا باقی کم ہوگا۔",
  },
  v_both_answers_go: {
    en: "Both answers go for verification — before verification they are not part of any account.",
    rm: "Dono jawab tasdeeq ke liye jate hain — tasdeeq se pehle kisi hisaab mein shamil nahi hote.",
    ur: "دونوں جواب تصدیق کے لیے جاتے ہیں — تصدیق سے پہلے کسی حساب میں شامل نہیں ہوتے۔",
  },

  // ---- Tasdeeq ----
  v_pending_verification_t: { en: "Pending Verification", rm: "Pending Verification", ur: "تصدیق باقی" },
  v_verification_pending: { en: "Verification Pending", rm: "Verification Pending", ur: "تصدیق باقی" },
  v_awaiting_verification: {
    en: "The work you submitted is awaiting AgriBridge verification. Only after verification does it become part of the bill.",
    rm: "Aap ka bheja hua kaam AgriBridge ki tasdeeq ke intezar mein hai. Tasdeeq ke baad hi wo bill ka hissa banega.",
    ur: "آپ کا بھیجا ہوا کام AgriBridge کی تصدیق کے انتظار میں ہے۔ تصدیق کے بعد ہی وہ بل کا حصہ بنے گا۔",
  },

  // ---- Booking aur acre ----
  v_booking: { en: "Booking", rm: "Booking", ur: "بکنگ" },
  v_no_booking: { en: "No bookings yet", rm: "Abhi koi booking nahi", ur: "ابھی کوئی بکنگ نہیں" },
  v_booked_acres: { en: "Booked acres", rm: "Booked acres", ur: "بک شدہ ایکڑ" },
  v_total_booked_acres: { en: "Total Booked Acres", rm: "Kul booked acre", ur: "کل بک شدہ ایکڑ" },
  v_completed_acres_t: { en: "Completed Acres", rm: "Completed Acres", ur: "مکمل ایکڑ" },
  v_completed_acres: { en: "Completed acres", rm: "Completed acres", ur: "مکمل ایکڑ" },
  v_in_progress_acres: { en: "In Progress Acres", rm: "Chal rahe acre", ur: "جاری ایکڑ" },
  v_pending_acres: { en: "Pending Acres", rm: "Baqi acre", ur: "باقی ایکڑ" },
  v_remaining_acres: { en: "Remaining acres", rm: "Baqi acre", ur: "باقی ایکڑ" },
  v_next7: { en: "Next 7 Days", rm: "Agle 7 din", ur: "اگلے 7 دن" },
  v_next7_acres: { en: "Next 7 Days Acres", rm: "Agle 7 din ke acre", ur: "اگلے 7 دن کے ایکڑ" },
  v_next7_free: { en: "The next 7 days are free", rm: "Agle 7 din khali hain", ur: "اگلے 7 دن خالی ہیں" },
  v_next7_no_work: { en: "No work in the next 7 days.", rm: "Agle 7 din mein koi kaam nahi.", ur: "اگلے 7 دن میں کوئی کام نہیں۔" },
  v_total_value: { en: "Total Value", rm: "Kul maliyat", ur: "کل مالیت" },
  v_kanal: { en: "Kanal", rm: "Kanal", ur: "کنال" },

  // ---- Adaigi ki fehrist ----
  v_recent_payments: { en: "Recent Payments", rm: "Haali adaigiyan", ur: "حالیہ ادائیگیاں" },
  v_no_payment_yet: { en: "No payment yet", rm: "Abhi koi adaigi nahi hui", ur: "ابھی کوئی ادائیگی نہیں ہوئی" },
  v_no_bill_yet: { en: "No bill has been made yet.", rm: "Abhi koi bill nahi bana.", ur: "ابھی کوئی بل نہیں بنا۔" },
  v_settlement: { en: "Settlement", rm: "Settlement", ur: "سیٹلمنٹ" },
  v_art_ne: { en: "Al Rana Traders", rm: "Al Rana Traders ne", ur: "Al Rana Traders نے" },

  // ---- Chhote lafz ----
  v_yes: { en: "Yes", rm: "Haan", ur: "ہاں" },
  v_no: { en: "No", rm: "Nahi", ur: "نہیں" },
  v_not_now: { en: "Not now", rm: "Abhi nahi", ur: "ابھی نہیں" },
  v_leave_it: { en: "Leave it", rm: "Rehne dein", ur: "رہنے دیں" },
  v_call: { en: "Call", rm: "Call", ur: "کال" },
  v_work: { en: "Work", rm: "Kaam", ur: "کام" },
  v_diesel: { en: "Diesel", rm: "Diesel", ur: "ڈیزل" },
  v_no_rows: { en: "No rows.", rm: "Koi qatar nahi.", ur: "کوئی قطار نہیں۔" },
  v_a_note: { en: "A note (optional)", rm: "Koi baat (marzi se)", ur: "کوئی بات (مرضی سے)" },
  v_a_reference: { en: "A reference (optional)", rm: "Koi nishani (marzi se)", ur: "کوئی نشانی (مرضی سے)" },
  v_anything_else: { en: "Anything else to add", rm: "Kuch aur batana ho", ur: "کچھ اور بتانا ہو" },
};
