/**
 * Milk Handover Certificate ke alfaz.
 * Kaghaz ke khane (FAT, LR, SNF, Gross Vol) angrezi rehte hain —
 * wahi certificate jise staff bharta hai.
 */
export const milkHandoverDict = {
  mh_title: { en: "Milk Handover Certificate", rm: "Milk Handover Certificate", ur: "دودھ حوالگی سرٹیفکیٹ" },
  mh_subtitle: {
    en: "MCC to the company — one certificate per branch, date and shift. Litres are what you type.",
    rm: "MCC se company tak — ek branch, ek tareekh, ek shift. Litre wahi jo aap likhein.",
    ur: "ایم سی سی سے کمپنی تک۔ لیٹر وہی جو آپ لکھیں۔",
  },
  mh_new: { en: "New certificate", rm: "Naya certificate", ur: "نیا سرٹیفکیٹ" },
  mh_list: { en: "Saved certificates", rm: "Mehfooz certificate", ur: "محفوظ سرٹیفکیٹ" },
  mh_none: { en: "No certificate yet.", rm: "Abhi koi certificate nahi.", ur: "ابھی کوئی سرٹیفکیٹ نہیں۔" },
  mh_save: { en: "Save certificate", rm: "Certificate mehfooz karein", ur: "سرٹیفکیٹ محفوظ کریں" },
  mh_saving: { en: "Saving...", rm: "Mehfooz ho raha hai...", ur: "محفوظ ہو رہا ہے..." },
  mh_print: { en: "Print / share", rm: "Print / share", ur: "پرنٹ" },
  mh_saved: { en: "Certificate saved.", rm: "Certificate mehfooz ho gaya.", ur: "سرٹیفکیٹ محفوظ ہو گیا۔" },
  mh_branch: { en: "Branch", rm: "Branch", ur: "شاخ" },
  mh_shift: { en: "Shift", rm: "Shift", ur: "شفٹ" },
  mh_morning: { en: "Morning", rm: "Subah", ur: "صبح" },
  mh_evening: { en: "Evening", rm: "Shaam", ur: "شام" },
  mh_pending: { en: "Not yet", rm: "Abhi nahi", ur: "ابھی نہیں" },
  mh_yes: { en: "YES", rm: "YES", ur: "ہاں" },
  mh_no: { en: "NO", rm: "NO", ur: "نہیں" },
  mh_add_row: { en: "Add chiller row", rm: "Chiller ki qatar barhayein", ur: "قطار بڑھائیں" },
  mh_sign_me: { en: "Use my name", rm: "Mera naam", ur: "میرا نام" },
  mh_backfill: {
    en: "Older dates stay empty until someone types them. Nothing is filled in for you.",
    rm: "Purani tareekh khali rehti hai jab tak koi khud na likhe. Kuch pehle se bhara nahi jata.",
    ur: "پرانی تاریخ خالی رہتی ہے جب تک کوئی خود نہ لکھے۔",
  },
  mh_locked: {
    en: "The company receipt is already recorded. Litres stay as they are. You can still set accept or reject and the signatures.",
    rm: "Company ki raseed darj ho chuki hai. Miqdar ab nahi badlegi. Faisla aur dastakhat ab bhi likh sakte hain.",
    ur: "کمپنی کی رسید درج ہے۔ مقدار نہیں بدلے گی۔ فیصلہ اور دستخط اب بھی۔",
  },
  mh_spec_warn: {
    en: "Below the minimum spec — this is a warning. Save is not blocked.",
    rm: "Min spec se neeche — ye nishan hai. Save nahi rukta.",
    ur: "کم از کم معیار سے نیچے — یہ نشان ہے۔ محفوظ رکتا نہیں۔",
  },
  mh_suggest: {
    en: "13-style estimate from the rate settings. It is not saved until you press Write.",
    rm: "Rate settings se andaza. Mehfooz tab hota hai jab Likhein dabayein.",
    ur: "اندازہ۔ محفوظ تب جب لکھیں دبائیں۔",
  },
  mh_write: { en: "Write", rm: "Likhein", ur: "لکھیں" },
  mh_open: { en: "Open", rm: "Kholen", ur: "کھولیں" },
  mh_lines: { en: "Chiller rows", rm: "Chiller qatarein", ur: "چلر قطاریں" },
  mh_dispatch: { en: "Company receipt (litres)", rm: "Company ki raseed (litre)", ur: "کمپنی کی رسید" },
  mh_no_lines: {
    en: "This dispatch has no chiller rows yet. The litres already recorded stay until you save rows — then the gross total replaces them.",
    rm: "Is rawangi par abhi chiller ki qatarein nahi. Jo litre pehle likha tha wo tab badlega jab aap qatarein mehfooz karein — naya gross un ka jama hoga.",
    ur: "ابھی چلر کی قطاریں نہیں۔ مقدار تب بدلے گی جب قطاریں محفوظ کریں۔",
  },
} as const;
