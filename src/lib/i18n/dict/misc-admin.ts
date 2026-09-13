/**
 * Supplier, do report, aur nayi cheez ka form.
 *
 * SUPPLIER KI "CREDIT LIMIT" KA RUKH ULTA HAI. Baqi poore nizam mein
 * udhaar ki hadd wo hai jo HUM kisi ko dete hain; yahan wo hai jo
 * supplier HUMEIN deta hai. Is liye us ka apna jumla hai -- ek hi lafz
 * "Credit Limit" dono jagah rakhne par finance wala banda ek din ulta
 * padh leta hai.
 *
 * DO REPORTON MEIN "Owed to Farmers" ka apna khana hai. Ye kul kharidari
 * se alag adad hai: kharidari wo hai jo li gayi, ye wo hai jo ab tak di
 * nahi gayi. Dono ko ek jagah dikhana report ko be-kaar kar deta hai --
 * kyunke jo sawal roz poochha jata hai wo doosra hai.
 *
 * FILER / NON-FILER tarjuma nahi hue. FBR ki apni istilah hai aur
 * kaghaz par bhi wohi likhi hoti hai.
 */
export const miscAdminDict = {
  // ---- Supplier ----
  su_company_name: { en: "Company Name (legal / business name)", rm: "Company ka naam (kaghazi / karobari naam)", ur: "کمپنی کا نام (کاغذی / کاروباری نام)" },
  su_credit_limit: {
    en: "Credit Limit (Rs.) — how much credit the supplier gives us",
    rm: "Udhaar ki hadd (Rs.) -- supplier hamein kitna udhaar deta hai",
    ur: "ادھار کی حد (روپے) — سپلائر ہمیں کتنا ادھار دیتا ہے",
  },
  su_legal_documents: { en: "Legal Documents", rm: "Kaghazat", ur: "کاغذات" },
  su_cnic_number: { en: "CNIC Number", rm: "CNIC number", ur: "CNIC نمبر" },
  su_cnic_copy: { en: "Upload CNIC Copy", rm: "CNIC ki nakal lagayein", ur: "CNIC کی نقل لگائیں" },
  su_ntn_number: { en: "NTN Number", rm: "NTN number", ur: "NTN نمبر" },
  su_ntn_certificate: { en: "Upload NTN Certificate", rm: "NTN sanad lagayein", ur: "NTN سند لگائیں" },
  su_tax_status: { en: "Tax Status", rm: "Tax ki haalat", ur: "ٹیکس کی حالت" },
  su_filer: { en: "Filer (pays tax)", rm: "Filer (tax bharta hai)", ur: "فائلر (ٹیکس بھرتا ہے)" },
  su_non_filer: { en: "Non-Filer", rm: "Non-Filer", ur: "نان فائلر" },

  // ---- Anaj ki kharidari ki report ----
  pr_title: { en: "Grain Procurement Report", rm: "Anaj ki kharidari ki report", ur: "اناج کی خریداری کی رپورٹ" },
  pr_total_quantity: { en: "Total Quantity", rm: "Kul tadaad", ur: "کل تعداد" },
  pr_avg_rate_kg: { en: "Avg. Rate / kg", rm: "Ausat rate / kg", ur: "اوسط ریٹ / کلو" },
  pr_crop_breakdown: { en: "Crop-wise Breakdown", rm: "Fasal fasal ka hisaab", ur: "فصل فصل کا حساب" },
  pr_no_procurement: { en: "No procurement in this period.", rm: "Is arse mein koi kharidari nahi hui.", ur: "اس عرصے میں کوئی خریداری نہیں ہوئی۔" },
  pr_supplied: { en: "Supplied", rm: "Diya", ur: "دیا" },
  pr_quality: { en: "Quality", rm: "Maal ki qism", ur: "مال کی قسم" },
  pr_weight: { en: "Weight", rm: "Wazan", ur: "وزن" },

  // ---- Doodh ki report ----
  mr_title: { en: "Milk Collection Report", rm: "Doodh jama karne ki report", ur: "دودھ جمع کرنے کی رپورٹ" },
  mr_all_farmers: { en: "All Farmers", rm: "Sab kisan", ur: "سب کسان" },
  mr_total_litres: { en: "Total Litres", rm: "Kul litre", ur: "کل لیٹر" },
  mr_avg_rate_litre: { en: "Avg. Rate / litre", rm: "Ausat rate / litre", ur: "اوسط ریٹ / لیٹر" },
  mr_avg_fat: { en: "Avg. Fat %", rm: "Ausat fat %", ur: "اوسط فیٹ %" },
  mr_no_collection: { en: "No milk collection in this period.", rm: "Is arse mein doodh jama nahi hua.", ur: "اس عرصے میں دودھ جمع نہیں ہوا۔" },
  mr_litres: { en: "Litres", rm: "Litre", ur: "لیٹر" },
  mr_shift: { en: "Shift", rm: "Waqt", ur: "وقت" },
  mr_fat: { en: "Fat %", rm: "Fat %", ur: "فیٹ %" },

  // ---- Nayi cheez ----
  pf_photo_prefilled: {
    en: "Fields were filled in from the photo — please double-check them.",
    rm: "Khane tasveer se bhar diye gaye hain -- ek dafa khud dekh lein.",
    ur: "خانے تصویر سے بھر دیے گئے ہیں — ایک دفعہ خود دیکھ لیں۔",
  },
  pf_product_name: { en: "Product Name *", rm: "Cheez ka naam *", ur: "چیز کا نام *" },
  pf_unit: { en: "Unit", rm: "Unit", ur: "یونٹ" },
  pf_pack_size_eg: { en: "e.g. 500ml, 1kg", rm: "misal: 500ml, 1kg", ur: "مثال: 500ml، 1kg" },
  pf_barcode: { en: "Barcode", rm: "Barcode", ur: "بارکوڈ" },
  pf_manufacture_date: { en: "Manufacture Date", rm: "Banne ki tareekh", ur: "بننے کی تاریخ" },
  pf_active_ingredient: { en: "Active Ingredient", rm: "Asal juzw", ur: "اصل جزو" },
  pf_composition: { en: "Composition", rm: "Tarkeeb", ur: "ترکیب" },
  pf_dose: { en: "Dose", rm: "Miqdar", ur: "مقدار" },
  pf_usage_instructions: { en: "Usage Instructions", rm: "Istemal ka tareeqa", ur: "استعمال کا طریقہ" },
  pf_safety_info: { en: "Safety Information", rm: "Ehtiyat ki baatein", ur: "احتیاط کی باتیں" },
  pf_mrp_rate: { en: "MRP Rate (for credit) (Rs.)", rm: "MRP rate (udhaar ke liye) (Rs.)", ur: "MRP ریٹ (ادھار کے لیے) (روپے)" },
  pf_low_stock_below: { en: "Low Stock Alert Below", rm: "Itne se kam ho to ittila", ur: "اتنے سے کم ہو تو اطلاع" },
} as const;
