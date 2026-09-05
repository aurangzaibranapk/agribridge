/**
 * Dealer, shakhein aur un ke gosharay.
 *
 * SHAKH KI TEEN HAALATEIN ALAG HAIN: chalti hui, roki hui, aur bandh.
 * "Roki hui" waqti hai -- adaigi ka masla hal ho to khul jati hai.
 * "Bandh" faisla hai. Dono ko ek lafz dena us bande ko dhoka deta hai
 * jo fehrist dekh kar ye tay karta hai ke aaj is dukan ko maal bhejna
 * hai ya nahi.
 *
 * HAALAT BADALTE WAQT WAJAH ZAROORI HAI. Wo khana yahan is liye hai ke
 * do mahine baad koi poochhe "ye dukan band kyun hui thi" to jawab
 * record mein ho -- kisi ki yaad mein nahi.
 *
 * BRANCH KI JAGAH (lat/lng) hazri ke liye hai. Us safhe par Google Maps
 * ka tareeqa qadam ba qadam likha hua hai, kyunke ye kaam saal mein ek
 * dafa hota hai aur har dafa naya banda karta hai.
 */
export const partnersDict = {
  // ---- Shakh ----
  br_new_shop: { en: "New Shop / Branch", rm: "Nayi dukan / shakh", ur: "نئی دکان / شاخ" },
  br_name_eg: { en: "e.g. Jhang Bazaar Shop", rm: "misal: Jhang Bazaar wali dukan", ur: "مثال: جھنگ بازار والی دکان" },
  br_edit: { en: "Edit Branch", rm: "Shakh tabdeel karein", ur: "شاخ تبدیل کریں" },
  br_name: { en: "Branch Name", rm: "Shakh ka naam", ur: "شاخ کا نام" },
  br_main: { en: "Main", rm: "Markazi", ur: "مرکزی" },
  br_blocked: { en: "Blocked", rm: "Bandh", ur: "بند" },
  br_reason_label: { en: "Reason:", rm: "Wajah:", ur: "وجہ:" },
  br_reason_field: { en: "Reason", rm: "Wajah", ur: "وجہ" },
  br_reason_eg: { en: "e.g. payment issue, licence expired", rm: "misal: adaigi ka masla, licence khatam ho gaya", ur: "مثال: ادائیگی کا مسئلہ، لائسنس ختم ہو گیا" },
  br_no_staff: { en: "No staff assigned yet.", rm: "Abhi koi staff nahi laga.", ur: "ابھی کوئی عملہ نہیں لگا۔" },
  br_shops_branches: { en: "Shops / Branches", rm: "Dukanein / shakhein", ur: "دکانیں / شاخیں" },
  br_no_shops: { en: "No shops yet", rm: "Abhi koi dukan nahi", ur: "ابھی کوئی دکان نہیں" },
  br_order_charges: { en: "Order Charges", rm: "Order ke kharche", ur: "آرڈر کے خرچے" },
  br_payments_advance: { en: "Payments / Advance", rm: "Adaigi / advance", ur: "ادائیگی / ایڈوانس" },

  // ---- Shakh ki jagah ----
  bl_title: { en: "Branch Locations (for attendance)", rm: "Shakhon ki jagah (hazri ke liye)", ur: "شاخوں کی جگہ (حاضری کے لیے)" },
  bl_saved: { en: "Saved.", rm: "Mehfooz ho gaya.", ur: "محفوظ ہو گیا۔" },
  bl_latitude: { en: "Latitude", rm: "Latitude", ur: "لیٹیٹیوڈ" },
  bl_longitude: { en: "Longitude", rm: "Longitude", ur: "لانگیٹیوڈ" },
  bl_radius: { en: "Radius (metres)", rm: "Daira (meter)", ur: "دائرہ (میٹر)" },
  bl_clear_note: {
    en: "Save with both fields empty to remove the location.",
    rm: "Dono khane khali chhoR kar mehfooz karein to jagah hat jayegi.",
    ur: "دونوں خانے خالی چھوڑ کر محفوظ کریں تو جگہ ہٹ جائے گی۔",
  },
  bl_step_open_maps: { en: "Open Google Maps and find your branch", rm: "Google Maps kholein aur apni shakh dhoondein", ur: "گوگل میپس کھولیں اور اپنی شاخ تلاش کریں" },
  bl_step_long_press: {
    en: "Press and hold on the branch's spot (or right-click)",
    rm: "Shakh ki jagah par ungli daba kar rakhein (ya right-click karein)",
    ur: "شاخ کی جگہ پر انگلی دبا کر رکھیں (یا رائٹ کلک کریں)",
  },
  bl_step_two_numbers: { en: "Two numbers will appear, like", rm: "Do number nazar aayenge, jaise", ur: "دو نمبر نظر آئیں گے، جیسے" },

  // ---- Dealer ----
  dl_new: { en: "New Dealer", rm: "Naya Dealer", ur: "نیا ڈیلر" },
  dl_edit: { en: "Edit Dealer", rm: "Dealer tabdeel karein", ur: "ڈیلر تبدیل کریں" },
  dl_business_eg: { en: "e.g. ABC Traders", rm: "misal: ABC Traders", ur: "مثال: ABC Traders" },
  dl_dealers: { en: "Dealers", rm: "Dealer", ur: "ڈیلر" },
  dl_none_yet: { en: "No dealers yet", rm: "Abhi koi Dealer nahi", ur: "ابھی کوئی ڈیلر نہیں" },
  dl_code: { en: "Dealer Code", rm: "Dealer ka code", ur: "ڈیلر کا کوڈ" },
  dl_total_commission: { en: "Total Commission", rm: "Kul commission", ur: "کل کمیشن" },
} as const;

/**
 * Kisan ka safha, aur HR ke chhote safhe (ID card, WhatsApp pehchan).
 *
 * WHATSAPP PEHCHAN KE SAFHE PAR TEEN HAALATEIN ALAG HAIN, aur ye farq
 * hi us safhe ka poora maqsad hai:
 *
 *   "Tasdeeq ho chuki"  -- banda pehchana ja chuka, WhatsApp chal raha
 *                          hai.
 *   "Tayyar, intezar mein" -- HR ne phone aur CNIC bhar diye, ab bande
 *                          ka apna message aana baqi hai.
 *   "Data adhoora"      -- HR ne kuch bhara hi nahi. Ye HAMARI ghalti
 *                          hai, bande ki nahi.
 *
 * Teenon ko "pending" likh dena aasan tha, magar phir HR ko kabhi pata
 * na chalta ke kaam kis ke zimme hai -- us ke apne, ya us bande ke.
 */
export const peoplePagesDict = {
  // ---- Kisan ka safha ----
  fp_back: { en: "Back", rm: "Peechhe", ur: "پیچھے" },
  fp_no_farm: { en: "This farmer has not added a farm yet.", rm: "Is kisan ne abhi koi khet darj nahi kiya.", ur: "اس کسان نے ابھی کوئی کھیت درج نہیں کیا۔" },
  fp_total_bookings: { en: "Total bookings", rm: "Kul bookings", ur: "کل بکنگ" },
  fp_in_progress: { en: "In progress", rm: "Chal rahi", ur: "چل رہی" },
  fp_farmer_owes: { en: "Farmer owes", rm: "Kisan ke zimme", ur: "کسان کے ذمے" },
  fp_add_farmer: { en: "Add Farmer", rm: "Kisan shamil karein", ur: "کسان شامل کریں" },
  fp_farmer_added: { en: "Farmer added.", rm: "Kisan shamil ho gaya.", ur: "کسان شامل ہو گیا۔" },
  fp_promote: { en: "Promote to Staff / Admin", rm: "Staff ya Admin bana dein", ur: "عملہ یا ایڈمن بنا دیں" },
  fp_delete_q: { en: "Delete farmer?", rm: "Kisan ko mita dein?", ur: "کسان کو مٹا دیں؟" },
  fp_promote_q: { en: "Promote to staff?", rm: "Staff bana dein?", ur: "عملہ بنا دیں؟" },
  fp_contact: { en: "Contact", rm: "Raabta", ur: "رابطہ" },
  fp_registered: { en: "Registered", rm: "Darj hua", ur: "درج ہوا" },
  fp_details: { en: "Details", rm: "Tafseel", ur: "تفصیل" },
  fp_farmers: { en: "Farmers", rm: "Kisan", ur: "کسان" },
  fp_none_registered: { en: "No farmers registered yet", rm: "Abhi koi kisan darj nahi hua", ur: "ابھی کوئی کسان درج نہیں ہوا" },
  fp_total_credits: { en: "Total Credits", rm: "Kul credit", ur: "کل کریڈٹ" },
  fp_total_debits: { en: "Total Debits", rm: "Kul debit", ur: "کل ڈیبٹ" },

  // ---- ID card ----
  ic_settings: { en: "Card settings", rm: "Card ki settings", ur: "کارڈ کی سیٹنگز" },
  ic_print: { en: "Print ID card", rm: "ID card print karein", ur: "ID کارڈ پرنٹ کریں" },
  ic_download: { en: "Download ID card details", rm: "ID card ki tafseel download karein", ur: "ID کارڈ کی تفصیل ڈاؤن لوڈ کریں" },
  ic_share_whatsapp: { en: "Share via WhatsApp", rm: "WhatsApp par bhejein", ur: "واٹس ایپ پر بھیجیں" },
  ic_share_email: { en: "Share via Email", rm: "Email par bhejein", ur: "ای میل پر بھیجیں" },
  ic_blood_label: { en: "Blood Group:", rm: "Blood group:", ur: "بلڈ گروپ:" },
  ic_emergency_label: { en: "Emergency:", rm: "Emergency:", ur: "ایمرجنسی:" },
  ic_update_details: { en: "Update Card Details", rm: "Card ki tafseel tabdeel karein", ur: "کارڈ کی تفصیل تبدیل کریں" },
  ic_employee_code: { en: "Employee Code", rm: "Mulazim ka code", ur: "ملازم کا کوڈ" },
  ic_blood_group: { en: "Blood Group (e.g. O+)", rm: "Blood group (misal: O+)", ur: "بلڈ گروپ (مثال: O+)" },
  ic_emergency_name: { en: "Emergency Contact Name", rm: "Emergency raabte ka naam", ur: "ایمرجنسی رابطے کا نام" },
  ic_emergency_number: { en: "Emergency Contact Number", rm: "Emergency raabte ka number", ur: "ایمرجنسی رابطے کا نمبر" },

  // ---- Staff WhatsApp pehchan ----
  sw_title: { en: "Staff WhatsApp Identification", rm: "Staff ki WhatsApp pehchan", ur: "عملے کی واٹس ایپ پہچان" },
  sw_verified: { en: "Verified", rm: "Tasdeeq ho chuki", ur: "تصدیق ہو چکی" },
  sw_ready_waiting: { en: "Ready, waiting", rm: "Tayyar, intezar mein", ur: "تیار، انتظار میں" },
  sw_just_message: {
    en: "The staff member only has to send a WhatsApp message",
    rm: "Bande ko sirf WhatsApp par message karna hai",
    ur: "بندے کو صرف واٹس ایپ پر میسج کرنا ہے",
  },
  sw_data_missing: { en: "Data incomplete", rm: "Maloomat adhoori", ur: "معلومات ادھوری" },
  sw_phone_cnic_pending: { en: "Phone or CNIC still to be filled in", rm: "Phone ya CNIC bharna baqi", ur: "فون یا CNIC بھرنا باقی" },
  sw_linked: { en: "Linked", rm: "JuR gaya", ur: "جڑ گیا" },
  sw_waiting: { en: "Waiting", rm: "Intezar mein", ur: "انتظار میں" },
  sw_not_set: { en: "not set", rm: "nahi hai", ur: "نہیں ہے" },
  sw_hr_page: { en: "HR page", rm: "HR ka safha", ur: "HR کا صفحہ" },
  sw_here: { en: "here", rm: "yahan", ur: "یہاں" },
  sw_how_it_works: {
    en: "How it works: on the HR page, fill in the staff member's phone and CNIC. Then that person sends any WhatsApp message from that same number — the system asks for the last 6 digits of the CNIC, and on the right answer the number is linked for good.",
    rm: "Tareeqa: HR ke safhe par bande ka phone aur CNIC bharein. Phir wo apne usi number se WhatsApp par koi bhi paighaam bheje -- nizam CNIC ke aakhri 6 hindse poochhega, aur sahi jawab par number hamesha ke liye juR jayega.",
    ur: "طریقہ: HR کے صفحے پر بندے کا فون اور CNIC بھریں۔ پھر وہ اپنے اسی نمبر سے واٹس ایپ پر کوئی بھی پیغام بھیجے — نظام CNIC کے آخری 6 ہندسے پوچھے گا، اور صحیح جواب پر نمبر ہمیشہ کے لیے جڑ جائے گا۔",
  },
} as const;
