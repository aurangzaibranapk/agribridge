/**
 * Bank, batwa, anaj ki kharidari ke kaghaz, aur Buyer.
 *
 * BATWE KI TABDEELI KI QISMEIN ALAG HAIN (haath se durusti, top-up,
 * cashback, referral, incentive, subsidy). Sab ko "adjustment" likh
 * dena aasan tha, magar in mein sirf PEHLI durusti hai -- baqi paanch
 * kharche hain jo hum ne apni marzi se diye. Ek hi lafz rakhne par
 * saal ke aakhir mein ye pata na chalta ke kitna paisa incentive mein
 * gaya aur kitna hamari apni ghalti sudharne mein.
 *
 * ANAJ KE BILL PAR "GROSS WEIGHT", "CUT" AUR "NET WEIGHT" teenon alag
 * likhe jate hain. Sirf net likhna aasan tha, magar kisan ka pehla
 * sawal yahi hota hai ke kaat kitni lagi -- aur us ka jawab bill par
 * hona chahiye, munshi ki zabani nahi.
 *
 * "Ye computer se bana hai" wala jumla qasdan hai: is par dastkhat nahi
 * hote.
 */
export const financeGrainDict = {
  // ---- Bank ----
  fb_add_bank: { en: "Add New Bank", rm: "Naya bank shamil karein", ur: "نیا بینک شامل کریں" },
  fb_bank_added: { en: "Bank added.", rm: "Bank shamil ho gaya.", ur: "بینک شامل ہو گیا۔" },
  fb_bank_eg: { en: "e.g. HBL, UBL, Bank Alfalah", rm: "misal: HBL, UBL, Bank Alfalah", ur: "مثال: HBL، UBL، بینک الفلاح" },
  fb_opening_balance: { en: "Opening Balance", rm: "Shuru ka baqi", ur: "شروع کا باقی" },
  fb_none_yet: { en: "No bank added yet.", rm: "Abhi koi bank shamil nahi hua.", ur: "ابھی کوئی بینک شامل نہیں ہوا۔" },
  fb_add_first: { en: "Add the first bank", rm: "Pehla bank shamil karein", ur: "پہلا بینک شامل کریں" },
  fb_edit_bank: { en: "Edit Bank", rm: "Bank tabdeel karein", ur: "بینک تبدیل کریں" },
  fb_bank_updated: { en: "Bank updated.", rm: "Bank tabdeel ho gaya.", ur: "بینک تبدیل ہو گیا۔" },
  fb_management: { en: "Bank Management", rm: "Bank ka intezam", ur: "بینک کا انتظام" },
  fb_payment_mapping: { en: "Payment Method Mapping", rm: "Adaigi ke tareeqon ki jori", ur: "ادائیگی کے طریقوں کی جوڑی" },

  // ---- Batwa ----
  wl_not_found: { en: "Farmer or wallet not found.", rm: "Kisan ya batwa nahi mila.", ur: "کسان یا بٹوہ نہیں ملا۔" },
  wl_wallets: { en: "Wallets", rm: "Batway", ur: "بٹوے" },
  wl_none_found: { en: "No wallets found", rm: "Koi batwa nahi mila", ur: "کوئی بٹوہ نہیں ملا" },
  wl_owner: { en: "Owner", rm: "Kis ka", ur: "کس کا" },
  wl_held: { en: "Held", rm: "Roka hua", ur: "روکا ہوا" },
  wl_adjust: { en: "Adjust Wallet", rm: "Batwa durust karein", ur: "بٹوہ درست کریں" },
  wl_adjusted: { en: "Adjusted successfully.", rm: "Durusti ho gayi.", ur: "درستی ہو گئی۔" },
  wl_direction: { en: "Direction", rm: "Rukh", ur: "رخ" },
  wl_add_funds: { en: "Add Funds (credit)", rm: "Paise daalein (credit)", ur: "پیسے ڈالیں (کریڈٹ)" },
  wl_deduct_funds: { en: "Deduct Funds (debit)", rm: "Paise nikaalein (debit)", ur: "پیسے نکالیں (ڈیبٹ)" },
  wl_manual_adjustment: { en: "Manual Adjustment", rm: "Haath se durusti", ur: "ہاتھ سے درستی" },
  wl_topup: { en: "Top-up", rm: "Top-up", ur: "ٹاپ اپ" },
  wl_cashback: { en: "Cashback", rm: "Cashback", ur: "کیش بیک" },
  wl_referral: { en: "Referral Bonus", rm: "Referral bonus", ur: "ریفرل بونس" },
  wl_incentive: { en: "Incentive", rm: "Incentive", ur: "انعام" },
  wl_subsidy: { en: "Subsidy", rm: "Subsidy", ur: "سبسڈی" },

  // ---- Anaj ka bill ----
  gb_title: { en: "AgriBridge — Grain Procurement Bill", rm: "AgriBridge -- anaj ki kharidari ka bill", ur: "ایگری برج — اناج کی خریداری کا بل" },
  gb_warehouse: { en: "Warehouse", rm: "Godam", ur: "گودام" },
  gb_grain_type: { en: "Grain Type", rm: "Anaj ki qism", ur: "اناج کی قسم" },
  gb_gross_weight: { en: "Gross Weight", rm: "Poora wazan", ur: "پورا وزن" },
  gb_cut: { en: "Cut", rm: "Kaat", ur: "کاٹ" },
  gb_net_weight: { en: "Net Weight", rm: "Saaf wazan", ur: "صاف وزن" },
  gb_rate_kg: { en: "Rate / kg", rm: "Rate / kg", ur: "ریٹ / کلو" },
  gb_computer_bill: {
    en: "This is a computer-generated bill from the AgriBridge system.",
    rm: "Ye bill AgriBridge ke nizam se computer par bana hai.",
    ur: "یہ بل ایگری برج کے نظام سے کمپیوٹر پر بنا ہے۔",
  },
  gb_entry_not_found: { en: "Entry not found.", rm: "Indraj nahi mila.", ur: "اندراج نہیں ملا۔" },
  gb_payment_not_found: { en: "Payment not found.", rm: "Adaigi nahi mili.", ur: "ادائیگی نہیں ملی۔" },

  // ---- Anaj ka kharcha ----
  ge_recorded: { en: "Expense recorded.", rm: "Kharcha darj ho gaya.", ur: "خرچہ درج ہو گیا۔" },
  ge_example: {
    en: "e.g. diesel filled today, labour for harvesting, etc.",
    rm: "jaise: aaj itna diesel dalwaya, fasal uthwane ki mazdoori, waghera",
    ur: "جیسے: آج اتنا ڈیزل ڈلوایا، فصل اٹھوانے کی مزدوری، وغیرہ",
  },
  ge_link_entry: {
    en: "Link it to a particular farmer's or party's entry",
    rm: "Kisi khaas kisan ya party ke indraj se joRein",
    ur: "کسی خاص کسان یا پارٹی کے اندراج سے جوڑیں",
  },

  // ---- Anaj ka gosharah ----
  gst_title: { en: "Grain Procurement Statement", rm: "Anaj ki kharidari ka gosharah", ur: "اناج کی خریداری کا گوشوارہ" },
  gst_supply_plus: { en: "Supply (+)", rm: "Diya (+)", ur: "دیا (+)" },
  gst_payment_minus: { en: "Payment (−)", rm: "Adaigi (−)", ur: "ادائیگی (−)" },
  gst_total_supply_value: { en: "Total Supply Value", rm: "Kul diye hue maal ki qeemat", ur: "کل دیے ہوئے مال کی قیمت" },
  gst_computer_statement: {
    en: "This is a computer-generated statement from the AgriBridge system.",
    rm: "Ye gosharah AgriBridge ke nizam se computer par bana hai.",
    ur: "یہ گوشوارہ ایگری برج کے نظام سے کمپیوٹر پر بنا ہے۔",
  },
  gst_select_party: { en: "Select a farmer or party.", rm: "Kisan ya party chunein.", ur: "کسان یا پارٹی چنیں۔" },

  // ---- Buyer ----
  by_new: { en: "New Buyer", rm: "Naya Buyer", ur: "نیا بائر" },
  by_edit: { en: "Edit Buyer", rm: "Buyer tabdeel karein", ur: "بائر تبدیل کریں" },
  by_business_eg: { en: "e.g. ABC Grain Traders", rm: "misal: ABC Grain Traders", ur: "مثال: ABC Grain Traders" },
  by_buyers: { en: "Buyers", rm: "Buyer", ur: "بائر" },
  by_none_yet: { en: "No buyers yet", rm: "Abhi koi Buyer nahi", ur: "ابھی کوئی بائر نہیں" },
} as const;

/**
 * Anaj ka dashboard aur us ke baqi khane.
 *
 * "HAR ENTRY KI POORI COST" jaan boojh kar chaar hisson mein tooti hui
 * hai: anaj, diesel, mazdoori, bardana. Sirf ek "cost" dikhana aasan
 * tha, magar mol tol wahin hota hai -- kisi entry par bardana mehnga
 * paRa, kisi par ladai. Ek adad se ye kabhi pata na chalta.
 *
 * "GENERAL EXPENSES (kisi ek entry se nahi)" ka apna khana is liye hai
 * ke kuch kharche kisi ek sauday ke nahi hote -- kiraya, aam diesel.
 * Unhen kisi entry par daal dena us entry ka nafa jhoota kar deta.
 *
 * COGS aur FIFO angrezi hi rahe -- hisaab ki istilahat hain, aur
 * accountant unhen isi shakl mein parhta hai.
 */
export const grainDashDict = {
  gd_bought: { en: "Bought", rm: "Kharida", ur: "خریدا" },
  gd_sold: { en: "Sold", rm: "Becha", ur: "بیچا" },
  gd_total_bought: { en: "Total Bought", rm: "Kul kharida", ur: "کل خریدا" },
  gd_total_sold: { en: "Total Sold", rm: "Kul becha", ur: "کل بیچا" },
  gd_in_stock_now: { en: "In Stock Now", rm: "Abhi stock mein", ur: "ابھی اسٹاک میں" },
  gd_in_stock: { en: "In Stock", rm: "Stock mein", ur: "اسٹاک میں" },
  gd_full_profit_calc: { en: "Full Profit Calculation", rm: "Poora nafa ka hisaab", ur: "پورا نفع کا حساب" },
  gd_sales_revenue: { en: "Sales Revenue (from buyers)", rm: "Bikri ki aamdani (buyer se)", ur: "بکری کی آمدنی (بائر سے)" },
  gd_cogs_fifo: { en: "COGS (grain cost — FIFO)", rm: "COGS (anaj ki lagat -- FIFO)", ur: "COGS (اناج کی لاگت — FIFO)" },
  gd_gross_profit_sale: { en: "Gross Profit (the sale's margin)", rm: "Khaam nafa (bikri ka farq)", ur: "خام نفع (بکری کا فرق)" },
  gd_operational_expenses: {
    en: "Operational Expenses (diesel, labour, sacks, rent)",
    rm: "Chalane ke kharche (diesel, mazdoori, bardana, kiraya)",
    ur: "چلانے کے خرچے (ڈیزل، مزدوری، بردانہ، کرایہ)",
  },
  gd_net_business_profit: { en: "Net Business Profit", rm: "Karobar ka saaf nafa", ur: "کاروبار کا صاف نفع" },
  gd_full_cost_each_entry: {
    en: "Full Cost of Each Entry (grain + diesel + labour + sacks)",
    rm: "Har indraj ki poori lagat (anaj + diesel + mazdoori + bardana)",
    ur: "ہر اندراج کی پوری لاگت (اناج + ڈیزل + مزدوری + بردانہ)",
  },
  gd_grain_cost: { en: "Grain Cost", rm: "Anaj ki lagat", ur: "اناج کی لاگت" },
  gd_diesel: { en: "Diesel", rm: "Diesel", ur: "ڈیزل" },
  gd_labour: { en: "Labour", rm: "Mazdoori", ur: "مزدوری" },
  gd_sacks: { en: "Sacks (bardana)", rm: "Bardana", ur: "بردانہ" },
  gd_rent: { en: "Rent", rm: "Kiraya", ur: "کرایہ" },
  gd_total_true_cost: { en: "Total (true cost)", rm: "Kul (asal lagat)", ur: "کل (اصل لاگت)" },
  gd_expense_breakdown: { en: "Expense Breakdown (all)", rm: "Kharchon ki tafseel (sab)", ur: "خرچوں کی تفصیل (سب)" },
  gd_general_expenses: {
    en: "General Expenses (not tied to one entry)",
    rm: "Aam kharche (kisi ek indraj ke nahi)",
    ur: "عام خرچے (کسی ایک اندراج کے نہیں)",
  },
  gd_no_expense: { en: "No expenses yet.", rm: "Abhi koi kharcha nahi.", ur: "ابھی کوئی خرچہ نہیں۔" },
  gd_no_general_expense: { en: "No general expenses.", rm: "Koi aam kharcha nahi.", ur: "کوئی عام خرچہ نہیں۔" },
  gd_no_linked_expense: {
    en: "No expense has been linked to any entry yet.",
    rm: "Abhi tak kisi indraj se koi kharcha nahi joRa gaya.",
    ur: "ابھی تک کسی اندراج سے کوئی خرچہ نہیں جوڑا گیا۔",
  },
  gd_farmer_party: { en: "Farmer / Party", rm: "Kisan / party", ur: "کسان / پارٹی" },
  gd_procurement_page: { en: "Procurement Page", rm: "Kharidari ka safha", ur: "خریداری کا صفحہ" },
  gd_sell_page: { en: "Sell Page", rm: "Bikri ka safha", ur: "بکری کا صفحہ" },

  // ---- Baqi grain safhe ----
  gd_add_more_expense: { en: "Add Another Expense", rm: "Aur kharcha shamil karein", ur: "اور خرچہ شامل کریں" },
  gd_confirm_note: {
    en: "The entry is not saved until you confirm.",
    rm: "Jab tak tasdeeq nahi karenge, indraj mehfooz nahi hoga.",
    ur: "جب تک تصدیق نہیں کریں گے، اندراج محفوظ نہیں ہوگا۔",
  },
  gd_new_party: { en: "Create a New Party", rm: "Nayi party banayein", ur: "نئی پارٹی بنائیں" },
  gd_payment_recorded: { en: "Payment recorded.", rm: "Adaigi darj ho gayi.", ur: "ادائیگی درج ہو گئی۔" },
  gd_buyer_req: { en: "Buyer *", rm: "Buyer *", ur: "بائر *" },
  gd_grain_type_req: { en: "Grain Type *", rm: "Anaj ki qism *", ur: "اناج کی قسم *" },
  gd_warehouse_req: { en: "Warehouse *", rm: "Godam *", ur: "گودام *" },
  gd_qty_kg_req: { en: "Quantity (kg) *", rm: "Tadaad (kg) *", ur: "تعداد (کلو) *" },
  gd_rate_kg_req: { en: "Rate per kg (Rs.) *", rm: "Fi kg rate (Rs.) *", ur: "فی کلو ریٹ (روپے) *" },
  gd_amount_req: { en: "Amount (Rs.) *", rm: "Raqam (Rs.) *", ur: "رقم (روپے) *" },
  gd_which_account_in: { en: "Which account did the money come into? *", rm: "Kaunse khate mein paisa aaya *", ur: "کون سے کھاتے میں پیسہ آیا *" },
  gd_which_account_out: { en: "Which account did this expense go from? *", rm: "Kaunse khate se ye kharcha gaya *", ur: "کون سے کھاتے سے یہ خرچہ گیا *" },
  gd_print_download: { en: "Print / Download", rm: "Print / download", ur: "پرنٹ / ڈاؤن لوڈ" },
  gd_receiving: { en: "Receiving", rm: "Rasidgi", ur: "رسیدگی" },
} as const;
