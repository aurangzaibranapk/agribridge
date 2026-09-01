/**
 * Hazri ka calendar, team, aur darkhwastein.
 *
 * TEEN LAFZ JAAN BOOJH KAR AISE HI:
 *
 *   "Hazri" -- Urdu mein حاضری. English mein "Attendance". Ye teenon
 *   zabanon mein alag hai kyunke teenon mein ye lafz roz bola jata hai.
 *
 *   "Missing" aur "Absent" ka farq har zaban mein RAKHA gaya hai.
 *   Missing = dekha hi nahi gaya. Absent = dekh kar ghair hazir likha.
 *   Ye do cheezein ek lafz mein daal dena wohi ghalti hai jo is project
 *   ke usool mein mana hai: "hisaab nahi rakha jata" aur "sifar" ek
 *   cheez nahi.
 *
 *   "Arhti" ki tarah, "Kanal"/"Marla" jaise lafz waise ke waise hain.
 */
export const hrAttendanceDict = {
  // ---- Calendar ----
  hra_title: { en: "Attendance Calendar", rm: "Hazri Calendar", ur: "حاضری کیلنڈر" },
  hra_subtitle: {
    en: "One month, one person, every day. Where there is no record, the answer comes from the rules — holiday, weekly off, or genuinely not seen.",
    rm: "Ek mahina, ek banda, har din. Jahan record nahi, wahan jawab qawaid se banta hai — chhutti, hafte ki chhutti, ya waqai dekha hi nahi gaya.",
    ur: "ایک مہینہ، ایک فرد، ہر دن۔ جہاں ریکارڈ نہیں، وہاں جواب قواعد سے بنتا ہے — چھٹی، ہفتہ وار چھٹی، یا واقعی دیکھا ہی نہیں گیا۔",
  },
  hra_pick_person: { en: "Employee", rm: "Mulazim", ur: "ملازم" },
  hra_prev_month: { en: "Previous month", rm: "Pichhla mahina", ur: "پچھلا مہینہ" },
  hra_next_month: { en: "Next month", rm: "Agla mahina", ur: "اگلا مہینہ" },
  hra_today: { en: "Today", rm: "Aaj", ur: "آج" },

  // ---- Har din ka darja ----
  hra_st_present: { en: "Present", rm: "Hazir", ur: "حاضر" },
  hra_st_absent: { en: "Absent", rm: "Ghair Hazir", ur: "غیر حاضر" },
  hra_st_late: { en: "Late", rm: "Der se", ur: "دیر سے" },
  hra_st_leave: { en: "Leave", rm: "Chhutti", ur: "چھٹی" },
  hra_st_half_day: { en: "Half Day", rm: "Aadha Din", ur: "آدھا دن" },
  hra_st_holiday: { en: "Holiday", rm: "Chhutti ka din", ur: "تعطیل" },
  hra_st_weekly_off: { en: "Weekly Off", rm: "Hafte ki chhutti", ur: "ہفتہ وار چھٹی" },
  hra_st_missing_punch: { en: "Missing Punch", rm: "Check-out nahi hua", ur: "چیک آؤٹ نہیں ہوا" },
  hra_st_missing: { en: "Not recorded", rm: "Record hi nahi", ur: "ریکارڈ ہی نہیں" },
  hra_st_leave_pending: { en: "Leave pending", rm: "Chhutti zer-e-ghaur", ur: "چھٹی زیرِ غور" },
  hra_st_future: { en: "Not yet", rm: "Abhi nahi", ur: "ابھی نہیں" },
  hra_st_today: { en: "Today — not yet marked", rm: "Aaj — abhi hazri nahi lagi", ur: "آج — ابھی حاضری نہیں لگی" },
  hra_st_pending_correction: { en: "Correction pending", rm: "Darkhwast zer-e-ghaur", ur: "درخواست زیرِ غور" },

  // ---- Din ki tafseel ----
  hra_check_in: { en: "Check in", rm: "Aaya", ur: "آمد" },
  hra_check_out: { en: "Check out", rm: "Gaya", ur: "روانگی" },
  hra_hours: { en: "Hours", rm: "Ghante", ur: "گھنٹے" },
  hra_late_by: { en: "Late by", rm: "Der", ur: "تاخیر" },
  hra_minutes: { en: "min", rm: "minute", ur: "منٹ" },
  hra_source: { en: "Source", rm: "Kahan se", ur: "کہاں سے" },
  hra_src_web: { en: "Web", rm: "Web", ur: "ویب" },
  hra_src_pwa: { en: "Mobile", rm: "Mobile", ur: "موبائل" },
  hra_src_whatsapp: { en: "WhatsApp", rm: "WhatsApp", ur: "واٹس ایپ" },
  hra_src_biometric: { en: "Biometric", rm: "Biometric", ur: "بایو میٹرک" },
  hra_src_correction: { en: "Set by hand", rm: "Haath se lagayi", ur: "ہاتھ سے لگائی" },
  hra_src_offline: { en: "Offline sync", rm: "Offline sync", ur: "آف لائن سنک" },
  hra_src_leave: { en: "From approved leave", rm: "Manzoor chhutti se", ur: "منظور چھٹی سے" },
  hra_no_record: { en: "No record for this day.", rm: "Is din ka koi record nahi.", ur: "اس دن کا کوئی ریکارڈ نہیں۔" },
  hra_changed_times: { en: "changed", rm: "dafa badla gaya", ur: "بار تبدیل ہوا" },

  // ---- Mahine ka khulasa ----
  hra_working_days: { en: "Working days", rm: "Kaam ke din", ur: "کام کے دن" },
  hra_present_days: { en: "Present", rm: "Hazir", ur: "حاضر" },
  hra_absent_days: { en: "Absent", rm: "Ghair hazir", ur: "غیر حاضر" },
  hra_missing_days: { en: "Not recorded", rm: "Record nahi", ur: "ریکارڈ نہیں" },
  hra_leave_days: { en: "Leave", rm: "Chhutti", ur: "چھٹی" },
  hra_late_days: { en: "Late", rm: "Der se aaya", ur: "دیر سے آیا" },
  hra_open_items: { en: "Open requests", rm: "Khuli darkhwastein", ur: "کھلی درخواستیں" },
  hra_finalized: { en: "Month closed", rm: "Mahina band", ur: "مہینہ بند" },
  hra_not_finalized: { en: "Month open", rm: "Mahina khula", ur: "مہینہ کھلا" },
  hra_payroll_warning: {
    en: "Attendance not finalized — salary made on this month will change later.",
    rm: "Hazri abhi band nahi hui — is mahine par bani tankhwah baad mein badal sakti hai.",
    ur: "حاضری ابھی بند نہیں ہوئی — اس مہینے پر بنی تنخواہ بعد میں بدل سکتی ہے۔",
  },

  // ---- Darkhwast ----
  hra_request_fix: { en: "Request a correction", rm: "Theek karwane ki darkhwast", ur: "درستی کی درخواست" },
  hra_set_by_hand: { en: "Set attendance", rm: "Hazri lagayein", ur: "حاضری لگائیں" },
  hra_reason: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  hra_reason_hint: {
    en: "Mandatory. This reason stays on the record for good.",
    rm: "Lazmi. Ye wajah hamesha record par rehti hai.",
    ur: "لازمی۔ یہ وجہ ہمیشہ ریکارڈ پر رہتی ہے۔",
  },
  hra_manager_comment: { en: "Your comment", rm: "Aap ka comment", ur: "آپ کا تبصرہ" },
  hra_approve: { en: "Approve", rm: "Manzoor", ur: "منظور" },
  hra_reject: { en: "Reject", rm: "Na-manzoor", ur: "نامنظور" },
  hra_send_back: { en: "Send back", rm: "Wapas bhejein", ur: "واپس بھیجیں" },
  hra_send_request: { en: "Send request", rm: "Darkhwast bhejein", ur: "درخواست بھیجیں" },
  hra_withdraw: { en: "Withdraw", rm: "Wapas lein", ur: "واپس لیں" },
  hra_history: { en: "What changed", rm: "Kya kya badla", ur: "کیا کیا بدلا" },
  hra_history_empty: { en: "Never changed by hand.", rm: "Kabhi haath se nahi badla.", ur: "کبھی ہاتھ سے نہیں بدلا۔" },
  hra_was: { en: "was", rm: "pehle", ur: "پہلے" },
  hra_now: { en: "now", rm: "ab", ur: "اب" },

  // ---- Board ----
  hrb_title: { en: "Attendance Board", rm: "Hazri Board", ur: "حاضری بورڈ" },
  hrb_subtitle: {
    en: "Where the team stands today, and what needs attention.",
    rm: "Aaj team kahan khaRi hai, aur kis cheez par dhyan chahiye.",
    ur: "آج ٹیم کہاں کھڑی ہے، اور کس چیز پر توجہ چاہیے۔",
  },
  hrb_needs_attention: { en: "Needs attention", rm: "Dhyan chahiye", ur: "توجہ درکار" },
  hrb_live_feed: { en: "Today, person by person", rm: "Aaj, ek ek banda", ur: "آج، ایک ایک فرد" },
  hrb_pending_corrections: { en: "Correction requests", rm: "Hazri ki darkhwastein", ur: "حاضری کی درخواستیں" },
  hrb_pending_leaves: { en: "Leave requests", rm: "Chhutti ki darkhwastein", ur: "چھٹی کی درخواستیں" },
  hrb_missing_punch_7d: { en: "Missing check-out (7 days)", rm: "Check-out nahi hua (7 din)", ur: "چیک آؤٹ نہیں ہوا (7 دن)" },
  hrb_missing_7d: { en: "Not recorded (7 days)", rm: "Record hi nahi (7 din)", ur: "ریکارڈ ہی نہیں (7 دن)" },
  hrb_nobody: { en: "Nobody to show.", rm: "Dikhane ko koi nahi.", ur: "دکھانے کو کوئی نہیں۔" },

  // ---- Team ----
  hrt_title: { en: "Team & Reporting", rm: "Team aur Reporting", ur: "ٹیم اور رپورٹنگ" },
  hrt_subtitle: {
    en: "Who reports to whom. A manager can only decide for their own reporting team — this page is what decides that.",
    rm: "Kaun kis ko report karta hai. Manager sirf apni is team ka faisla kar sakta hai — wo faisla isi safhe se banta hai.",
    ur: "کون کس کو رپورٹ کرتا ہے۔ منیجر صرف اپنی اسی ٹیم کا فیصلہ کر سکتا ہے — وہ فیصلہ اسی صفحے سے بنتا ہے۔",
  },
  hrt_reports_to: { en: "Reports to", rm: "Afsar", ur: "افسر" },
  hrt_no_manager: { en: "No manager — goes to HR", rm: "Koi afsar nahi — HR ke paas", ur: "کوئی افسر نہیں — ایچ آر کے پاس" },
  hrt_department: { en: "Department", rm: "Shoba", ur: "شعبہ" },
  hrt_branch: { en: "Branch", rm: "Branch", ur: "برانچ" },
  hrt_designation: { en: "Designation", rm: "Ohda", ur: "عہدہ" },
  hrt_employment: { en: "Employment", rm: "Mulazmat", ur: "ملازمت" },
  hrt_direct_reports: { en: "Direct reports", rm: "Seedhe matehat", ur: "براہِ راست ماتحت" },
  hrt_save: { en: "Save", rm: "Mehfooz karein", ur: "محفوظ کریں" },
  hrt_no_reporting_yet: {
    en: "Nobody has a manager set yet. Until then every request goes to HR.",
    rm: "Abhi kisi ka afsar darj nahi. Tab tak har darkhwast HR ke paas jati hai.",
    ur: "ابھی کسی کا افسر درج نہیں۔ تب تک ہر درخواست ایچ آر کے پاس جاتی ہے۔",
  },

  // ---- Settings ----
  hrs_title: { en: "Holidays & Shift", rm: "Chhutti aur Waqt", ur: "چھٹیاں اور اوقات" },
  hrs_subtitle: {
    en: "The rules the calendar reads where there is no record.",
    rm: "Wo qawaid jin se calendar wahan jawab banata hai jahan record nahi.",
    ur: "وہ قواعد جن سے کیلنڈر وہاں جواب بناتا ہے جہاں ریکارڈ نہیں۔",
  },
  hrs_shift: { en: "Working hours", rm: "Kaam ka waqt", ur: "کام کا وقت" },
  hrs_shift_start: { en: "From", rm: "Se", ur: "سے" },
  hrs_shift_end: { en: "To", rm: "Tak", ur: "تک" },
  hrs_grace: { en: "Late grace (minutes)", rm: "Der ki chhoot (minute)", ur: "تاخیر کی چھوٹ (منٹ)" },
  hrs_weekly_off: { en: "Weekly off", rm: "Hafte ki chhutti", ur: "ہفتہ وار چھٹی" },
  hrs_holidays: { en: "Declared holidays", rm: "Elaan shuda chhutti", ur: "اعلان شدہ چھٹیاں" },
  hrs_add_holiday: { en: "Add holiday", rm: "Chhutti daalein", ur: "چھٹی شامل کریں" },
  hrs_holiday_name: { en: "What holiday", rm: "Kaun si chhutti", ur: "کون سی چھٹی" },
  hrs_month_lock: { en: "Month close", rm: "Mahina band karna", ur: "مہینہ بند کرنا" },
  hrs_lock_month: { en: "Close this month", rm: "Ye mahina band karein", ur: "یہ مہینہ بند کریں" },
  hrs_reopen: { en: "Reopen", rm: "Dobara kholein", ur: "دوبارہ کھولیں" },
  hrs_reopen_reason: { en: "Why reopen", rm: "Kholne ki wajah", ur: "کھولنے کی وجہ" },
  hrs_lock_note: {
    en: "Salary is made only on a closed month. Closing while requests are open is what hides the very thing this lock exists for.",
    rm: "Tankhwah sirf band mahine par banti hai. Khuli darkhwastein rehte hue band karna wohi cheez chhupa deta hai jis ke liye ye taala hai.",
    ur: "تنخواہ صرف بند مہینے پر بنتی ہے۔ کھلی درخواستیں رہتے ہوئے بند کرنا وہی چیز چھپا دیتا ہے جس کے لیے یہ تالا ہے۔",
  },

  // ---- Din ke naam ----
  hra_dow_0: { en: "Sun", rm: "Itwaar", ur: "اتوار" },
  hra_dow_1: { en: "Mon", rm: "Peer", ur: "پیر" },
  hra_dow_2: { en: "Tue", rm: "Mangal", ur: "منگل" },
  hra_dow_3: { en: "Wed", rm: "Budh", ur: "بدھ" },
  hra_dow_4: { en: "Thu", rm: "Jumeraat", ur: "جمعرات" },
  hra_dow_5: { en: "Fri", rm: "Juma", ur: "جمعہ" },
  hra_dow_6: { en: "Sat", rm: "Hafta", ur: "ہفتہ" },

  // ---- Aazmaishi muddat (probation) ----
  hrp_title: { en: "Probation & Confirmation", rm: "Aazmaishi Muddat", ur: "آزمائشی مدت" },
  hrp_subtitle: {
    en: "A new person is on probation until someone decides. Nobody becomes permanent by the date passing.",
    rm: "Naya banda tab tak aazmaish par hai jab tak koi faisla na kare. Sirf tareekh guzarne se koi pakka nahi hota.",
    ur: "نیا فرد اُس وقت تک آزمائش پر ہے جب تک کوئی فیصلہ نہ کرے۔ صرف تاریخ گزرنے سے کوئی مستقل نہیں ہوتا۔",
  },
  hrp_status: { en: "Status", rm: "Haalat", ur: "حالت" },
  hrp_probation: { en: "On probation", rm: "Aazmaish par", ur: "آزمائش پر" },
  hrp_confirmed: { en: "Permanent", rm: "Pakka", ur: "مستقل" },
  hrp_ended: { en: "Left", rm: "Alag ho gaya", ur: "الگ ہو گیا" },
  hrp_start: { en: "Probation from", rm: "Aazmaish kab se", ur: "آزمائش کب سے" },
  hrp_end: { en: "Probation until", rm: "Aazmaish kab tak", ur: "آزمائش کب تک" },
  hrp_months: { en: "Months", rm: "Mahine", ur: "مہینے" },
  hrp_days_left: { en: "Days left", rm: "Din baqi", ur: "دن باقی" },
  hrp_overdue: { en: "Decision overdue", rm: "Faisla baqi hai", ur: "فیصلہ باقی ہے" },
  hrp_overdue_note: {
    en: "The date has passed and no decision was made. This person is still on probation — they did not become permanent on their own.",
    rm: "Tareekh guzar chuki hai aur faisla nahi hua. Ye banda abhi bhi aazmaish par hai — khud ba khud pakka nahi hua.",
    ur: "تاریخ گزر چکی ہے اور فیصلہ نہیں ہوا۔ یہ فرد اب بھی آزمائش پر ہے — خود بخود مستقل نہیں ہوا۔",
  },
  hrp_start_probation: { en: "Start probation", rm: "Aazmaish shuru karein", ur: "آزمائش شروع کریں" },
  hrp_extend: { en: "Extend", rm: "Muddat baRhayein", ur: "مدت بڑھائیں" },
  hrp_confirm: { en: "Make permanent", rm: "Pakka karein", ur: "مستقل کریں" },
  hrp_end_service: { en: "End service", rm: "Alag karein", ur: "الگ کریں" },
  hrp_extend_months: { en: "Extend by (months)", rm: "Kitne mahine baRhayein", ur: "کتنے مہینے بڑھائیں" },
  hrp_extensions: { en: "Extended", rm: "Dafa baRhai gayi", ur: "بار بڑھائی گئی" },
  hrp_cannot_extend: {
    en: "Cannot be extended further — decide now: permanent, or end.",
    rm: "Ab aur nahi baRh sakti — ab faisla karein: pakka, ya alag.",
    ur: "اب مزید نہیں بڑھ سکتی — اب فیصلہ کریں: مستقل، یا الگ۔",
  },
  hrp_nobody_due: { en: "Nobody's probation is ending.", rm: "Kisi ki aazmaish khatam nahi ho rahi.", ur: "کسی کی آزمائش ختم نہیں ہو رہی۔" },
  hrp_history: { en: "Past decisions", rm: "Pichhle faisle", ur: "پچھلے فیصلے" },

  // ---- Chhutti ka hisaab ----
  hrl_balance: { en: "Annual leave", rm: "Saalana chhutti", ur: "سالانہ چھٹی" },
  hrl_entitled: { en: "Allowed", rm: "Banti hai", ur: "بنتی ہے" },
  hrl_used: { en: "Taken", rm: "Li gayi", ur: "لی گئی" },
  hrl_remaining: { en: "Left", rm: "Baqi", ur: "باقی" },
  hrl_no_entitlement: {
    en: "No annual leave during probation. Unpaid leave can still be requested.",
    rm: "Aazmaish ke dauran saalana chhutti nahi milti. Bila tankhwah chhutti phir bhi maangi ja sakti hai.",
    ur: "آزمائش کے دوران سالانہ چھٹی نہیں ملتی۔ بلا تنخواہ چھٹی پھر بھی مانگی جا سکتی ہے۔",
  },
  hrl_policy: { en: "Leave policy", rm: "Chhutti ka usool", ur: "چھٹی کا اصول" },
  hrl_annual_days: { en: "Annual leave (days per year)", rm: "Saalana chhutti (din)", ur: "سالانہ چھٹی (دن)" },
  hrl_probation_months: { en: "Probation (months)", rm: "Aazmaishi muddat (mahine)", ur: "آزمائشی مدت (مہینے)" },
  hrl_probation_max: { en: "Maximum probation (months)", rm: "Kul hadd (mahine)", ur: "کل حد (مہینے)" },
  hrl_probation_paid: { en: "Paid leave during probation", rm: "Aazmaish par tankhwah wali chhutti", ur: "آزمائش پر تنخواہ والی چھٹی" },
  hrl_prorate: { en: "First year counted by month", rm: "Pehla saal mahinon ke hisaab se", ur: "پہلا سال مہینوں کے حساب سے" },
  hrl_carry: { en: "Carry forward (days)", rm: "Agle saal le jayein (din)", ur: "اگلے سال لے جائیں (دن)" },
  hrl_expires: { en: "Expires 31 December", rm: "31 December ko khatam", ur: "31 دسمبر کو ختم" },
  hrl_expiring_note: {
    en: "Unused annual leave does not carry over — it expires on 31 December.",
    rm: "Bachi hui saalana chhutti agle saal nahi jati — 31 December ko khatam ho jati hai.",
    ur: "بچی ہوئی سالانہ چھٹی اگلے سال نہیں جاتی — 31 دسمبر کو ختم ہو جاتی ہے۔",
  },
  hrl_expiring_soon: {
    en: "days left to use it",
    rm: "din baqi hain — us se pehle le lein",
    ur: "دن باقی ہیں — اُس سے پہلے لے لیں",
  },
  hrl_expiring_people: { en: "Leave expiring", rm: "Chhutti khatam ho rahi", ur: "چھٹی ختم ہو رہی" },
} as const;
