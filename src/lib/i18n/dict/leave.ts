/**
 * Chhutti ke alfaz.
 *
 * Istilahat glossary.ts se: staff, manager, hazri, tareekh, wajah, din.
 *
 * Ek jumla yahan khaas hai: "manzoori se hazri khud badal jayegi". Wo
 * safhe par hai, kisi madad ke safhe par nahi -- manzoori dene wale ko
 * usi lamhe maloom hona chahiye ke us ke dabane ka asar kahan tak jata
 * hai.
 */
export const leaveDict = {
  lv_title: { en: "Leave", rm: "Chhutti", ur: "چھٹی" },
  lv_subtitle: {
    en: "Ask for leave, and decide on others' requests",
    rm: "Chhutti maangein, aur doosron ki darkhwaston par faisla karein",
    ur: "چھٹی مانگیں، اور دوسروں کی درخواستوں پر فیصلہ کریں",
  },
  lv_attendance_note: {
    en: "Once leave is approved, attendance for those days is written as leave on its own. Cancelling it removes only those rows — a real attendance record is never touched.",
    rm: "Chhutti manzoor hote hi un dinon ki hazri khud 'chhutti' likh di jati hai. Mansookh karne par sirf wohi qatarein hatti hain — asli hazri ko koi haath nahi lagata.",
    ur: "چھٹی منظور ہوتے ہی ان دنوں کی حاضری خود 'چھٹی' لکھ دی جاتی ہے۔ منسوخ کرنے پر صرف وہی قطاریں ہٹتی ہیں — اصلی حاضری کو کوئی ہاتھ نہیں لگاتا۔",
  },

  lv_my_leave: { en: "My leave", rm: "Meri chhutti", ur: "میری چھٹی" },
  lv_ask: { en: "Ask for leave", rm: "Chhutti maangein", ur: "چھٹی مانگیں" },
  lv_from: { en: "From", rm: "Kis din se", ur: "کس دن سے" },
  lv_to: { en: "To", rm: "Kis din tak", ur: "کس دن تک" },
  lv_to_hint: { en: "Leave empty for one day", rm: "Ek din ki ho to khali chhoR dein", ur: "ایک دن کی ہو تو خالی چھوڑ دیں" },
  lv_type: { en: "Type", rm: "Qism", ur: "قسم" },
  lv_type_casual: { en: "Casual", rm: "Aam", ur: "عام" },
  lv_type_sick: { en: "Sick", rm: "Bimari", ur: "بیماری" },
  lv_type_annual: { en: "Annual", rm: "Salana", ur: "سالانہ" },
  lv_type_unpaid: { en: "Unpaid", rm: "Bina tankhwah", ur: "بغیر تنخواہ" },
  lv_reason: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  lv_reason_hint: {
    en: "This reason stays on the record",
    rm: "Ye wajah record par rehti hai",
    ur: "یہ وجہ ریکارڈ پر رہتی ہے",
  },
  lv_days: { en: "days", rm: "din", ur: "دن" },
  lv_send: { en: "Send request", rm: "Darkhwast bhejein", ur: "درخواست بھیجیں" },
  lv_sending: { en: "Sending...", rm: "Ja rahi hai...", ur: "جا رہی ہے..." },
  lv_no_leave_yet: { en: "No leave requested yet.", rm: "Abhi tak koi chhutti nahi maangi.", ur: "ابھی تک کوئی چھٹی نہیں مانگی۔" },

  lv_awaiting_decision: { en: "Awaiting your decision", rm: "Aap ke faisle ka intezar", ur: "آپ کے فیصلے کا انتظار" },
  lv_none_pending: { en: "Nothing awaiting a decision.", rm: "Kisi faisle ka intezar nahi.", ur: "کسی فیصلے کا انتظار نہیں۔" },
  lv_approve: { en: "Approve", rm: "Manzoor", ur: "منظور" },
  lv_reject: { en: "Reject", rm: "Na-manzoor", ur: "نامنظور" },
  lv_decision_note: { en: "Note", rm: "Baat", ur: "بات" },
  lv_decision_note_hint: {
    en: "Required when rejecting",
    rm: "Na-manzoor karte waqt likhna zaroori hai",
    ur: "نامنظور کرتے وقت لکھنا ضروری ہے",
  },

  lv_pending: { en: "Pending", rm: "Faisla baqi", ur: "فیصلہ باقی" },
  lv_approved: { en: "Approved", rm: "Manzoor", ur: "منظور" },
  lv_rejected: { en: "Rejected", rm: "Na-manzoor", ur: "نامنظور" },
  lv_cancelled: { en: "Cancelled", rm: "Mansookh", ur: "منسوخ" },
} as const;
