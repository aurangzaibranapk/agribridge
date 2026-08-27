export type Lang = "en" | "ur";

const dict = {
  app_name: { en: "AgriBridge", ur: "ایگری برج" },
  farmer_portal: { en: "Farmer Portal", ur: "کسان پورٹل" },
  back_to_website: { en: "Back to Website", ur: "ویب سائٹ پر واپس" },
  back_to_dashboard: { en: "Back to Dashboard", ur: "ڈیش بورڈ پر واپس" },

  // Sidebar
  nav_dashboard: { en: "Dashboard", ur: "ڈیش بورڈ" },
  nav_profile: { en: "My Profile", ur: "میری پروفائل" },
  nav_wallet: { en: "My Wallet", ur: "میرا بٹوہ" },
  nav_farms: { en: "My Farms", ur: "میرے کھیت" },
  nav_livestock: { en: "Livestock", ur: "مویشی" },
  nav_crops: { en: "My Crops", ur: "میری فصلیں" },
  nav_fertilizer: { en: "Fertilizer", ur: "کھاد" },
  nav_machinery: { en: "Machinery", ur: "مشینری" },
  nav_farm_management: { en: "Farm Management", ur: "فارم مینجمنٹ" },

  // Dashboard
  welcome: { en: "Welcome", ur: "خوش آمدید" },
  farmer_code: { en: "Farmer Code", ur: "کسان کوڈ" },
  profile: { en: "Profile", ur: "پروفائل" },
  complete: { en: "Complete", ur: "مکمل" },
  harvest_profit: { en: "Harvest Profit", ur: "فصل کا منافع" },
  recent_activity: { en: "Recent Activity", ur: "حالیہ سرگرمی" },
  activity_subtitle: { en: "All your service requests in one place.", ur: "آپ کی تمام سروس درخواستیں ایک جگہ۔" },
  quick_links: { en: "Quick Links", ur: "فوری روابط" },
  sell_produce: { en: "Sell Produce", ur: "پیداوار بیچیں" },
  marketplace: { en: "Marketplace", ur: "مارکیٹ پلیس" },
  place_order_bridge: { en: "Place Order (Bridge)", ur: "آرڈر دیں (برج)" },
  no_activity_yet: { en: "No activity yet. Request a service above to get started.", ur: "ابھی کوئی سرگرمی نہیں۔ شروع کرنے کے لیے اوپر سروس کی درخواست کریں۔" },
  my_wallet_stat: { en: "My Wallet", ur: "میرا بٹوہ" },
  my_farms_stat: { en: "My Farms", ur: "میرے کھیت" },
  my_crops_stat: { en: "My Crops", ur: "میری فصلیں" },
  machinery_stat: { en: "Machinery", ur: "مشینری" },
  fertilizer_stat: { en: "Fertilizer", ur: "کھاد" },
  livestock_stat: { en: "Livestock", ur: "مویشی" },
  district_not_set: { en: "District not set", ur: "ضلع درج نہیں" },
  mobile_not_set: { en: "Mobile not set", ur: "موبائل درج نہیں" },
  harvest_link: { en: "Harvest", ur: "فصل کی کٹائی" },

  // Profile page
  complete_your_profile: { en: "Complete Your Profile", ur: "اپنی پروفائل مکمل کریں" },
  percent_complete: { en: "complete", ur: "مکمل" },
  profile_complete_msg: { en: "Profile Complete", ur: "پروفائل مکمل ہے" },
  profile_incomplete_msg: { en: "Profile Incomplete", ur: "پروفائل نامکمل ہے" },
  basic_information: { en: "Basic Information", ur: "بنیادی معلومات" },
  documents_upload: { en: "Documents Upload", ur: "دستاویزات اپ لوڈ" },
  full_name: { en: "Full Name", ur: "پورا نام" },
  cnic: { en: "CNIC / ID Card", ur: "شناختی کارڈ" },
  village: { en: "Village", ur: "گاؤں" },
  city: { en: "City", ur: "شہر" },
  whatsapp_updates: { en: "Send me updates on WhatsApp", ur: "مجھے واٹس ایپ پر اپڈیٹس بھیجیں" },
  cnic_front: { en: "CNIC Front", ur: "شناختی کارڈ اگلا حصہ" },
  cnic_back: { en: "CNIC Back", ur: "شناختی کارڈ پچھلا حصہ" },
  save_profile: { en: "Save Profile", ur: "پروفائل محفوظ کریں" },
  saving: { en: "Saving...", ur: "محفوظ ہو رہا ہے..." },
  tap_photo_hint: { en: "Tap the photo icon to update your picture", ur: "تصویر بدلنے کے لیے کیمرہ آئیکن دبائیں" },
  your_name_placeholder: { en: "Your Name", ur: "آپ کا نام" },

  // My Farms page
  my_farms_title: { en: "My Farms", ur: "میرے کھیت" },
  my_farms_subtitle: { en: "Add each of your lands/fields separately.", ur: "اپنی ہر زمین/کھیت الگ الگ شامل کریں۔" },
  total_land_auto: { en: "Total Land (Auto)", ur: "کل زمین (خودکار)" },
  total_farms_auto: { en: "Total Farms (Auto)", ur: "کل کھیت (خودکار)" },
  add_new_farm: { en: "Add New Farm", ur: "نیا کھیت شامل کریں" },
  farm_name: { en: "Farm Name", ur: "کھیت کا نام" },
  area_acres: { en: "Area (Acres)", ur: "رقبہ (ایکڑ)" },
  village_optional: { en: "Village (optional)", ur: "گاؤں (اختیاری)" },
  district_optional: { en: "District (optional)", ur: "ضلع (اختیاری)" },
  owned_or_rented: { en: "Is the land owned or rented?", ur: "زمین اپنی ہے یا کرائے پر؟" },
  owned: { en: "Owned", ur: "اپنی" },
  rented: { en: "Rented", ur: "کرائے پر" },
  rent_per_acre: { en: "Rent Per Acre (Rs.) - if rented", ur: "کرایہ فی ایکڑ (روپے) - اگر کرائے پر ہے" },
  pin_location_optional: { en: "Pin Location (Optional)", ur: "مقام نشان زد کریں (اختیاری)" },
  use_current_location: { en: "Use My Current Location", ur: "میرا موجودہ مقام استعمال کریں" },
  add_farm_btn: { en: "Add Farm", ur: "کھیت شامل کریں" },
  unverified_hint: { en: "A new farm will show as \"Unverified\" - admin will verify it, but you can keep working.", ur: "نیا کھیت \"غیر تصدیق شدہ\" دکھائے گا - ایڈمن اسے تصدیق کرے گا، لیکن آپ کام جاری رکھ سکتے ہیں۔" },
  my_farms_list: { en: "My Farms List", ur: "میرے کھیتوں کی فہرست" },
  no_farms_yet: { en: "No farms added yet.", ur: "ابھی تک کوئی کھیت شامل نہیں کیا گیا۔" },
  verified: { en: "Verified", ur: "تصدیق شدہ" },
  unverified: { en: "Unverified", ur: "غیر تصدیق شدہ" },
  view_on_map: { en: "View on Map", ur: "نقشے پر دیکھیں" },
  harvest_records: { en: "Harvest Records", ur: "فصل کے ریکارڈ" },
  crops_grown: { en: "Crops Grown", ur: "اگائی گئی فصلیں" },
  total_profit_loss: { en: "Total Profit/Loss", ur: "کل نفع/نقصان" },

  // My Crops page
  my_crops_title: { en: "My Crops", ur: "میری فصلیں" },
  my_crops_subtitle: { en: "Add your crop, track expenses, and see progress to harvest.", ur: "اپنی فصل شامل کریں، اخراجات ٹریک کریں، اور کٹائی تک کی پیش رفت دیکھیں۔" },
  farm_land_status: { en: "Farm Land Status", ur: "کھیت کی زمین کی صورتحال" },
  add_new_crop: { en: "Add New Crop", ur: "نئی فصل شامل کریں" },
  select_farm: { en: "Select a farm", ur: "کھیت منتخب کریں" },
  crop: { en: "Crop", ur: "فصل" },
  sowing_date: { en: "Sowing Date", ur: "بوائی کی تاریخ" },
  area_optional: { en: "Area - Optional (Acre / Kanal / Marla)", ur: "رقبہ - اختیاری (ایکڑ / کنال / مرلہ)" },
  land_available_hint: { en: "Only this much land is available on this farm.", ur: "اس کھیت میں صرف اتنی زمین دستیاب ہے۔" },
  add_crop_btn: { en: "Add Crop", ur: "فصل شامل کریں" },
  profit_prediction: { en: "Profit Prediction", ur: "منافع کا اندازہ" },
  expected_cost: { en: "Expected Cost", ur: "متوقع خرچہ" },
  expected_revenue: { en: "Expected Revenue", ur: "متوقع آمدنی" },
  expected_profit: { en: "Expected Profit", ur: "متوقع منافع" },
  not_enough_data: { en: "Not enough data yet for this crop to make an estimate.", ur: "اس فصل کے لیے ابھی اندازہ لگانے کے لیے کافی ڈیٹا نہیں ہے۔" },
  active_crops: { en: "Active Crops", ur: "موجودہ فصلیں" },
  total_expense_col: { en: "Cost", ur: "خرچہ" },
  per_acre_col: { en: "Per Acre", ur: "فی ایکڑ" },
  details_btn: { en: "Details", ur: "تفصیلات" },
  no_crops_yet: { en: "No crops added yet.", ur: "ابھی تک کوئی فصل شامل نہیں کی گئی۔" },

  // Crops Table (new keys)
  table_progress_header: { en: "Progress", ur: "پیش رفت" },
  ready_label: { en: "Ready", ur: "تیار" },
  confirm_delete_crop: { en: "Are you sure? This crop will be deleted.", ur: "کیا آپ کو یقین ہے؟ یہ فصل حذف ہو جائے گی۔" },

  // Add Crop Form (new keys)
  farm_label: { en: "Farm", ur: "کھیت" },
  land_total_label: { en: "Total", ur: "کل" },
  land_used_label: { en: "Used", ur: "استعمال شدہ" },
  land_available_label: { en: "Available", ur: "باقی" },
  only_available_prefix: { en: "Only", ur: "صرف" },
  only_available_suffix: { en: "is available on this farm.", ur: "اس کھیت میں دستیاب ہے۔" },
  unit_acre: { en: "Acre", ur: "ایکڑ" },
  unit_kanal: { en: "Kanal", ur: "کنال" },
  unit_marla: { en: "Marla", ur: "مرلہ" },
  andazan_kharcha: { en: "Estimated Cost", ur: "اندازاً خرچہ" },
  andazan_kamai: { en: "Estimated Revenue", ur: "اندازاً کمائی" },
  andazan_munafa: { en: "Estimated Profit", ur: "اندازاً منافع" },
  prediction_disclaimer_prefix: { en: "Based on average of", ur: "اوسط پر مبنی" },
  prediction_disclaimer_suffix: { en: "past crops - actual result may vary with weather/rate.", ur: "پرانی فصلوں کا - اصل نتیجہ موسم/ریٹ کے ساتھ بدل سکتا ہے۔" },

  // Credit Request Form (new keys)
  your_response_needed: { en: "Your Response Needed", ur: "آپ کا جواب درکار ہے" },
  new_credit_request: { en: "New Credit Request", ur: "نئی کریڈٹ درخواست" },
  request_sent_msg: { en: "Request sent.", ur: "درخواست بھیج دی گئی۔" },
  category_label: { en: "Category", ur: "قسم" },
  category_group_filter: { en: "Category Group (Product Filter)", ur: "زمرہ (پروڈکٹ فلٹر)" },
  all_products_option: { en: "All Products", ur: "تمام پروڈکٹس" },
  product_label: { en: "Product", ur: "پروڈکٹ" },
  select_placeholder: { en: "- select -", ur: "- منتخب کریں -" },
  quantity_label: { en: "Quantity", ur: "مقدار" },
  eg_2: { en: "e.g. 2", ur: "مثلاً 2" },
  credit_request_history: { en: "Credit Request History", ur: "کریڈٹ درخواست کی تاریخ" },
  mrp_rate_label: { en: "MRP Rate", ur: "ایم آر پی ریٹ" },
  base_amount_label: { en: "Base Amount", ur: "بنیادی رقم" },
  credit_charge_label: { en: "Credit Charge", ur: "کریڈٹ چارج" },
  total_payable_label: { en: "Total Payable", ur: "کل قابل ادائیگی" },
  admin_note_label: { en: "Admin Note", ur: "ایڈمن نوٹ" },
  status_pending: { en: "Under Admin Review", ur: "ایڈمن کے زیر جائزہ" },
  status_admin_approved: { en: "Your Response Needed", ur: "آپ کا جواب درکار ہے" },
  status_farmer_accepted: { en: "Accepted", ur: "قبول کر لیا گیا" },
  status_farmer_rejected: { en: "Rejected", ur: "مسترد کر دیا گیا" },
  status_admin_rejected: { en: "Rejected by Admin", ur: "ایڈمن نے مسترد کیا" },
  accept_btn: { en: "Accept", ur: "قبول کریں" },
  reject_btn: { en: "Reject", ur: "مسترد کریں" },
  sending_label: { en: "Sending...", ur: "بھیجا جا رہا ہے..." },
  send_request_btn: { en: "Send Request", ur: "درخواست بھیجیں" },
  cat_seed: { en: "Seed", ur: "بیج" },
  cat_pesticide: { en: "Pesticide", ur: "کیڑے مار دوا" },

  // Fertilizer page
  fertilizer_title: { en: "Fertilizer / Seed / Pesticide Credit", ur: "کھاد / بیج / کیڑے مار ادویات کریڈٹ" },
  fertilizer_subtitle: { en: "Select a product, get credit at MRP rate - admin approves, then you accept.", ur: "پروڈکٹ منتخب کریں، ایم آر پی ریٹ پر کریڈٹ لیں - ایڈمن منظوری دے گا، پھر آپ قبول کریں۔" },
  credit_balance_label: { en: "Your Total Credit Balance (Seed/Fertilizer/Pesticide/Machinery)", ur: "آپ کا کل کریڈٹ بیلنس (بیج/کھاد/کیڑے مار ادویات/مشینری)" },

  // Machinery page (new keys)
  no_requests_yet: { en: "No requests yet.", ur: "ابھی تک کوئی درخواست نہیں ہوئی۔" },
  ai_estimated_cost_label: { en: "AI Estimated Cost", ur: "اے آئی اندازہ خرچہ" },
  ai_estimate_pending: { en: "AI estimate is being prepared...", ur: "اے آئی اندازہ تیار ہو رہا ہے..." },
  machine_thresher: { en: "Thresher", ur: "تھریشر" },
  machine_harvester: { en: "Harvester", ur: "ہارویسٹر" },
  machine_rotavator: { en: "Rotavator", ur: "روٹاویٹر" },
  machine_tractor: { en: "Tractor", ur: "ٹریکٹر" },

  // Machinery page
  machinery_title: { en: "Machinery Rental Request", ur: "مشینری کرائے کی درخواست" },
  machinery_subtitle: { en: "Select a farm - the system will tell you which machine you need.", ur: "کھیت منتخب کریں - سسٹم بتائے گا آپ کو کون سی مشین چاہیے۔" },

  // Livestock page
  livestock_title: { en: "Livestock", ur: "مویشی" },
  livestock_subtitle: { en: "Keep your animal details and request loan/financing when needed.", ur: "اپنے جانوروں کی تفصیلات رکھیں اور ضرورت پڑنے پر قرض/فنانسنگ کی درخواست کریں۔" },
  livestock_loan_request: { en: "Livestock Loan Request", ur: "مویشی قرض کی درخواست" },
  past_requests: { en: "Past Requests", ur: "پرانی درخواستیں" },

  // Farm Management (Harvest) page
  farm_mgmt_title: { en: "Farm Management", ur: "فارم مینجمنٹ" },
  farm_mgmt_subtitle: { en: "Add your harvest record and see production history.", ur: "اپنا فصل کی کٹائی کا ریکارڈ شامل کریں اور پیداوار کی تاریخ دیکھیں۔" },
  crop_history_title: { en: "Crop History", ur: "فصل کی تاریخ" },

  // Wallet page
  my_wallet_title: { en: "My Wallet", ur: "میرا بٹوہ" },

  // Marketplace/Sell Produce
  marketplace_title: { en: "Marketplace", ur: "مارکیٹ پلیس" },
  sell_produce_title: { en: "Sell Your Produce", ur: "اپنی پیداوار بیچیں" },

  // Location picker
  loc_getting: { en: "Getting your location...", ur: "آپ کا مقام حاصل کیا جا رہا ہے..." },
  loc_captured: { en: "Location captured", ur: "مقام حاصل ہو گیا" },
  loc_use_current: { en: "Use My Current Location", ur: "میرا موجودہ مقام استعمال کریں" },
  loc_error: { en: "Could not get location. Check browser settings.", ur: "مقام حاصل نہیں ہو سکا۔ براؤزر کی سیٹنگز چیک کریں۔" },

  // Misc units
  acres_unit: { en: "acres", ur: "ایکڑ" },
  error_prefix: { en: "Error", ur: "خرابی" },
  add_new_farm_heading: { en: "Add New Farm", ur: "نیا کھیت شامل کریں" },
  eg_farm_name: { en: "e.g. Uncle's Farm", ur: "مثلاً چچا کا کھیت" },
  eg_area: { en: "e.g. 5", ur: "مثلاً 5" },
  eg_rent: { en: "e.g. 30000", ur: "مثلاً 30000" },
  farm_overall_loss: { en: "This farm is running an overall loss.", ur: "اس کھیت میں مجموعی طور پر نقصان ہو رہا ہے۔" },
  farm_recurring_loss: { en: "keeps having repeated losses.", ur: "میں بار بار نقصان ہو رہا ہے۔" },
  farm_overall_good: { en: "This farm's overall result is good.", ur: "اس کھیت کا مجموعی نتیجہ اچھا ہے۔" },

  // Language toggle
  language: { en: "Language", ur: "زبان" },
} as const;

export type TranslationKey = keyof typeof dict;

export function t(key: TranslationKey, lang: Lang): string {
  return dict[key]?.[lang] ?? String(key);
}