/**
 * Website Admin Dashboard ke alfaz.
 *
 * Istilahat glossary.ts se: kisan, gahak, shakh, stock, cheez, raqam,
 * kul, baqi, bikri, kharidari, adaigi, tareekh, commission, machinery.
 *
 * Do faisle yahan khaas hain:
 *
 *   "Dealer" aur "Buyer" tarjuma nahi hue. Ye do alag darje hain aur
 *   dono ko "kharidar" likh dena unhen ek bana deta -- jabke poore
 *   nizam mein un ka khata, un ka hisaab aur un ki rok alag hai.
 *
 *   "Pending" ka tarjuma jagah ke hisaab se badla hai. Order ke liye
 *   "intezar mein", tasdeeq ke liye "tasdeeq baqi", aur darkhwast ke
 *   liye "nayi darkhwastein" -- kyunke teenon jagah bande ka agla kaam
 *   alag hai. Ek hi lafz teenon jagah rakhna sirf kaghaz par theek
 *   lagta hai.
 */
export const dashboardDict = {
  db_title: { en: "Website Admin Dashboard", rm: "Website Admin Dashboard", ur: "ویب سائٹ ایڈمن ڈیش بورڈ" },

  // ---- Sar-e-warq ke hisse ----
  db_business_summary: { en: "Business Summary", rm: "Karobar ka khulasa", ur: "کاروبار کا خلاصہ" },
  db_orders_overview: { en: "Orders Overview", rm: "Order ek nazar mein", ur: "آرڈر ایک نظر میں" },
  db_inventory_overview: { en: "Inventory Overview", rm: "Stock ek nazar mein", ur: "اسٹاک ایک نظر میں" },
  db_service_requests: { en: "Service Requests Overview", rm: "Darkhwastein ek nazar mein", ur: "درخواستیں ایک نظر میں" },
  db_dealer_buyer_perf: {
    en: "Dealer & Buyer Performance (this period)",
    rm: "Dealer aur Buyer ki kaarkardagi (is arse mein)",
    ur: "ڈیلر اور بائر کی کارکردگی (اس عرصے میں)",
  },
  db_website_quick_links: { en: "Website Management — Quick Links", rm: "Website ka intezam — chhote raaste", ur: "ویب سائٹ کا انتظام — چھوٹے راستے" },

  // ---- Ginti ke khane ----
  db_total_dealers: { en: "Total Dealers", rm: "Kul Dealer", ur: "کل ڈیلر" },
  db_active_dealers: { en: "Active Dealers", rm: "Chalte hue Dealer", ur: "چلتے ہوئے ڈیلر" },
  db_total_buyers: { en: "Total Buyers", rm: "Kul Buyer", ur: "کل بائر" },
  db_total_investors: { en: "Total Investors", rm: "Kul sarmaya kaar", ur: "کل سرمایہ کار" },
  db_total_suppliers: { en: "Total Suppliers", rm: "Kul supplier", ur: "کل سپلائر" },
  db_total_shops: { en: "Total Shops / Branches", rm: "Kul dukanein / shakhein", ur: "کل دکانیں / شاخیں" },
  db_total_orders: { en: "Total Orders", rm: "Kul order", ur: "کل آرڈر" },
  db_registered_farmers: { en: "Registered Farmers", rm: "Darj shuda kisan", ur: "درج شدہ کسان" },

  // ---- Order ki haalat ----
  db_pending: { en: "Pending", rm: "Intezar mein", ur: "انتظار میں" },
  db_processing: { en: "Processing", rm: "Kaam chal raha hai", ur: "کام چل رہا ہے" },
  db_completed: { en: "Completed", rm: "Mukammal", ur: "مکمل" },
  db_cancelled: { en: "Cancelled", rm: "Mansookh", ur: "منسوخ" },

  // ---- Dealer aur Buyer ----
  db_top_dealers: { en: "Top Dealers", rm: "Sab se aage Dealer", ur: "سب سے آگے ڈیلر" },
  db_top_buyers: { en: "Top Buyers", rm: "Sab se aage Buyer", ur: "سب سے آگے بائر" },
  db_no_dealer_orders: { en: "No dealer orders in this period.", rm: "Is arse mein Dealer ka koi order nahi.", ur: "اس عرصے میں ڈیلر کا کوئی آرڈر نہیں۔" },
  db_no_buyer_orders: { en: "No buyer orders in this period.", rm: "Is arse mein Buyer ka koi order nahi.", ur: "اس عرصے میں بائر کا کوئی آرڈر نہیں۔" },
  db_dealer: { en: "Dealer", rm: "Dealer", ur: "ڈیلر" },
  db_buyer: { en: "Buyer", rm: "Buyer", ur: "بائر" },
  db_orders: { en: "Orders", rm: "Order", ur: "آرڈر" },
  db_payout: { en: "Payout", rm: "Adaigi", ur: "ادائیگی" },
  db_outstanding: { en: "Outstanding", rm: "Baqi", ur: "باقی" },
  db_purchases: { en: "Purchases", rm: "Kharidari", ur: "خریداری" },
  db_dealer_orders: { en: "Dealer Orders", rm: "Dealer ke order", ur: "ڈیلر کے آرڈر" },
  db_buyer_orders: { en: "Buyer Orders", rm: "Buyer ke order", ur: "بائر کے آرڈر" },
  db_buyer_purchases: { en: "Buyer Purchases", rm: "Buyer ki kharidari", ur: "بائر کی خریداری" },
  db_pending_dealer_verification: { en: "Pending Dealer Verification", rm: "Dealer ki tasdeeq baqi", ur: "ڈیلر کی تصدیق باقی" },
  db_total_dealer_payable: { en: "Total Dealer Payable", rm: "Dealer ko kul dena", ur: "ڈیلر کو کل دینا" },

  // ---- Stock ----
  db_total_products: { en: "Total Products", rm: "Kul cheezein", ur: "کل چیزیں" },
  db_active_products: { en: "Active Products", rm: "Chalti hui cheezein", ur: "چلتی ہوئی چیزیں" },
  db_out_of_stock: { en: "Out of Stock", rm: "Stock khatam", ur: "اسٹاک ختم" },
  db_total_stock_value: { en: "Total Stock Value", rm: "Stock ki kul qeemat", ur: "اسٹاک کی کل قیمت" },
  db_pending_transfers: { en: "Pending Transfers", rm: "Raaste mein maal", ur: "راستے میں مال" },
  db_low_stock_alert: { en: "Low Stock Alert", rm: "Stock kam ho raha hai", ur: "اسٹاک کم ہو رہا ہے" },

  // ---- Kisan ka udhaar ----
  db_farmer_credit: { en: "Farmer Credit", rm: "Kisan ka udhaar", ur: "کسان کا ادھار" },
  db_total_credit_given: { en: "Total Credit Given", rm: "Kul udhaar diya", ur: "کل ادھار دیا" },
  db_total_repaid: { en: "Total Repaid", rm: "Kul wapas aaya", ur: "کل واپس آیا" },
  db_farmers_with_credit: { en: "Farmers with Credit", rm: "Jin kisanon par udhaar hai", ur: "جن کسانوں پر ادھار ہے" },
  db_credit_alerts: { en: "Credit Alerts — pending 3+ days", rm: "Udhaar par nazar — teen din se ziyada", ur: "ادھار پر نظر — تین دن سے زیادہ" },

  // ---- Aakhri order ----
  db_recent_orders: { en: "Recent Orders", rm: "Aakhri order", ur: "آخری آرڈر" },
  db_no_orders_yet: { en: "No orders yet.", rm: "Abhi koi order nahi.", ur: "ابھی کوئی آرڈر نہیں۔" },
  db_order_no: { en: "Order #", rm: "Order #", ur: "آرڈر #" },
  db_type: { en: "Type", rm: "Qism", ur: "قسم" },
  db_customer: { en: "Customer", rm: "Gahak", ur: "گاہک" },
  db_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  db_status: { en: "Status", rm: "Haalat", ur: "حالت" },
  db_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },

  // ---- Darkhwastein ----
  db_pending_requests: { en: "Pending Requests", rm: "Nayi darkhwastein", ur: "نئی درخواستیں" },
  db_machinery_requests: { en: "Machinery Requests", rm: "Machinery ki darkhwastein", ur: "مشینری کی درخواستیں" },
  db_fertilizer_requests: { en: "Fertilizer Requests", rm: "Khaad ki darkhwastein", ur: "کھاد کی درخواستیں" },
  db_livestock_loans: { en: "Livestock Loans", rm: "Maweshi ke qarze", ur: "مویشی کے قرضے" },
  db_machinery_status: { en: "Machinery — Status", rm: "Machinery — haalat", ur: "مشینری — حالت" },
  db_fertilizer_status: { en: "Fertilizer — Status", rm: "Khaad — haalat", ur: "کھاد — حالت" },
  db_livestock_status: { en: "Livestock — Status", rm: "Maweshi — haalat", ur: "مویشی — حالت" },

  // ---- Website ----
  db_new_contact_messages: { en: "New Contact Messages", rm: "Naye paighaam", ur: "نئے پیغام" },
  db_new_investor_inquiries: { en: "New Investor Inquiries", rm: "Sarmaya kaaron ke naye sawal", ur: "سرمایہ کاروں کے نئے سوال" },
  db_blog_posts: { en: "Blog Posts", rm: "Blog ki tehreerein", ur: "بلاگ کی تحریریں" },
  db_newsletter_subscribers: { en: "Newsletter Subscribers", rm: "Newsletter ke members", ur: "نیوز لیٹر کے ممبر" },
  db_testimonials: { en: "Testimonials", rm: "Logon ki raaye", ur: "لوگوں کی رائے" },

  // ---- Aam ----
  db_view_all: { en: "View all", rm: "Sab dekhein", ur: "سب دیکھیں" },
  db_bridge_orders: { en: "Bridge Orders", rm: "Bridge Order", ur: "برج آرڈر" },
  db_produce_orders: { en: "Produce Orders", rm: "Fasal ke order", ur: "فصل کے آرڈر" },
  db_weather_forecast: { en: "5-Day Weather Forecast", rm: "5 din ka mausam", ur: "5 دن کا موسم" },
} as const;
