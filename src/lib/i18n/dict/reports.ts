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
