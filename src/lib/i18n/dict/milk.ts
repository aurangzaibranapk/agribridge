/**
 * Doodh ke alfaz.
 *
 * Istilahat glossary.ts se: kisan, doodh, shakh, tareekh, raqam, rate,
 * baqi, adaigi, raseed, wajah, dhoondein, mehfooz karein, hatayein.
 *
 * Doodh ke apne lafz jo yahan tay hote hain (aur milk-dispatch.ts mein
 * pehle se isi tarah chal rahe hain -- do naam nahi hone chahiyen):
 *
 *   Shift      Waqt          وقت
 *   Morning    Subah         صبح
 *   Evening    Shaam         شام
 *   Chiller    Chiller       چلر
 *   Shortage   Kami          کمی
 *   Route      Route         روٹ
 *   Verify     Tasdeeq       تصدیق
 *
 * FAT, LR, SNF, TS ka tarjuma jaan boojh kar NAHI kiya gaya. Ye chiller
 * ki machine par isi tarah likhe hote hain, aur inhen "چکنائی" bana
 * dena us bande ki madad nahi karta jo machine ki screen dekh kar entry
 * kar raha hai.
 */
export const milkDict = {
  // --- Safhe ke unwan ---
  mk_title: { en: "Milk Collection", rm: "Doodh ki Wusooli", ur: "دودھ کی وصولی" },
  mk_subtitle: {
    en: "Daily milk entries, quality, and farmer payments",
    rm: "Rozana doodh ki entries, quality aur kisan ki adaigi",
    ur: "روزانہ دودھ کی انٹریاں، کوالٹی اور کسان کی ادائیگی",
  },

  // --- Upar ke teen khane ---
  mk_today_collection: { en: "Today's Collection", rm: "Aaj ka Doodh", ur: "آج کا دودھ" },
  mk_total_owed: { en: "Total Owed to Farmers", rm: "Kisanon ka Kul Baqi", ur: "کسانوں کا کل باقی" },
  mk_active_suppliers: { en: "Active Suppliers", rm: "Doodh Dene Wale", ur: "دودھ دینے والے" },

  // --- Fehristein ---
  mk_recent_entries: { en: "Recent Entries", rm: "Nayi Entries", ur: "نئی انٹریاں" },
  mk_farmer_balances: { en: "Farmer Balances", rm: "Kisanon ka Baqi", ur: "کسانوں کا باقی" },
  mk_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  mk_chiller: { en: "Chiller", rm: "Chiller", ur: "چلر" },
  mk_farmer: { en: "Farmer", rm: "Kisan", ur: "کسان" },
  mk_shift: { en: "Shift", rm: "Waqt", ur: "وقت" },
  mk_morning: { en: "Morning", rm: "Subah", ur: "صبح" },
  mk_evening: { en: "Evening", rm: "Shaam", ur: "شام" },
  mk_qty_l: { en: "Qty (L)", rm: "Litre", ur: "لیٹر" },
  mk_fat_snf: { en: "FAT/SNF", rm: "FAT/SNF", ur: "FAT/SNF" },
  mk_rate: { en: "Rate", rm: "Rate", ur: "ریٹ" },
  mk_total: { en: "Total", rm: "Kul", ur: "کل" },
  mk_supplied: { en: "Supplied", rm: "Diya", ur: "دیا" },
  mk_paid: { en: "Paid", rm: "Ada", ur: "ادا" },
  mk_balance_due: { en: "Balance Due", rm: "Baqi", ur: "باقی" },
  mk_action: { en: "Action", rm: "Kaam", ur: "کام" },
  mk_pay: { en: "Pay", rm: "Adaigi", ur: "ادائیگی" },
  mk_no_entries: { en: "No milk entries yet.", rm: "Abhi koi entry nahi.", ur: "ابھی کوئی انٹری نہیں۔" },
  mk_no_suppliers: { en: "No suppliers yet.", rm: "Abhi koi doodh dene wala nahi.", ur: "ابھی کوئی دودھ دینے والا نہیں۔" },

  // --- Nayi entry ka form ---
  mk_new_entry: { en: "New Milk Entry", rm: "Nayi Doodh Entry", ur: "نئی دودھ انٹری" },
  mk_entry_saved: { en: "Entry recorded.", rm: "Entry record ho gayi.", ur: "انٹری ریکارڈ ہو گئی۔" },
  mk_sms_not_configured: {
    en: " (SMS gateway is not configured yet — copy the message below)",
    rm: " (SMS gateway abhi configure nahi hai — message neeche copy kar lein)",
    ur: " (ایس ایم ایس گیٹ وے ابھی سیٹ نہیں ہے — پیغام نیچے سے کاپی کر لیں)",
  },
  mk_chiller_branch_req: { en: "Chiller/Branch *", rm: "Chiller/Shakh *", ur: "چلر/شاخ *" },
  mk_farmer_req: { en: "Farmer *", rm: "Kisan *", ur: "کسان *" },
  mk_select: { en: "- select -", rm: "- chunein -", ur: "- منتخب کریں -" },
  mk_balance_due_label: { en: "Balance Due", rm: "Baqi raqam", ur: "باقی رقم" },
  mk_shift_auto: { en: "Shift (auto-detected)", rm: "Waqt (khud pehchana gaya)", ur: "وقت (خود پہچانا گیا)" },
  mk_late_warn_1: { en: "This is the", rm: "Ye", ur: "یہ" },
  mk_late_warn_2: { en: "slot but the time right now is", rm: "slot hai lekin abhi waqt", ur: "سلاٹ ہے لیکن ابھی وقت" },
  mk_late_warn_3: { en: "— write the reason", rm: "ka hai — wajah likhein", ur: "کا ہے — وجہ لکھیں" },
  mk_late_reason_eg: {
    en: "e.g. Got late in the morning, entering it now",
    rm: "misaal: Subah der ho gayi thi, ab entry kar raha hoon",
    ur: "مثلاً صبح دیر ہو گئی تھی، اب انٹری کر رہا ہوں",
  },
  mk_volume_req: { en: "Volume (Liters) *", rm: "Litre *", ur: "لیٹر *" },
  mk_fat_req: { en: "FAT % *", rm: "FAT % *", ur: "FAT % *" },
  mk_lr_req: { en: "LR *", rm: "LR *", ur: "LR *" },
  mk_notes: { en: "Notes", rm: "Notes", ur: "نوٹس" },
  mk_snf_auto: { en: "SNF (auto)", rm: "SNF (khud)", ur: "SNF (خود)" },
  mk_adjusted_volume: { en: "Adjusted Volume (13 TS)", rm: "Adjusted Volume (13 TS)", ur: "ایڈجسٹڈ والیوم (13 TS)" },
  mk_amount_auto_note: {
    en: "The amount is calculated from the farmer's type (Self Drop-off / Field Collection).",
    rm: "Raqam kisan ki type (Self Drop-off / Field Collection) se khud ban jayegi.",
    ur: "رقم کسان کی قسم (خود لانے والا / میدان سے وصولی) سے خود بن جائے گی۔",
  },
  mk_record_entry: { en: "Record Entry", rm: "Entry Darj Karein", ur: "انٹری درج کریں" },
  mk_saving: { en: "Saving...", rm: "Mehfooz ho raha hai...", ur: "محفوظ ہو رہا ہے..." },

  // --- Adaigi ---
  mk_record_payment: { en: "Record Payment", rm: "Adaigi Darj Karein", ur: "ادائیگی درج کریں" },
  mk_owed: { en: "Owed", rm: "Baqi", ur: "باقی" },
  mk_payment_recorded: { en: "Payment recorded.", rm: "Adaigi darj ho gayi.", ur: "ادائیگی درج ہو گئی۔" },
  mk_amount_req: { en: "Amount (Rs.) *", rm: "Raqam (Rs.) *", ur: "رقم (روپے) *" },
  mk_payment_method: { en: "Payment Method", rm: "Adaigi ka Tareeqa", ur: "ادائیگی کا طریقہ" },
  mk_cash: { en: "Cash", rm: "Naqad", ur: "نقد" },
  mk_bank_transfer: { en: "Bank Transfer", rm: "Bank Transfer", ur: "بینک ٹرانسفر" },

  // --- Maidan ka collection (collect) ---
  mk_collect_title: { en: "Field Collection", rm: "Maidan se Wusooli", ur: "میدان سے وصولی" },
  mk_offline_saving: {
    en: "No network — entries are being saved on the device",
    rm: "Network nahi hai — entries device par mahfooz ho rahi hain",
    ur: "نیٹ ورک نہیں ہے — انٹریاں ڈیوائس پر محفوظ ہو رہی ہیں",
  },
  mk_offline_sending: { en: "entries on the device, being sent", rm: "entry device par, bheji ja rahi hai", ur: "انٹری ڈیوائس پر، بھیجی جا رہی ہے" },
  mk_send_now: { en: "Send now", rm: "Abhi bhejein", ur: "ابھی بھیجیں" },
  mk_sending: { en: "Sending", rm: "Ja rahi hain", ur: "جا رہی ہیں" },
  mk_offline_queue_note: {
    en: "entries queued. They go on their own the moment the network is back — they stay safe even if you close the page.",
    rm: "entry qatar mein. Network aate hi khud chali jayengi — safha band kar dein to bhi mahfooz rahengi.",
    ur: "انٹری قطار میں۔ نیٹ ورک آتے ہی خود چلی جائیں گی — صفحہ بند کر دیں تو بھی محفوظ رہیں گی۔",
  },
  mk_stuck: { en: "entries stuck — the server did not accept them:", rm: "entry ruk gayi — server ne qabool nahi ki:", ur: "انٹری رک گئی — سرور نے قبول نہیں کی:" },
  mk_remove: { en: "remove", rm: "hatayein", ur: "ہٹائیں" },
  mk_stuck_note: {
    en: "These have to be entered again from the website — without fixing the reason they will not go on their own.",
    rm: "Inhein dobara website se daalna hoga — wajah theek kiye baghair ye khud nahi jayengi.",
    ur: "انہیں دوبارہ ویب سائٹ سے ڈالنا ہوگا — وجہ ٹھیک کیے بغیر یہ خود نہیں جائیں گی۔",
  },
  mk_search_name_code: { en: "Type a name or code", rm: "Naam ya code likhein", ur: "نام یا کوڈ لکھیں" },
  mk_no_farmer_found: { en: "No farmer found.", rm: "Koi kisan nahi mila.", ur: "کوئی کسان نہیں ملا۔" },
  mk_change: { en: "change", rm: "badlein", ur: "بدلیں" },
  mk_liters_req: { en: "Liters *", rm: "Litre *", ur: "لیٹر *" },
  mk_lr_photo: { en: "LR photo", rm: "LR ki photo", ur: "LR کی تصویر" },
  mk_photo_preparing: { en: "Preparing the photo...", rm: "Tasveer taiyar ho rahi hai...", ur: "تصویر تیار ہو رہی ہے..." },
  mk_photo_ready: { en: "Photo ready", rm: "Tasveer taiyar", ur: "تصویر تیار" },
  mk_save: { en: "Save", rm: "Mehfooz Karein", ur: "محفوظ کریں" },
  mk_save_on_device: { en: "Save on the device", rm: "Device par Mahfooz Karein", ur: "ڈیوائس پر محفوظ کریں" },
  mk_fat_at_chiller_note: {
    en: "FAT is applied at the chiller — the amount is made at that point.",
    rm: "FAT chiller par lagega — raqam us waqt banegi.",
    ur: "FAT چلر پر لگے گا — رقم اسی وقت بنے گی۔",
  },
  mk_just_saved: { en: "Just saved", rm: "Abhi mahfooz kiye", ur: "ابھی محفوظ کیے" },
  mk_no_network: { en: "No network", rm: "Network nahi hai", ur: "نیٹ ورک نہیں ہے" },
  mk_server_unreachable: { en: "Could not reach the server", rm: "Server tak nahi pahuncha ja saka", ur: "سرور تک نہیں پہنچا جا سکا" },
  mk_server_unreachable_retry: {
    en: "Could not reach the server. Try again.",
    rm: "Server tak nahi pahuncha ja saka. Dobara koshish karein.",
    ur: "سرور تک نہیں پہنچا جا سکا۔ دوبارہ کوشش کریں۔",
  },
  mk_saved_on_device: { en: "saved on the device", rm: "device par mahfooz", ur: "ڈیوائس پر محفوظ" },
  mk_not_saved: { en: "Could not be saved.", rm: "Mahfooz nahi ho saka.", ur: "محفوظ نہیں ہو سکا۔" },
  mk_photo_failed: { en: "The photo could not be taken.", rm: "Tasveer nahi li ja saki.", ur: "تصویر نہیں لی جا سکی۔" },
  mk_device_save_failed: {
    en: "The entry could not even be saved on the device. Write it on paper.",
    rm: "Entry device par bhi mahfooz nahi ho saki. Kagaz par likh lein.",
    ur: "انٹری ڈیوائس پر بھی محفوظ نہیں ہو سکی۔ کاغذ پر لکھ لیں۔",
  },

  // --- Chiller (FAT) ---
  mk_chiller_title: { en: "Chiller — FAT and Dispatch", rm: "Chiller — FAT aur Rawangi", ur: "چلر — FAT اور روانگی" },
  mk_chiller_subtitle: {
    en: "FAT is applied here. Only after that is the rate made and the money credited to the farmer.",
    rm: "FAT yahan lagta hai. Us ke baad hi rate banta hai aur paisa kisan ke khate mein jata hai.",
    ur: "FAT یہاں لگتا ہے۔ اس کے بعد ہی ریٹ بنتا ہے اور پیسہ کسان کے کھاتے میں جاتا ہے۔",
  },
  mk_apply: { en: "Apply", rm: "Lagayein", ur: "لگائیں" },
  mk_apply_to_all: { en: "Apply to all", rm: "Sab par lagayein", ur: "سب پر لگائیں" },
  mk_batch_fat_note: {
    en: "At the chiller a single sample of the whole tank is usually taken — in that case the same FAT applies to everyone.",
    rm: "Chiller par aksar poore tank ka ek namoona liya jata hai — us soorat mein wohi FAT sab par lagta hai.",
    ur: "چلر پر اکثر پورے ٹینک کا ایک نمونہ لیا جاتا ہے — اس صورت میں وہی FAT سب پر لگتا ہے۔",
  },
  mk_arrived_at_chiller: { en: "Arrived at the chiller (L)", rm: "Chiller par pahuncha (L)", ur: "چلر پر پہنچا (لیٹر)" },
  mk_record: { en: "Record", rm: "Darj karein", ur: "درج کریں" },
  mk_no_milk_this_shift: {
    en: "No milk is recorded for this day and shift.",
    rm: "Is din aur waqt ka koi doodh darj nahi.",
    ur: "اس دن اور وقت کا کوئی دودھ درج نہیں۔",
  },
  mk_route_all_fat_done: {
    en: "FAT has been applied to every entry on this route.",
    rm: "Is route ki sab entries par FAT lag chuka hai.",
    ur: "اس روٹ کی سب انٹریوں پر FAT لگ چکا ہے۔",
  },
  mk_field: { en: "Field", rm: "Maidan", ur: "میدان" },
  mk_shortage: { en: "shortage", rm: "kami", ur: "کمی" },
  mk_excess: { en: "excess", rm: "ziyadti", ur: "زیادتی" },
  mk_over_limit: { en: "— over the limit", rm: "— hadd se zyada", ur: "— حد سے زیادہ" },
  mk_entries: { en: "entries", rm: "entries", ur: "انٹریاں" },
  mk_no_route: { en: "No route", rm: "Bagair route", ur: "بغیر روٹ" },

  // --- Manager tasdeeq (verify) ---
  mk_verify_title: { en: "Manager Verify", rm: "Manager Tasdeeq", ur: "منیجر تصدیق" },
  mk_verify_subtitle: {
    en: "The rate is already applied. Verification does not happen without a written reason — this rule is in the database too.",
    rm: "Rate lag chuka hai. Tasdeeq bina wajah likhe nahi hoti — ye rok database mein bhi lagi hui hai.",
    ur: "ریٹ لگ چکا ہے۔ تصدیق بغیر وجہ لکھے نہیں ہوتی — یہ روک ڈیٹابیس میں بھی لگی ہوئی ہے۔",
  },
  mk_nothing_to_verify: { en: "Nothing is waiting to be verified.", rm: "Tasdeeq ke intezar mein koi entry nahi.", ur: "تصدیق کے انتظار میں کوئی انٹری نہیں۔" },
  mk_select_all: { en: "Select all", rm: "Sab chunein", ur: "سب منتخب کریں" },
  mk_selected: { en: "selected", rm: "chuni gayin", ur: "منتخب" },
  mk_self_delivery: { en: "Brought it himself", rm: "Khud laya", ur: "خود لایا" },
  mk_duplicate_warn: {
    en: "There is another entry for this same farmer in this same shift.",
    rm: "Isi kisan ki isi shift mein doosri entry bhi hai.",
    ur: "اسی کسان کی اسی شفٹ میں دوسری انٹری بھی ہے۔",
  },
  mk_verify: { en: "Verify", rm: "Tasdeeq", ur: "تصدیق" },
  mk_reject: { en: "Reject", rm: "Rad karein", ur: "رد کریں" },
  mk_comment_req: { en: "Comment *", rm: "Comment *", ur: "تبصرہ *" },
  mk_comment_required_note: { en: "(required — write the reason)", rm: "(lazmi — wajah likhein)", ur: "(لازمی — وجہ لکھیں)" },
  mk_comment_eg: {
    en: "e.g. Matched the chiller reading against the entries, everything is correct.",
    rm: "Misaal: Chiller ka naap aur entries mila kar dekh li, sab durust hai.",
    ur: "مثلاً: چلر کا ناپ اور انٹریاں ملا کر دیکھ لی، سب درست ہے۔",
  },
  mk_comment_permanent: {
    en: "This comment stays in the record forever",
    rm: "Ye comment hamesha ke liye record mein rahega",
    ur: "یہ تبصرہ ہمیشہ کے لیے ریکارڈ میں رہے گا",
  },
  mk_selected_amount: { en: "Selected amount", rm: "Chuni hui raqam", ur: "منتخب رقم" },
  mk_working: { en: "Working...", rm: "Ho raha hai...", ur: "ہو رہا ہے..." },
  mk_verify_now: { en: "Verify", rm: "Tasdeeq Karein", ur: "تصدیق کریں" },
  mk_reject_now: { en: "Reject", rm: "Rad Karein", ur: "رد کریں" },
  mk_pick_first: {
    en: "First select entries and write a comment",
    rm: "Pehle entries chunein aur comment likhein",
    ur: "پہلے انٹریاں منتخب کریں اور تبصرہ لکھیں",
  },

  // --- Route aur kami ---
  mk_routes_title: { en: "Route Collection & Shortage", rm: "Route aur Kami", ur: "روٹ اور کمی" },
  mk_routes_subtitle: {
    en: "Field against chiller — the alert comes up on its own when the shortage crosses the limit",
    rm: "Maidan ke muqable chiller — kami hadd se barhe to alert khud aata hai",
    ur: "میدان کے مقابلے چلر — کمی حد سے بڑھے تو الرٹ خود آتا ہے",
  },
  mk_red_alert_count: {
    en: "route(s) have a gap above the shortage limit — look into it.",
    rm: "route mein kami hadd se zyada hai — dhyan dein.",
    ur: "روٹ میں کمی حد سے زیادہ ہے — دھیان دیں۔",
  },
  mk_route_rider: { en: "Route/Rider", rm: "Route/Rider", ur: "روٹ/رائیڈر" },
  mk_field_l: { en: "Field (L)", rm: "Maidan (L)", ur: "میدان (لیٹر)" },
  mk_chiller_l: { en: "Chiller (L)", rm: "Chiller (L)", ur: "چلر (لیٹر)" },
  mk_shortage_pc: { en: "Shortage %", rm: "Kami %", ur: "کمی %" },
  mk_status: { en: "Status", rm: "Halat", ur: "حالت" },
  mk_pending: { en: "Pending", rm: "Baqi hai", ur: "باقی ہے" },
  mk_red_alert: { en: "Red Alert", rm: "Red Alert", ur: "ریڈ الرٹ" },
  mk_ok: { en: "OK", rm: "Theek", ur: "ٹھیک" },
  mk_no_route_entry: { en: "There is no route entry yet.", rm: "Abhi koi route entry nahi hai.", ur: "ابھی کوئی روٹ انٹری نہیں ہے۔" },
  mk_field_collection_entry: { en: "Field Collection Entry", rm: "Maidan ki Entry", ur: "میدان کی انٹری" },
  mk_entry_saved_short: { en: "Entry saved.", rm: "Entry mehfooz ho gayi.", ur: "انٹری محفوظ ہو گئی۔" },
  mk_pick_chiller: { en: "- pick a chiller/branch -", rm: "- Chiller/Shakh chunein -", ur: "- چلر/شاخ منتخب کریں -" },
  mk_route_name: { en: "Route name", rm: "Route ka naam", ur: "روٹ کا نام" },
  mk_rider_name: { en: "Rider name (optional)", rm: "Rider ka naam (marzi se)", ur: "رائیڈر کا نام (مرضی سے)" },
  mk_field_volume: { en: "Field collected volume (L)", rm: "Maidan se liya (L)", ur: "میدان سے لیا (لیٹر)" },
  mk_chiller_volume_if_known: {
    en: "Chiller received volume (L) — if known",
    rm: "Chiller par pahuncha (L) — agar pata hai",
    ur: "چلر پر پہنچا (لیٹر) — اگر پتہ ہے",
  },
  mk_save_entry: { en: "Save Entry", rm: "Entry Mehfooz Karein", ur: "انٹری محفوظ کریں" },
  mk_add: { en: "Add", rm: "Daalein", ur: "ڈالیں" },

  // --- Chiller par khara kisan (walk-in) ---
  mk_walkin_title: { en: "Walk-in Milk", rm: "Chiller par Aaya Doodh", ur: "چلر پر آیا دودھ" },
  mk_walkin_saved: {
    en: "The milk is recorded — a message has been sent to the farmer.",
    rm: "Doodh darj ho gaya — kisan ko paighaam bhej diya gaya.",
    ur: "دودھ درج ہو گیا — کسان کو پیغام بھیج دیا گیا۔",
  },
  mk_receipt: { en: "AgriBridge Milk Receipt", rm: "AgriBridge Doodh ki Raseed", ur: "ایگری برج دودھ کی رسید" },
  mk_collection: { en: "Collection", rm: "Wusooli", ur: "وصولی" },
  mk_milk: { en: "Milk", rm: "Doodh", ur: "دودھ" },
  mk_collection_id: { en: "Collection ID", rm: "Collection ID", ur: "کلیکشن آئی ڈی" },
  mk_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  mk_next_farmer: { en: "Next Farmer", rm: "Agla Kisan", ur: "اگلا کسان" },
  mk_step1_who: { en: "1. Who is the farmer?", rm: "1. Kisan kaun hai?", ur: "۱۔ کسان کون ہے؟" },
  mk_step2_measure: { en: "2. Measurement at the chiller", rm: "2. Chiller par naap", ur: "۲۔ چلر پر ناپ" },
  mk_village_not_recorded: { en: "Village not recorded", rm: "Village darj nahi", ur: "گاؤں درج نہیں" },
  mk_active: { en: "Active", rm: "Active", ur: "فعال" },
  mk_closed: { en: "Closed", rm: "Band", ur: "بند" },
  mk_search_placeholder: { en: "Farmer ID, mobile, CNIC or name", rm: "Farmer ID, mobile, CNIC ya naam", ur: "فارمر آئی ڈی، موبائل، شناختی کارڈ یا نام" },
  mk_search: { en: "Search", rm: "Dhoondein", ur: "تلاش کریں" },
  mk_none_found_register: {
    en: "No farmer found. If this is a new farmer, register them below.",
    rm: "Koi kisan nahi mila. Naya kisan hai to neeche darj kar lein.",
    ur: "کوئی کسان نہیں ملا۔ نیا کسان ہے تو نیچے درج کر لیں۔",
  },
  mk_same_name_note: {
    en: "If several farmers come up under the same name, identify by village and mobile — the milk always goes to the right Farmer ID.",
    rm: "Naam se kai kisan mil jayein to village aur mobile se pehchan lein — doodh hamesha asli Farmer ID par hi jata hai.",
    ur: "نام سے کئی کسان مل جائیں تو گاؤں اور موبائل سے پہچان لیں — دودھ ہمیشہ اصلی فارمر آئی ڈی پر ہی جاتا ہے۔",
  },
  mk_register_new: { en: "Register a new farmer", rm: "Naya kisan darj karein", ur: "نیا کسان درج کریں" },
  mk_milk_l_req: { en: "Milk (L) *", rm: "Doodh (L) *", ur: "دودھ (لیٹر) *" },
  mk_receiver_note_1: { en: "Received by:", rm: "Wusool karne wala:", ur: "وصول کرنے والا:" },
  mk_receiver_you: { en: "you", rm: "aap", ur: "آپ" },
  mk_receiver_note_2: {
    en: "• No MCA's name is put on this entry.",
    rm: "• Is entry par kisi MCA ka naam nahi lagta.",
    ur: "• اس انٹری پر کسی MCA کا نام نہیں لگتا۔",
  },
  mk_save_and_receipt: { en: "Save and Make the Receipt", rm: "Mehfooz Karein aur Parchi Banayein", ur: "محفوظ کریں اور پرچی بنائیں" },
  mk_full_name_req: { en: "Full name *", rm: "Poora naam *", ur: "پورا نام *" },
  mk_mobile_req: { en: "Mobile number *", rm: "Mobile number *", ur: "موبائل نمبر *" },
  mk_village: { en: "Village", rm: "Village", ur: "گاؤں" },
  mk_make_farmer_id: { en: "Create Farmer ID", rm: "Farmer ID banayein", ur: "فارمر آئی ڈی بنائیں" },
  mk_creating: { en: "Creating...", rm: "Ban raha hai...", ur: "بن رہا ہے..." },
  mk_quick_register_note: {
    en: "HR will fill in the rest later — only as much is asked here as is actually needed to take the milk.",
    rm: "Baqi tafseel HR baad mein bhar dega — yahan sirf utna poochha jata hai jitna doodh lene ke liye waqai chahiye.",
    ur: "باقی تفصیل ایچ آر بعد میں بھر دے گا — یہاں صرف اتنا پوچھا جاتا ہے جتنا دودھ لینے کے لیے واقعی چاہیے۔",
  },
} as const;

/** Do safhon ke unwan aur upar ke chhote khane. */
export const milkPageDict = {
  mk_walkin_page_title: { en: "Walk-in / Self Delivery", rm: "Khud Laya Doodh", ur: "خود لایا دودھ" },
  mk_walkin_page_sub: {
    en: "The farmer brought the milk to the chiller himself. No MCA's name goes on this entry.",
    rm: "Kisan khud chiller par doodh laya. Is entry par kisi MCA ka naam nahi lagta.",
    ur: "کسان خود چلر پر دودھ لایا۔ اس انٹری پر کسی MCA کا نام نہیں لگتا۔",
  },
  mk_collect_page_title: { en: "Collect Milk", rm: "Doodh Jama Karein", ur: "دودھ جمع کریں" },
  mk_no_route_assigned: {
    en: "No route recorded yet — ask HR to write down your route and chiller.",
    rm: "Route abhi darj nahi — HR se kehein ke aap ka route aur chiller likh dein.",
    ur: "روٹ ابھی درج نہیں — ایچ آر سے کہیں کہ آپ کا روٹ اور چلر لکھ دیں۔",
  },
  mk_route_label: { en: "Route", rm: "Route", ur: "روٹ" },
  mk_today: { en: "Today", rm: "Aaj", ur: "آج" },
  mk_todays_entries: { en: "Today's entries", rm: "Aaj ki entries", ur: "آج کی انٹریاں" },
} as const;

/**
 * Doodh wali motorcycle ka petrol.
 *
 * "Expected KM/Liter" is liye poochha jata hai ke asal khapat us se
 * mila kar dekhi ja sake. Wo adad na ho to har entry theek lagti hai --
 * aur wohi cheez pakarni thi jab gaari se ziyada tel nikalne lage.
 *
 * "Margin" ka khana jaan boojh kar alag hai. Official rate wo hai jo
 * pump par likha hai; margin hamara apna hai. Dono ko ek hi khane mein
 * mila dena us din pakRa nahi jata jab pump ka rate badalta hai aur
 * hamara nahi.
 */
export const milkFuelDict = {
  mf_no_vehicle: { en: "No vehicle added yet.", rm: "Abhi koi gaari shamil nahi hui.", ur: "ابھی کوئی گاڑی شامل نہیں ہوئی۔" },
  mf_km: { en: "KM", rm: "KM", ur: "کلومیٹر" },
  mf_km_per_l: { en: "KM/L", rm: "KM/L", ur: "کلومیٹر فی لیٹر" },
  mf_ok: { en: "OK", rm: "Theek", ur: "ٹھیک" },
  mf_no_entry: { en: "No fuel entries yet.", rm: "Abhi koi tel ka indraj nahi.", ur: "ابھی کوئی تیل کا اندراج نہیں۔" },
  mf_add_motorcycle: { en: "Add Motorcycle", rm: "Motorcycle shamil karein", ur: "موٹر سائیکل شامل کریں" },
  mf_vehicle_name: { en: "Vehicle Name (e.g. Honda 70 — Red)", rm: "Gaari ka naam (misal: Honda 70 - laal)", ur: "گاڑی کا نام (مثال: ہونڈا 70 — لال)" },
  mf_reg_no: { en: "Registration No. (optional)", rm: "Registration number (marzi se)", ur: "رجسٹریشن نمبر (مرضی سے)" },
  mf_rider_name: { en: "Rider Name", rm: "Chalane wale ka naam", ur: "چلانے والے کا نام" },
  mf_expected_kmpl: {
    en: "Expected KM/Litre (what it normally does)",
    rm: "Tawaqqo KM/litre (ye aam tor par kitna chalti hai)",
    ur: "توقع KM/لیٹر (یہ عام طور پر کتنا چلتی ہے)",
  },
  mf_add_vehicle: { en: "Add Vehicle", rm: "Gaari shamil karein", ur: "گاڑی شامل کریں" },
  mf_todays_rate: { en: "Today's Fuel Rate", rm: "Aaj ka tel ka rate", ur: "آج کا تیل کا ریٹ" },
  mf_rate_note: {
    en: "Enter the official rate only — the system adds the margin itself.",
    rm: "Sirf official rate likhein -- margin nizam khud laga deta hai.",
    ur: "صرف آفیشل ریٹ لکھیں — مارجن نظام خود لگا دیتا ہے۔",
  },
  mf_petrol_rate: { en: "Petrol Rate (Rs)", rm: "Petrol ka rate (Rs)", ur: "پٹرول کا ریٹ (روپے)" },
  mf_diesel_rate: { en: "Diesel Rate (Rs)", rm: "Diesel ka rate (Rs)", ur: "ڈیزل کا ریٹ (روپے)" },
  mf_margin: { en: "Margin (Rs) — added automatically", rm: "Margin (Rs) -- khud lag jayega", ur: "مارجن (روپے) — خود لگ جائے گا" },
  mf_daily_log: { en: "Daily Fuel Log", rm: "Rozana tel ka indraj", ur: "روزانہ تیل کا اندراج" },
  mf_log_saved: {
    en: "Log saved — the amount was calculated automatically.",
    rm: "Indraj mehfooz ho gaya -- raqam khud nikal aayi.",
    ur: "اندراج محفوظ ہو گیا — رقم خود نکل آئی۔",
  },
  mf_opening_km: { en: "Opening KM", rm: "Shuru ka KM", ur: "شروع کا کلومیٹر" },
  mf_closing_km: { en: "Closing KM", rm: "Aakhri KM", ur: "آخری کلومیٹر" },
  mf_litres: { en: "Fuel Litres Purchased", rm: "Kitne litre tel liya", ur: "کتنے لیٹر تیل لیا" },
  mf_cost_auto: {
    en: "Cost is calculated from today's rate automatically.",
    rm: "Kharcha aaj ke rate se khud nikal aayega.",
    ur: "خرچہ آج کے ریٹ سے خود نکل آئے گا۔",
  },
  mf_route_name: { en: "Route Name (optional)", rm: "Route ka naam (marzi se)", ur: "روٹ کا نام (مرضی سے)" },
  mf_milk_that_day: { en: "Milk Collected That Day (L)", rm: "Us din jama hua doodh (L)", ur: "اس دن جمع ہوا دودھ (لیٹر)" },
  mf_odometer_photo: { en: "Odometer Photo (optional)", rm: "Meter ki tasveer (marzi se)", ur: "میٹر کی تصویر (مرضی سے)" },
  mf_save_log: { en: "Save Log", rm: "Indraj mehfooz karein", ur: "اندراج محفوظ کریں" },
} as const;
