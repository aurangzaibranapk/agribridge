/**
 * Kharidari aur supplier ke alfaz.
 *
 * Istilahat glossary.ts se: supplier, kharidari, cheez, tadaad, lagat,
 * raqam, kul, baqi, shakh, tareekh, wajah, bill, adaigi, godam.
 *
 * Do lafz yahan tay ho rahe hain:
 *
 *   Purchase Order   Kharidari ka Order    خریداری کا آرڈر
 *   Payable          Dena hai              دینا ہے
 *
 * "Payable" ke liye "baqi" nahi liya gaya. Baqi dono taraf chalta hai --
 * gahak se lena bhi baqi, supplier ko dena bhi baqi. Supplier ke safhe
 * par "dena hai" likha ho to ek nazar mein pata chalta hai ke paisa
 * hamare zimme hai.
 *
 * "Filer" / "Non-Filer" ka tarjuma NAHI kiya: ye FBR ke apne lafz hain
 * aur har kaghaz par isi tarah likhe milte hain.
 */
export const purchasesDict = {
  pu_title: { en: "Purchases", rm: "Kharidari", ur: "خریداری" },
  pu_subtitle: {
    en: "Purchase orders to suppliers, and receiving the stock",
    rm: "Supplier ko kharidari ke order, aur maal wusool karna",
    ur: "سپلائر کو خریداری کے آرڈر، اور مال وصول کرنا",
  },
  pu_empty: { en: "No purchase order yet", rm: "Abhi koi kharidari ka order nahi", ur: "ابھی کوئی خریداری کا آرڈر نہیں" },
  pu_po_no: { en: "PO #", rm: "Order #", ur: "آرڈر #" },
  pu_supplier: { en: "Supplier", rm: "Supplier", ur: "سپلائر" },
  pu_branch: { en: "Branch", rm: "Shakh", ur: "شاخ" },
  pu_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  pu_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  pu_status: { en: "Status", rm: "Halat", ur: "حالت" },
  pu_action: { en: "Action", rm: "Kaam", ur: "کام" },
  pu_delete: { en: "Delete", rm: "Mitayein", ur: "مٹائیں" },

  // --- Halatein ---
  pu_s_pending: { en: "Not received yet", rm: "Maal aana baqi", ur: "مال آنا باقی" },
  pu_s_received: { en: "Received", rm: "Maal aa gaya", ur: "مال آ گیا" },
  pu_s_cancelled: { en: "Cancelled", rm: "Mansookh", ur: "منسوخ" },

  // --- Naya order ---
  pu_new_order: { en: "New Purchase Order", rm: "Nayi Kharidari ka Order", ur: "نئی خریداری کا آرڈر" },
  pu_created: {
    en: 'The purchase order is made. Mark it "Received" from the list once the stock arrives.',
    rm: 'Kharidari ka order ban gaya. Maal aa jaye to fehrist se "Maal aa gaya" laga dein.',
    ur: 'خریداری کا آرڈر بن گیا۔ مال آ جائے تو فہرست سے "مال آ گیا" لگا دیں۔',
  },
  pu_supplier_req: { en: "Supplier *", rm: "Supplier *", ur: "سپلائر *" },
  pu_select: { en: "— select —", rm: "— chunein —", ur: "— منتخب کریں —" },
  pu_purchase_date: { en: "Purchase Date", rm: "Kharidari ki Tareekh", ur: "خریداری کی تاریخ" },
  pu_branch_req: { en: "Branch *", rm: "Shakh *", ur: "شاخ *" },
  pu_notes: { en: "Notes", rm: "Notes", ur: "نوٹس" },
  pu_products: { en: "Products", rm: "Cheezein", ur: "چیزیں" },
  pu_add_product: { en: "Add a product", rm: "Cheez shamil karein", ur: "چیز شامل کریں" },
  pu_line: { en: "Line", rm: "Line", ur: "لائن" },
  pu_select_product: { en: "— select a product —", rm: "— cheez chunein —", ur: "— چیز منتخب کریں —" },
  pu_quantity: { en: "Quantity", rm: "Tadaad", ur: "تعداد" },
  pu_unit_cost: { en: "Unit cost (Rs.)", rm: "Ek ki lagat (Rs.)", ur: "ایک کی لاگت (روپے)" },
  pu_batch_optional: { en: "Batch number (optional)", rm: "Batch number (marzi se)", ur: "بیچ نمبر (مرضی سے)" },
  pu_expiry: { en: "Expiry date", rm: "Miyaad ki tareekh", ur: "میعاد کی تاریخ" },
  pu_total: { en: "Total", rm: "Kul", ur: "کل" },
  pu_create: { en: "Create the Purchase Order", rm: "Kharidari ka Order Banayein", ur: "خریداری کا آرڈر بنائیں" },
  pu_creating: { en: "Creating...", rm: "Ban raha hai...", ur: "بن رہا ہے..." },

  // --- Maal wusool karna ---
  pu_mark_received: { en: "Mark Received", rm: "Maal Aa Gaya", ur: "مال آ گیا" },
  pu_receiving: { en: "Receiving...", rm: "Wusool ho raha hai...", ur: "وصول ہو رہا ہے..." },

  // --- Mitana ---
  pu_delete_title_1: { en: "Delete purchase", rm: "Kharidari", ur: "خریداری" },
  pu_delete_title_2: { en: "?", rm: "mitayein?", ur: "مٹائیں؟" },
  pu_delete_warn: {
    en: "This cannot be undone — the stock will come back down too. A reason must be written.",
    rm: "Ye wapas nahi hota — stock bhi wapis kam ho jayega. Wajah likhna zaroori hai.",
    ur: "یہ واپس نہیں ہوتا — اسٹاک بھی واپس کم ہو جائے گا۔ وجہ لکھنا ضروری ہے۔",
  },
  pu_delete_reason_ph: {
    en: "Write the reason for deleting (required)...",
    rm: "Mitane ki wajah likhein (zaroori hai)...",
    ur: "مٹانے کی وجہ لکھیں (ضروری ہے)...",
  },
  pu_confirm_delete: { en: "Confirm Delete", rm: "Mitana Pakka Karein", ur: "مٹانا پکا کریں" },
  pu_deleting: { en: "Deleting...", rm: "Mit raha hai...", ur: "مٹ رہا ہے..." },

  // --- Supplier ---
  su_title: { en: "Suppliers", rm: "Suppliers", ur: "سپلائرز" },
  su_subtitle: {
    en: "The companies and vendors you buy stock from",
    rm: "Jin companies aur vendors se maal kharida jata hai",
    ur: "جن کمپنیوں اور وینڈرز سے مال خریدا جاتا ہے",
  },
  su_none: { en: "There is no supplier.", rm: "Koi supplier nahi hai.", ur: "کوئی سپلائر نہیں ہے۔" },
  su_payable: { en: "We owe", rm: "Dena hai", ur: "دینا ہے" },
  su_view_cnic: { en: "View CNIC", rm: "CNIC Dekhein", ur: "شناختی کارڈ دیکھیں" },
  su_view_ntn: { en: "View NTN", rm: "NTN Dekhein", ur: "این ٹی این دیکھیں" },
  su_edit: { en: "Edit", rm: "Badlein", ur: "بدلیں" },
  su_statement: { en: "Statement", rm: "Hisaab", ur: "حساب" },
  su_active: { en: "Active", rm: "Chalu", ur: "چالو" },
  su_inactive: { en: "Inactive", rm: "Band", ur: "بند" },
  su_suspended: { en: "Suspended", rm: "Roka hua", ur: "روکا ہوا" },

  // ---- Adaigi ki shartein (255) ----
  pu_terms: { en: "Payment", rm: "Adaigi", ur: "ادائیگی" },
  pu_terms_paid: { en: "Paid in full", rm: "Poora diya", ur: "پورا دیا" },
  pu_terms_partial: { en: "Partly paid", rm: "Kuch diya", ur: "کچھ دیا" },
  pu_terms_credit: { en: "On credit", rm: "Udhaar", ur: "ادھار" },
  pu_paid_now: { en: "Paid now (Rs)", rm: "Abhi diye (Rs)", ur: "ابھی دیے (Rs)" },
  pu_credit_days: { en: "Credit days", rm: "Kitne din ka udhaar", ur: "کتنے دن کا ادھار" },
  pu_due_date: { en: "Due date", rm: "Adaigi ki tareekh", ur: "ادائیگی کی تاریخ" },
  pu_terms_hint: {
    en: "What you pay now is recorded as a supplier payment — the same place every payment goes. Nothing is written twice.",
    rm: "Jo abhi diya wo supplier ki adaigi mein likha jata hai — wahi jagah jahan har adaigi jati hai. Kuch do dafa nahi likha jata.",
    ur: "جو ابھی دیا وہ سپلائر کی ادائیگی میں لکھا جاتا ہے — وہی جگہ جہاں ہر ادائیگی جاتی ہے۔ کچھ دو دفعہ نہیں لکھا جاتا۔",
  },
  pu_paid_more_than_total: {
    en: "Paid now cannot be more than the purchase total.",
    rm: "Abhi diye hue paise kharid ke kul se zyada nahi ho sakte.",
    ur: "ابھی دیے ہوئے پیسے خرید کے کل سے زیادہ نہیں ہو سکتے۔",
  },
  pu_partial_needs_amount: {
    en: '"Partly paid" needs an amount above zero.',
    rm: '"Kuch diya" ke sath adad likhna zaroori hai, sifar nahi.',
    ur: '"کچھ دیا" کے ساتھ عدد لکھنا ضروری ہے، صفر نہیں۔',
  },

  sb_due_title: { en: "Payments due", rm: "Adaigi ka calendar", ur: "ادائیگی کا کیلنڈر" },
  sb_due_7: { en: "Due in the next 7 days", rm: "Agle 7 din mein dena", ur: "اگلے 7 دن میں دینا" },
  sb_overdue: { en: "Overdue", rm: "Tareekh guzar gayi", ur: "تاریخ گزر گئی" },
  sb_due_none: {
    en: "No purchase has a due date in the next 7 days.",
    rm: "Agle 7 din mein kisi purchase ki adaigi ki tareekh nahi.",
    ur: "اگلے 7 دن میں کسی پرچیز کی ادائیگی کی تاریخ نہیں۔",
  },
  sb_due_purchase: { en: "Purchase", rm: "Purchase", ur: "پرچیز" },
  sb_due_when: { en: "Due", rm: "Kab tak", ur: "کب تک" },
  sb_due_days: { en: "{n} days", rm: "{n} din", ur: "{n} دن" },
  sb_due_today: { en: "today", rm: "aaj", ur: "آج" },
  sb_due_late: { en: "{n} days late", rm: "{n} din late", ur: "{n} دن لیٹ" },
  sb_paid_on_this: { en: "Paid on this", rm: "Is par diya", ur: "اس پر دیا" },
  sb_supplier_total: { en: "Supplier's total payable", rm: "Supplier ka kul dena", ur: "سپلائر کا کل دینا" },
  sb_not_received: { en: "not received yet", rm: "maal abhi nahi aaya", ur: "مال ابھی نہیں آیا" },
  sb_due_note: {
    en: "The amount still owed on one purchase is not shown on purpose: payments sit on the supplier's account, not on one bill. Counting a per-bill balance would invent a number that does not exist.",
    rm: "Ek purchase ka apna \"baqi\" jaan boojh kar nahi likha: adaigi supplier ke khate par hoti hai, kisi ek bill par nahi. Ek bill ka baqi ginna wo adad banana hai jo asal mein hai hi nahi.",
    ur: "ایک پرچیز کا اپنا \"باقی\" جان بوجھ کر نہیں لکھا: ادائیگی سپلائر کے کھاتے پر ہوتی ہے، کسی ایک بل پر نہیں۔ ایک بل کا باقی گننا وہ عدد بنانا ہے جو اصل میں ہے ہی نہیں۔",
  },

  // ---- GRN: kitna aaya, kitna toota, kitna kam (256) ----
  grn_title: { en: "Count the goods", rm: "Maal ginein", ur: "مال گنیں" },
  grn_hint: {
    en: "Write what actually arrived. Received + damaged + short must equal the invoice quantity — nothing goes missing quietly.",
    rm: "Jo asal mein aaya wo likhein. Aaya + toota + kam = invoice ki tadad — kuch chup chaap gum nahi hota.",
    ur: "جو اصل میں آیا وہ لکھیں۔ آیا + ٹوٹا + کم = انوائس کی تعداد — کچھ چپ چاپ گم نہیں ہوتا۔",
  },
  grn_invoice_qty: { en: "On invoice", rm: "Invoice par", ur: "انوائس پر" },
  grn_received: { en: "Arrived OK", rm: "Theek aaya", ur: "ٹھیک آیا" },
  grn_damaged: { en: "Damaged", rm: "Toota", ur: "ٹوٹا" },
  grn_short: { en: "Short", rm: "Kam", ur: "کم" },
  grn_all_ok: { en: "All arrived as invoiced", rm: "Sab invoice jitna aaya", ur: "سب انوائس جتنا آیا" },
  grn_photo: { en: "Photo (evidence)", rm: "Tasveer (saboot)", ur: "تصویر (ثبوت)" },
  grn_photo_hint: {
    en: "Optional — but when something is damaged or short, a photo settles the argument with the supplier later.",
    rm: "Ikhtiyari — magar jab kuch toota ya kam ho, tasveer baad mein supplier se behes khatam kar deti hai.",
    ur: "اختیاری — مگر جب کچھ ٹوٹا یا کم ہو، تصویر بعد میں سپلائر سے بحث ختم کر دیتی ہے۔",
  },
  grn_note: { en: "Note", rm: "Note", ur: "نوٹ" },
  grn_note_req: {
    en: "When something is damaged or short, write a note — what and why.",
    rm: "Jab kuch toota ya kam ho to note likhein — kya aur kyun.",
    ur: "جب کچھ ٹوٹا یا کم ہو تو نوٹ لکھیں — کیا اور کیوں۔",
  },
  grn_confirm: { en: "Confirm & bring stock in", rm: "Tasdeeq karein, maal andar layein", ur: "تصدیق کریں، مال اندر لائیں" },
  grn_payable_note: {
    en: "The supplier is owed only for what arrived OK. Damaged and short units are not paid for — the difference stays visible on the purchase.",
    rm: "Supplier ka dena sirf utna banega jitna maal theek aaya. Toota aur kam — dono ka paisa nahi banta; farq purchase par nazar aata rehta hai.",
    ur: "سپلائر کا دینا صرف اتنا بنے گا جتنا مال ٹھیک آیا۔ ٹوٹا اور کم — دونوں کا پیسہ نہیں بنتا؛ فرق پرچیز پر نظر آتا رہتا ہے۔",
  },
  grn_adds_up_err: {
    en: "{name}: arrived + damaged is more than the invoice quantity ({qty}).",
    rm: "{name}: aaya + toota invoice ki tadad ({qty}) se zyada hai.",
    ur: "{name}: آیا + ٹوٹا انوائس کی تعداد ({qty}) سے زیادہ ہے۔",
  },
  grn_done: {
    en: "Received. {ok} units in, {dmg} damaged, {short} short.",
    rm: "Receive ho gaya. {ok} andar aaye, {dmg} toote, {short} kam.",
    ur: "ریسیو ہو گیا۔ {ok} اندر آئے، {dmg} ٹوٹے، {short} کم۔",
  },
  grn_discrepancy: { en: "Invoice vs arrived", rm: "Invoice banam aaya", ur: "انوائس بمقابلہ آیا" },
} as const;
