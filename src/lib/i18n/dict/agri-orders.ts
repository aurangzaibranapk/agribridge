/**
 * Agri Order -- order banana, dispatch, GRN aur adaigi.
 *
 * Ye chaar safhe ek hi safar ke chaar parhaav hain, is liye ek hi
 * fehrist mein hain: order banta hai, maal chalta hai, godam par ginti
 * hoti hai, aur paisa jata hai. Alag alag fehristein banate to "Short"
 * aur "Damaged" chaar jagah alag alag likhe jate -- jabke wo poore
 * safar mein ek hi cheez hai.
 *
 * "GRN" tarjuma nahi hua. Ye godam par bola jane wala lafz hai, aur
 * kaghaz par bhi wohi likha hota hai; "maal wusooli ka indraj" likh
 * dena wahan kisi ko samajh nahi aata.
 *
 * EK BAAT JO YAHAN KHAAS HAI. GRN ki "Difference" wali fehrist mein
 * har wajah alag rakhi gayi hai -- kam aaya, ziyada aaya, toota hua,
 * ghalat cheez, khatam shuda, batch ka masla. Sab ko "farq" likh dena
 * aasan tha, magar phir report se ye pata na chalta ke nuqsan raaste
 * mein hua ya packing mein hi kam tha -- aur wohi asal sawal hai.
 */
export const agriOrdersDict = {
  // ---- Naya order ----
  ao_order_info: { en: "Order Information", rm: "Order ki maloomat", ur: "آرڈر کی معلومات" },
  ao_supplier_name: { en: "Supplier Name", rm: "Supplier ka naam", ur: "سپلائر کا نام" },
  ao_supplier_name_ph: { en: "Enter supplier name", rm: "Supplier ka naam likhein", ur: "سپلائر کا نام لکھیں" },
  ao_order_to_branch: { en: "Order To Branch (if internal)", rm: "Kis shakh ko order (agar andar ka hai)", ur: "کس شاخ کو آرڈر (اگر اندر کا ہے)" },
  ao_where_from: { en: "Where will the goods come from?", rm: "Maal kahan se aayega?", ur: "مال کہاں سے آئے گا؟" },
  ao_order_from: { en: "Order From", rm: "Kahan se", ur: "کہاں سے" },
  ao_from_company: { en: "Company / another shop", rm: "Company / doosri dukan", ur: "کمپنی / دوسری دکان" },
  ao_from_outside: { en: "Outside supplier", rm: "Bahar ka supplier", ur: "باہر کا سپلائر" },
  ao_partner_details: { en: "Location / Partner Details", rm: "Jagah / partner ki tafseel", ur: "جگہ / پارٹنر کی تفصیل" },
  ao_partner_name: { en: "Partner Name", rm: "Partner ka naam", ur: "پارٹنر کا نام" },
  ao_partner_code: { en: "Partner Code", rm: "Partner ka code", ur: "پارٹنر کا کوڈ" },
  ao_shop_dealer_name: { en: "Shop / Dealer Name", rm: "Dukan / Dealer ka naam", ur: "دکان / ڈیلر کا نام" },
  ao_city: { en: "City", rm: "Shehar", ur: "شہر" },
  ao_product_selection: { en: "Product Selection", rm: "Cheezein chunein", ur: "چیزیں چنیں" },
  ao_search_product_cat: { en: "Search product (name or category)", rm: "Cheez dhoondein (naam ya qism)", ur: "چیز تلاش کریں (نام یا قسم)" },
  ao_freight_charges: { en: "Freight / Delivery Charges", rm: "Kiraya / pahunchane ka kharcha", ur: "کرایہ / پہنچانے کا خرچہ" },
  ao_other_charges: { en: "Other Charges", rm: "Doosre kharche", ur: "دوسرے خرچے" },
  ao_freight_other: { en: "Freight + Other", rm: "Kiraya + doosre", ur: "کرایہ + دوسرے" },
  ao_existing_outstanding: { en: "Existing Outstanding (Rs)", rm: "Pehle se baqi (Rs)", ur: "پہلے سے باقی (روپے)" },
  ao_available_credit: { en: "Available Credit:", rm: "Kitna udhaar mil sakta hai:", ur: "کتنا ادھار مل سکتا ہے:" },
  ao_projected_outstanding: { en: "Projected Outstanding:", rm: "Is order ke baad baqi:", ur: "اس آرڈر کے بعد باقی:" },

  // ---- GRN ----
  ao_ordered_value: { en: "Ordered Value", rm: "Order ki qeemat", ur: "آرڈر کی قیمت" },
  ao_received_value: { en: "Received Value", rm: "Jo aaya us ki qeemat", ur: "جو آیا اس کی قیمت" },
  ao_received_value_stock: { en: "Received Value (stock that arrived)", rm: "Jitna stock aaya us ki qeemat", ur: "جتنا اسٹاک آیا اس کی قیمت" },
  ao_stock_added: { en: "Stock has been added to inventory.", rm: "Stock godam mein shamil ho chuka hai.", ur: "اسٹاک گودام میں شامل ہو چکا ہے۔" },
  ao_discrepancy_wait: {
    en: "A discrepancy was found — waiting for the warehouse's reason.",
    rm: "Farq nikla hai -- godam ki wajah ka intezar hai.",
    ur: "فرق نکلا ہے — گودام کی وجہ کا انتظار ہے۔",
  },
  ao_warehouse_reason: { en: "Warehouse reason:", rm: "Godam ki wajah:", ur: "گودام کی وجہ:" },
  ao_reason_ph: {
    en: "Write the reason (e.g. it was short in the packing itself, damaged in transit)",
    rm: "Wajah likhein (jaise: packing mein hi kam tha, raaste mein toot gaya)",
    ur: "وجہ لکھیں (جیسے: پیکنگ میں ہی کم تھا، راستے میں ٹوٹ گیا)",
  },
  ao_send_reason: { en: "Send Reason", rm: "Wajah bhejein", ur: "وجہ بھیجیں" },
  ao_final_payable: { en: "Final Payable Amount (Rs)", rm: "Aakhri dena (Rs)", ur: "آخری دینا (روپے)" },
  ao_finalize: { en: "Finalize", rm: "Pakka karein", ur: "پکا کریں" },
  ao_create_grn: { en: "Create GRN", rm: "GRN banayein", ur: "GRN بنائیں" },
  ao_received_qty: { en: "Received Qty", rm: "Jitna aaya", ur: "جتنا آیا" },
  ao_difference: { en: "Difference", rm: "Farq", ur: "فرق" },
  ao_diff_none: { en: "None", rm: "Koi nahi", ur: "کوئی نہیں" },
  ao_diff_excess: { en: "Excess", rm: "Ziyada", ur: "زیادہ" },
  ao_diff_wrong_product: { en: "Wrong Product", rm: "Ghalat cheez", ur: "غلط چیز" },
  ao_diff_expired: { en: "Expired", rm: "Khatam shuda", ur: "ختم شدہ" },
  ao_diff_batch: { en: "Batch Issue", rm: "Batch ka masla", ur: "بیچ کا مسئلہ" },
  ao_seal_condition: { en: "Seal Condition", rm: "Mohar ki haalat", ur: "مہر کی حالت" },
  ao_quality_status: { en: "Quality Status", rm: "Maal ki haalat", ur: "مال کی حالت" },
  ao_accepted: { en: "Accepted", rm: "Qabool", ur: "قبول" },
  ao_accepted_with_diff: { en: "Accepted with Difference", rm: "Farq ke sath qabool", ur: "فرق کے ساتھ قبول" },
  ao_rejected: { en: "Rejected", rm: "Rad", ur: "رد" },
  ao_rejection_reason: { en: "Rejection Reason", rm: "Rad karne ki wajah", ur: "رد کرنے کی وجہ" },
  ao_charges: { en: "Charges (freight etc.)", rm: "Kharche (kiraya waghera)", ur: "خرچے (کرایہ وغیرہ)" },
  ao_charges_ph: {
    en: "Charges — freight / loading etc. (Rs). Leave 0 if not charging.",
    rm: "Kharche -- kiraya / ladai waghera (Rs). Nahi lena to 0 rakhein.",
    ur: "خرچے — کرایہ / لدائی وغیرہ (روپے)۔ نہیں لینا تو 0 رکھیں۔",
  },
  ao_discount_adjustment: { en: "Discount Adjustment", rm: "Riayat ka hisaab", ur: "رعایت کا حساب" },
  ao_discount_adjustment_rs: { en: "Discount Adjustment (Rs)", rm: "Riayat ka hisaab (Rs)", ur: "رعایت کا حساب (روپے)" },
  ao_submit_grn: { en: "Submit GRN", rm: "GRN bhejein", ur: "GRN بھیجیں" },

  // ---- Dispatch aur delivery ----
  ao_driver: { en: "Driver", rm: "Driver", ur: "ڈرائیور" },
  ao_dispatch_date: { en: "Dispatch Date", rm: "Bhejne ki tareekh", ur: "بھیجنے کی تاریخ" },
  ao_create_dispatch: { en: "Create Dispatch", rm: "Dispatch banayein", ur: "ڈسپیچ بنائیں" },
  ao_select_driver: { en: "Select a registered driver (optional)", rm: "Darj shuda driver chunein (marzi se)", ur: "درج شدہ ڈرائیور چنیں (مرضی سے)" },
  ao_vehicle_number: { en: "Vehicle Number", rm: "Gaari ka number", ur: "گاڑی کا نمبر" },
  ao_driver_name: { en: "Driver Name", rm: "Driver ka naam", ur: "ڈرائیور کا نام" },
  ao_driver_mobile: { en: "Driver Mobile", rm: "Driver ka mobile", ur: "ڈرائیور کا موبائل" },
  ao_transporter: { en: "Transporter (optional)", rm: "Transporter (marzi se)", ur: "ٹرانسپورٹر (مرضی سے)" },
  ao_delivery_location: { en: "Delivery Location", rm: "Kahan pahunchana hai", ur: "کہاں پہنچانا ہے" },
  ao_items_adjust: {
    en: "Items (if sending less, adjust here)",
    rm: "Cheezein (kam bhej rahe hain to yahan theek karein)",
    ur: "چیزیں (کم بھیج رہے ہیں تو یہاں ٹھیک کریں)",
  },
  ao_dispatch_qty: { en: "Dispatch Qty", rm: "Kitna bheja", ur: "کتنا بھیجا" },
  ao_confirm_delivery: { en: "Confirm Delivery", rm: "Pahunchne ki tasdeeq", ur: "پہنچنے کی تصدیق" },
  ao_check_each_item: { en: "What arrived — check each item", rm: "Kya aaya -- har cheez dekh lein", ur: "کیا آیا — ہر چیز دیکھ لیں" },
  ao_reason_required: { en: "Write the reason (required)", rm: "Wajah likhein (zaroori hai)", ur: "وجہ لکھیں (ضروری ہے)" },
  ao_receiver_note: {
    en: "Receiver name is filled from your system record — change it if needed.",
    rm: "Lene wale ka naam nizam ke record se bhar diya gaya hai -- zaroorat ho to badal dein.",
    ur: "لینے والے کا نام نظام کے ریکارڈ سے بھر دیا گیا ہے — ضرورت ہو تو بدل دیں۔",
  },
  ao_receiver_name: { en: "Receiver Name", rm: "Lene wale ka naam", ur: "لینے والے کا نام" },
  ao_receiver_cnic: { en: "Receiver CNIC (optional)", rm: "Lene wale ka CNIC (marzi se)", ur: "لینے والے کا CNIC (مرضی سے)" },
  ao_receiver_mobile: { en: "Receiver Mobile (optional)", rm: "Lene wale ka mobile (marzi se)", ur: "لینے والے کا موبائل (مرضی سے)" },
  ao_delivery_photo: { en: "Delivery Photo (optional)", rm: "Delivery ki tasveer (marzi se)", ur: "ڈیلیوری کی تصویر (مرضی سے)" },
  ao_delivery_challan: { en: "Delivery Challan (optional)", rm: "Delivery challan (marzi se)", ur: "ڈیلیوری چالان (مرضی سے)" },

  // ---- Adaigi ----
  ao_no_payment_yet: { en: "No payment submitted yet.", rm: "Abhi koi adaigi nahi bheji gayi.", ur: "ابھی کوئی ادائیگی نہیں بھیجی گئی۔" },
  ao_reject_payment: { en: "Reject Payment", rm: "Adaigi rad karein", ur: "ادائیگی رد کریں" },
  ao_submit_payment: { en: "Submit Payment", rm: "Adaigi bhejein", ur: "ادائیگی بھیجیں" },
  ao_payment_submitted: { en: "Payment submitted.", rm: "Adaigi bhej di gayi.", ur: "ادائیگی بھیج دی گئی۔" },
  ao_online_payment: { en: "Online Payment", rm: "Online adaigi", ur: "آن لائن ادائیگی" },
  ao_bank_of_payment: { en: "Bank Name (bank the payment came from)", rm: "Bank ka naam (jis bank se adaigi hui)", ur: "بینک کا نام (جس بینک سے ادائیگی ہوئی)" },
  ao_transaction_id: { en: "Transaction ID", rm: "Transaction ID", ur: "ٹرانزیکشن ID" },
  ao_paid_amount: { en: "Paid Amount (Rs)", rm: "Di hui raqam (Rs)", ur: "دی ہوئی رقم (روپے)" },
  ao_receipt_upload: { en: "Receipt Upload (optional)", rm: "Raseed lagayein (marzi se)", ur: "رسید لگائیں (مرضی سے)" },
} as const;

/**
 * Order ka safha, cheez chunne ka grid, shikayat, aur wapsi.
 *
 * FEEDBACK KE PANCH KHANE ALAG HAIN (pahunchana, maal ki qism, packing,
 * service, aur mila jula). Ek "rating" rakhna aasan tha, magar phir
 * shikayat ka ilaj kabhi na milta: teen sitare ka matlab ye ho sakta hai
 * ke maal theek tha aur gaari late thi, ya ulta. Do bilkul alag ilaj.
 *
 * WAPSI KI WAJAH bhi alag rakhi gayi hai -- "kharab" aur "bika nahi"
 * ek jaise nahi. Pehla supplier ka masla hai, doosra hamare andaze ka.
 * Ek hi lafz likhne par ye pata na chalta ke kis se baat karni hai.
 *
 * "HQ maal receive karega to itni raqam khate se kam hogi" wala jumla
 * qasdan wahin likha hai jahan raqam dikhti hai: wapsi banate waqt kuch
 * nahi hilta, sab tab hota hai jab maal waqai pahunchta hai -- aur ye
 * baat pehle se saamne honi chahiye.
 */
export const agriOrdersMoreDict = {
  // ---- Shikayat aur raaye ----
  ac_no_complaint: { en: "No complaints.", rm: "Koi shikayat nahi.", ur: "کوئی شکایت نہیں۔" },
  ac_resolution_notes: { en: "Resolution notes", rm: "Hal ka note", ur: "حل کا نوٹ" },
  ac_write_full_detail: { en: "Write the full detail", rm: "Poori tafseel likhein", ur: "پوری تفصیل لکھیں" },
  ac_submit: { en: "Submit", rm: "Bhejein", ur: "بھیجیں" },
  ac_give_feedback: { en: "Give Feedback", rm: "Raaye dein", ur: "رائے دیں" },
  ac_delivery_experience: { en: "Delivery Experience", rm: "Pahunchane ka tajurba", ur: "پہنچانے کا تجربہ" },
  ac_product_quality: { en: "Product Quality", rm: "Maal ki qism", ur: "مال کی قسم" },
  ac_packaging: { en: "Packaging", rm: "Packing", ur: "پیکنگ" },
  ac_overall_rating: { en: "Overall Rating *", rm: "Mila jula darja *", ur: "ملا جلا درجہ *" },
  ac_comments: { en: "Comments", rm: "Baat", ur: "بات" },
  ac_submit_feedback: { en: "Submit Feedback", rm: "Raaye bhejein", ur: "رائے بھیجیں" },
  ac_comment_optional: { en: "Comment (optional)", rm: "Baat (marzi se)", ur: "بات (مرضی سے)" },
  ac_reject_order: { en: "Reject Order", rm: "Order rad karein", ur: "آرڈر رد کریں" },

  // ---- Order ka safha ----
  ao_order_not_found: { en: "Order not found.", rm: "Order nahi mila.", ur: "آرڈر نہیں ملا۔" },
  ao_freight: { en: "Freight", rm: "Kiraya", ur: "کرایہ" },
  ao_order_progress: { en: "Order Progress", rm: "Order kahan tak pahuncha", ur: "آرڈر کہاں تک پہنچا" },
  ao_detailed_log: { en: "Detailed Log", rm: "Poori tafseel", ur: "پوری تفصیل" },
  ao_new_order: { en: "New Agri Order", rm: "Naya Agri Order", ur: "نیا ایگری آرڈر" },
  ao_ordering_title: { en: "AgriBridge Ordering", rm: "AgriBridge ka order nizam", ur: "ایگری بریج کا آرڈر نظام" },
  ao_total_order_value: { en: "Total Order Value", rm: "Order ki kul qeemat", ur: "آرڈر کی کل قیمت" },
  ao_pending_payment: { en: "Pending Payment", rm: "Adaigi baqi", ur: "ادائیگی باقی" },
  ao_month_sales: { en: "This Month's Sales", rm: "Is mahine ki bikri", ur: "اس مہینے کی بکری" },
  ao_order_no: { en: "Order No.", rm: "Order number", ur: "آرڈر نمبر" },
  ao_to: { en: "To", rm: "Kis ko", ur: "کس کو" },
  ao_no_order_yet: { en: "No orders yet.", rm: "Abhi koi order nahi.", ur: "ابھی کوئی آرڈر نہیں۔" },

  // ---- Cheez chunne ka grid ----
  ao_sort_stock_first: { en: "Available Stock First", rm: "Jo maujood hai wo pehle", ur: "جو موجود ہے وہ پہلے" },
  ao_sort_az: { en: "Name A-Z", rm: "Naam A-Z", ur: "نام A-Z" },
  ao_sort_za: { en: "Name Z-A", rm: "Naam Z-A", ur: "نام Z-A" },
  ao_sort_price_low: { en: "Price Low-High", rm: "Qeemat kam se ziyada", ur: "قیمت کم سے زیادہ" },
  ao_sort_price_high: { en: "Price High-Low", rm: "Qeemat ziyada se kam", ur: "قیمت زیادہ سے کم" },
  ao_sort_stock_low: { en: "Stock Low-High", rm: "Stock kam se ziyada", ur: "اسٹاک کم سے زیادہ" },
  ao_rate_label: { en: "Rate:", rm: "Rate:", ur: "ریٹ:" },
  ao_purchase_label: { en: "Purchase:", rm: "Kharid:", ur: "خرید:" },
  ao_warehouse_label: { en: "Warehouse:", rm: "Godam:", ur: "گودام:" },
  ao_all_stock_selected: { en: "All available stock is selected", rm: "Poora maujood stock chun liya gaya", ur: "پورا موجود اسٹاک چن لیا گیا" },
  ao_from_company_src: { en: "From Company", rm: "Company se", ur: "کمپنی سے" },
  ao_from_other_shop: { en: "From Another Shop", rm: "Doosri dukan se", ur: "دوسری دکان سے" },
  ao_from_other_shop_note: {
    en: "It will come from another shop's stock. That shop will dispatch it.",
    rm: "Kisi aur dukan ke stock se aayega. Wohi dukan bhejegi.",
    ur: "کسی اور دکان کے اسٹاک سے آئے گا۔ وہی دکان بھیجے گی۔",
  },

  // ---- Wapsi ----
  ar_not_found: { en: "Return not found.", rm: "Wapsi nahi mili.", ur: "واپسی نہیں ملی۔" },
  ar_created: { en: "Created", rm: "Banaya", ur: "بنایا" },
  ar_received: { en: "Received", rm: "Mil gaya", ur: "مل گیا" },
  ar_reject_reason_ph: { en: "Write the reason for rejection...", rm: "Rad karne ki wajah likhein...", ur: "رد کرنے کی وجہ لکھیں..." },
  ar_no_stock: {
    en: "There is no stock in your warehouse, so a return cannot be created.",
    rm: "Aap ke godam mein abhi koi stock nahi hai, is liye wapsi nahi ban sakti.",
    ur: "آپ کے گودام میں ابھی کوئی اسٹاک نہیں ہے، اس لیے واپسی نہیں بن سکتی۔",
  },
  ar_made: { en: "Return created. HQ has been notified.", rm: "Wapsi ban gayi. HQ ko ittila bhej di gayi hai.", ur: "واپسی بن گئی۔ HQ کو اطلاع بھیج دی گئی ہے۔" },
  ar_reason_heading: { en: "Reason for Return", rm: "Wapsi ki wajah", ur: "واپسی کی وجہ" },
  ar_which_order: { en: "Which order is this from? (optional)", rm: "Kis order ka maal hai? (marzi ki baat)", ur: "کس آرڈر کا مال ہے؟ (مرضی کی بات)" },
  ar_pick_goods: { en: "Pick the Goods", rm: "Maal chunein", ur: "مال چنیں" },
  ar_my_stock: { en: "My Stock", rm: "Mera stock", ur: "میرا اسٹاک" },
  ar_return_qty: { en: "Return Qty", rm: "Kitna wapas", ur: "کتنا واپس" },
  ar_damaged: { en: "Damaged", rm: "Kharab", ur: "خراب" },
  ar_not_sold: { en: "Did not sell", rm: "Bika nahi", ur: "بکا نہیں" },
  ar_total_items: { en: "Total Items", rm: "Kul cheezein", ur: "کل چیزیں" },
  ar_return_value: { en: "Return Value", rm: "Wapsi ki qeemat", ur: "واپسی کی قیمت" },
  ar_deduct_note: {
    en: "When HQ receives the goods, this amount will be deducted from your account.",
    rm: "HQ maal wusool karega to itni raqam aap ke khate se kam ho jayegi.",
    ur: "HQ مال وصول کرے گا تو اتنی رقم آپ کے کھاتے سے کم ہو جائے گی۔",
  },
  ar_notes_if_any: { en: "Notes (if any)", rm: "Note (agar koi ho)", ur: "نوٹ (اگر کوئی ہو)" },
  ar_no_branch_linked: {
    en: "This account is not linked to any branch. Contact the admin.",
    rm: "Ye khata kisi shakh se nahi juRa. Admin se raabta karein.",
    ur: "یہ کھاتہ کسی شاخ سے نہیں جڑا۔ ایڈمن سے رابطہ کریں۔",
  },
  ar_title: { en: "Returns (branch to HQ)", rm: "Wapsi (shakh se HQ)", ur: "واپسی (شاخ سے HQ)" },
  ar_waiting_hq: { en: "Waiting for HQ", rm: "HQ ke intezar mein", ur: "HQ کے انتظار میں" },
  ar_received_done: { en: "Received", rm: "Mil chuke", ur: "مل چکے" },
  ar_rejected_done: { en: "Rejected", rm: "Rad huye", ur: "رد ہوئے" },
  ar_none_yet: { en: "No returns yet.", rm: "Abhi tak koi wapsi nahi.", ur: "ابھی تک کوئی واپسی نہیں۔" },
  ar_return_no: { en: "Return No.", rm: "Wapsi number", ur: "واپسی نمبر" },
} as const;
