/**
 * Wo components jo kai safhon par ek sath nazar aate hain.
 *
 * Sidebar, khata, reports, batwa, table ke neeche wale button -- ye kisi
 * ek safhe ke nahi. Isi liye in ka tarjuma alag rakha gaya hai: jab ye
 * har safhe par hain, to in mein ek lafz ka farq har safhe par nazar
 * aata hai.
 *
 * DO CHEEZEIN JAAN BOOJH KAR YAHAN NAHI HAIN:
 *
 * 1. urdu-agreement-template.tsx -- kiraye ka qanooni muahida. Wo poora
 *    Urdu mein likha hai aur usay teen zabanon ke switch mein daalna
 *    ghalat hoga: English mode mein aadha angrezi muahida banta, jo
 *    qanooni tor par bekar hai. Muahida ek hi zaban mein rehta hai.
 *
 * 2. art-logo.tsx -- wahan "Al Rana Traders" logo ka aria-label hai,
 *    nazar aane wala matn nahi. Logo ka wordmark hota hai; usay har
 *    zaban mein badal dena nishan ko hi badal dena hai.
 *
 * Jo lafz commonDict mein pehle se the (Raqam, Baqi, Tareekh, Phone,
 * Qism, Tafseel) aur jo doosri fehriston mein (Customer, Loading...,
 * All Branches, AR, Al Rana Traders) un ke liye naya key nahi banaya.
 */
export const sharedDict = {
  // ---- Tasveer aur file ----
  sh_preview: { en: "Preview", rm: "Jhalak", ur: "جھلک" },
  sh_remove_image: { en: "Remove image", rm: "Tasveer hatayein", ur: "تصویر ہٹائیں" },
  sh_remove_file: { en: "Remove file", rm: "File hatayein", ur: "فائل ہٹائیں" },
  sh_file: { en: "File", rm: "File", ur: "فائل" },
  sh_attachment: { en: "attachment", rm: "sath lagi file", ur: "ساتھ لگی فائل" },
  sh_payment_slip: { en: "Payment Slip (image or PDF)", rm: "Adaigi ki parchi (tasveer ya PDF)", ur: "ادائیگی کی پرچی (تصویر یا PDF)" },
  sh_no_voice: { en: "Voice input not supported in this browser", rm: "Is browser mein awaz se likhna nahi chalta", ur: "اس براؤزر میں آواز سے لکھنا نہیں چلتا" },

  // ---- Sidebar aur upar ki patti ----
  sh_logout: { en: "Log out", rm: "Bahar niklein", ur: "باہر نکلیں" },
  sh_open_menu: { en: "Open menu", rm: "Menu kholein", ur: "مینو کھولیں" },
  sh_close_menu: { en: "Close menu", rm: "Menu band karein", ur: "مینو بند کریں" },
  sh_toggle_dark: { en: "Toggle dark mode", rm: "Andhera mode badlein", ur: "اندھیرا موڈ بدلیں" },

  // ---- Khata ----
  sh_no_customers: { en: "No customers found.", rm: "Koi gahak nahi mila.", ur: "کوئی گاہک نہیں ملا۔" },
  sh_no_transactions: { en: "No transactions yet.", rm: "Abhi koi lein dein nahi.", ur: "ابھی کوئی لین دین نہیں۔" },
  sh_note: { en: "Note", rm: "Note", ur: "نوٹ" },
  sh_note_optional: { en: "Note (optional)", rm: "Note (marzi se)", ur: "نوٹ (مرضی سے)" },
  sh_payment_amount: { en: "Payment Amount", rm: "Adaigi ki raqam", ur: "ادائیگی کی رقم" },
  sh_record_payment: { en: "Record Payment", rm: "Adaigi darj karein", ur: "ادائیگی درج کریں" },
  sh_search_customer: { en: "Search customer...", rm: "Gahak dhoondein...", ur: "گاہک تلاش کریں..." },
  sh_select_customer: {
    en: "Select a customer from the list to record a payment.",
    rm: "Adaigi darj karne ke liye fehrist mein se gahak chunein.",
    ur: "ادائیگی درج کرنے کے لیے فہرست میں سے گاہک چنیں۔",
  },
  sh_eg_cash_received: { en: "e.g. Cash received", rm: "misal: naqad mila", ur: "مثال: نقد ملا" },

  // ---- Paighaam ----
  sh_ask_question: { en: "Ask a question...", rm: "Kuch poochhein...", ur: "کچھ پوچھیں..." },
  sh_no_messages: { en: "No messages yet.", rm: "Koi paighaam nahi hai abhi.", ur: "کوئی پیغام نہیں ہے ابھی۔" },
  sh_no_contact: { en: "No contact found.", rm: "Koi banda nahi mila.", ur: "کوئی بندہ نہیں ملا۔" },
  sh_send_all_staff: { en: "Send to All Staff", rm: "Sab staff ko bhejein", ur: "سب عملے کو بھیجیں" },
  sh_one_msg_all: { en: "One message, goes to everyone", rm: "Ek paighaam, sab ko chala jayega", ur: "ایک پیغام، سب کو چلا جائے گا" },
  sh_write_announcement: { en: "Write the announcement...", rm: "Elaan likhein...", ur: "اعلان لکھیں..." },
  sh_all_staff_note: {
    en: "This message goes to every active staff member (Sales, Finance, Warehouse, HR, etc).",
    rm: "Ye paighaam har chalte hue staff (Sales, Finance, Warehouse, HR waghera) ko chala jayega.",
    ur: "یہ پیغام ہر چلتے ہوئے عملے (Sales، Finance، Warehouse، HR وغیرہ) کو چلا جائے گا۔",
  },

  // ---- Reports ----
  sh_daily_sales: { en: "Daily Sales Summary", rm: "Roz ki bikri ka khulasa", ur: "روز کی بکری کا خلاصہ" },
  sh_reports_sub: { en: "Daily sales summary and Khata aging", rm: "Roz ki bikri ka khulasa aur khate ki umar", ur: "روز کی بکری کا خلاصہ اور کھاتے کی عمر" },
  sh_total_sales: { en: "Total Sales", rm: "Kul bikri", ur: "کل بکری" },
  sh_cash_received: { en: "Cash Received", rm: "Naqad mila", ur: "نقد ملا" },
  sh_khata_credit: { en: "Khata (Credit)", rm: "Khata (udhaar)", ur: "کھاتہ (ادھار)" },
  sh_est_profit: { en: "Est. Profit", rm: "Andaze ka nafa", ur: "اندازے کا نفع" },
  sh_transactions: { en: "Transactions", rm: "Lein dein", ur: "لین دین" },
  sh_khata_aging: { en: "Khata Aging Report", rm: "Khate ki umar ki report", ur: "کھاتے کی عمر کی رپورٹ" },
  sh_days_outstanding: { en: "Days Outstanding", rm: "Kitne din se baqi", ur: "کتنے دن سے باقی" },
  sh_no_khata: { en: "No outstanding Khata balances.", rm: "Khate mein kuch baqi nahi.", ur: "کھاتے میں کچھ باقی نہیں۔" },

  // ---- Batwa ----
  sh_available_balance: { en: "Available Balance", rm: "Jo abhi mil sakta hai", ur: "جو ابھی مل سکتا ہے" },
  sh_held_pending: { en: "Held (Pending)", rm: "Roka hua", ur: "روکا ہوا" },
  sh_txn_history: { en: "Transaction History", rm: "Lein dein ka record", ur: "لین دین کا ریکارڈ" },

  // ---- Charts aur table ----
  sh_no_requests: { en: "No requests yet", rm: "Abhi koi darkhwast nahi", ur: "ابھی کوئی درخواست نہیں" },
  sh_activity_trend: { en: "Activity Trend", rm: "Kaam ka rukh", ur: "کام کا رخ" },
  sh_requests_by_service: { en: "Requests by Service", rm: "Service ke hisaab se darkhwastein", ur: "سروس کے حساب سے درخواستیں" },
  sh_next: { en: "Next", rm: "Agla", ur: "اگلا" },
  sh_previous: { en: "Previous", rm: "Pichhla", ur: "پچھلا" },

  // ---- Dastakhat ----
  sh_clear: { en: "Clear", rm: "Saaf karein", ur: "صاف کریں" },
  sh_sign_here: { en: "Sign here with your finger or mouse", rm: "Ungli ya mouse se yahan sign karein", ur: "انگلی یا ماؤس سے یہاں دستخط کریں" },
};
