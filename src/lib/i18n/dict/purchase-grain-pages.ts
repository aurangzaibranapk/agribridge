/**
 * Char naye safhon ke alfaz: GRN ki qatar, supplier ke bill, anaj ka
 * godam, aur anaj ki kisan adaigi.
 *
 * Istilahat pehle se tay shuda fehriston se: supplier, godam, kisan,
 * party, raqam, baqi, adaigi, lagat, kaat, mann.
 *
 * "GRN" ka tarjuma NAHI kiya. Ye kaghaz par isi tarah likha hota hai aur
 * godam wala isi naam se pukarta hai; "maal wusooli ki raseed" likh dene
 * se koi us kaghaz se milaan nahi kar payega.
 *
 * "Dena" ka lafz supplier ke liye wahi hai jo purchases.ts mein tay hua:
 * "baqi" dono taraf chalta hai, "dena" ek nazar mein bata deta hai ke
 * paisa hamare zimme hai.
 */
export const purchaseGrainPagesDict = {
  // --- GRN ki qatar ---
  grn_q_title: { en: "GRN Queue", rm: "GRN ki Qatar", ur: "جی آر این کی قطار" },
  grn_q_subtitle: {
    en: "Goods that have moved but whose count is not yet settled",
    rm: "Jo maal chal chuka hai magar us ka hisaab poora nahi hua",
    ur: "جو مال چل چکا ہے مگر اس کا حساب پورا نہیں ہوا",
  },
  grn_q_make: { en: "GRN still to be made", rm: "GRN banana baqi", ur: "جی آر این بنانا باقی" },
  grn_q_make_hint: {
    en: "The goods went out but nobody has counted them yet",
    rm: "Maal nikal chuka hai magar abhi kisi ne gina nahi",
    ur: "مال نکل چکا ہے مگر ابھی کسی نے گنا نہیں",
  },
  grn_q_warehouse: { en: "Waiting on the warehouse", rm: "Godam ki nazar ka intezar", ur: "گودام کی نظر کا انتظار" },
  grn_q_warehouse_hint: {
    en: "A gap was found — the warehouse has to write the reason",
    rm: "Farq nikla hai — godam wale ko wajah likhni hai",
    ur: "فرق نکلا ہے — گودام والے کو وجہ لکھنی ہے",
  },
  grn_q_finance: { en: "Waiting on finance", rm: "Finance ki nazar ka intezar", ur: "فنانس کی نظر کا انتظار" },
  grn_q_finance_hint: {
    en: "The reason is written — now the decision on how much to pay",
    rm: "Wajah likhi ja chuki — ab faisla ke kitna dena hai",
    ur: "وجہ لکھی جا چکی — اب فیصلہ کہ کتنا دینا ہے",
  },
  grn_q_shortage: { en: "Short", rm: "Kami", ur: "کمی" },
  grn_q_damage: { en: "Damaged", rm: "Kharabi", ur: "خرابی" },
  grn_q_today: { en: "today", rm: "aaj", ur: "آج" },
  grn_q_days: { en: "days", rm: "din", ur: "دن" },
  grn_q_empty: { en: "Nothing is pending", rm: "Koi kaam baqi nahi", ur: "کوئی کام باقی نہیں" },
  grn_q_empty_note: {
    en: "Every dispatch that has gone out has been counted and settled.",
    rm: "Jo bhi maal nikla, wo gina bhi ja chuka aur us ka hisaab bhi ho gaya.",
    ur: "جو بھی مال نکلا، وہ گنا بھی جا چکا اور اس کا حساب بھی ہو گیا۔",
  },
  grn_q_footer: {
    en: "This list builds itself — it does not wait for anyone to update a status. Goods that are never counted have their shortage never surface.",
    rm: "Ye fehrist khud banti hai -- kisi ke status badalne ka intezar nahi karti. Jo maal gina na jaye, us ki kami kabhi saamne nahi aati.",
    ur: "یہ فہرست خود بنتی ہے — کسی کے اسٹیٹس بدلنے کا انتظار نہیں کرتی۔ جو مال گنا نہ جائے، اس کی کمی کبھی سامنے نہیں آتی۔",
  },

  // --- Supplier ke bill ---
  sb_title: { en: "Bills & Payable", rm: "Bill aur Dena", ur: "بل اور دینا" },
  sb_subtitle: {
    en: "Each supplier: what was bought, what was paid, what is owed",
    rm: "Har supplier ka hisaab: kitna kharida, kitna ada kiya, kitna dena hai",
    ur: "ہر سپلائر کا حساب: کتنا خریدا، کتنا ادا کیا، کتنا دینا ہے",
  },
  sb_total_payable: { en: "Total Payable", rm: "Kul Dena", ur: "کل دینا" },
  sb_owed_count: { en: "Suppliers owed", rm: "Jin ka dena hai", ur: "جن کا دینا ہے" },
  sb_over_limit: { en: "Over the limit", rm: "Hadd se upar", ur: "حد سے اوپر" },
  sb_supplier: { en: "Supplier", rm: "Supplier", ur: "سپلائر" },
  sb_bought: { en: "Bought", rm: "Kharida", ur: "خریدا" },
  sb_paid: { en: "Paid", rm: "Ada kiya", ur: "ادا کیا" },
  sb_payable: { en: "Owed", rm: "Dena", ur: "دینا" },
  sb_in_transit: { en: "Not yet received", rm: "Aana baqi", ur: "آنا باقی" },
  sb_statement: { en: "Statement", rm: "Hisaab", ur: "حساب" },
  sb_open: { en: "Open", rm: "Kholein", ur: "کھولیں" },
  sb_limit_crossed: { en: "Credit limit crossed:", rm: "Udhaar ki hadd cross:", ur: "ادھار کی حد کراس:" },
  sb_empty: { en: "No supplier yet", rm: "Abhi koi supplier nahi", ur: "ابھی کوئی سپلائر نہیں" },
  sb_empty_note: {
    en: "Add a supplier under Purchases → Suppliers, then their account will appear here.",
    rm: "Kharidari → Suppliers se supplier banayein, phir un ka hisaab yahan aayega.",
    ur: "خریداری ← سپلائرز سے سپلائر بنائیں، پھر ان کا حساب یہاں آئے گا۔",
  },
  sb_mismatch: {
    en: "suppliers' figures do not match the real account. Do not act on these numbers until they are checked.",
    rm: "supplier ka adad asal hisaab se nahi milta. Jaanche baghair in adad par amal na karein.",
    ur: "سپلائر کا عدد اصل حساب سے نہیں ملتا۔ جانچے بغیر ان اعداد پر عمل نہ کریں۔",
  },
  sb_written: { en: "written", rm: "likha", ur: "لکھا" },
  sb_should_be: { en: "should be", rm: "hona chahiye", ur: "ہونا چاہیے" },
  sb_footer: {
    en: 'The "Owed" figure is not remembered anywhere — it is worked out from received purchases minus payments, every time. It cannot be written by hand.',
    rm: '"Dena" ka adad kahin yaad nahi rakha jata -- wo har baar wusool shuda kharidari mein se adaigi nikal kar banta hai. Haath se likha nahi ja sakta.',
    ur: '"دینا" کا عدد کہیں یاد نہیں رکھا جاتا — وہ ہر بار وصول شدہ خریداری میں سے ادائیگی نکال کر بنتا ہے۔ ہاتھ سے لکھا نہیں جا سکتا۔',
  },

  // --- Anaj ka godam ---
  gw_title: { en: "Grain Warehouse", rm: "Anaj ka Godam", ur: "اناج کا گودام" },
  gw_subtitle: {
    en: "Each warehouse and crop: how much came in, how much went out, how much is lying there",
    rm: "Har godam aur fasal: kitna aaya, kitna gaya, kitna para hai",
    ur: "ہر گودام اور فصل: کتنا آیا، کتنا گیا، کتنا پڑا ہے",
  },
  gw_total_kg: { en: "Grain on hand", rm: "Maujood Anaj", ur: "موجود اناج" },
  gw_maund: { en: "maund", rm: "mann", ur: "من" },
  gw_stuck_money: { en: "Money tied up in it", rm: "Us mein Phansa Paisa", ur: "اس میں پھنسا پیسہ" },
  gw_warehouses: { en: "Warehouses", rm: "Godam", ur: "گودام" },
  gw_grain: { en: "Grain", rm: "Fasal", ur: "فصل" },
  gw_in: { en: "In (kg)", rm: "Aaya (kg)", ur: "آیا (کلو)" },
  gw_out: { en: "Out (kg)", rm: "Gaya (kg)", ur: "گیا (کلو)" },
  gw_on_hand: { en: "On hand", rm: "Para hai", ur: "پڑا ہے" },
  gw_avg_cost: { en: "Avg cost / kg", rm: "Aausat lagat / kg", ur: "اوسط لاگت / کلو" },
  gw_value: { en: "Value", rm: "Qeemat", ur: "قیمت" },
  gw_empty: { en: "No grain in any warehouse", rm: "Kisi godam mein anaj nahi", ur: "کسی گودام میں اناج نہیں" },
  gw_empty_note: {
    en: "Once grain is bought in, it will appear here on its own.",
    rm: "Anaj kharida jayega to yahan khud aa jayega.",
    ur: "اناج خریدا جائے گا تو یہاں خود آ جائے گا۔",
  },
  gw_footer: {
    en: "Average cost is what the grain lying here actually cost — the next deal is worth doing only above this figure.",
    rm: "Aausat lagat wo hai jo para hua anaj waqai mein para. Agla sauda isi adad se upar hi faida deta hai.",
    ur: "اوسط لاگت وہ ہے جو پڑا ہوا اناج واقعی میں پڑا۔ اگلا سودا اسی عدد سے اوپر ہی نفع دیتا ہے۔",
  },

  // --- Anaj: kisan ki adaigi ---
  gp_title: { en: "Farmer Payments", rm: "Kisan ki Adaigi", ur: "کسان کی ادائیگی" },
  gp_subtitle: {
    en: "Who is owed how much for grain, and paying them",
    rm: "Anaj ka kis ka kitna baqi hai, aur adaigi karna",
    ur: "اناج کا کس کا کتنا باقی ہے، اور ادائیگی کرنا",
  },
  gp_total_due: { en: "Total owed", rm: "Kul Dena", ur: "کل دینا" },
  gp_owed_count: { en: "Sellers owed", rm: "Jin ka baqi hai", ur: "جن کا باقی ہے" },
  gp_search: { en: "Name, code or mobile", rm: "Naam, code ya mobile", ur: "نام، کوڈ یا موبائل" },
  gp_none: { en: "Nobody found.", rm: "Koi nahi mila.", ur: "کوئی نہیں ملا۔" },
  gp_seller: { en: "Seller", rm: "Bechne Wala", ur: "بیچنے والا" },
  gp_supplied: { en: "Supplied", rm: "Diya", ur: "دیا" },
  gp_paid: { en: "Paid", rm: "Ada", ur: "ادا" },
  gp_due: { en: "Owed", rm: "Baqi", ur: "باقی" },
  gp_overpaid: { en: "paid more than due", rm: "zyada ja chuka", ur: "زیادہ جا چکا" },
  gp_pay: { en: "Pay", rm: "Adaigi", ur: "ادائیگی" },
  gp_pay_title: { en: "Record a Payment", rm: "Adaigi Darj Karein", ur: "ادائیگی درج کریں" },
  gp_amount: { en: "Amount (Rs.) — not more than owed", rm: "Raqam (Rs.) — baqi se zyada nahi", ur: "رقم (روپے) — باقی سے زیادہ نہیں" },
} as const;
