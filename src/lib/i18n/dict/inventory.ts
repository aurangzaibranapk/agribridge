/**
 * Stock, godam aur maal ki ginti ke alfaz.
 *
 * Istilahat glossary.ts se: stock, cheez, tadaad, godam, shakh, lagat,
 * nuqsan, tareekh, wajah, ginti, farq.
 *
 * Do lafz yahan tay ho rahe hain:
 *
 *   Batch      Batch      بیچ      (dawai/khaad ki parchi par isi tarah
 *                                   likha hota hai -- tarjuma karne se
 *                                   maal ki parchi se milaan tootta hai)
 *   Expiry     Miyaad     میعاد
 *
 * "Ginti" ka lafz cash-close.ts se hi liya gaya hai -- cash ho ya maal,
 * ginne ka amal ek hi lafz se bulaya jata hai.
 */
export const inventoryDict = {
  inv_title: { en: "Inventory", rm: "Maal / Stock", ur: "مال / اسٹاک" },
  inv_subtitle: {
    en: "Stock levels, value, and low-stock alerts across every warehouse",
    rm: "Har godam ka stock, us ki qeemat, aur kam maal ka alert",
    ur: "ہر گودام کا اسٹاک، اس کی قیمت، اور کم مال کا الرٹ",
  },
  inv_stock_lines: { en: "Stock Lines", rm: "Stock ki Lines", ur: "اسٹاک کی لائنیں" },
  inv_total_value: { en: "Total Stock Value", rm: "Kul Stock ki Qeemat", ur: "کل اسٹاک کی قیمت" },
  inv_low_stock: { en: "Low Stock Items", rm: "Kam Maal Wali Cheezein", ur: "کم مال والی چیزیں" },
  inv_product: { en: "Product", rm: "Cheez", ur: "چیز" },
  inv_warehouse: { en: "Warehouse", rm: "Godam", ur: "گودام" },
  inv_batch: { en: "Batch", rm: "Batch", ur: "بیچ" },
  inv_expiry: { en: "Expiry", rm: "Miyaad", ur: "میعاد" },
  inv_qty: { en: "Qty", rm: "Tadaad", ur: "تعداد" },
  inv_value: { en: "Value", rm: "Qeemat", ur: "قیمت" },
  inv_actions: { en: "Actions", rm: "Kaam", ur: "کام" },
  inv_low: { en: "Low", rm: "Kam", ur: "کم" },
  // Receiving (265)
  inv_rc_title: { en: "Receiving", rm: "Receiving -- jo maal aana hai", ur: "ریسیونگ -- جو مال آنا ہے" },
  inv_rc_desc: {
    en: "One place for stock waiting to be counted in: approved supplier purchases, and shop orders on their way. The counting itself happens on the same GRN screens as before.",
    rm: "Jo maal ginna baqi hai wo ek jagah: manzoor shuda supplier purchases, aur raaste mein shop ke orders. Ginti wahi purane GRN safhon par hoti hai.",
    ur: "جو مال گننا باقی ہے وہ ایک جگہ: منظور شدہ سپلائر پرچیز، اور راستے میں شاپ کے آرڈر۔ گنتی وہی پرانے GRN صفحوں پر ہوتی ہے۔",
  },
  inv_rc_shop_orders: { en: "Shop orders on the way", rm: "Shop ke orders raaste mein", ur: "شاپ کے آرڈر راستے میں" },
  inv_rc_shop_orders_hint: { en: "Dispatched or in transit — count them in on the GRN queue.", rm: "Bheje hue ya raaste mein — GRN ki qatar par ginein.", ur: "بھیجے ہوئے یا راستے میں — GRN کی قطار پر گنیں۔" },
  inv_rc_open_grn: { en: "Open GRN queue", rm: "GRN ki qatar kholein", ur: "GRN کی قطار کھولیں" },
  inv_rc_purchases: { en: "Supplier purchases ready to count", rm: "Supplier ki purchases, ginne ke liye tayyar", ur: "سپلائر کی پرچیز، گننے کے لیے تیار" },
  inv_rc_none: { en: "Nothing waiting to be received.", rm: "Abhi kuch aana baqi nahi.", ur: "ابھی کچھ آنا باقی نہیں۔" },
  inv_rc_waiting: { en: "Not approved yet", rm: "Abhi manzoor nahi", ur: "ابھی منظور نہیں" },
  inv_rc_waiting_hint: { en: "These cannot be counted in until Owner/Admin approves them on", rm: "Ye tab tak gine nahi ja sakte jab tak Owner/Admin manzoor na karein, yahan:", ur: "یہ تب تک گنے نہیں جا سکتے جب تک Owner/Admin منظور نہ کریں، یہاں:" },
  // Miyaad batch ki (257): sab se qareeb wala batch dikhta hai.
  inv_days: { en: "days", rm: "din", ur: "دن" },
  inv_expired: { en: "expired", rm: "guzar gayi", ur: "گزر گئی" },
  inv_empty: {
    en: "No inventory yet. Receive a purchase order to add stock.",
    rm: "Abhi koi maal nahi. Kharidari ka maal wusool karne se stock aata hai.",
    ur: "ابھی کوئی مال نہیں۔ خریداری کا مال وصول کرنے سے اسٹاک آتا ہے۔",
  },

  // --- Stock adjust ---
  inv_adjust: { en: "Adjust Stock", rm: "Stock Theek Karein", ur: "اسٹاک ٹھیک کریں" },
  inv_current: { en: "Current", rm: "Abhi", ur: "ابھی" },
  inv_adjusted: { en: "Adjusted.", rm: "Theek kar diya gaya.", ur: "ٹھیک کر دیا گیا۔" },
  inv_direction: { en: "Direction", rm: "Kis taraf", ur: "کس طرف" },
  inv_increase: { en: "Increase", rm: "Barhayein", ur: "بڑھائیں" },
  inv_decrease: { en: "Decrease (damage/loss)", rm: "Ghatayein (kharabi/nuqsan)", ur: "گھٹائیں (خرابی/نقصان)" },
  inv_quantity: { en: "Quantity", rm: "Tadaad", ur: "تعداد" },
  inv_reason: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  inv_reason_eg: { en: "e.g. Damaged in storage", rm: "misaal: godam mein kharab ho gaya", ur: "مثلاً گودام میں خراب ہو گیا" },
  inv_apply: { en: "Apply", rm: "Lagayein", ur: "لگائیں" },
  inv_processing: { en: "Working...", rm: "Ho raha hai...", ur: "ہو رہا ہے..." },

  // --- Transfer ---
  inv_transfer: { en: "Transfer Stock", rm: "Stock Bhejein", ur: "اسٹاک بھیجیں" },
  inv_currently_at: { en: "currently at", rm: "abhi hai", ur: "ابھی ہے" },
  inv_transferred: { en: "Sent.", rm: "Bhej diya gaya.", ur: "بھیج دیا گیا۔" },
  inv_from_warehouse: { en: "From Warehouse", rm: "Kis godam se", ur: "کس گودام سے" },
  inv_to_warehouse: { en: "To Warehouse", rm: "Kis godam mein", ur: "کس گودام میں" },
  inv_select: { en: "- select -", rm: "- chunein -", ur: "- منتخب کریں -" },
  inv_notes: { en: "Notes", rm: "Notes", ur: "نوٹس" },

  // ---- Product card (263) ----
  inv_pc_title: { en: "Product card", rm: "Product ka card", ur: "پروڈکٹ کا کارڈ" },
  inv_pc_desc: {
    en: "Per warehouse: on hand, reserved for approved orders, free to sell, batches and nearest expiry.",
    rm: "Har godam mein: para hua, manzoor orders ke liye rakha hua, khula, batch aur qareeb miyaad.",
    ur: "ہر گودام میں: پڑا ہوا، منظور آرڈرز کے لیے رکھا ہوا، کھلا، بیچ اور قریب میعاد۔",
  },
  inv_pc_on_hand: { en: "On hand", rm: "Para hua", ur: "پڑا ہوا" },
  inv_pc_reserved: { en: "Reserved", rm: "Rakha hua", ur: "رکھا ہوا" },
  inv_pc_reserved_hint: {
    en: "Approved orders not yet dispatched from this warehouse.",
    rm: "Manzoor orders jo abhi is godam se bheje nahi gaye.",
    ur: "منظور آرڈرز جو ابھی اس گودام سے بھیجے نہیں گئے۔",
  },
  inv_pc_available: { en: "Free", rm: "Khula", ur: "کھلا" },
  inv_pc_batches: { en: "Batches", rm: "Batch", ur: "بیچ" },
  inv_pc_nearest: { en: "Nearest expiry", rm: "Qareeb miyaad", ur: "قریب میعاد" },
  inv_pc_last_move: { en: "Last movement", rm: "Aakhri harkat", ur: "آخری حرکت" },
  inv_pc_movements: { en: "Recent movements", rm: "Haal ki harkatein", ur: "حال کی حرکتیں" },
  inv_pc_no_stock: { en: "No stock row in any warehouse yet.", rm: "Abhi kisi godam mein is ka khana nahi.", ur: "ابھی کسی گودام میں اس کا خانہ نہیں۔" },
  inv_pc_back: { en: "Back to inventory", rm: "Stock ki fehrist par wapas", ur: "اسٹاک کی فہرست پر واپس" },
} as const;

/**
 * Maal ki ginti.
 *
 * Is safhe ka poora asool ek jumle mein hai: ginne wale ko system ka
 * adad nazar nahi aata. Us jumle ka tarjuma sab se ehtiyat se kiya gaya
 * hai -- ye sirf hidayat nahi, ginti ki wajah hai.
 */
export const stockCountDict = {
  sc_title: { en: "Stock Count", rm: "Maal ki Ginti", ur: "مال کی گنتی" },
  sc_subtitle: {
    en: "The person counting does not see the system's number. Whatever is counted is what gets written — only then is a count really a count.",
    rm: "Ginne wale ko system ka adad nazar nahi aata. Jo gina jaye wahi likha jaye — tabhi ginti asal mein ginti hai.",
    ur: "گننے والے کو سسٹم کا عدد نظر نہیں آتا۔ جو گنا جائے وہی لکھا جائے — تبھی گنتی اصل میں گنتی ہے۔",
  },
  sc_overdue_1: { en: "warehouses", rm: "godam", ur: "گودام" },
  sc_overdue_2: { en: "have not been counted for more than", rm: "ki ginti nahi hui,", ur: "کی گنتی نہیں ہوئی،" },
  sc_overdue_3: { en: "days.", rm: "din se zyada arse se.", ur: "دن سے زیادہ عرصے سے۔" },
  sc_last_count: { en: "last count", rm: "aakhri ginti", ur: "آخری گنتی" },
  sc_never_counted: { en: "never counted", rm: "kabhi nahi gina gaya", ur: "کبھی نہیں گنا گیا" },
  sc_never_counted_note: {
    en: "A warehouse never counted is the most dangerous of all — the difference there has been piling up from the start and nobody has ever looked.",
    rm: "Kabhi na gina gaya godam sab se khatarnak hai — wahan farq ka jama hona shuru se jari hai aur kisi ne dekha hi nahi.",
    ur: "کبھی نہ گنا گیا گودام سب سے خطرناک ہے — وہاں فرق کا جمع ہونا شروع سے جاری ہے اور کسی نے دیکھا ہی نہیں۔",
  },
  sc_no_warehouse: { en: "No warehouse found", rm: "Koi godam nahi mila", ur: "کوئی گودام نہیں ملا" },
  sc_no_warehouse_note: {
    en: "First create a warehouse under Admin → Warehouses.",
    rm: "Pehle Admin → Warehouses mein godam banayein.",
    ur: "پہلے ایڈمن ← گودام میں گودام بنائیں۔",
  },
  sc_warehouse: { en: "Warehouse", rm: "Godam", ur: "گودام" },
  sc_new_count: { en: "New count", rm: "Nayi ginti", ur: "نئی گنتی" },
  sc_review: { en: "review", rm: "milaan", ur: "ملان" },
  sc_counting: { en: "counting under way", rm: "ginti jari hai", ur: "گنتی جاری ہے" },
  sc_items: { en: "items", rm: "cheezen", ur: "چیزیں" },
  sc_go_to_review: { en: "Go to review →", rm: "Milaan par jayein →", ur: "ملان پر جائیں ←" },
  sc_back_to_count: { en: "← back to counting", rm: "← ginti par wapas", ur: "← گنتی پر واپس" },
  sc_hidden_until_all: {
    en: 'Once every item is filled in, the "Go to review" button appears. The system\'s number does not open before that.',
    rm: 'Sab cheezen bhar jayen to "Milaan par jayein" ka button aa jayega. Us se pehle system ka adad nahi kholta.',
    ur: 'سب چیزیں بھر جائیں تو "ملان پر جائیں" کا بٹن آ جائے گا۔ اس سے پہلے سسٹم کا عدد نہیں کھلتا۔',
  },
  sc_no_open_count: { en: "No count is open for this warehouse", rm: "Is godam ki koi ginti khuli nahi", ur: "اس گودام کی کوئی گنتی کھلی نہیں" },
  sc_no_open_count_note: {
    en: "Start a new count from the left. The moment it starts, the system's number is saved and hidden.",
    rm: "Bayen taraf se nayi ginti shuru karein. Shuru karte hi system ka adad mahfooz ho jayega aur chhup jayega.",
    ur: "بائیں طرف سے نئی گنتی شروع کریں۔ شروع کرتے ہی سسٹم کا عدد محفوظ ہو جائے گا اور چھپ جائے گا۔",
  },
  sc_past_counts: { en: "Past counts", rm: "Pichhli gintiyan", ur: "پچھلی گنتیاں" },
  sc_no_past_counts: { en: "No count has been completed yet.", rm: "Abhi koi ginti mukammal nahi hui.", ur: "ابھی کوئی گنتی مکمل نہیں ہوئی۔" },
  sc_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  sc_with_gaps: { en: "With a gap", rm: "Farq wali", ur: "فرق والی" },
  sc_loss_gain: { en: "Loss / gain", rm: "Nuqsan / izafa", ur: "نقصان / اضافہ" },
  sc_all_on_time: { en: "Every warehouse has been counted within", rm: "Har godam ki ginti hui hai —", ur: "ہر گودام کی گنتی ہوئی ہے —" },
  sc_all_on_time_days: { en: "days.", rm: "din ke andar.", ur: "دن کے اندر۔" },

  // --- Ginti ka form ---
  sc_waiting: { en: "One moment…", rm: "Ruk jayein…", ur: "رک جائیں…" },
  sc_which_warehouse: { en: "Which warehouse to count", rm: "Kaunsa godam ginna hai", ur: "کون سا گودام گننا ہے" },
  sc_pick: { en: "— select —", rm: "— select karein —", ur: "— منتخب کریں —" },
  sc_start_count: { en: "Start the count", rm: "Ginti shuru karein", ur: "گنتی شروع کریں" },
  sc_hidden_note: {
    en: "The system's number is hidden on purpose. Write exactly what you count — if a gap turns up, it will be shown on the next page. Writing after looking at the number makes the count pointless.",
    rm: "System ka adad jaan boojh kar chhupaya gaya hai. Jo aap ginein, bilkul wohi likhein — agar farq nikla to wo agle safhe par saamne aayega. Adad dekh kar likhne se ginti ka koi faida nahi rehta.",
    ur: "سسٹم کا عدد جان بوجھ کر چھپایا گیا ہے۔ جو آپ گنیں، بالکل وہی لکھیں — اگر فرق نکلا تو وہ اگلے صفحے پر سامنے آئے گا۔ عدد دیکھ کر لکھنے سے گنتی کا کوئی فائدہ نہیں رہتا۔",
  },
  sc_item: { en: "Item", rm: "Cheez", ur: "چیز" },
  sc_you_counted: { en: "You counted", rm: "Aap ne gina", ur: "آپ نے گنا" },
  sc_save_counts: { en: "Save the counted numbers", rm: "Gine hue adad mahfooz karein", ur: "گنے ہوئے عدد محفوظ کریں" },

  // --- Milaan ---
  sc_matched: { en: "items matched exactly.", rm: "cheezen bilkul theek milin.", ur: "چیزیں بالکل ٹھیک ملیں۔" },
  sc_gaps_note: { en: "have a gap — a reason must be written for each one.", rm: "mein farq hai — har ek ki wajah likhna zaroori hai.", ur: "میں فرق ہے — ہر ایک کی وجہ لکھنا ضروری ہے۔" },
  sc_expected: { en: "Should be", rm: "Hona chahiye", ur: "ہونا چاہیے" },
  sc_found: { en: "Found", rm: "Mila", ur: "ملا" },
  sc_difference: { en: "Difference", rm: "Farq", ur: "فرق" },
  sc_worth: { en: "Worth", rm: "Qeemat", ur: "قیمت" },
  sc_what_happened: { en: "What do you make of it? (required)", rm: "Kya samajh aaya? (lazmi)", ur: "کیا سمجھ آیا؟ (لازمی)" },
  sc_post_note: {
    en: 'On completing, the stock is set to the counted numbers and the loss goes into the "Stock loss" account. After that this count cannot be changed.',
    rm: 'Mukammal karne par stock gine hue adad par set ho jayega aur nuqsan "Stock ka nuqsan" khate mein chala jayega. Us ke baad ye ginti badli nahi ja sakti.',
    ur: 'مکمل کرنے پر اسٹاک گنے ہوئے عدد پر سیٹ ہو جائے گا اور نقصان "اسٹاک کا نقصان" کھاتے میں چلا جائے گا۔ اس کے بعد یہ گنتی بدلی نہیں جا سکتی۔',
  },
  sc_finish_review: { en: "Complete the review", rm: "Milaan mukammal karein", ur: "ملان مکمل کریں" },

  // --- Stock ledger ---
  sl_title: { en: "Stock Ledger", rm: "Stock ka Ledger", ur: "اسٹاک کا لیجر" },
  sl_subtitle: {
    en: "Recent stock movements across every branch",
    rm: "Har shakh mein maal ki nayi aamad-o-raft",
    ur: "ہر شاخ میں مال کی نئی آمد و رفت",
  },
  sl_empty: { en: "No stock movement yet", rm: "Abhi koi stock ki harkat nahi", ur: "ابھی کوئی اسٹاک کی حرکت نہیں" },
} as const;

/**
 * Ek shakh se doosri shakh maal bhejna.
 *
 * Halat ke naam (pending, in_transit, discrepancy...) database mein
 * angrezi mein rehte hain -- wo data hai. Screen par unhen TRANSFER_STATUS
 * ke zariye lafz mein badla jata hai, warna manager ko "payment_verified"
 * likha nazar aata tha.
 *
 * "Farq" (discrepancy) wohi lafz hai jo cash-close aur stock-count par
 * chalta hai. Jo cheez bheji gayi aur jo mili -- un ka farq bhi wahi
 * farq hai.
 */
export const stockTransferDict = {
  st_title: { en: "Stock Transfer Requests", rm: "Maal Bhejne ki Darkhwastein", ur: "مال بھیجنے کی درخواستیں" },
  st_subtitle: {
    en: "Shop to shop and central warehouse — approval is needed at every step",
    rm: "Ek dukan se doosri, aur markazi godam se — har qadam par manzoori chahiye",
    ur: "ایک دکان سے دوسری، اور مرکزی گودام سے — ہر قدم پر منظوری چاہیے",
  },
  st_empty: { en: "No transfer request yet", rm: "Abhi koi darkhwast nahi", ur: "ابھی کوئی درخواست نہیں" },
  st_product: { en: "Product", rm: "Cheez", ur: "چیز" },
  st_from: { en: "From", rm: "Kahan se", ur: "کہاں سے" },
  st_to: { en: "To", rm: "Kahan", ur: "کہاں" },
  st_qty: { en: "Qty", rm: "Tadaad", ur: "تعداد" },
  st_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  st_status: { en: "Status", rm: "Halat", ur: "حالت" },
  st_action: { en: "Action", rm: "Kaam", ur: "کام" },
  st_received: { en: "received", rm: "mila", ur: "ملا" },

  // --- Halatein ---
  st_s_pending: { en: "Waiting", rm: "Manzoori ka intezar", ur: "منظوری کا انتظار" },
  st_s_approved: { en: "Approved", rm: "Manzoor", ur: "منظور" },
  st_s_payment_verified: { en: "Payment verified", rm: "Adaigi tasdeeq shuda", ur: "ادائیگی تصدیق شدہ" },
  st_s_in_transit: { en: "On the way", rm: "Raaste mein", ur: "راستے میں" },
  st_s_completed: { en: "Done", rm: "Mukammal", ur: "مکمل" },
  st_s_discrepancy: { en: "Gap found", rm: "Farq nikla", ur: "فرق نکلا" },
  st_s_cancelled: { en: "Cancelled", rm: "Mansookh", ur: "منسوخ" },

  // --- Kaam ke button ---
  st_approve: { en: "Approve", rm: "Manzoor Karein", ur: "منظور کریں" },
  st_approving: { en: "Approving...", rm: "Manzoori ho rahi hai...", ur: "منظوری ہو رہی ہے..." },
  st_reject: { en: "Reject", rm: "Rad Karein", ur: "رد کریں" },
  st_account: { en: "— account —", rm: "— khata —", ur: "— کھاتہ —" },
  st_verify_payment: { en: "Verify Payment", rm: "Adaigi Tasdeeq Karein", ur: "ادائیگی تصدیق کریں" },
  st_verifying: { en: "Verifying...", rm: "Tasdeeq ho rahi hai...", ur: "تصدیق ہو رہی ہے..." },
  st_dispatch: { en: "Dispatch", rm: "Rawana Karein", ur: "روانہ کریں" },
  st_dispatching: { en: "Dispatching...", rm: "Rawana ho raha hai...", ur: "روانہ ہو رہا ہے..." },
  st_qty_received: { en: "Qty received", rm: "Kitna mila", ur: "کتنا ملا" },
  st_match_accept: { en: "Match & Accept", rm: "Mila kar Qabool Karein", ur: "ملا کر قبول کریں" },
  st_saving: { en: "Saving...", rm: "Mehfooz ho raha hai...", ur: "محفوظ ہو رہا ہے..." },
  st_resolution_notes: { en: "Resolution notes", rm: "Kaise hal hua", ur: "کیسے حل ہوا" },
  st_resolve: { en: "Resolve", rm: "Hal Karein", ur: "حل کریں" },
  st_resolving: { en: "Resolving...", rm: "Hal ho raha hai...", ur: "حل ہو رہا ہے..." },
  st_final_accept: { en: "Final Accept", rm: "Aakhri Qabooliyat", ur: "آخری قبولیت" },
  st_accepting: { en: "Accepting...", rm: "Qabool ho raha hai...", ur: "قبول ہو رہا ہے..." },
  st_cancel: { en: "Cancel", rm: "Mansookh", ur: "منسوخ" },

  // --- Darkhwast ka form ---
  st_request_sent: { en: "The request has been sent.", rm: "Darkhwast bhej di gayi.", ur: "درخواست بھیج دی گئی۔" },
  st_from_source: { en: "From (source shop)", rm: "Kahan se (dene wali dukan)", ur: "کہاں سے (دینے والی دکان)" },
  st_central_warehouse: { en: "Central Warehouse (HQ)", rm: "Markazi Godam (HQ)", ur: "مرکزی گودام (ایچ کیو)" },
  st_from_your_shop: { en: "From (your shop)", rm: "Kahan se (aap ki dukan)", ur: "کہاں سے (آپ کی دکان)" },
  st_your_shop: { en: "Your shop", rm: "Aap ki dukan", ur: "آپ کی دکان" },
  st_to_destination: { en: "To (destination shop) *", rm: "Kahan (lene wali dukan) *", ur: "کہاں (لینے والی دکان) *" },
  st_pick_shop: { en: "— pick a shop —", rm: "— dukan chunein —", ur: "— دکان منتخب کریں —" },
  st_pick_products: {
    en: "Pick the products (more than one is fine)",
    rm: "Cheezein chunein (ek se zyada bhi le sakte hain)",
    ur: "چیزیں منتخب کریں (ایک سے زیادہ بھی لے سکتے ہیں)",
  },
  st_total: { en: "Total", rm: "Kul", ur: "کل" },
  st_submit: { en: "Send the Request", rm: "Darkhwast Bhejein", ur: "درخواست بھیجیں" },
  st_submitting: { en: "Sending...", rm: "Ja rahi hai...", ur: "جا رہی ہے..." },
} as const;
