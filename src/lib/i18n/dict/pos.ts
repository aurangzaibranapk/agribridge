/**
 * POS ke alfaz -- counter par bola jane wala hissa.
 *
 * Istilahat glossary.ts se: naqad, khata, gahak, cheez, tadaad, kul,
 * baqi, bikri, wapsi, raseed.
 *
 * Ek baat POS par khaas hai: yahan zyada tar matn EK LAFZ ka hota hai
 * aur bande ki nazar us par ek pal ke liye parti hai. Is liye chhote
 * lafz chune gaye hain -- "Kul" na ke "Kul raqam", "Baqi" na ke "Baqi
 * rehne wali raqam".
 */
export const posDict = {
  // --- Safhe ke unwan ---
  pos_title: { en: "POS", rm: "POS", ur: "پی او ایس" },
  pos_karyana_ordering: { en: "Karyana Ordering", rm: "Karyana Ordering", ur: "کریانہ آرڈرنگ" },

  // --- Cheezein dhoondna ---
  pos_search_products: { en: "Search products...", rm: "Cheez dhoondein...", ur: "چیز تلاش کریں..." },
  pos_no_products: { en: "No products found.", rm: "Koi cheez nahi mili.", ur: "کوئی چیز نہیں ملی۔" },
  pos_scan_hint: {
    en: "Scan barcode with scanner, or type and press Enter",
    rm: "Barcode scan karein, ya likh kar Enter dabayein",
    ur: "بارکوڈ اسکین کریں، یا لکھ کر Enter دبائیں",
  },
  pos_scan_barcode: { en: "Scan Barcode", rm: "Barcode scan karein", ur: "بارکوڈ اسکین کریں" },
  pos_scan_camera_hint: {
    en: "Hold the product barcode in front of the camera",
    rm: "Cheez ka barcode camera ke saamne rakhein",
    ur: "چیز کا بارکوڈ کیمرے کے سامنے رکھیں",
  },

  // --- Cart ---
  pos_cart: { en: "Cart", rm: "Cart", ur: "ٹوکری" },
  pos_cart_empty: { en: "No items in cart", rm: "Cart khali hai", ur: "ٹوکری خالی ہے" },
  pos_cart_empty_error: { en: "Cart is empty.", rm: "Cart khali hai.", ur: "ٹوکری خالی ہے۔" },
  pos_clear_cart: { en: "Clear Cart", rm: "Cart khali karein", ur: "ٹوکری خالی کریں" },
  pos_total_quantity: { en: "Total Quantity", rm: "Kul tadaad", ur: "کل تعداد" },
  pos_grand_total: { en: "Grand Total", rm: "Kul", ur: "کل" },

  // --- Gahak ---
  pos_walk_in: { en: "Walk-in / No customer", rm: "Walk-in / koi gahak nahi", ur: "واک اِن / کوئی گاہک نہیں" },
  pos_customer: { en: "Customer", rm: "Gahak", ur: "گاہک" },
  pos_khata_needs_customer: {
    en: "Select a customer for a khata sale.",
    rm: "Khata ke liye gahak chunein.",
    ur: "کھاتے کے لیے گاہک منتخب کریں۔",
  },

  // --- Adaigi ---
  pos_payment: { en: "Payment", rm: "Adaigi", ur: "ادائیگی" },
  pos_add_split: { en: "Add Split Payment", rm: "Adaigi ka doosra tareeqa", ur: "ادائیگی کا دوسرا طریقہ" },
  pos_remaining: { en: "Remaining", rm: "Baqi", ur: "باقی" },
  pos_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  pos_reference_optional: {
    en: "Transaction Reference (optional)",
    rm: "Reference number (marzi se)",
    ur: "ریفرنس نمبر (اختیاری)",
  },
  pos_attach_receipt: {
    en: "Attach payment screenshot / receipt",
    rm: "Adaigi ki raseed ya screenshot lagayein",
    ur: "ادائیگی کی رسید یا اسکرین شاٹ لگائیں",
  },
  pos_receipt_attached: { en: "Receipt attached", rm: "Raseed lag gayi", ur: "رسید لگ گئی" },

  // --- Bikri ka nateeja ---
  pos_sale_done: { en: "Sale complete.", rm: "Bikri mukammal.", ur: "بکری مکمل۔" },
  pos_sale_failed: { en: "Sale could not go through.", rm: "Bikri nahi ho saki.", ur: "بکری نہیں ہو سکی۔" },

  // --- Raseed ---
  pos_receipt: { en: "Receipt", rm: "Raseed", ur: "رسید" },
  pos_receipt_loading: { en: "Loading receipt...", rm: "Raseed aa rahi hai...", ur: "رسید آ رہی ہے..." },
  pos_cashier: { en: "Cashier", rm: "Cashier", ur: "کیشیئر" },
  pos_payment_mode: { en: "Payment Mode", rm: "Adaigi ka tareeqa", ur: "ادائیگی کا طریقہ" },
  pos_item: { en: "Item", rm: "Cheez", ur: "چیز" },
  pos_qty: { en: "Qty", rm: "Tadaad", ur: "تعداد" },
  pos_rate: { en: "Rate", rm: "Rate", ur: "ریٹ" },
  pos_total: { en: "Total", rm: "Kul", ur: "کل" },
  pos_cash_paid: { en: "Cash Paid", rm: "Naqad diya", ur: "نقد دیا" },
  pos_khata_credit: { en: "Khata (Credit)", rm: "Khata", ur: "کھاتہ" },
  pos_outstanding: { en: "Total Outstanding Balance", rm: "Kul baqi", ur: "کل باقی" },
  pos_thank_you: { en: "Thank You for Shopping!", rm: "Shukriya!", ur: "شکریہ!" },
  pos_close: { en: "Close", rm: "Band karein", ur: "بند کریں" },
  pos_email_address: { en: "Email address", rm: "Email ka pata", ur: "ای میل کا پتہ" },
  pos_email_sent: { en: "Email sent.", rm: "Email bhej di gayi.", ur: "ای میل بھیج دی گئی۔" },

  // --- Ordering ---
  pos_total_orders: { en: "Total Orders", rm: "Kul orders", ur: "کل آرڈر" },
  pos_total_order_value: { en: "Total Order Value", rm: "Orders ki kul raqam", ur: "آرڈر کی کل رقم" },
  pos_orders_in_transit: { en: "Orders in Transit", rm: "Raaste mein", ur: "راستے میں" },
  pos_orders_delivered: { en: "Orders Delivered", rm: "Pahunch gaye", ur: "پہنچ گئے" },
  pos_advance_balance: { en: "Your Advance Balance", rm: "Aap ka advance", ur: "آپ کا ایڈوانس" },
  pos_advance_hint: {
    en: "This balance can be used on your next order.",
    rm: "Ye raqam agle order mein lagai ja sakti hai.",
    ur: "یہ رقم اگلے آرڈر میں لگائی جا سکتی ہے۔",
  },
  pos_new_order: { en: "New Order", rm: "Naya order", ur: "نیا آرڈر" },
  pos_recent_orders: { en: "Recent Orders", rm: "Haal ke orders", ur: "حالیہ آرڈر" },
  pos_view_all: { en: "View All", rm: "Sab dekhein", ur: "سب دیکھیں" },
  pos_no_orders: { en: "No orders yet.", rm: "Abhi koi order nahi.", ur: "ابھی کوئی آرڈر نہیں۔" },

  // --- Wapsi ---
  pos_returns_title: { en: "POS — Returns", rm: "POS — Wapsi", ur: "پی او ایس — واپسی" },
  pos_returns_subtitle: {
    en: "Staff fills it in, the manager's code sends it. Money and goods go back at once.",
    rm: "Staff bharta hai, manager ka code bhejta hai. Paisa aur maal usi waqt wapas.",
    ur: "عملہ بھرتا ہے، منیجر کا کوڈ بھیجتا ہے۔ پیسہ اور مال اسی وقت واپس۔",
  },
  pos_return_do: { en: "Make a return", rm: "Wapsi karein", ur: "واپسی کریں" },
  pos_receipt_number: { en: "Receipt number", rm: "Raseed ka number", ur: "رسید کا نمبر" },
  pos_receipt_number_hint: {
    en: "the number printed on the receipt",
    rm: "raseed par chhapa hua number",
    ur: "رسید پر چھپا ہوا نمبر",
  },
  pos_search: { en: "Search", rm: "Dhoondein", ur: "تلاش کریں" },
  pos_searching: { en: "Searching...", rm: "Dhoond raha hai...", ur: "تلاش جاری ہے..." },
  pos_sale_not_found: {
    en: "This sale was not found. Check the receipt number again.",
    rm: "Ye bikri nahi mili. Raseed ka number dobara dekh lein.",
    ur: "یہ بکری نہیں ملی۔ رسید کا نمبر دوبارہ دیکھ لیں۔",
  },
  pos_receipt_number_short: {
    en: "Enter the receipt number (at least four characters).",
    rm: "Raseed ka number likhein (kam az kam char harf).",
    ur: "رسید کا نمبر لکھیں (کم از کم چار حروف)۔",
  },
  pos_return_possible: { en: "Return possible", rm: "Wapsi ho sakti hai", ur: "واپسی ہو سکتی ہے" },
  pos_already: { en: "Already", rm: "Pehle hi", ur: "پہلے ہی" },
  pos_full_return_note: {
    en: "The whole sale is returned — not individual items. The money goes back the same way it came.",
    rm: "Poori bikri wapas hoti hai — kuch cheezein alag se nahi. Paisa usi tarah wapas jayega jis tarah aaya tha.",
    ur: "پوری بکری واپس ہوتی ہے — کچھ چیزیں الگ سے نہیں۔ پیسہ اسی طرح واپس جائے گا جس طرح آیا تھا۔",
  },
  pos_return_reason: { en: "Reason for return *", rm: "Wapsi ki wajah *", ur: "واپسی کی وجہ *" },
  pos_return_reason_hint: {
    en: "This reason stays on the record.",
    rm: "Ye wajah hamesha darj rahegi.",
    ur: "یہ وجہ ہمیشہ درج رہے گی۔",
  },
  pos_return_reason_example: {
    en: "The customer needed a different fertilizer...",
    rm: "Gahak ko doosri khaad chahiye thi...",
    ur: "گاہک کو دوسری کھاد چاہیے تھی...",
  },
  pos_manager_code: { en: "Manager's code *", rm: "Manager ka code *", ur: "منیجر کا کوڈ *" },
  pos_manager_code_hint: {
    en: "No return happens without the code. Every wrong attempt is recorded.",
    rm: "Code ke baghair wapsi nahi hoti. Ghalat code ki har koshish darj hoti hai.",
    ur: "کوڈ کے بغیر واپسی نہیں ہوتی۔ غلط کوڈ کی ہر کوشش درج ہوتی ہے۔",
  },
  pos_return_done: {
    en: "The goods are back in the warehouse and the money has gone to the customer.",
    rm: "Maal godam mein wapas aa gaya aur paisa gahak ko ja chuka hai.",
    ur: "مال گودام میں واپس آ گیا اور پیسہ گاہک کو جا چکا ہے۔",
  },

  // --- Manager ka code ---
  pos_your_code: { en: "Your code", rm: "Aap ka code", ur: "آپ کا کوڈ" },
  pos_code_set: { en: "is set", rm: "laga hua hai", ur: "لگا ہوا ہے" },
  pos_code_not_set: { en: "not set yet", rm: "abhi nahi laga", ur: "ابھی نہیں لگا" },
  pos_code_explain: {
    en: "This code is needed to send a return through at the counter. Every return is recorded in your name, so do not share it. If you forget it, a new one must be made — the old one is never shown to anyone.",
    rm: "Ye code counter par wapsi bhejne ke liye chahiye hota hai. Har wapsi aap ke naam par darj hoti hai, is liye ise kisi ko na batayein. Bhool jayen to naya banana paRta hai; purana kisi ko nazar nahi aata.",
    ur: "یہ کوڈ کاؤنٹر پر واپسی بھیجنے کے لیے چاہیے ہوتا ہے۔ ہر واپسی آپ کے نام پر درج ہوتی ہے، اس لیے اسے کسی کو نہ بتائیں۔ بھول جائیں تو نیا بنانا پڑتا ہے؛ پرانا کسی کو نظر نہیں آتا۔",
  },
  pos_new_code: { en: "New code", rm: "Naya code", ur: "نیا کوڈ" },
  pos_code_again: { en: "Type it again", rm: "Dobara likhein", ur: "دوبارہ لکھیں" },
  pos_set_code: { en: "Set code", rm: "Code lagayein", ur: "کوڈ لگائیں" },
  pos_change_code: { en: "Change code", rm: "Code badlein", ur: "کوڈ بدلیں" },

  // --- Sham ki fehrist ---
  pos_returns_today: { en: "Today's returns", rm: "Aaj ki wapsiyan", ur: "آج کی واپسیاں" },
  pos_returns_count: { en: "returns", rm: "wapsi", ur: "واپسی" },
  pos_returned_amount: { en: "returned", rm: "wapas", ur: "واپس" },
  pos_no_returns_today: { en: "No returns today.", rm: "Aaj koi wapsi nahi hui.", ur: "آج کوئی واپسی نہیں ہوئی۔" },
  pos_return_number: { en: "Return", rm: "Wapsi", ur: "واپسی" },
  pos_time: { en: "Time", rm: "Waqt", ur: "وقت" },
  pos_how_refunded: { en: "How refunded", rm: "Kaise wapas", ur: "کیسے واپس" },
  pos_filled_by: { en: "Filled by", rm: "Bhari kis ne", ur: "بھری کس نے" },
  pos_code_of: { en: "Whose code", rm: "Code kis ka", ur: "کوڈ کس کا" },
  pos_reason: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  pos_self: { en: "(self)", rm: "(khud)", ur: "(خود)" },
  pos_wrong_code_attempts: {
    en: "Wrong code attempts today",
    rm: "Ghalat code ki koshishein — aaj",
    ur: "غلط کوڈ کی کوششیں — آج",
  },
  pos_wrong_code_explain: {
    en: "This list should stay empty. Any row here means someone tried to guess the manager's code.",
    rm: "Ye fehrist khali rehni chahiye. Koi qatar aaye to iska matlab hai ke kisi ne manager ka code andaze se lagane ki koshish ki.",
    ur: "یہ فہرست خالی رہنی چاہیے۔ کوئی قطار آئے تو اس کا مطلب ہے کہ کسی نے منیجر کا کوڈ اندازے سے لگانے کی کوشش کی۔",
  },
  pos_someone: { en: "someone", rm: "koi", ur: "کوئی" },
} as const;
