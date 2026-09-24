/**
 * Trust & Performance -- saye wala safha (P3 tak sirf Master Admin).
 *
 * EK LAFZ PAR KHAAS DHYAN: "Tay hi nahi hui" / "N/A".
 *
 * Ye SIFAR NAHI HAI. Jahan kisi factor ka hisaab banta hi nahi (misal:
 * jis bande ne kabhi udhaar liya hi nahi, us ka "waqt par wapsi" ka
 * hisaab), wahan sifar likhna jhoot hota -- sifar kehta hai "dekh liya,
 * bura tha". Is liye teenon zabanon mein wo jumla "hisaab bana hi nahi"
 * kehta hai, "sifar" nahi.
 */
export const trustDict = {
  tr_title: { en: "Trust & Performance Intelligence", rm: "Trust & Performance Intelligence", ur: "ٹرسٹ اینڈ پرفارمنس انٹیلیجنس" },
  tr_master_only: {
    en: "This page is for the Master Admin only.",
    rm: "Ye safha sirf Master Admin ke liye hai.",
    ur: "یہ صفحہ صرف ماسٹر ایڈمن کے لیے ہے۔",
  },
  tr_not_shown: {
    en: "These numbers are not shown to anyone yet.",
    rm: "Ye adad abhi kisi ko nahi dikhaye jate.",
    ur: "یہ اعداد ابھی کسی کو نہیں دکھائے جاتے۔",
  },
  tr_name: { en: "Name", rm: "Naam", ur: "نام" },
  tr_score: { en: "Score", rm: "Score", ur: "اسکور" },
  tr_evidence: { en: "Evidence", rm: "Saboot", ur: "ثبوت" },
  tr_flags: { en: "Flags", rm: "Nishan", ur: "نشان" },
  tr_credit_record: { en: "Credit history", rm: "Udhaar ka record", ur: "ادھار کا ریکارڈ" },
  tr_last_evidence: { en: "Last evidence", rm: "Aakhri saboot", ur: "آخری ثبوت" },
  tr_none_of_kind: { en: "No record of this kind", rm: "Is kism ka koi record nahi", ur: "اِس قسم کا کوئی ریکارڈ نہیں" },

  // ---- Ek bande ka safha ----
  tr_back_to_list: { en: "Back to the list", rm: "Wapas fehrist par", ur: "واپس فہرست پر" },
  tr_no_score_yet: { en: "No score has been built for this person yet.", rm: "Is bande ka koi hisaab abhi bana hi nahi.", ur: "اِس بندے کا کوئی حساب ابھی بنا ہی نہیں۔" },
  tr_where_from: { en: "Where this number came from", rm: "Ye number bana kahan se", ur: "یہ نمبر بنا کہاں سے" },
  tr_factor: { en: "Factor", rm: "Factor", ur: "عنصر" },
  tr_weight: { en: "Weight", rm: "Wazan", ur: "وزن" },
  tr_result: { en: "Result", rm: "Nateeja", ur: "نتیجہ" },
  tr_state: { en: "State", rm: "Halat", ur: "حالت" },
  tr_coverage: { en: "Evidence Coverage", rm: "Saboot ka daaira", ur: "ثبوت کا دائرہ" },
  tr_engine: { en: "Engine", rm: "Engine", ur: "انجن" },
  tr_risk_flag: { en: "Risk flag", rm: "Khatre ka nishan", ur: "خطرے کا نشان" },
  tr_reason: { en: "Reason", rm: "Wajah", ur: "وجہ" },

  // "Sifar" aur "hisaab bana hi nahi" ek cheez nahi -- upar wali wajah.
  tr_na: { en: "N/A", rm: "N/A", ur: "لاگو نہیں" },
  tr_not_established: { en: "Never established", rm: "Tay hi nahi hui", ur: "طے ہی نہیں ہوئی" },

  tr_events_title: { en: "Events — and the paper behind each one", rm: "Waqiat — aur har ek ka asal kaghaz", ur: "واقعات — اور ہر ایک کا اصل کاغذ" },
  tr_voided_title: {
    en: "Voided events — out of the score, but not erased from the record",
    rm: "Batil ho chuke waqiat — hisaab mein nahi, magar tareekh se mite bhi nahi",
    ur: "باطل ہو چکے واقعات — حساب میں نہیں، مگر تاریخ سے مٹے بھی نہیں",
  },
  tr_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  tr_what_of: { en: "What of", rm: "Kis cheez ki", ur: "کس چیز کی" },
  tr_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  tr_number: { en: "Number", rm: "Number", ur: "نمبر" },
  tr_came: { en: "In", rm: "Aaya", ur: "آیا" },
  tr_obligations: { en: "Obligations", rm: "Zimmedariyan", ur: "ذمہ داریاں" },
  tr_past_ledger: { en: "Past record", rm: "Guzra hua hisaab", ur: "گزرا ہوا حساب" },
  tr_credit_allowed: { en: "Credit eligibility", rm: "Udhaar ki ijazat", ur: "ادھار کی اجازت" },
  tr_time_safe: { en: "safe from time", rm: "waqt se mehfooz", ur: "وقت سے محفوظ" },

  // Ye jumla sab se ahem hai -- malik ka apna faisla, aur safhe par
  // likha rehna chahiye taake koi is adad ko manzoori na samjhe.
  tr_human_decides: {
    en: "The decision is a person's — this system does not approve anything.",
    rm: "Faisla insaan ka hai — ye nizam manzoori nahi deta.",
    ur: "فیصلہ انسان کا ہے — یہ نظام منظوری نہیں دیتا۔",
  },
} as const;
