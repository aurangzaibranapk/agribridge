/**
 * Khata, Cash Book aur Finance Queue ke alfaz.
 *
 * Istilahat glossary.ts se: naqad, bank, khata, gahak, supplier, raqam,
 * kul, baqi, lagat, adaigi, raseed, bill, tareekh, wajah, ledger,
 * cash book, mehfooz karein, mansookh, band karein.
 *
 * Teen lafz yahan jaan boojh kar tay kiye ja rahe hain, kyunke inhein
 * ghalat tarjuma karne se hisaab ka matlab hi badal jata hai:
 *
 *   Credit   Aamad     آمد     (khate mein paisa AAYA)
 *   Debit    Kharch    خرچ     (khate se paisa GAYA)
 *   Balance  Baqi      باقی
 *
 * "Credit" ko "udhaar" likhna sab se bara khatra tha -- cash book mein
 * credit ka matlab udhaar nahi, aamad hai. Khata (udhaar) alag cheez
 * hai aur us ka apna lafz "khata" hi rehta hai.
 *
 * Transfer ka tarjuma nahi kiya gaya: bank ki parchi par bhi "transfer"
 * hi likha hota hai.
 */
export const financeDict = {
  // --- Cash Book ---
  fn_title: { en: "Finance / Cash Book", rm: "Khata / Cash Book", ur: "کھاتہ / کیش بک" },
  fn_subtitle: {
    en: "One cash book across every account — income, expenses and transfers",
    rm: "Har khate ki ek hi cash book — aamad, kharch aur transfer",
    ur: "ہر کھاتے کی ایک ہی کیش بک — آمد، خرچ اور ٹرانسفر",
  },
  fn_no_accounts: { en: "No accounts yet", rm: "Abhi koi khata nahi", ur: "ابھی کوئی کھاتہ نہیں" },
  fn_no_accounts_note: {
    en: "At least one account is needed to start (say 'Cash' or a bank's name). Make one from the button here, then reload the page.",
    rm: "Shuru karne ke liye kam az kam ek khata chahiye (jaise 'Naqad' ya kisi bank ka naam). Yahin button se bana kar safha dobara khol lein.",
    ur: "شروع کرنے کے لیے کم از کم ایک کھاتہ چاہیے (جیسے 'نقد' یا کسی بینک کا نام)۔ یہیں بٹن سے بنا کر صفحہ دوبارہ کھول لیں۔",
  },
  fn_total_balance: { en: "Total Balance (All Accounts)", rm: "Kul Baqi (Sab Khate)", ur: "کل باقی (سب کھاتے)" },
  fn_new_account: { en: "New Account", rm: "Naya Khata", ur: "نیا کھاتہ" },
  fn_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  fn_description: { en: "Description", rm: "Tafseel", ur: "تفصیل" },
  fn_credit: { en: "Credit", rm: "Aamad", ur: "آمد" },
  fn_debit: { en: "Debit", rm: "Kharch", ur: "خرچ" },
  fn_balance: { en: "Balance", rm: "Baqi", ur: "باقی" },
  fn_no_txns: { en: "No transactions yet.", rm: "Abhi koi entry nahi.", ur: "ابھی کوئی انٹری نہیں۔" },

  // --- Aamad / kharch ka form ---
  fn_add_income_expense: { en: "Add Income/Expense", rm: "Aamad/Kharch Daalein", ur: "آمد/خرچ ڈالیں" },
  fn_recorded: { en: "Recorded.", rm: "Darj ho gaya.", ur: "درج ہو گیا۔" },
  fn_income_credit: { en: "Income (Credit)", rm: "Aamad (khate mein aaya)", ur: "آمد (کھاتے میں آیا)" },
  fn_expense_debit: { en: "Expense (Debit)", rm: "Kharch (khate se gaya)", ur: "خرچ (کھاتے سے گیا)" },
  fn_category_eg: {
    en: "Category (e.g. Rent, Salary, Utility Bill)",
    rm: "Qism (jaise Kiraya, Tankhwah, Bijli ka Bill)",
    ur: "قسم (جیسے کرایہ، تنخواہ، بجلی کا بل)",
  },
  fn_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  fn_amount_rs: { en: "Amount (Rs)", rm: "Raqam (Rs)", ur: "رقم (روپے)" },
  fn_notes_optional: { en: "Notes (optional)", rm: "Notes (marzi se)", ur: "نوٹس (مرضی سے)" },
  fn_add_txn: { en: "Add Transaction", rm: "Entry Daalein", ur: "انٹری ڈالیں" },
  fn_saving: { en: "Saving...", rm: "Mehfooz ho raha hai...", ur: "محفوظ ہو رہا ہے..." },

  // --- Transfer ---
  fn_transfer_title: { en: "Transfer Between Accounts", rm: "Ek Khate se Doosre Mein", ur: "ایک کھاتے سے دوسرے میں" },
  fn_transferred: { en: "Transferred.", rm: "Transfer ho gaya.", ur: "ٹرانسفر ہو گیا۔" },
  fn_from_account: { en: "From account", rm: "Kis khate se", ur: "کس کھاتے سے" },
  fn_to_account: { en: "To account", rm: "Kis khate mein", ur: "کس کھاتے میں" },
  fn_transfer: { en: "Transfer", rm: "Transfer Karein", ur: "ٹرانسفر کریں" },
  fn_transferring: { en: "Transferring...", rm: "Transfer ho raha hai...", ur: "ٹرانسفر ہو رہا ہے..." },

  // --- Naya khata ---
  fn_account_name_eg: { en: "Account name (e.g. Meezan Bank)", rm: "Khate ka naam (jaise Meezan Bank)", ur: "کھاتے کا نام (جیسے میزان بینک)" },
  fn_cash: { en: "Cash", rm: "Naqad", ur: "نقد" },
  fn_bank: { en: "Bank", rm: "Bank", ur: "بینک" },
  fn_mobile_wallet: { en: "Mobile Wallet", rm: "Mobile Wallet", ur: "موبائل والیٹ" },
  fn_other: { en: "Other", rm: "Doosra", ur: "دوسرا" },
  fn_opening_balance: { en: "Opening Balance", rm: "Shuruaati Baqi", ur: "شروعاتی باقی" },
  fn_cancel: { en: "Cancel", rm: "Mansookh", ur: "منسوخ" },
  fn_create: { en: "Create", rm: "Banayein", ur: "بنائیں" },
  fn_creating: { en: "Creating...", rm: "Ban raha hai...", ur: "بن رہا ہے..." },

  // --- Finance Queue ---
  fq_title: { en: "Finance Queue", rm: "Finance ki Qatar", ur: "فنانس کی قطار" },
  fq_subtitle: {
    en: "Wherever money is involved — all in one place, to verify or approve",
    rm: "Jahan bhi paisa lagta hai — sab ek jagah, dekhne aur manzoori ke liye",
    ur: "جہاں بھی پیسہ لگتا ہے — سب ایک جگہ، دیکھنے اور منظوری کے لیے",
  },
  fq_total_pending: { en: "Total Pending Action", rm: "Kul Kaam Baqi", ur: "کل کام باقی" },
  fq_order_payments: { en: "AgriBridge Order Payments", rm: "AgriBridge Order ki Adaigi", ur: "ایگری برج آرڈر کی ادائیگی" },
  fq_no_payment_pending: { en: "No payment is pending.", rm: "Koi adaigi baqi nahi hai.", ur: "کوئی ادائیگی باقی نہیں ہے۔" },
  fq_expense_approvals: { en: "Company Expense Approvals", rm: "Company Kharch ki Manzoori", ur: "کمپنی خرچ کی منظوری" },
  fq_no_expense_pending: { en: "No expense is pending.", rm: "Koi kharch baqi nahi hai.", ur: "کوئی خرچ باقی نہیں ہے۔" },
  fq_shop_bills: { en: "Shop Bills Pending", rm: "Dukan ke Bill Baqi", ur: "دکان کے بل باقی" },
  fq_no_bill_pending: { en: "No bill is pending.", rm: "Koi bill baqi nahi hai.", ur: "کوئی بل باقی نہیں ہے۔" },

  // --- Supplier ki adaigi ki darkhwast ---
  fq_supplier_requests: { en: "Supplier Payment Requests", rm: "Supplier ki Adaigi ki Darkhwastein", ur: "سپلائر کی ادائیگی کی درخواستیں" },
  fq_request_payment: { en: "Request a Payment", rm: "Adaigi ki Darkhwast Dein", ur: "ادائیگی کی درخواست دیں" },
  fq_no_request_pending: { en: "No payment request is pending.", rm: "Koi darkhwast baqi nahi hai.", ur: "کوئی درخواست باقی نہیں ہے۔" },
  fq_view_slip: { en: "View slip", rm: "Slip Dekhein", ur: "سلپ دیکھیں" },
  fq_reject_reason_label: { en: "Reason for rejection", rm: "Rad karne ki wajah", ur: "رد کرنے کی وجہ" },
  fq_approve: { en: "Approve", rm: "Manzoor Karein", ur: "منظور کریں" },
  fq_reject: { en: "Reject", rm: "Rad Karein", ur: "رد کریں" },
  fq_reject_request_title: { en: "Reject the Payment Request", rm: "Adaigi ki Darkhwast Rad Karein", ur: "ادائیگی کی درخواست رد کریں" },
  fq_reject_reason_ph: { en: "Reason for rejecting", rm: "Rad karne ki wajah", ur: "رد کرنے کی وجہ" },
  fq_confirm_reject: { en: "Confirm Reject", rm: "Rad Karna Pakka Karein", ur: "رد کرنا پکا کریں" },
  fq_request_title: { en: "Request a Payment", rm: "Adaigi ki Darkhwast", ur: "ادائیگی کی درخواست" },
  fq_request_note: {
    en: "This request becomes a payment only after Admin/Owner approval.",
    rm: "Ye darkhwast Admin/Owner ki manzoori ke baad hi adaigi banti hai.",
    ur: "یہ درخواست ایڈمن/مالک کی منظوری کے بعد ہی ادائیگی بنتی ہے۔",
  },
  fq_pick_supplier: { en: "- pick a supplier -", rm: "- Supplier chunein -", ur: "- سپلائر منتخب کریں -" },
  fq_bank_transfer: { en: "Bank Transfer", rm: "Bank Transfer", ur: "بینک ٹرانسفر" },
  fq_online_payment: { en: "Online Payment", rm: "Online Adaigi", ur: "آن لائن ادائیگی" },
  fq_cheque: { en: "Cheque", rm: "Cheque", ur: "چیک" },
  fq_upload_slip: { en: "Upload slip (optional)", rm: "Slip lagayein (marzi se)", ur: "سلپ لگائیں (مرضی سے)" },
  fq_send_request: { en: "Send Request", rm: "Darkhwast Bhejein", ur: "درخواست بھیجیں" },
} as const;
