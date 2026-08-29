/**
 * Anaj (grain) ke alfaz.
 *
 * Istilahat glossary.ts se: kisan, anaj, godam, rate, raqam, kul, baqi,
 * naqad, bank, adaigi, raseed, bill, tareekh, nafa, lagat.
 *
 * Anaj ke apne lafz, jo mandi mein pehle se bole jate hain aur jaan
 * boojh kar wahi rakhe gaye:
 *
 *   Kaat       کاٹ      (deduction -- namee/mitti ki wajah se wazan se
 *                        jo kaata jata hai; "katauti" daftar ka lafz
 *                        hai, mandi ka nahi)
 *   Bardana    بردانہ   (bori)
 *   Chungi     چنگی     (raaste ka mehsool)
 *   Mazdoori   مزدوری
 *   Maund      من       (40 kg -- kisan wazan isi mein sochta hai)
 *   Party      پارٹی    (kisanon ka group jo mil kar anaj laata hai)
 *
 * Fasal ke naam dono tarah likhe jate hain: Gandum aur Wheat. Yahan
 * pehle wo naam jo bola jata hai, phir bracket mein doosra -- taake
 * kaghaz se milaan bhi ho jaye aur parhne wale ko samajh bhi aaye.
 */
export const grainDict = {
  gr_title: { en: "Grain Procurement", rm: "Anaj ki Kharidari", ur: "اناج کی خریداری" },
  gr_subtitle: {
    en: "Wheat, rice and maize — buying from farmers and parties, with the full account",
    rm: "Gandum, chawal aur makai — kisanon aur parties se kharidna, poora hisaab",
    ur: "گندم، چاول اور مکئی — کسانوں اور پارٹیوں سے خریدنا، پورا حساب",
  },
  gr_dashboard_title: { en: "Grain Business Dashboard", rm: "Anaj ka Dashboard", ur: "اناج کا ڈیش بورڈ" },
  gr_dashboard_subtitle: {
    en: "Buying, selling and running costs — the whole account, to the rupee, in one place",
    rm: "Kharidari, bikri aur kharche — poora hisaab, ek ek rupya, ek jagah",
    ur: "خریداری، بکری اور خرچے — پورا حساب، ایک ایک روپیہ، ایک جگہ",
  },
  gr_sell_title: { en: "Sell Grain", rm: "Anaj Bechein", ur: "اناج بیچیں" },
  gr_sell_subtitle: {
    en: "Selling the procured grain to buyers — revenue, cost and profit all tracked",
    rm: "Kharida hua anaj gahakon ko bechna — aamdani, lagat aur nafa, sab darj",
    ur: "خریدا ہوا اناج گاہکوں کو بیچنا — آمدنی، لاگت اور نفع، سب درج",
  },

  // --- Fasal ---
  gr_wheat: { en: "Wheat", rm: "Gandum (Wheat)", ur: "گندم" },
  gr_rice: { en: "Rice", rm: "Chawal (Rice)", ur: "چاول" },
  gr_maize: { en: "Maize", rm: "Makai (Maize)", ur: "مکئی" },

  // --- Fehrist ---
  gr_new_entry: { en: "New Entry", rm: "Nayi Entry", ur: "نئی انٹری" },
  gr_new_grain_entry: { en: "New Grain Entry", rm: "Naya Anaj ka Entry", ur: "نیا اناج کا انٹری" },
  gr_entries: { en: "Entries", rm: "Entries", ur: "انٹریاں" },
  gr_balances: { en: "Balances (Farmer + Party)", rm: "Baqi (Kisan + Party)", ur: "باقی (کسان + پارٹی)" },
  gr_full_history: { en: "Full History", rm: "Poori History", ur: "پوری ہسٹری" },
  gr_no_entries: { en: "There is no entry yet.", rm: "Koi entry nahi hai abhi.", ur: "کوئی انٹری نہیں ہے ابھی۔" },
  gr_no_entries_short: { en: "There is no entry.", rm: "Koi entry nahi hai.", ur: "کوئی انٹری نہیں ہے۔" },
  gr_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  gr_seller: { en: "Seller", rm: "Bechne Wala", ur: "بیچنے والا" },
  gr_grain: { en: "Grain", rm: "Anaj", ur: "اناج" },
  gr_type: { en: "Type", rm: "Qism", ur: "قسم" },
  gr_gross: { en: "Gross", rm: "Kul Wazan", ur: "کل وزن" },
  gr_cut: { en: "Cut", rm: "Kaat", ur: "کاٹ" },
  gr_net: { en: "Net", rm: "Saaf Wazan", ur: "صاف وزن" },
  gr_rate: { en: "Rate", rm: "Rate", ur: "ریٹ" },
  gr_total: { en: "Total", rm: "Kul", ur: "کل" },
  gr_action: { en: "Action", rm: "Kaam", ur: "کام" },
  gr_bill: { en: "Bill", rm: "Bill", ur: "بل" },
  gr_view_slip: { en: "View slip", rm: "Slip Dekhein", ur: "سلپ دیکھیں" },
  gr_view_entry_slip: { en: "View entry slip", rm: "Entry Slip Dekhein", ur: "انٹری سلپ دیکھیں" },
  gr_view_payment_slip: { en: "View payment slip", rm: "Payment Slip Dekhein", ur: "ادائیگی سلپ دیکھیں" },
  gr_name: { en: "Name", rm: "Naam", ur: "نام" },
  gr_grain_kg: { en: "Grain (kg)", rm: "Anaj (kg)", ur: "اناج (کلو)" },
  gr_grain_value: { en: "Grain value", rm: "Anaj ki Qeemat", ur: "اناج کی قیمت" },
  gr_total_paid: { en: "Total Paid", rm: "Kul Ada", ur: "کل ادا" },
  gr_remaining: { en: "Remaining", rm: "Baaqi", ur: "باقی" },
  gr_total_supply_value: { en: "Total Supply Value", rm: "Kul Supply ki Qeemat", ur: "کل سپلائی کی قیمت" },
  gr_payable: { en: "Payable to farmer/party", rm: "Kisan/Party ko Dena Hai", ur: "کسان/پارٹی کو دینا ہے" },

  // --- Nayi entry ka form ---
  gr_farmer: { en: "Farmer", rm: "Kisan", ur: "کسان" },
  gr_party: { en: "Party (group)", rm: "Party (Group)", ur: "پارٹی (گروپ)" },
  gr_who_brought: { en: "Who brought it? *", rm: "Kon Leke Aaya? *", ur: "کون لے کے آیا؟ *" },
  gr_farmer_req: { en: "Farmer *", rm: "Kisan *", ur: "کسان *" },
  gr_party_req: { en: "Party *", rm: "Party *", ur: "پارٹی *" },
  gr_new_party: { en: "Create a new party", rm: "Nayi Party Banayein", ur: "نئی پارٹی بنائیں" },
  gr_party_created: { en: "The party has been created.", rm: "Party ban gayi.", ur: "پارٹی بن گئی۔" },
  gr_party_name_req: { en: "Party name *", rm: "Party ka Naam *", ur: "پارٹی کا نام *" },
  gr_contact_person: { en: "Contact person", rm: "Raabta karne wala", ur: "رابطہ کرنے والا" },
  gr_phone: { en: "Phone", rm: "Phone", ur: "فون" },
  gr_cnic_optional: { en: "CNIC (optional)", rm: "CNIC (marzi se)", ur: "شناختی کارڈ (مرضی سے)" },
  gr_address: { en: "Address", rm: "Pata", ur: "پتہ" },
  gr_create_party: { en: "Create the Party", rm: "Party Banayein", ur: "پارٹی بنائیں" },
  gr_grain_type_req: { en: "Grain type *", rm: "Anaj ki Qism *", ur: "اناج کی قسم *" },
  gr_warehouse_req: { en: "Warehouse *", rm: "Godam *", ur: "گودام *" },
  gr_gross_kg_req: { en: "Gross weight — KG *", rm: "Kul Wazan — KG *", ur: "کل وزن — کلو *" },
  gr_gross_maund: { en: "Gross weight — Maund", rm: "Kul Wazan — Mann", ur: "کل وزن — من" },
  gr_auto: { en: "Fills in on its own", rm: "Khud ban jayega", ur: "خود بن جائے گا" },
  gr_cut_deduction: { en: "Cut (deduction)", rm: "Kaat (Cut/Deduction)", ur: "کاٹ (کٹوتی)" },
  gr_from_preset: { en: "From a preset", rm: "Preset Se", ur: "پہلے سے طے شدہ" },
  gr_write_manually: { en: "Write it manually", rm: "Manually Likhein", ur: "خود لکھیں" },
  gr_cut_pc_ph: { en: "Cut % (say 2 or 10)", rm: "Kaat % (jaise 2 ya 10)", ur: "کاٹ % (جیسے 2 یا 10)" },
  gr_how_many_kg: { en: "How many kg", rm: "Kitne kg", ur: "کتنے کلو" },
  gr_net_weight: { en: "Net weight (payable)", rm: "Saaf Wazan (jis ka paisa banta hai)", ur: "صاف وزن (جس کا پیسہ بنتا ہے)" },
  gr_rate_per_kg_req: { en: "Rate per kg (Rs.) *", rm: "Rate fi kg (Rs.) *", ur: "ریٹ فی کلو (روپے) *" },
  gr_moisture: { en: "Moisture %", rm: "Namee %", ur: "نمی %" },
  gr_quality_grade: { en: "Quality grade", rm: "Quality ka Darja", ur: "کوالٹی کا درجہ" },
  gr_grade_eg: { en: "e.g. A, B, Premium", rm: "jaise A, B, Premium", ur: "جیسے A، B، پریمیم" },
  gr_notes: { en: "Notes", rm: "Notes", ur: "نوٹس" },
  gr_record_entry: { en: "Record the Entry", rm: "Entry Record Karein", ur: "انٹری ریکارڈ کریں" },
  gr_saving: { en: "Saving...", rm: "Mehfooz ho raha hai...", ur: "محفوظ ہو رہا ہے..." },

  // --- Kharcha ---
  gr_any_expense: {
    en: "Is there an expense with this entry? (diesel / labour / sacks / rent) *",
    rm: "Is entry ke sath koi kharcha hai? (Diesel/Mazdoori/Bardana/Rent) *",
    ur: "اس انٹری کے ساتھ کوئی خرچہ ہے؟ (ڈیزل/مزدوری/بردانہ/کرایہ) *",
  },
  gr_yes: { en: "Yes", rm: "Haan", ur: "ہاں" },
  gr_no: { en: "No", rm: "Nahi", ur: "نہیں" },
  gr_diesel: { en: "Diesel / Fuel", rm: "Diesel / Tel", ur: "ڈیزل / تیل" },
  gr_labor: { en: "Labour", rm: "Mazdoori", ur: "مزدوری" },
  gr_bardana: { en: "Sacks (bardana)", rm: "Bardana", ur: "بردانہ" },
  gr_tractor_rent: { en: "Tractor / trolley rent", rm: "Tractor / Trolley ka Kiraya", ur: "ٹریکٹر / ٹرالی کا کرایہ" },
  gr_other: { en: "Other", rm: "Doosra", ur: "دوسرا" },
  gr_description: { en: "Description", rm: "Tafseel", ur: "تفصیل" },
  gr_amount_rs: { en: "Amount (Rs)", rm: "Raqam (Rs)", ur: "رقم (روپے)" },
  gr_chungi: { en: "Chungi — how is it to be paid?", rm: "Chungi — Kaise Deni Hai?", ur: "چنگی — کیسے دینی ہے؟" },

  // --- Adaigi ---
  gr_pay_now: { en: "Is a payment to be made right now? *", rm: "Is Waqt Adaigi Karni Hai? *", ur: "اس وقت ادائیگی کرنی ہے؟ *" },
  gr_cash_rs: { en: "Cash (Rs)", rm: "Naqad (Rs)", ur: "نقد (روپے)" },
  gr_which_account_req: { en: "Which account did the money leave from? *", rm: "Kis Khate Se Paisa Gaya *", ur: "کس کھاتے سے پیسہ گیا *" },
  gr_which_account_from_req: { en: "Which account (money goes from here) *", rm: "Kaunsa Khata (jahan se paisa gaya) *", ur: "کون سا کھاتہ (جہاں سے پیسہ گیا) *" },
  gr_credit_note: {
    en: "If this farmer already owes credit or a loan, it is deducted on its own and the rest goes out in cash.",
    rm: "Agar is kisan par pehle se koi udhaar ya loan hai to wo khud kat kar baqi paisa naqad jayega.",
    ur: "اگر اس کسان پر پہلے سے کوئی ادھار یا قرض ہے تو وہ خود کٹ کر باقی پیسہ نقد جائے گا۔",
  },
  gr_receiving_photo_req: { en: "Farmer's signed receiving — photo *", rm: "Kisan ki Signed Receiving — Photo *", ur: "کسان کی دستخط شدہ رسید — تصویر *" },
  gr_receiving_note: {
    en: "Before handing over cash, take the signed receiving from the farmer and attach its photo here — so there is no disagreement tomorrow.",
    rm: "Naqad dene se pehle kisan se signed receiving lein aur us ki photo yahan lagayein — kal ko koi ikhtilaf na ho.",
    ur: "نقد دینے سے پہلے کسان سے دستخط شدہ رسید لیں اور اس کی تصویر یہاں لگائیں — کل کو کوئی اختلاف نہ ہو۔",
  },
  gr_receiving_note_short: {
    en: "Before handing over cash, take the signed receiving from the farmer and attach its photo here.",
    rm: "Naqad dene se pehle kisan se signed receiving lein aur us ki photo yahan lagayein.",
    ur: "نقد دینے سے پہلے کسان سے دستخط شدہ رسید لیں اور اس کی تصویر یہاں لگائیں۔",
  },
  gr_make_payment: { en: "Make a Payment", rm: "Adaigi Karein", ur: "ادائیگی کریں" },
  gr_amount_req: { en: "Amount (Rs.) *", rm: "Raqam (Rs.) *", ur: "رقم (روپے) *" },
  gr_amount_cap: {
    en: "Payment amount (Rs.) — cannot exceed what is owed",
    rm: "Adaigi ki raqam (Rs.) — jitna dena hai us se zyada nahi",
    ur: "ادائیگی کی رقم (روپے) — جتنا دینا ہے اس سے زیادہ نہیں",
  },
  gr_payment_method: { en: "Payment method", rm: "Adaigi ka Tareeqa", ur: "ادائیگی کا طریقہ" },
  gr_cash: { en: "Cash", rm: "Naqad", ur: "نقد" },
  gr_bank_transfer: { en: "Bank Transfer", rm: "Bank Transfer", ur: "بینک ٹرانسفر" },
  gr_record_payment: { en: "Record the Payment", rm: "Adaigi Record Karein", ur: "ادائیگی ریکارڈ کریں" },
  gr_rs_amount: { en: "Rs amount", rm: "Rs raqam", ur: "روپے رقم" },
} as const;
