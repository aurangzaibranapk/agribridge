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
