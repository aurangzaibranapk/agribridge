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
  fq_order_payments: { en: "AgriBridge Order Payments", rm: "AgriBridge Order ki Adaigi", ur: "ایگری بریج آرڈر کی ادائیگی" },
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

  // ---- Maali gosharay (298): Trial Balance, P&L, Balance Sheet, Journal ----
  fs_title: { en: "Financial statements", rm: "Maali gosharay", ur: "مالی گوشوارے" },
  fs_desc: {
    en: "Built from the same journal every module already posts into. Nothing is counted twice here.",
    rm: "Wohi journal jis mein har hissa pehle se likhta hai. Yahan koi adad dobara nahi gina jata.",
    ur: "وہی جرنل جس میں ہر حصہ پہلے سے لکھتا ہے۔ یہاں کوئی عدد دوبارہ نہیں گنا جاتا۔",
  },
  fs_only_finance: {
    en: "These statements are for the Owner, Admin, Manager or Finance.",
    rm: "Ye gosharay Owner, Admin, Manager ya Finance ke liye hain.",
    ur: "یہ گوشوارے مالک، ایڈمن، مینیجر یا فنانس کے لیے ہیں۔",
  },
  fs_trial: { en: "Trial Balance", rm: "Trial Balance", ur: "ٹرائل بیلنس" },
  fs_pnl: { en: "Profit & Loss", rm: "Nafa Nuqsan", ur: "نفع نقصان" },
  fs_bs: { en: "Balance Sheet", rm: "Balance Sheet", ur: "بیلنس شیٹ" },
  fs_journal: { en: "General Journal", rm: "Poora Journal", ur: "پورا جرنل" },
  fs_from: { en: "From", rm: "Se", ur: "سے" },
  fs_to: { en: "To", rm: "Tak", ur: "تک" },
  fs_as_of: { en: "As on", rm: "Is tareekh tak", ur: "اس تاریخ تک" },
  fs_show: { en: "Show", rm: "Dikhayein", ur: "دکھائیں" },
  fs_account: { en: "Account", rm: "Khata", ur: "کھاتہ" },
  fs_debit: { en: "Debit", rm: "Debit", ur: "ڈیبٹ" },
  fs_credit: { en: "Credit", rm: "Credit", ur: "کریڈٹ" },
  fs_balance: { en: "Balance", rm: "Baqi", ur: "باقی" },
  fs_balance_note: {
    en: "This balance is only for the dates you picked (debit minus credit, on the account's own side). For the full balance from the very beginning, click the account name — its ledger shows the opening balance too.",
    rm: "Ye baqi SIRF chuni hui tareekhon ka hai (debit minus credit, khate ke apne rukh par). Shuru se ab tak ka poora baqi dekhna ho to khate ke naam par click karein — us ke ledger mein shuru ka baqi bhi hota hai.",
    ur: "یہ باقی صرف چنی ہوئی تاریخوں کا ہے۔ شروع سے اب تک کا پورا باقی دیکھنے کے لیے کھاتے کے نام پر کلک کریں۔",
  },
  fs_side: { en: "Dr/Cr", rm: "Rukh", ur: "رخ" },
  fs_total: { en: "Total", rm: "Kul", ur: "کل" },
  fs_no_entries: { en: "No entries in this period.", rm: "Is arse mein koi entry nahi.", ur: "اس عرصے میں کوئی اندراج نہیں۔" },
  fs_failed: { en: "Could not be worked out:", rm: "Hisaab nahi ho saka:", ur: "حساب نہیں ہو سکا:" },
  fs_equal: {
    en: "Debit and credit are equal — the ledger balances.",
    rm: "Debit aur credit barabar hain — ledger theek hai.",
    ur: "ڈیبٹ اور کریڈٹ برابر ہیں — لیجر ٹھیک ہے۔",
  },
  fs_not_equal: {
    en: "Debit and credit are NOT equal. This is a real problem, not a display issue. Difference:",
    rm: "Debit aur credit barabar NAHI. Ye asal masla hai, dikhane ki ghalti nahi. Farq:",
    ur: "ڈیبٹ اور کریڈٹ برابر نہیں۔ یہ اصل مسئلہ ہے، دکھانے کی غلطی نہیں۔ فرق:",
  },
  fs_income: { en: "Income", rm: "Aamdani", ur: "آمدنی" },
  fs_cogs: { en: "Cost of goods", rm: "Maal ki lagat", ur: "مال کی لاگت" },
  fs_expense: { en: "Expenses", rm: "Kharche", ur: "خرچے" },
  fs_gross: { en: "Gross profit", rm: "Maal par bacha", ur: "مال پر بچا" },
  fs_net: { en: "Net profit / loss", rm: "Saaf nafa / nuqsan", ur: "صاف نفع / نقصان" },
  fs_assets: { en: "Assets", rm: "Jo hamara hai", ur: "جو ہمارا ہے" },
  fs_liabilities: { en: "Liabilities", rm: "Jo dena hai", ur: "جو دینا ہے" },
  fs_equity: { en: "Owner capital", rm: "Malik ka sarmaya", ur: "مالک کا سرمایہ" },
  fs_liab_equity: { en: "Liabilities + capital", rm: "Dena + sarmaya", ur: "دینا + سرمایہ" },
  fs_year_profit: { en: "This year profit / loss", rm: "Is saal ka nafa / nuqsan", ur: "اس سال کا نفع / نقصان" },
  fs_bs_not_equal: {
    en: "The two sides do not match. Difference:",
    rm: "Dono taraf barabar nahi. Farq:",
    ur: "دونوں طرف برابر نہیں۔ فرق:",
  },
  fs_reversal: { en: "reversal", rm: "ulti gayi", ur: "الٹی گئی" },
  fs_backdated: { en: "back-dated", rm: "purani tareekh", ur: "پرانی تاریخ" },

  // ---- Haath se journal entry ----
  je_title: { en: "Journal entry", rm: "Journal entry", ur: "جرنل انٹری" },
  je_desc: {
    en: "For the few things that have no screen of their own — owner capital, bank profit, opening balances.",
    rm: "Sirf un cheezon ke liye jin ka koi safha hai hi nahi — malik ka sarmaya, bank ka munafa, opening balance.",
    ur: "صرف ان چیزوں کے لیے جن کا کوئی صفحہ ہے ہی نہیں — مالک کا سرمایہ، بینک کا منافع، اوپننگ بیلنس۔",
  },
  je_only_finance: {
    en: "Manual entries are for the Owner, Admin or Finance.",
    rm: "Haath se entry Owner, Admin ya Finance kar sakta hai.",
    ur: "ہاتھ سے اندراج مالک، ایڈمن یا فنانس کر سکتا ہے۔",
  },
  je_note: {
    en: "Every sale, purchase, milk and machinery entry is already posted by its own screen. Do not repeat those here — that would count the same money twice.",
    rm: "Har bikri, kharid, doodh aur machinery ki entry apne safhe se KHUD banti hai. Unhen yahan dobara na likhein — wo wahi raqam do dafa gin lena hai.",
    ur: "ہر بکری، خرید، دودھ اور مشینری کی انٹری اپنے صفحے سے خود بنتی ہے۔ انہیں یہاں دوبارہ نہ لکھیں — وہ وہی رقم دو دفعہ گن لینا ہے۔",
  },
  je_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  je_description: { en: "What is this entry for?", rm: "Ye entry kis liye hai?", ur: "یہ اندراج کس لیے ہے؟" },
  je_description_eg: {
    en: "e.g. Owner put Rs 200,000 into the business",
    rm: "misal: malik ne karobar mein Rs 200,000 daale",
    ur: "مثال: مالک نے کاروبار میں 200,000 روپے ڈالے",
  },
  je_backdated_warn: {
    en: "This entry is dated in the past. That is allowed, but it will be marked on the audit trail — write why.",
    rm: "Ye entry guzri hui tareekh ki hai. Jaiz hai, magar audit par nishaan ke sath aayegi — wajah likhein.",
    ur: "یہ اندراج گزری ہوئی تاریخ کا ہے۔ جائز ہے، مگر آڈٹ پر نشان کے ساتھ آئے گا — وجہ لکھیں۔",
  },
  je_backdate_reason: {
    en: "Why is it dated back? (at least ten letters)",
    rm: "Purani tareekh kyun? (kam az kam das harf)",
    ur: "پرانی تاریخ کیوں؟ (کم از کم دس حرف)",
  },
  je_account: { en: "Account", rm: "Khata", ur: "کھاتہ" },
  je_pick_account: { en: "- pick -", rm: "- chunein -", ur: "- چنیں -" },
  je_memo: { en: "Note", rm: "Note", ur: "نوٹ" },
  je_debit: { en: "Debit", rm: "Debit", ur: "ڈیبٹ" },
  je_credit: { en: "Credit", rm: "Credit", ur: "کریڈٹ" },
  je_total: { en: "Total", rm: "Kul", ur: "کل" },
  je_add_line: { en: "Add a line", rm: "Ek qatar aur", ur: "ایک قطار اور" },
  je_equal: { en: "Debit = Credit", rm: "Debit = Credit", ur: "ڈیبٹ = کریڈٹ" },
  je_not_equal: { en: "Not equal — difference", rm: "Barabar nahi — farq", ur: "برابر نہیں — فرق" },
  je_post: { en: "Post this entry", rm: "Entry darj karein", ur: "اندراج درج کریں" },
  je_done: { en: "Entry posted", rm: "Entry darj ho gayi", ur: "اندراج درج ہو گیا" },
  je_another: { en: "Another entry", rm: "Ek aur entry", ur: "ایک اور اندراج" },

  // ---- Finance ka markaz ----
  fc_title: { en: "Financial Accounting", rm: "Maali Hisaab Kitab", ur: "مالی حساب کتاب" },
  fc_desc: {
    en: "One place for the whole of finance. What is not built yet is written down, not hidden.",
    rm: "Poore finance ka ek markaz. Jo abhi nahi bana, wo chhupaya nahi — saaf likha hai.",
    ur: "پورے فنانس کا ایک مرکز۔ جو ابھی نہیں بنا، وہ چھپایا نہیں — صاف لکھا ہے۔",
  },
  fc_only_finance: {
    en: "This page is for the Owner, Admin, Manager or Finance.",
    rm: "Ye safha Owner, Admin, Manager ya Finance ke liye hai.",
    ur: "یہ صفحہ مالک، ایڈمن، مینیجر یا فنانس کے لیے ہے۔",
  },
  fc_pending: { en: "Not built yet", rm: "Abhi nahi bana", ur: "ابھی نہیں بنا" },
  fc_g1: { en: "1. Finance", rm: "1. Finance", ur: "1. فنانس" },
  fc_g2: { en: "2. Payments & Receipts", rm: "2. Adaigi aur Wasooli", ur: "2. ادائیگی اور وصولی" },
  fc_g3: { en: "3. Finance System", rm: "3. Finance ka Nizam", ur: "3. فنانس کا نظام" },
  fc_g4: { en: "4. Fixed Assets", rm: "4. Mustaqil Asaasay", ur: "4. مستقل اثاثے" },
  fc_g5: { en: "5. Finance Reports", rm: "5. Maali Reports", ur: "5. مالی رپورٹس" },
  fc_jv: { en: "Journal entry", rm: "Journal entry", ur: "جرنل انٹری" },
  fc_jv_hint: {
    en: "only for what has no screen of its own",
    rm: "sirf un cheezon ke liye jin ka koi safha nahi",
    ur: "صرف ان چیزوں کے لیے جن کا کوئی صفحہ نہیں",
  },
  fc_cashbook: { en: "Cash book", rm: "Cash Book", ur: "کیش بک" },
  fc_bank_recon: { en: "Bank reconciliation", rm: "Bank se milaan", ur: "بینک سے ملان" },
  fc_daily_recon: { en: "Daily reconciliation", rm: "Roz ka milaan", ur: "روز کا ملان" },
  fc_reversal: { en: "Audit trail & reversal", rm: "Audit aur entry ulti karna", ur: "آڈٹ اور اندراج الٹا کرنا" },
  fc_reversal_hint: {
    en: "posted entries are never deleted — they are reversed",
    rm: "darj entry mitti nahi -- ulti jati hai",
    ur: "درج اندراج مٹتا نہیں — الٹا جاتا ہے",
  },
  fc_supplier_pay: { en: "Supplier bills & payments", rm: "Supplier ke bill aur dena", ur: "سپلائر کے بل اور دینا" },
  fc_customer_recover: { en: "Customer khata & recovery", rm: "Gahak ka khata aur wasooli", ur: "گاہک کا کھاتہ اور وصولی" },
  fc_cash_custody: { en: "Who is holding cash", rm: "Kis ke paas cash", ur: "کس کے پاس کیش" },
  fc_handover: { en: "Cash handover", rm: "Cash haath badalna", ur: "کیش ہاتھ بدلنا" },
  fc_handover_hint: {
    en: "funds issued and received between branch and staff",
    rm: "shaakh aur staff ke darmiyan paisa dena aur lena",
    ur: "شاخ اور عملے کے درمیان پیسہ دینا اور لینا",
  },
  fc_cash_close: { en: "Nightly cash count", rm: "Raat ki cash ginti", ur: "رات کی کیش گنتی" },
  fc_staff_khata: { en: "Staff khata", rm: "Staff khata", ur: "عملے کا کھاتہ" },
  fc_banks: { en: "Banks", rm: "Bank", ur: "بینک" },
  fc_pay_map: { en: "Payment method mapping", rm: "Adaigi ka tareeqa aur khata", ur: "ادائیگی کا طریقہ اور کھاتہ" },
  fc_pay_map_hint: {
    en: "which account each payment method lands in",
    rm: "kaunsa tareeqa kis khate mein jata hai",
    ur: "کونسا طریقہ کس کھاتے میں جاتا ہے",
  },
  fc_trial: { en: "Trial Balance", rm: "Trial Balance", ur: "ٹرائل بیلنس" },
  fc_pnl: { en: "Profit & Loss", rm: "Nafa Nuqsan", ur: "نفع نقصان" },
  fc_bs: { en: "Balance Sheet", rm: "Balance Sheet", ur: "بیلنس شیٹ" },
  fc_journal: { en: "General Journal", rm: "Poora Journal", ur: "پورا جرنل" },
  fc_finance_report: { en: "Finance report", rm: "Finance report", ur: "فنانس رپورٹ" },
  fc_shop_pnl: { en: "Shop-wise P&L", rm: "Dukan dukan ka nafa nuqsan", ur: "دکان دکان کا نفع نقصان" },
  fc_machinery_pnl: { en: "Machinery P&L", rm: "Machinery ka nafa nuqsan", ur: "مشینری کا نفع نقصان" },
  fc_credit_report: { en: "Credit report", rm: "Udhaar report", ur: "ادھار رپورٹ" },
  fc_audit_report: { en: "Audit centre (loss)", rm: "Audit center (nuqsan)", ur: "آڈٹ سینٹر (نقصان)" },
  fc_anomalies: { en: "Anomalies", rm: "Ajeeb baatein", ur: "عجیب باتیں" },
  fc_b_pdc: { en: "Post-dated cheques", rm: "Aage ki tareekh ke cheque", ur: "آگے کی تاریخ کے چیک" },
  fc_b_recurring: { en: "Recurring journals", rm: "Har mahine wali entry", ur: "ہر مہینے والی انٹری" },
  fc_b_budget: { en: "Budgets", rm: "Budget", ur: "بجٹ" },
  fc_b_closing: { en: "Period closing", rm: "Mahina/saal band karna", ur: "مہینہ/سال بند کرنا" },
  fc_b_costing: { en: "Item costing run", rm: "Cheez ki lagat ka hisaab", ur: "چیز کی لاگت کا حساب" },
  fc_b_advance: { en: "Employee advances", rm: "Staff ko advance", ur: "عملے کو ایڈوانس" },
  fc_b_loan: { en: "Employee loans", rm: "Staff ko qarza", ur: "عملے کو قرضہ" },
  fc_b_coa: { en: "Chart of Accounts screen", rm: "Khaton ka safha", ur: "کھاتوں کا صفحہ" },
  fc_b_terms: { en: "Payment terms", rm: "Adaigi ki shartein", ur: "ادائیگی کی شرطیں" },
  fc_b_cheque: { en: "Cheque books", rm: "Cheque book", ur: "چیک بک" },
  fc_b_periods: { en: "Accounting periods", rm: "Hisaab ke arse", ur: "حساب کے عرصے" },
  fc_b_merge: { en: "Account merge", rm: "Khate milana", ur: "کھاتے ملانا" },
  fc_b_assets: {
    en: "Whole module: register, categories, depreciation, disposal, revaluation, asset ledger",
    rm: "Poora hissa: register, qismein, depreciation, farokht, dobara qeemat, asset ledger",
    ur: "پورا حصہ: رجسٹر، قسمیں، ڈیپریسیشن، فروخت، دوبارہ قیمت، اثاثہ لیجر",
  },
  fc_b_cashflow: { en: "Cash flow statement", rm: "Cash flow", ur: "کیش فلو" },
  fc_b_working: { en: "Working capital", rm: "Chalta sarmaya", ur: "چلتا سرمایہ" },
  fc_b_receivable: { en: "Farmer / supplier / dealer receivable-payable", rm: "Kisan / supplier / dealer ka lena-dena", ur: "کسان / سپلائر / ڈیلر کا لینا دینا" },
  fc_b_branch_pnl: { en: "Branch-wise P&L", rm: "Shaakh shaakh ka nafa nuqsan", ur: "شاخ شاخ کا نفع نقصان" },
  fc_architecture: {
    en: "Every module posts its own accounting: a POS sale, a supplier GRN, milk, grain, machinery. The accountant's job here is to check, reconcile, correct and close — not to type the same entry a second time.",
    rm: "Har hissa apna hisaab KHUD likhta hai: POS ki bikri, supplier ka maal, doodh, grain, machinery. Yahan accountant ka kaam dekhna, milaana, durust karna aur band karna hai — wohi entry dobara likhna nahi.",
    ur: "ہر حصہ اپنا حساب خود لکھتا ہے: پی او ایس کی بکری، سپلائر کا مال، دودھ، گرین، مشینری۔ یہاں اکاؤنٹنٹ کا کام دیکھنا، ملانا، درست کرنا اور بند کرنا ہے — وہی اندراج دوبارہ لکھنا نہیں۔",
  },
} as const;
