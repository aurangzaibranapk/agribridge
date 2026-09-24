/**
 * Reports -- Profit & Loss aur Audit Center.
 *
 * DO LAFZ JAAN BOOJH KAR ANGREZI HI RAHE. "COGS" aur "Revenue" hisaab
 * ki istilahat hain jo accountant aur bank dono isi shakl mein parhte
 * hain; un ka tarjuma kar dena report ko bahar bhejne ke qabil nahi
 * rehne deta. Un ke saath us ka matlab Urdu mein likh diya gaya hai.
 *
 * AUDIT KE KHALI JUMLE. "Koi loss report nahi hai" ka matlab hai ke
 * DEKH liya aur kuch nahi mila -- ye us se bilkul alag baat hai ke
 * dekhne ka haq na ho. Rok wale jumle common.ts mein alag rakhe hain.
 */
export const reportsDict = {
  // ---- Profit & Loss ----
  rp_title: { en: "Multi-Level Profit & Loss", rm: "Har darje ka nafa nuqsan", ur: "ہر درجے کا نفع نقصان" },
  rp_subtitle: {
    en: "Track every rupee: business -> branch -> shop -> product",
    rm: "Har rupya peechha karein: karobar -> shakh -> dukan -> cheez",
    ur: "ہر روپیہ پیچھا کریں: کاروبار ← شاخ ← دکان ← چیز",
  },
  rp_qty_sold: { en: "Qty Sold", rm: "Kitna bika", ur: "کتنا بکا" },
  rp_revenue: { en: "Revenue", rm: "Aamdani", ur: "آمدنی" },
  rp_cogs: { en: "COGS", rm: "COGS (bike maal ki lagat)", ur: "COGS (بکے مال کی لاگت)" },
  rp_cogs_full: { en: "COGS (cost of goods sold)", rm: "COGS (bike maal ki lagat)", ur: "COGS (بکے مال کی لاگت)" },
  rp_no_sale_range: {
    en: "No sales for this shop in this date range.",
    rm: "Is arse mein is dukan ki koi bikri nahi hui.",
    ur: "اس عرصے میں اس دکان کی کوئی بکری نہیں ہوئی۔",
  },
  rp_each_shop: { en: "Each Shop in Full", rm: "Har dukan ka poora hisaab", ur: "ہر دکان کا پورا حساب" },
  rp_stock_in_period: { en: "Stock Received in Period", rm: "Is arse mein aaya stock", ur: "اس عرصے میں آیا اسٹاک" },
  rp_stock_now: { en: "Stock on Hand Now", rm: "Abhi maujood stock", ur: "ابھی موجود اسٹاک" },
  rp_sales: { en: "Sales", rm: "Bikri", ur: "بکری" },
  rp_sales_revenue: { en: "Sales (Revenue)", rm: "Bikri (aamdani)", ur: "بکری (آمدنی)" },
  rp_gross_profit: { en: "Gross Profit", rm: "Khaam nafa", ur: "خام نفع" },
  rp_expenses: { en: "Expenses", rm: "Kharche", ur: "خرچے" },
  rp_no_expense: {
    en: "No expenses recorded for this shop yet.",
    rm: "Is dukan ka abhi koi kharcha darj nahi hua.",
    ur: "اس دکان کا ابھی کوئی خرچہ درج نہیں ہوا۔",
  },
  rp_net_profit: { en: "Net Profit", rm: "Saaf nafa", ur: "صاف نفع" },
  rp_no_active_shop: {
    en: "No active shop in this branch.",
    rm: "Is shakh mein koi chalti hui dukan nahi.",
    ur: "اس شاخ میں کوئی چلتی ہوئی دکان نہیں۔",
  },
  rp_branch_combined: {
    en: "Whole Branch Combined (all shops + branch-wide)",
    rm: "Poori shakh ka mila hua hisaab (sab dukanein + shakh ke apne)",
    ur: "پوری شاخ کا ملا ہوا حساب (سب دکانیں + شاخ کے اپنے)",
  },
  rp_total_gross_shops: { en: "Total Gross Profit (all shops)", rm: "Kul khaam nafa (sab dukanein)", ur: "کل خام نفع (سب دکانیں)" },
  rp_total_stock_shops: { en: "Total Current Stock (all shops)", rm: "Kul maujooda stock (sab dukanein)", ur: "کل موجودہ اسٹاک (سب دکانیں)" },
  rp_shop_expenses: { en: "Shop-wise Expenses", rm: "Dukan dukan ke kharche", ur: "دکان دکان کے خرچے" },
  rp_branchwide_expenses: {
    en: "Branch-wide Expenses (not tied to one shop)",
    rm: "Shakh ke apne kharche (kisi ek dukan ke nahi)",
    ur: "شاخ کے اپنے خرچے (کسی ایک دکان کے نہیں)",
  },
  rp_net_branch: { en: "Net Profit (Whole Branch)", rm: "Saaf nafa (poori shakh)", ur: "صاف نفع (پوری شاخ)" },
  rp_total_gross_branches: { en: "Total Gross Profit (all branches)", rm: "Kul khaam nafa (sab shakhein)", ur: "کل خام نفع (سب شاخیں)" },
  rp_total_expenses_branches: { en: "Total Expenses (all branches)", rm: "Kul kharche (sab shakhein)", ur: "کل خرچے (سب شاخیں)" },
  rp_net_business: { en: "Net Profit (Whole Business)", rm: "Saaf nafa (poora karobar)", ur: "صاف نفع (پورا کاروبار)" },
  rp_no_branch: { en: "No branch found.", rm: "Koi shakh nahi mili.", ur: "کوئی شاخ نہیں ملی۔" },
  rp_all_branches: { en: "All Branches", rm: "Sab shakhein", ur: "سب شاخیں" },
  rp_whole_branch: { en: "Whole Branch (all shops)", rm: "Poori shakh (sab dukanein)", ur: "پوری شاخ (سب دکانیں)" },
  rp_from: { en: "From", rm: "Se", ur: "سے" },
  rp_to: { en: "To", rm: "Tak", ur: "تک" },

  // ---- Audit Center ----
  ra_title: { en: "Audit Center — Full Loss Picture", rm: "Audit Center -- poore nuqsan ka hisaab", ur: "آڈٹ سینٹر — پورے نقصان کا حساب" },
  ra_subtitle: {
    en: "Everything in one place: manual loss, expiry, slow-moving stock, GRN/delivery/transfer discrepancies",
    rm: "Sab kuch ek jagah: haath se darj nuqsan, khatam hoti cheezein, para hua stock, aur GRN/delivery/transfer ke farq",
    ur: "سب کچھ ایک جگہ: ہاتھ سے درج نقصان، ختم ہوتی چیزیں، پڑا ہوا اسٹاک، اور GRN/ڈیلیوری/ٹرانسفر کے فرق",
  },
  ra_verifiers_note_before: {
    en: "To manage verification permissions, see the",
    rm: "Tasdeeq ki ijazatein sanbhalne ke liye dekhein",
    ur: "تصدیق کی اجازتیں سنبھالنے کے لیے دیکھیں",
  },
  ra_total_exposure: {
    en: "Total Loss Exposure (approved + expired + GRN/transfer)",
    rm: "Kul nuqsan saamne (manzoor shuda + khatam shuda + GRN/transfer)",
    ur: "کل نقصان سامنے (منظور شدہ + ختم شدہ + GRN/ٹرانسفر)",
  },
  ra_pending_loss: { en: "Pending Loss Reports", rm: "Nuqsan ki nayi report", ur: "نقصان کی نئی رپورٹ" },
  ra_expiry_warning: { en: "Expiry Warning (within 30 days)", rm: "Tees din mein khatam ho rahi cheezein", ur: "تیس دن میں ختم ہو رہی چیزیں" },
  ra_slow_moving: { en: "Slow-Moving Stock (90+ days)", rm: "Nawwe din se para hua stock", ur: "نوے دن سے پڑا ہوا اسٹاک" },
  ra_view_photo: { en: "View Photo", rm: "Tasveer dekhein", ur: "تصویر دیکھیں" },
  ra_no_loss: { en: "No loss reports.", rm: "Nuqsan ki koi report nahi.", ur: "نقصان کی کوئی رپورٹ نہیں۔" },
  ra_no_expiry: { en: "Nothing is about to expire.", rm: "Koi cheez khatam hone wali nahi.", ur: "کوئی چیز ختم ہونے والی نہیں۔" },
  ra_batch: { en: "Batch", rm: "Batch", ur: "بیچ" },
  ra_grn_no: { en: "GRN No.", rm: "GRN number", ur: "GRN نمبر" },
  ra_transfer_no: { en: "Transfer No.", rm: "Transfer number", ur: "ٹرانسفر نمبر" },
  ra_short_qty: { en: "Short Qty", rm: "Kitna kam", ur: "کتنا کم" },
  ra_no_grn_diff: { en: "No GRN discrepancies.", rm: "GRN mein koi farq nahi.", ur: "GRN میں کوئی فرق نہیں۔" },
  ra_no_delivery_diff: { en: "No delivery discrepancies.", rm: "Delivery mein koi farq nahi.", ur: "ڈیلیوری میں کوئی فرق نہیں۔" },
  ra_no_transfer_diff: { en: "No stock transfer discrepancies.", rm: "Stock transfer mein koi farq nahi.", ur: "اسٹاک ٹرانسفر میں کوئی فرق نہیں۔" },
  ra_verifiers_page: { en: "Verifiers page", rm: "Tasdeeq karne walon ka safha", ur: "تصدیق کرنے والوں کا صفحہ" },
} as const;

/**
 * Baqi reportein aur audit ke chhote form.
 *
 * "KAM RATE PE NIKALNA HAI" wala raasta jaan boojh kar RAD karne se
 * alag hai. Rad karne ka matlab hai loss thi hi nahi; kam rate ka
 * matlab hai loss thi, magar maal poora zaya nahi hua -- kuch qeemat
 * abhi baqi hai. Dono ko ek button banate to godam ka asal nuqsan
 * kabhi theek na ginaa jata.
 *
 * SALES REPORT MEIN ADAIGI KE TEEN KHANE ALAG HAIN (naqad, khata/split,
 * bank/kisan card). Ye teen alag paise hain: pehla aaj haath mein hai,
 * doosra abhi aana hai, teesra bank se aata hai. Ek "kul bikri" un
 * teenon ka farq chhupa deti hai.
 */
export const reportsMoreDict = {
  // ---- Nuqsan ki report ----
  rl_report_loss: { en: "Report Loss", rm: "Nuqsan darj karein", ur: "نقصان درج کریں" },
  rl_how_much_qty: { en: "How much quantity", rm: "Kitni tadaad", ur: "کتنی تعداد" },
  rl_reason_ph: {
    en: "Write the reason (what happened, how it came to light)",
    rm: "Wajah likhein (kya hua, kaise pata chala)",
    ur: "وجہ لکھیں (کیا ہوا، کیسے پتہ چلا)",
  },
  rl_photo_recommended: { en: "Photo (optional, but recommended)", rm: "Tasveer (marzi se, magar behtar hai)", ur: "تصویر (مرضی سے، مگر بہتر ہے)" },
  rl_reject_loss: { en: "Reject Loss", rm: "Nuqsan rad karein", ur: "نقصان رد کریں" },
  rl_reject_reason_eg: {
    en: "Reason for rejection (e.g. there was no actual loss)",
    rm: "Rad karne ki wajah (jaise: asal mein nuqsan tha hi nahi)",
    ur: "رد کرنے کی وجہ (جیسے: اصل میں نقصان تھا ہی نہیں)",
  },
  rl_sell_lower_rate: { en: "Sell at a Lower Rate", rm: "Kam rate par nikalna hai", ur: "کم ریٹ پر نکالنا ہے" },
  rl_new_rate_per_unit: { en: "New (lower) Rate per Unit (Rs)", rm: "Naya (kam) rate fi unit (Rs)", ur: "نیا (کم) ریٹ فی یونٹ (روپے)" },
  rl_new_rate: { en: "New rate", rm: "Naya rate", ur: "نیا ریٹ" },
  rl_confirm_lower_rate: { en: "Confirm Lower Rate", rm: "Kam rate ki tasdeeq", ur: "کم ریٹ کی تصدیق" },

  // ---- Tasdeeq karne walon ki ijazat ----
  rv_permission_granted: { en: "Permission granted.", rm: "Ijazat de di gayi.", ur: "اجازت دے دی گئی۔" },
  rv_all_shops: { en: "All Shops (can verify any shop)", rm: "Sab dukanein (kisi bhi dukan ki tasdeeq kar sake)", ur: "سب دکانیں (کسی بھی دکان کی تصدیق کر سکے)" },
  rv_admin_only: { en: "Only Admin / Owner can see this page.", rm: "Ye safha sirf Admin ya Owner dekh sakta hai.", ur: "یہ صفحہ صرف ایڈمن یا مالک دیکھ سکتا ہے۔" },
  rv_title: { en: "Loss Verification Permissions", rm: "Nuqsan ki tasdeeq ki ijazatein", ur: "نقصان کی تصدیق کی اجازتیں" },
  rv_staff_member: { en: "Staff Member", rm: "Staff ka banda", ur: "عملے کا بندہ" },
  rv_none_yet: { en: "No permission has been granted yet.", rm: "Abhi tak kisi ko ijazat nahi di gayi.", ur: "ابھی تک کسی کو اجازت نہیں دی گئی۔" },

  // ---- Udhaar ki report ----
  rc_title: { en: "Credit Report", rm: "Udhaar ki report", ur: "ادھار کی رپورٹ" },
  rc_by_category: { en: "Credit by Category", rm: "Qism ke hisaab se udhaar", ur: "قسم کے حساب سے ادھار" },
  rc_none_yet: { en: "No credit given yet.", rm: "Abhi koi udhaar nahi diya gaya.", ur: "ابھی کوئی ادھار نہیں دیا گیا۔" },
  rc_no_overdue: { en: "No overdue pending requests.", rm: "Koi darkhwast waqt se ziyada nahi rukI.", ur: "کوئی درخواست وقت سے زیادہ نہیں رکی۔" },

  // ---- Finance report ----
  rf_title: { en: "Finance Report", rm: "Finance ki report", ur: "فنانس کی رپورٹ" },
  rf_total_income: { en: "Total Income", rm: "Kul aamdani", ur: "کل آمدنی" },
  rf_total_expense: { en: "Total Expense", rm: "Kul kharcha", ur: "کل خرچہ" },
  rf_net_cash_flow: { en: "Net Cash Flow", rm: "Paise ka saaf beh", ur: "پیسے کا صاف بہاؤ" },
  rf_total_balance: { en: "Total Balance (all accounts)", rm: "Kul baqi (sab khaton ka)", ur: "کل باقی (سب کھاتوں کا)" },
  rf_account_balances: { en: "Account Balances", rm: "Khaton ka baqi", ur: "کھاتوں کا باقی" },
  rf_no_accounts: { en: "No accounts yet.", rm: "Abhi koi khata nahi.", ur: "ابھی کوئی کھاتہ نہیں۔" },
  rf_top_expense_cats: { en: "Top Expense Categories", rm: "Sab se bare kharche", ur: "سب سے بڑے خرچے" },
  rf_no_expenses_period: { en: "No expenses in this period.", rm: "Is arse mein koi kharcha nahi.", ur: "اس عرصے میں کوئی خرچہ نہیں۔" },
  rf_account: { en: "Account", rm: "Khata", ur: "کھاتہ" },

  // ---- Stock report ----
  ri_title: { en: "Inventory Report", rm: "Stock ki report", ur: "اسٹاک کی رپورٹ" },
  ri_by_product: { en: "Stock by Product (top 50 by value)", rm: "Cheez ke hisaab se stock (qeemat mein sab se ooper 50)", ur: "چیز کے حساب سے اسٹاک (قیمت میں سب سے اوپر 50)" },
  ri_no_products: { en: "No products found.", rm: "Koi cheez nahi mili.", ur: "کوئی چیز نہیں ملی۔" },

  // ---- Kharidari ki report ----
  rpu_title: { en: "Purchases Report", rm: "Kharidari ki report", ur: "خریداری کی رپورٹ" },
  rpu_purchase_orders: { en: "Purchase Orders", rm: "Kharidari ke order", ur: "خریداری کے آرڈر" },
  rpu_no_purchases: { en: "No purchases in this period.", rm: "Is arse mein koi kharidari nahi hui.", ur: "اس عرصے میں کوئی خریداری نہیں ہوئی۔" },
  rpu_no_data: { en: "No data yet.", rm: "Abhi koi maloomat nahi.", ur: "ابھی کوئی معلومات نہیں۔" },

  // ---- Bikri ki report ----
  rs_title: { en: "Sales Report", rm: "Bikri ki report", ur: "بکری کی رپورٹ" },
  rs_total_sales: { en: "Total Sales", rm: "Kul bikri", ur: "کل بکری" },
  rs_transactions: { en: "Transactions", rm: "Lein dein", ur: "لین دین" },
  rs_avg_sale: { en: "Avg. Sale", rm: "Ausat bikri", ur: "اوسط بکری" },
  rs_khata_split: { en: "Khata / Split", rm: "Khata / mila jula", ur: "کھاتہ / ملا جلا" },
  rs_bank_kisan_card: { en: "Bank / Kisan Card", rm: "Bank / Kisan Card", ur: "بینک / کسان کارڈ" },
  rs_recent_sales: { en: "Recent Sales", rm: "Aakhri bikri", ur: "آخری بکری" },
  rs_no_sales_period: { en: "No sales in this period.", rm: "Is arse mein koi bikri nahi hui.", ur: "اس عرصے میں کوئی بکری نہیں ہوئی۔" },
  rs_cashier: { en: "Cashier", rm: "Cashier", ur: "کیشیئر" },

  // ---- Aam ----
  rr_reports: { en: "Reports", rm: "Reportein", ur: "رپورٹیں" },
  rr_shop_comparison: { en: "Shop Comparison", rm: "Dukanon ka moqabla", ur: "دکانوں کا مقابلہ" },
  rr_where_spent: { en: "Where the Money Went", rm: "Kharcha kis cheez par hua", ur: "خرچہ کس چیز پر ہوا" },
} as const;
