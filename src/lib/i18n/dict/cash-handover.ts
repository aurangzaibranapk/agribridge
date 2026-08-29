/**
 * Cash haath badalne ke alfaz.
 *
 * Istilahat glossary.ts se: naqad, shakh, raqam, farq, wajah, ginti.
 *
 * Ek lafz yahan khaas hai: "raaste mein" (in transit). Iska matlab ye
 * NAHI ke sab theek hai -- matlab ye hai ke us raqam ka abhi ek zimmedar
 * hai. English mein "in transit" wohi keh deta hai; Urdu mein "راستے
 * میں" hi sab se qareeb hai, "safar mein" nahi -- safar ka lafz safar
 * karne wale bande ke liye bola jata hai, raqam ke liye nahi.
 *
 * "KAM"/"ZYADA" cash-close.ts se hi aate hain -- cash ka farq do jagah
 * hota hai (ginti aur handover) magar lafz ek hi rehna chahiye.
 */
export const cashHandoverDict = {
  ch_title: { en: "Cash Changing Hands", rm: "Cash Haath Badalna", ur: "کیش ہاتھ بدلنا" },
  ch_subtitle: {
    en: "The sender and the receiver each write it down separately. Until the two accounts agree, the money stays “in transit”.",
    rm: "Dene wala aur lene wala — dono alag alag likhte hain. Jab tak dono ki baat ek na ho, raqam “raaste mein” rehti hai.",
    ur: "دینے والا اور لینے والا — دونوں الگ الگ لکھتے ہیں۔ جب تک دونوں کی بات ایک نہ ہو، رقم “راستے میں” رہتی ہے۔",
  },
  ch_none_in_transit: { en: "Nothing is in transit", rm: "Koi raqam raaste mein nahi", ur: "کوئی رقم راستے میں نہیں" },
  ch_in_transit_now: { en: "is in transit right now —", rm: "abhi raaste mein hai —", ur: "ابھی راستے میں ہے —" },
  ch_handovers: { en: "handovers", rm: "handover", ur: "ہینڈ اوور" },
  ch_all_received: { en: "Every amount sent has been received.", rm: "Har bheji hui raqam wusool ho chuki hai.", ur: "ہر بھیجی ہوئی رقم وصول ہو چکی ہے۔" },
  ch_transit_meaning: {
    en: "“In transit” does not mean everything is fine — it means that amount currently has one person answerable for it.",
    rm: "“Raaste mein” ka matlab ye nahi ke sab theek hai — matlab ye hai ke us raqam ka abhi ek zimmedar hai.",
    ur: "“راستے میں” کا مطلب یہ نہیں کہ سب ٹھیک ہے — مطلب یہ ہے کہ اس رقم کا ابھی ایک ذمہ دار ہے۔",
  },
  ch_stale_1: { en: "Of these,", rm: "In mein se", ur: "ان میں سے" },
  ch_stale_2: {
    en: "days. The more time passes, the less likely it is ever to turn up.",
    rm: "din se raaste mein hai. Jitna waqt guzarta hai, utna kam mumkin hota jata hai ke wo kabhi mile.",
    ur: "دن سے راستے میں ہے۔ جتنا وقت گزرتا ہے، اتنا کم ممکن ہوتا جاتا ہے کہ وہ کبھی ملے۔",
  },
  ch_amounts_for_you: { en: "Cash sent in your name — confirm it", rm: "Aap ke naam bheja gaya cash — tasdeeq karein", ur: "آپ کے نام بھیجا گیا کیش — تصدیق کریں" },
  ch_send_cash: { en: "Send cash", rm: "Cash bhejein", ur: "کیش بھیجیں" },
  ch_no_one_else: { en: "No second person found", rm: "Koi doosra shakhs nahi mila", ur: "کوئی دوسرا شخص نہیں ملا" },
  ch_no_one_else_note: {
    en: "Sending cash needs at least one more active staff member — the giver and the receiver cannot be the same person.",
    rm: "Cash bhejne ke liye kam az kam ek aur active staff hona zaroori hai — dene aur lene wala ek shakhs nahi ho sakta.",
    ur: "کیش بھیجنے کے لیے کم از کم ایک اور فعال ملازم ہونا ضروری ہے — دینے اور لینے والا ایک شخص نہیں ہو سکتا۔",
  },
  ch_in_transit_now_title: { en: "In transit right now", rm: "Abhi raaste mein", ur: "ابھی راستے میں" },
  ch_nothing_in_transit: { en: "Nothing is in transit.", rm: "Kuch bhi raaste mein nahi.", ur: "کچھ بھی راستے میں نہیں۔" },
  ch_carried_by: { en: "carried it", rm: "le kar gaya", ur: "لے کر گیا" },
  ch_today: { en: "today", rm: "aaj", ur: "آج" },
  ch_days: { en: "days", rm: "din", ur: "دن" },
  ch_past_handovers: { en: "Past handovers", rm: "Pichhle handover", ur: "پچھلے ہینڈ اوور" },
  ch_no_handovers: { en: "No handover has happened yet.", rm: "Abhi koi handover nahi hua.", ur: "ابھی کوئی ہینڈ اوور نہیں ہوا۔" },
  ch_who_to_who: { en: "Who → Whom", rm: "Kaun → Kaun", ur: "کون ← کون" },
  ch_sent: { en: "Sent", rm: "Bheja", ur: "بھیجا" },
  ch_got: { en: "Received", rm: "Mila", ur: "ملا" },
  ch_difference: { en: "Difference", rm: "Farq", ur: "فرق" },
  ch_reason: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  ch_still_in_transit: { en: " • still in transit", rm: " • abhi raaste mein", ur: " • ابھی راستے میں" },
  ch_footer_note: {
    en: "An amount once sent cannot be changed, and only the person it was sent to can record the receipt. If one person could write both sides, no difference would ever surface.",
    rm: "Bheji hui raqam badli nahi ja sakti, aur wusooli sirf wohi shakhs darj kar sakta hai jis ke naam bheji gayi ho. Ek hi banda dono taraf likh sake to farq kabhi nahi nikle ga.",
    ur: "بھیجی ہوئی رقم بدلی نہیں جا سکتی، اور وصولی صرف وہی شخص درج کر سکتا ہے جس کے نام بھیجی گئی ہو۔ ایک ہی بندہ دونوں طرف لکھ سکے تو فرق کبھی نہیں نکلے گا۔",
  },

  // --- Bhejne ka form ---
  ch_waiting: { en: "One moment…", rm: "Ruk jayein…", ur: "رک جائیں…" },
  ch_to_whom: { en: "Who are you giving it to?", rm: "Kis ko de rahe hain?", ur: "کس کو دے رہے ہیں؟" },
  ch_required: { en: "(required)", rm: "(lazmi)", ur: "(لازمی)" },
  ch_pick: { en: "— select —", rm: "— select karein —", ur: "— منتخب کریں —" },
  ch_to_whom_note: {
    en: "This is the person who will confirm it on the other side. You cannot confirm it yourself.",
    rm: "Ye wohi shakhs hoga jo doosri taraf tasdeeq karega. Aap khud tasdeeq nahi kar sakte.",
    ur: "یہ وہی شخص ہوگا جو دوسری طرف تصدیق کرے گا۔ آپ خود تصدیق نہیں کر سکتے۔",
  },
  ch_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  ch_where_going: { en: "Where is it going", rm: "Kahan ja raha hai", ur: "کہاں جا رہا ہے" },
  ch_unknown: { en: "— not known —", rm: "— maloom nahi —", ur: "— معلوم نہیں —" },
  ch_who_carries: { en: "Who is carrying it? (driver / staff)", rm: "Le kaun ja raha hai? (driver / mulazim)", ur: "لے کون جا رہا ہے؟ (ڈرائیور / ملازم)" },
  ch_self_carry: { en: "— carrying it myself —", rm: "— khud le ja raha hai —", ur: "— خود لے جا رہا ہے —" },
  ch_carrier_note: {
    en: "If the money goes missing, the question of who was holding it can only be asked because of this.",
    rm: "Raqam gum ho jaye to ye sawal tabhi ban sakta hai ke wo kis ke paas thi.",
    ur: "رقم گم ہو جائے تو یہ سوال تبھی بن سکتا ہے کہ وہ کس کے پاس تھی۔",
  },
  ch_note_optional: { en: "Anything to note (optional)", rm: "Koi baat (marzi)", ur: "کوئی بات (مرضی)" },
  ch_note_eg: { en: "e.g. Three days of sales, for HQ", rm: "Jaise: HQ ke liye teen din ki bikri", ur: "جیسے: ایچ کیو کے لیے تین دن کی بکری" },
  ch_record_sent: { en: "Record the cash as sent", rm: "Cash bheja hua darj karein", ur: "کیش بھیجا ہوا درج کریں" },

  // --- Wusooli ---
  ch_sent_by: { en: "sent it", rm: "ne bheja", ur: "نے بھیجا" },
  ch_brought_by: { en: "brought it", rm: "le kar aaya", ur: "لے کر آیا" },
  ch_days_ago: { en: "days ago", rm: "din se", ur: "دن سے" },
  ch_how_much_got: { en: "How much did you get? (count it and write)", rm: "Aap ko kitna mila? (gin kar likhein)", ur: "آپ کو کتنا ملا؟ (گن کر لکھیں)" },
  ch_received_word: { en: "received", rm: "mile", ur: "ملے" },
  ch_what_happened: { en: "What do you make of it?", rm: "Kya samajh aaya?", ur: "کیا سمجھ آیا؟" },
  ch_unknown_reason_ph: { en: "If the reason is not known, write exactly that", rm: "Wajah maloom na ho to wahi likhein", ur: "وجہ معلوم نہ ہو تو وہی لکھیں" },
  ch_all_matched: { en: "All received — the account is square.", rm: "Poore mile — hisaab barabar.", ur: "پورے ملے — حساب برابر۔" },
  ch_record_receipt: { en: "Record the receipt", rm: "Wusooli darj karein", ur: "وصولی درج کریں" },
} as const;
