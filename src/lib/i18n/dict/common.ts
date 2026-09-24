/**
 * Wo alfaz jo har safhe par aate hain.
 *
 * KYUN ALAG FILE. Admin panel ke 304 safhon mein taqreeban 2,068 English
 * jumle hain, magar wo 1,435 ALAG jumle hain -- yani aksar apne aap ko
 * dohrate hain. "Date" pachees safhon par hai, "Notes" unnees par,
 * "Status" solah par. Har safhe ki apni fehrist banate to wohi lafz
 * pachees dafa likha jata, aur pachees mein se ek jagah kisi din koi
 * doosra lafz likh deta -- aur do safhon par ek hi cheez ke do naam aa
 * jate.
 *
 * Ye 220 jumle 629 jagah lagte hain: poore kaam ka takreeban teesra
 * hissa, ek hi file se.
 *
 * Istilahat glossary.ts se li gayi hain. Naya lafz yahan daalne se
 * pehle wahan dekh lein -- us mein likha hai ke kis cheez ka kya naam
 * pehle se tay ho chuka hai.
 *
 * JO YAHAN JAAN BOOJH KAR NAHI HAIN: "WhatsApp", "CNIC", "IBAN",
 * "JazzCash", "EasyPaisa", "Al Rana Traders" -- naam aur nishan har
 * zaban mein ek hi rehte hain. Unhen tarjuma karna kisi ki madad nahi
 * karta, aur "ایزی پیسہ" likh dena us app ka naam badal deta hai jo
 * bande ke phone par kuch aur likha hua hai.
 */
export const commonDict = {
  // ---- Qatar ke sirnaame ----
  c_date: { en: "Date", rm: "Tareekh", ur: "تاریخ" },
  c_status: { en: "Status", rm: "Haalat", ur: "حالت" },
  c_type: { en: "Type", rm: "Qism", ur: "قسم" },
  c_category: { en: "Category", rm: "Qism", ur: "قسم" },
  c_description: { en: "Description", rm: "Tafseel", ur: "تفصیل" },
  c_detail: { en: "Detail", rm: "Tafseel", ur: "تفصیل" },
  c_notes: { en: "Notes", rm: "Note", ur: "نوٹ" },
  c_notes_optional: { en: "Notes (optional)", rm: "Note (marzi se)", ur: "نوٹ (مرضی سے)" },
  c_reason: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  c_action: { en: "Action", rm: "Kaam", ur: "کام" },
  c_actions: { en: "Actions", rm: "Kaam", ur: "کام" },
  c_number: { en: "Number", rm: "Number", ur: "نمبر" },
  c_no_short: { en: "No.", rm: "No.", ur: "نمبر" },
  c_name: { en: "Name", rm: "Naam", ur: "نام" },
  c_button_text: { en: "Button Text", rm: "Button par kya likha ho", ur: "بٹن پر کیا لکھا ہو" },
  c_button_link: { en: "Button Link", rm: "Button ka link", ur: "بٹن کا لنک" },
  c_title: { en: "Title", rm: "Unwan", ur: "عنوان" },
  c_value: { en: "Value", rm: "Qeemat", ur: "قیمت" },
  c_method: { en: "Method", rm: "Tareeqa", ur: "طریقہ" },
  c_filter: { en: "Filter", rm: "Chhaantein", ur: "چھانٹیں" },
  c_all: { en: "All", rm: "Sab", ur: "سب" },

  // ---- Paisa ----
  c_amount: { en: "Amount", rm: "Raqam", ur: "رقم" },
  c_amount_rs: { en: "Amount (Rs)", rm: "Raqam (Rs)", ur: "رقم (روپے)" },
  c_rate: { en: "Rate", rm: "Rate", ur: "ریٹ" },
  c_price: { en: "Price", rm: "Qeemat", ur: "قیمت" },
  c_cost: { en: "Cost", rm: "Lagat", ur: "لاگت" },
  c_profit: { en: "Profit", rm: "Nafa", ur: "نفع" },
  c_tax: { en: "Tax", rm: "Tax", ur: "ٹیکس" },
  c_discount: { en: "Discount", rm: "Riayat", ur: "رعایت" },
  c_subtotal: { en: "Subtotal", rm: "Jamaa", ur: "جمع" },
  c_total: { en: "Total", rm: "Kul", ur: "کل" },
  c_grand_total: { en: "Grand Total", rm: "Kul meezan", ur: "کل میزان" },
  c_total_amount: { en: "Total Amount", rm: "Kul raqam", ur: "کل رقم" },
  c_balance: { en: "Balance", rm: "Baqi", ur: "باقی" },
  c_baqi: { en: "Balance", rm: "Baqi", ur: "باقی" },
  c_balance_due: { en: "Balance Due", rm: "Baqi dena hai", ur: "باقی دینا ہے" },
  c_current_balance: { en: "Current Balance", rm: "Maujooda baqi", ur: "موجودہ باقی" },
  c_closing_balance: { en: "Closing Balance", rm: "Aakhri baqi", ur: "آخری باقی" },
  c_closing_balance_payable: { en: "Closing Balance (Payable)", rm: "Aakhri baqi (dena hai)", ur: "آخری باقی (دینا ہے)" },
  c_outstanding: { en: "Outstanding", rm: "Baqi", ur: "باقی" },
  c_payable: { en: "Payable", rm: "Dena hai", ur: "دینا ہے" },
  c_total_payable: { en: "Total Payable", rm: "Kul dena hai", ur: "کل دینا ہے" },
  c_total_paid: { en: "Total Paid", rm: "Kul diya", ur: "کل دیا" },
  c_total_payments: { en: "Total Payments", rm: "Kul adaigi", ur: "کل ادائیگی" },
  c_total_purchases: { en: "Total Purchases", rm: "Kul kharidari", ur: "کل خریداری" },
  c_total_repaid: { en: "Total Repaid", rm: "Kul wapas aaya", ur: "کل واپس آیا" },
  c_total_issued: { en: "Total Issued", rm: "Kul jaari kiya", ur: "کل جاری کیا" },
  c_total_stock_value: { en: "Total Stock Value", rm: "Stock ki kul qeemat", ur: "اسٹاک کی کل قیمت" },
  c_total_debit: { en: "Total Debit", rm: "Kul debit", ur: "کل ڈیبٹ" },
  c_total_credit: { en: "Total Credit", rm: "Kul credit", ur: "کل کریڈٹ" },
  c_debit: { en: "Debit", rm: "Debit", ur: "ڈیبٹ" },
  c_credit: { en: "Credit", rm: "Credit", ur: "کریڈٹ" },
  c_farq: { en: "Difference", rm: "Farq", ur: "فرق" },
  c_shortage: { en: "Shortage", rm: "Kami", ur: "کمی" },
  c_short: { en: "Short", rm: "Kam", ur: "کم" },
  c_commission: { en: "Commission", rm: "Commission", ur: "کمیشن" },
  c_credit_limit: { en: "Credit Limit", rm: "Udhaar ki hadd", ur: "ادھار کی حد" },
  c_credit_limit_rs: { en: "Credit Limit (Rs)", rm: "Udhaar ki hadd (Rs)", ur: "ادھار کی حد (روپے)" },
  c_owed_to_farmers: { en: "Owed to Farmers", rm: "Kisanon ko dena hai", ur: "کسانوں کو دینا ہے" },

  // ---- Adaigi ke tareeqe ----
  c_cash: { en: "Cash", rm: "Naqad", ur: "نقد" },
  c_bank_transfer: { en: "Bank Transfer", rm: "Bank transfer", ur: "بینک ٹرانسفر" },
  c_cheque: { en: "Cheque", rm: "Cheque", ur: "چیک" },
  c_payment_mode: { en: "Payment Mode", rm: "Adaigi ka tareeqa", ur: "ادائیگی کا طریقہ" },
  c_payment_method: { en: "Payment Method", rm: "Adaigi ka tareeqa", ur: "ادائیگی کا طریقہ" },
  c_advance: { en: "Advance", rm: "Advance", ur: "ایڈوانس" },
  c_advance_payment: { en: "Advance Payment", rm: "Advance adaigi", ur: "ایڈوانس ادائیگی" },
  c_other: { en: "Other", rm: "Doosra", ur: "دوسرا" },

  // ---- Bank ka khata ----
  c_bank_details: { en: "Bank Details (for payment)", rm: "Bank ki tafseel (adaigi ke liye)", ur: "بینک کی تفصیل (ادائیگی کے لیے)" },
  c_bank_name: { en: "Bank Name", rm: "Bank ka naam", ur: "بینک کا نام" },
  c_bank_logo: { en: "Bank Logo", rm: "Bank ka nishan", ur: "بینک کا نشان" },
  c_account_title: { en: "Account Title", rm: "Khate ka naam", ur: "کھاتے کا نام" },
  c_account_number: { en: "Account Number", rm: "Khata number", ur: "کھاتہ نمبر" },
  c_account_number_optional: { en: "Account Number (optional)", rm: "Khata number (marzi se)", ur: "کھاتہ نمبر (مرضی سے)" },

  // ---- Log ----
  c_farmer: { en: "Farmer", rm: "Kisan", ur: "کسان" },
  c_farmers: { en: "Farmers", rm: "Kisan", ur: "کسان" },
  c_buyer: { en: "Buyer", rm: "Buyer", ur: "بائر" },
  c_supplier: { en: "Supplier", rm: "Supplier", ur: "سپلائر" },
  c_staff: { en: "Staff", rm: "Staff", ur: "عملہ" },
  c_team: { en: "Team", rm: "Team", ur: "ٹیم" },
  c_company: { en: "Company", rm: "Company", ur: "کمپنی" },
  c_business_name: { en: "Business Name", rm: "Karobar ka naam", ur: "کاروبار کا نام" },
  c_contact: { en: "Contact", rm: "Raabta", ur: "رابطہ" },
  c_contact_person: { en: "Contact Person", rm: "Raabte ka banda", ur: "رابطے کا بندہ" },
  c_designation: { en: "Designation", rm: "Ohda", ur: "عہدہ" },
  c_department: { en: "Department", rm: "Department", ur: "شعبہ" },
  c_role: { en: "Role", rm: "Darja", ur: "درجہ" },
  c_joined: { en: "Joined", rm: "Shamil hua", ur: "شامل ہوا" },

  // ---- Raabta aur jagah ----
  c_cnic: { en: "CNIC", rm: "CNIC", ur: "CNIC" },
  c_cnic_optional: { en: "CNIC (optional)", rm: "CNIC (marzi se)", ur: "CNIC (مرضی سے)" },
  c_view_details: { en: "View Details", rm: "Tafseel dekhein", ur: "تفصیل دیکھیں" },
  c_phone: { en: "Phone", rm: "Phone", ur: "فون" },
  c_phone_number: { en: "Phone Number", rm: "Phone number", ur: "فون نمبر" },
  c_mobile_number: { en: "Mobile Number", rm: "Mobile number", ur: "موبائل نمبر" },
  c_email: { en: "Email", rm: "Email", ur: "ای میل" },
  c_email_address: { en: "Email address", rm: "Email ka pata", ur: "ای میل کا پتہ" },
  c_address: { en: "Address", rm: "Pata", ur: "پتہ" },
  c_location: { en: "Location", rm: "Jagah", ur: "جگہ" },
  c_village: { en: "Village", rm: "Gaon", ur: "گاؤں" },
  c_tehsil: { en: "Tehsil", rm: "Tehsil", ur: "تحصیل" },
  c_district: { en: "District", rm: "Zila", ur: "ضلع" },
  c_branch: { en: "Branch", rm: "Shakh", ur: "شاخ" },
  c_shop: { en: "Shop", rm: "Dukan", ur: "دکان" },
  c_shops: { en: "Shops", rm: "Dukanein", ur: "دکانیں" },

  // ---- Maal ----
  c_product: { en: "Product", rm: "Cheez", ur: "چیز" },
  c_products: { en: "Products", rm: "Cheezein", ur: "چیزیں" },
  c_add_product: { en: "Add Product", rm: "Cheez shamil karein", ur: "چیز شامل کریں" },
  c_search_product: { en: "Search product...", rm: "Cheez dhoondein...", ur: "چیز تلاش کریں..." },
  c_quantity: { en: "Quantity", rm: "Tadaad", ur: "تعداد" },
  c_qty: { en: "Qty", rm: "Tadaad", ur: "تعداد" },
  c_pack_size: { en: "Pack Size", rm: "Pack ka size", ur: "پیک کا سائز" },
  c_brand: { en: "Brand", rm: "Brand", ur: "برانڈ" },
  c_stock: { en: "Stock", rm: "Stock", ur: "اسٹاک" },
  c_seed: { en: "Seed", rm: "Beej", ur: "بیج" },
  c_fertilizer: { en: "Fertilizer", rm: "Khaad", ur: "کھاد" },
  c_pesticide: { en: "Pesticide", rm: "Zehr", ur: "زہر" },
  c_crop: { en: "Crop", rm: "Fasal", ur: "فصل" },
  c_machinery: { en: "Machinery", rm: "Machinery", ur: "مشینری" },
  c_service: { en: "Service", rm: "Service", ur: "سروس" },
  c_vehicle: { en: "Vehicle", rm: "Gaari", ur: "گاڑی" },
  c_expiry_date: { en: "Expiry Date", rm: "Khatam hone ki tareekh", ur: "ختم ہونے کی تاریخ" },

  // ---- Gaari ka kharcha ----
  c_petrol: { en: "Petrol", rm: "Petrol", ur: "پٹرول" },
  c_mileage: { en: "Mileage", rm: "Mileage", ur: "مائلیج" },
  c_tyre: { en: "Tyre", rm: "Tyre", ur: "ٹائر" },
  c_oil_change: { en: "Oil Change", rm: "Oil change", ur: "آئل چینج" },
  c_electricity: { en: "Electricity", rm: "Bijli", ur: "بجلی" },

  // ---- Button ----
  c_save: { en: "Save", rm: "Mehfooz karein", ur: "محفوظ کریں" },
  c_cancel: { en: "Cancel", rm: "Mansookh", ur: "منسوخ" },
  c_close: { en: "Close", rm: "Band karein", ur: "بند کریں" },
  c_back: { en: "Back", rm: "Wapas", ur: "واپس" },
  c_add: { en: "Add", rm: "Shamil karein", ur: "شامل کریں" },
  c_edit: { en: "Edit", rm: "Tabdeel karein", ur: "تبدیل کریں" },
  c_delete: { en: "Delete", rm: "Mitayein", ur: "مٹائیں" },
  c_view: { en: "View", rm: "Dekhein", ur: "دیکھیں" },
  c_send: { en: "Send", rm: "Bhejein", ur: "بھیجیں" },
  c_send_email: { en: "Send by Email", rm: "Email se bhejein", ur: "ای میل سے بھیجیں" },
  c_download: { en: "Download", rm: "Download", ur: "ڈاؤن لوڈ" },
  c_print: { en: "Print", rm: "Print", ur: "پرنٹ" },
  c_print_pdf: { en: "Print / PDF", rm: "Print / PDF", ur: "پرنٹ / PDF" },
  c_check: { en: "Check", rm: "Check karein", ur: "چیک کریں" },
  c_approve: { en: "Approve", rm: "Manzoor karein", ur: "منظور کریں" },
  c_reject: { en: "Reject", rm: "Rad karein", ur: "رد کریں" },
  c_confirm_reject: { en: "Confirm Reject", rm: "Rad karne ki tasdeeq", ur: "رد کرنے کی تصدیق" },
  c_reject_reason: { en: "Reason for rejection", rm: "Rad karne ki wajah", ur: "رد کرنے کی وجہ" },
  c_record_payment: { en: "Record Payment", rm: "Adaigi darj karein", ur: "ادائیگی درج کریں" },
  c_upload_payment_slip: { en: "Upload Payment Slip", rm: "Adaigi ki parchi lagayein", ur: "ادائیگی کی پرچی لگائیں" },
  c_verify_release_payout: { en: "Verify & Release Payout", rm: "Tasdeeq kar ke adaigi jaari karein", ur: "تصدیق کر کے ادائیگی جاری کریں" },
  c_mark_delivered: { en: "Mark Delivered", rm: "Pahunch gaya likhein", ur: "پہنچ گیا لکھیں" },
  c_select_staff: { en: "Select Staff", rm: "Staff chunein", ur: "عملہ چنیں" },
  c_enter_name: { en: "Enter name", rm: "Naam likhein", ur: "نام لکھیں" },

  // ---- Haalat ----
  c_active: { en: "Active", rm: "Chal raha hai", ur: "چل رہا ہے" },
  c_inactive: { en: "Inactive", rm: "Band hai", ur: "بند ہے" },
  c_activate: { en: "Activate", rm: "Chalu karein", ur: "چالو کریں" },
  c_deactivate: { en: "Deactivate", rm: "Band karein", ur: "بند کریں" },
  c_suspend: { en: "Suspend", rm: "Roke rakhein", ur: "روکے رکھیں" },
  c_suspended: { en: "Suspended", rm: "Roka hua", ur: "روکا ہوا" },
  c_reactivate: { en: "Reactivate", rm: "Dobara chalu karein", ur: "دوبارہ چالو کریں" },
  c_pending: { en: "Pending", rm: "Intezar mein", ur: "انتظار میں" },
  c_verified: { en: "Verified", rm: "Tasdeeq shuda", ur: "تصدیق شدہ" },
  c_received: { en: "Received", rm: "Mil gaya", ur: "مل گیا" },
  c_responded: { en: "Responded", rm: "Jawab de diya", ur: "جواب دے دیا" },
  c_read: { en: "Read", rm: "Parh liya", ur: "پڑھ لیا" },
  c_new: { en: "New", rm: "Naya", ur: "نیا" },
  c_published: { en: "Published", rm: "Shaya shuda", ur: "شائع شدہ" },
  c_closed: { en: "Closed", rm: "Band", ur: "بند" },
  c_damaged: { en: "Damaged", rm: "Kharab", ur: "خراب" },
  c_damage: { en: "Damage", rm: "Kharabi", ur: "خرابی" },
  c_marked: { en: "Marked", rm: "Nishan lage huye", ur: "نشان لگے ہوئے" },

  // ---- Kaghaz ----
  c_slip: { en: "Slip", rm: "Parchi", ur: "پرچی" },
  c_statement: { en: "Statement", rm: "Gosharah", ur: "گوشوارہ" },
  c_documents: { en: "Documents", rm: "Kaghazat", ur: "کاغذات" },
  c_photo: { en: "Photo", rm: "Tasveer", ur: "تصویر" },
  c_payment_word: { en: "Payment", rm: "Adaigi", ur: "ادائیگی" },
  c_order: { en: "Order", rm: "Order", ur: "آرڈر" },
  c_order_summary: { en: "Order Summary", rm: "Order ka khulasa", ur: "آرڈر کا خلاصہ" },
  c_order_charges: { en: "Order Charges", rm: "Order ke kharche", ur: "آرڈر کے خرچے" },
  c_new_return: { en: "New Return", rm: "Nayi wapsi", ur: "نئی واپسی" },
  c_recent_transactions: { en: "Recent Transactions", rm: "Aakhri lein dein", ur: "آخری لین دین" },
  c_recent_entries: { en: "Recent Entries", rm: "Aakhri indraj", ur: "آخری اندراج" },
  c_dashboard: { en: "Dashboard", rm: "Dashboard", ur: "ڈیش بورڈ" },
  c_from_where: { en: "From", rm: "Kahan se", ur: "کہاں سے" },
  c_taken_by: { en: "Taken by", rm: "Le ke jane wala", ur: "لے کر جانے والا" },
  c_farms: { en: "Farms", rm: "Khet", ur: "کھیت" },

  // ---- Jawab ke jumle ----
  c_saved: { en: "Saved.", rm: "Mehfooz ho gaya.", ur: "محفوظ ہو گیا۔" },
  c_updated: { en: "Updated.", rm: "Tabdeel ho gaya.", ur: "تبدیل ہو گیا۔" },
  c_done: { en: "Done.", rm: "Ho gaya.", ur: "ہو گیا۔" },
  c_email_sent: { en: "Email sent.", rm: "Email chali gayi.", ur: "ای میل چلی گئی۔" },
  c_permissions_saved: { en: "Permissions saved.", rm: "Ijazatein mehfooz ho gayin.", ur: "اجازتیں محفوظ ہو گئیں۔" },
  c_login_required: { en: "Login required.", rm: "Pehle login karein.", ur: "پہلے لاگ ان کریں۔" },

  // ---- Khali qatar ----
  c_no_records: { en: "No records.", rm: "Koi indraj nahi.", ur: "کوئی اندراج نہیں۔" },
  c_no_staff: { en: "No staff found.", rm: "Koi staff nahi mila.", ur: "کوئی عملہ نہیں ملا۔" },
  c_no_products: { en: "No products found.", rm: "Koi cheez nahi mili.", ur: "کوئی چیز نہیں ملی۔" },
  c_no_tx_period: { en: "No transactions in this period.", rm: "Is arse mein koi lein dein nahi.", ur: "اس عرصے میں کوئی لین دین نہیں۔" },
  c_no_entries_period: { en: "No entries in this period.", rm: "Is arse mein koi indraj nahi.", ur: "اس عرصے میں کوئی اندراج نہیں۔" },
  c_no_outstanding: { en: "No outstanding balances.", rm: "Kisi par kuch baqi nahi.", ur: "کسی پر کچھ باقی نہیں۔" },
  c_farmers_with_outstanding: { en: "Farmers with Outstanding Balance", rm: "Jin kisanon par baqi hai", ur: "جن کسانوں پر باقی ہے" },

  // ---- Rok ke jumle ----
  //
  // Ye "kuch nahi mila" nahi kehte -- ye kehte hain ke DEKHNE ka haq
  // nahi. Do alag baatein hain, aur inhen ek jaisa likh dena bande ko
  // ye samjha deta hai ke record hi khali hai.
  c_only_finance_admin: {
    en: "This page is for Finance, Manager and Admin only.",
    rm: "Ye safha sirf Finance, Manager aur Admin ke liye hai.",
    ur: "یہ صفحہ صرف فنانس، منیجر اور ایڈمن کے لیے ہے۔",
  },
  c_only_owner_admin: {
    en: "This page is for Owner and Admin only.",
    rm: "Ye safha sirf Owner aur Admin ke liye hai.",
    ur: "یہ صفحہ صرف مالک اور ایڈمن کے لیے ہے۔",
  },
} as const;
