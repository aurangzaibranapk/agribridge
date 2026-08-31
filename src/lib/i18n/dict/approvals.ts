/**
 * Approval Inbox, udhaar ki darkhwastein, aur shakh ka store credit.
 *
 * APPROVAL INBOX PAR CHAAR HAALATEIN ALAG HAIN, aur ye farq hi us safhe
 * ka kaam hai:
 *
 *   "Faisle ke intezar mein"  -- aam qatar.
 *   "Nishan lage huye"        -- kisi bande ne khud nishan lagaya.
 *   "System ne kuch ajeeb pakRa" -- nizam ne khud shak zahir kiya.
 *   "Faisla ho chuka"         -- kaam khatam.
 *
 * Doosri aur teesri ek jaisi lagti hain magar bilkul alag hain: ek
 * insaan ka shak hai, doosra hisaab ka. Dono ko "flagged" likh dena us
 * bande se ye baat chhupa deta hai ke shak kis ne kiya -- aur wohi baat
 * tay karti hai ke pehle kis ko poochha jaye.
 *
 * "Staff ne kya bheja (asal saboot)" aur "AI ne kya samjha" jaan boojh
 * kar do alag khane hain. AI ki samajh saboot NAHI hai. Do jagah rakhne
 * se manager ko har dafa yaad rehta hai ke asal cheez tasveer hai, us
 * ke neeche likha hua andaza nahi.
 */
export const approvalsDict = {
  // ---- Approval Inbox ----
  sb_inbox: { en: "Approval Inbox", rm: "Faislon ka box", ur: "فیصلوں کا باکس" },
  sb_awaiting: { en: "Awaiting decision", rm: "Faisle ke intezar mein", ur: "فیصلے کے انتظار میں" },
  sb_flagged_by_person: { en: "Flagged by someone", rm: "Kisi ne nishan lagaya", ur: "کسی نے نشان لگایا" },
  sb_flagged_by_system: { en: "System found something odd", rm: "Nizam ne kuch ajeeb pakRa", ur: "نظام نے کچھ عجیب پکڑا" },
  sb_decided: { en: "Decided", rm: "Faisla ho chuka", ur: "فیصلہ ہو چکا" },
  sb_none_yet: { en: "No submissions yet.", rm: "Abhi tak koi cheez nahi aayi.", ur: "ابھی تک کوئی چیز نہیں آئی۔" },
  sb_number: { en: "Number", rm: "Number", ur: "نمبر" },
  sb_kind: { en: "Kind", rm: "Qism", ur: "قسم" },
  sb_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  sb_state: { en: "State", rm: "Haalat", ur: "حالت" },
  sb_not_found: { en: "Submission not found.", rm: "Cheez nahi mili.", ur: "چیز نہیں ملی۔" },
  sb_system_caught: { en: "The system caught these things:", rm: "Nizam ne ye baatein pakRi hain:", ur: "نظام نے یہ باتیں پکڑی ہیں:" },
  sb_what_staff_sent: { en: "What the staff sent (the actual evidence)", rm: "Bande ne kya bheja (asal saboot)", ur: "بندے نے کیا بھیجا (اصل ثبوت)" },
  sb_no_photo: { en: "No photo was sent.", rm: "Koi tasveer nahi bheji gayi.", ur: "کوئی تصویر نہیں بھیجی گئی۔" },
  sb_what_ai_understood: { en: "What the AI understood", rm: "AI ne kya samjha", ur: "AI نے کیا سمجھا" },
  sb_manager_only: {
    en: "Only this branch's manager or an admin can decide on this.",
    rm: "Is par faisla is shakh ka manager ya admin hi kar sakta hai.",
    ur: "اس پر فیصلہ اس شاخ کا منیجر یا ایڈمن ہی کر سکتا ہے۔",
  },
  sb_arrived: { en: "Arrived", rm: "Aayi", ur: "آئی" },
  sb_your_decision: { en: "Your decision", rm: "Aap ka faisla", ur: "آپ کا فیصلہ" },
  sb_decision_eg: {
    en: "e.g. checked the receipt against the meter reading, everything matches.",
    rm: "Misal: raseed aur meter ka reading mila kar dekh liya, sab durust hai.",
    ur: "مثال: رسید اور میٹر کا ریڈنگ ملا کر دیکھ لیا، سب درست ہے۔",
  },
  sb_bill_goes_where: {
    en: "This bill goes to the same place as the company's other bills.",
    rm: "Ye bill wahin jayega jahan company ke baqi bill jate hain.",
    ur: "یہ بل وہیں جائے گا جہاں کمپنی کے باقی بل جاتے ہیں۔",
  },
  sb_no_khata: { en: "No account has been created", rm: "Koi khata bana hua nahi", ur: "کوئی کھاتہ بنا ہوا نہیں" },
  sb_fix_amount: { en: "If the amount needs correcting (optional)", rm: "Raqam theek karni ho to (marzi ki baat)", ur: "رقم ٹھیک کرنی ہو تو (مرضی کی بات)" },
  sb_leave_blank: { en: "Leave it blank and the original amount stands.", rm: "Khali chhoR dein to asal raqam hi rahegi.", ur: "خالی چھوڑ دیں تو اصل رقم ہی رہے گی۔" },

  // ---- Udhaar ki darkhwast ----
  crq_title: { en: "Credit Requests", rm: "Udhaar ki darkhwastein", ur: "ادھار کی درخواستیں" },
  crq_none_yet: { en: "No credit requests yet", rm: "Abhi koi darkhwast nahi", ur: "ابھی کوئی درخواست نہیں" },
  crq_base: { en: "Base", rm: "Buniyadi", ur: "بنیادی" },
  crq_approve: { en: "Approve Credit Request", rm: "Udhaar ki darkhwast manzoor karein", ur: "ادھار کی درخواست منظور کریں" },
  crq_margin: { en: "Credit Margin %", rm: "Udhaar par munafa %", ur: "ادھار پر منافع %" },
  crq_comments_visible: {
    en: "Comments / conditions (the farmer will see these)",
    rm: "Baat ya shartein (kisan ko nazar aayengi)",
    ur: "بات یا شرطیں (کسان کو نظر آئیں گی)",
  },
  crq_reject: { en: "Reject Credit Request", rm: "Udhaar ki darkhwast rad karein", ur: "ادھار کی درخواست رد کریں" },
  crq_reason_optional: { en: "Reason (optional)", rm: "Wajah (marzi se)", ur: "وجہ (مرضی سے)" },

  // ---- Kisan ka udhaar (safha) ----
  fcl_title: { en: "Farmer Credit Line", rm: "Kisan ke udhaar ki hadd", ur: "کسان کے ادھار کی حد" },
  fcl_farmers_on_credit: { en: "Farmers on Credit", rm: "Jin kisanon par udhaar hai", ur: "جن کسانوں پر ادھار ہے" },
  fcl_select_farmer: { en: "Select a farmer.", rm: "Kisan chunein.", ur: "کسان چنیں۔" },
  fcl_statement_title: { en: "Farmer Credit Statement", rm: "Kisan ke udhaar ka gosharah", ur: "کسان کے ادھار کا گوشوارہ" },
  fcl_issued_plus: { en: "Issued (+)", rm: "Diya (+)", ur: "دیا (+)" },
  fcl_paid_minus: { en: "Paid (−)", rm: "Wapas aaya (−)", ur: "واپس آیا (−)" },
  fcl_total_issued: { en: "Total Credit Issued", rm: "Kul udhaar diya", ur: "کل ادھار دیا" },
  fcl_computer_statement: {
    en: "This is a computer-generated statement from the AgriBridge system.",
    rm: "Ye gosharah AgriBridge ke nizam se computer par bana hai.",
    ur: "یہ گوشوارہ ایگری برج کے نظام سے کمپیوٹر پر بنا ہے۔",
  },

  // ---- Shakh ka store credit ----
  bc_title: { en: "Store Credit & Advance Wallet", rm: "Dukan ka udhaar aur advance batwa", ur: "دکان کا ادھار اور ایڈوانس بٹوہ" },
  bc_advance_paid: { en: "Advance Paid", rm: "Advance diya", ur: "ایڈوانس دیا" },
  bc_available_credit: { en: "Available Credit", rm: "Kitna udhaar baqi hai", ur: "کتنا ادھار باقی ہے" },
  bc_no_active_branch: { en: "No active branch.", rm: "Koi chalti hui shakh nahi.", ur: "کوئی چلتی ہوئی شاخ نہیں۔" },
  bc_advance_note: {
    en: "This amount goes into the shop's wallet; future orders are settled from it.",
    rm: "Ye raqam is dukan ke batwe mein jama ho jayegi, aage ke order isi se katenge.",
    ur: "یہ رقم اس دکان کے بٹوے میں جمع ہو جائے گی، آگے کے آرڈر اسی سے کٹیں گے۔",
  },
  bc_save_advance: { en: "Save Advance", rm: "Advance mehfooz karein", ur: "ایڈوانس محفوظ کریں" },
} as const;
