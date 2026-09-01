/**
 * Login, registration aur password ke safhe.
 *
 * Ye poore nizam ka DARWAZA hain. Yahan banda tab khara hota hai jab
 * usay abhi kuch nazar nahi aaya -- na dashboard, na apna khata. Agar
 * yahan zaban ghalat ho, to wo andar pahunchta hi nahi; baqi safhon ka
 * tarjuma us ke kisi kaam ka nahi.
 *
 * TEEN BAATEIN:
 *
 * 1. Zaban yahan COOKIE se aati hai, kisi khate se nahi -- kyunke abhi
 *    koi login hua hi nahi. Jo banda pehli dafa aaya hai us ke paas
 *    cookie bhi nahi hoti; us ke liye default Urdu hai, kyunke ye
 *    darwaza sab se pehle kisan ke liye hai.
 *
 * 2. "Al Rana Traders", "ART" aur "AgriBridge" ke Urdu naam wohi hain
 *    jo glossary.ts mein darj hain (الرانا ٹریڈرز، اے آر ٹی، ایگری بریج). Login ka safha wo pehli jagah hai jahan banda ye naam
 *    parhta hai -- yahan koi doosri hijje us ke liye doosra karobar
 *    bana degi.
 *
 * 3. "Ye number pehli dafa aaya hai..." wala jumla us kisan ke liye hai
 *    jis ka khata hai hi nahi. Us mein "aap ka khata usi waqt ban
 *    jayega" jaan boojh kar likha hai: banda darwaze par ye jaanna
 *    chahta hai ke usay kisi daftar ka chakkar to nahi lagana parega.
 */
export const authDict = {
  // ---- Login ka safha ----
  au_brand: { en: "ART AgriBridge", rm: "ART AgriBridge", ur: "اے آر ٹی ایگری بریج" },
  au_company: { en: "Al Rana Traders", rm: "Al Rana Traders", ur: "الرانا ٹریڈرز" },
  au_sign_in_title: { en: "Sign in to your account", rm: "Apne account mein sign in karein", ur: "اپنے اکاؤنٹ میں سائن اِن کریں" },
  au_close: { en: "Close", rm: "Band karein", ur: "بند کریں" },
  au_close_back_site: { en: "Close — go back to the website", rm: "Band karein — website par wapas jayein", ur: "بند کریں — ویب سائٹ پر واپس جائیں" },
  au_new_farmer_above: { en: "New farmer? Use the option above", rm: "Naye kisan hain? Upar", ur: "نئے کسان ہیں؟ اوپر" },

  // ---- Kaun aa raha hai ----
  au_farmer_customer: { en: "Farmer / Customer", rm: "Kisan / Customer", ur: "کسان / گاہک" },
  au_admin_staff_vendor: { en: "Admin / Staff / Vendor", rm: "Admin / Staff / Vendor", ur: "ایڈمن / عملہ / وینڈر" },

  // ---- OTP wala raasta ----
  au_send_otp: { en: "Send OTP", rm: "OTP bhejein", ur: "او ٹی پی بھیجیں" },
  au_otp_channel: {
    en: "The code goes to your WhatsApp. If you have no WhatsApp, it comes by SMS.",
    rm: "Code aap ke WhatsApp par jayega. WhatsApp na ho to SMS par.",
    ur: "کوڈ آپ کے WhatsApp پر جائے گا۔ WhatsApp نہ ہو تو SMS پر۔",
  },
  au_six_digit_code: { en: "Six-digit code", rm: "Chhe hindse wala code", ur: "چھ ہندسوں والا کوڈ" },
  au_code_not_received: { en: "Didn't get the code? Send again", rm: "Code nahi mila? Dobara bhejein", ur: "کوڈ نہیں ملا؟ دوبارہ بھیجیں" },
  au_go_in: { en: "Go in", rm: "Andar jayein", ur: "اندر جائیں" },

  // ---- Naya number ----
  au_first_time_number: {
    en: "This number is here for the first time. Write your name and village — your account is created right away.",
    rm: "Ye number pehli dafa aaya hai. Apna naam aur gaon likh dein — aap ka khata usi waqt ban jayega.",
    ur: "یہ نمبر پہلی دفعہ آیا ہے۔ اپنا نام اور گاؤں لکھ دیں — آپ کا کھاتہ اسی وقت بن جائے گا۔",
  },
  au_your_name: { en: "Your name", rm: "Aap ka naam", ur: "آپ کا نام" },
  au_eg_name: { en: "e.g. Amir Sultan", rm: "Misal: Amir Sultan", ur: "مثال: عامر سلطان" },
  au_village: { en: "Village", rm: "Gaon", ur: "گاؤں" },
  au_eg_village: { en: "e.g. Chak Maha Bali", rm: "Misal: Chak Maha Bali", ur: "مثال: چک مہا بلی" },

  // ---- Doosre raaste ----
  au_email_or_mobile: { en: "Email or Mobile", rm: "Email ya Mobile", ur: "ای میل یا موبائل" },
  au_have_user_id: { en: "Made a User ID? Log in with that", rm: "Apni User ID bana rakhi hai? Us se login karein", ur: "اپنی یوزر آئی ڈی بنا رکھی ہے؟ اس سے لاگ اِن کریں" },
  au_forgot_password_q: { en: "Forgot your password? Log in with mobile and OTP", rm: "Password yaad nahi? Mobile aur OTP se login karein", ur: "پاس ورڈ یاد نہیں؟ موبائل اور او ٹی پی سے لاگ اِن کریں" },
  au_customer_email_login: { en: "A customer? Come in with email and password", rm: "Customer hain? Email aur password se aayein", ur: "گاہک ہیں؟ ای میل اور پاس ورڈ سے آئیں" },
  au_forgot_password: { en: "Forgot password?", rm: "Password bhool gaye?", ur: "پاس ورڈ بھول گئے؟" },
  au_or: { en: "or", rm: "ya", ur: "یا" },
  au_email_code_note: { en: "The code arrives by email.", rm: "Code email par aayega.", ur: "کوڈ ای میل پر آئے گا۔" },
  au_link_user_id: { en: "User ID", rm: "User ID", ur: "یوزر آئی ڈی" },
  au_link_password: { en: "Password", rm: "Password", ur: "پاس ورڈ" },
  au_or_then: { en: "or else", rm: "ya phir", ur: "یا پھر" },
  au_ya: { en: "OR", rm: "YA", ur: "یا" },

  // ---- Login ka darwaza: dono User ID, aur raaste ka chunav ----
  au_mobile_userid: { en: "Mobile Number (User ID)", rm: "Mobile Number (User ID)", ur: "موبائل نمبر (یوزر آئی ڈی)" },
  au_email_userid: { en: "Email (User ID)", rm: "Email (User ID)", ur: "ای میل (یوزر آئی ڈی)" },
  // Raasta ab neeche wali patti mein khud nazar aata hai, is liye us ka
  // zikr yahan se hata diya -- ek hi baat do jagah likhne se safha lamba
  // hota tha aur card screen se bahar nikal jata.
  au_mobile_userid_help: {
    en: "This will be your User ID.",
    rm: "Ye aap ka User ID hoga.",
    ur: "یہ آپ کی یوزر آئی ڈی ہوگی۔",
  },
  au_email_userid_help: {
    en: "Also a User ID — the code arrives by email.",
    rm: "Ye bhi User ID hai — code email par aayega.",
    ur: "یہ بھی یوزر آئی ڈی ہے — کوڈ ای میل پر آئے گا۔",
  },
  au_pick_channel: { en: "Choose how to send the OTP", rm: "OTP bhejne ka tareeqa chunain", ur: "او ٹی پی بھیجنے کا طریقہ چنیں" },
  au_via_whatsapp: { en: "Send on WhatsApp", rm: "WhatsApp par bhejein", ur: "واٹس ایپ پر بھیجیں" },
  au_via_whatsapp_note: { en: "Fast and easy", rm: "Tez aur aasaan", ur: "تیز اور آسان" },
  au_via_sms: { en: "Send by SMS", rm: "SMS par bhejein", ur: "ایس ایم ایس پر بھیجیں" },
  au_via_sms_note: { en: "If WhatsApp is not available", rm: "Agar WhatsApp maujood na ho", ur: "اگر واٹس ایپ موجود نہ ہو" },
  au_channel_hint: {
    en: 'If the OTP does not reach WhatsApp, choose "Send by SMS".',
    rm: 'Agar WhatsApp par OTP na aaye to "SMS par bhejein" chunein.',
    ur: 'اگر واٹس ایپ پر او ٹی پی نہ آئے تو "ایس ایم ایس پر بھیجیں" چنیں۔',
  },
  au_not_member: { en: "Not a member?", rm: "Member nahi hain?", ur: "ممبر نہیں ہیں؟" },
  au_register_now: { en: "Register", rm: "Register karein", ur: "رجسٹر کریں" },
  au_need_one: {
    en: "Write a mobile number, or an email — either one.",
    rm: "Mobile number likhein, ya email — koi ek.",
    ur: "موبائل نمبر لکھیں، یا ای میل — کوئی ایک۔",
  },
  au_email_code_sent: { en: "Code sent to your email.", rm: "Code aap ke email par bhej diya gaya.", ur: "کوڈ آپ کے ای میل پر بھیج دیا گیا۔" },
  au_email_not_registered: {
    en: "This email is not registered. Please register first.",
    rm: "Ye email registered nahi hai. Pehle register karein.",
    ur: "یہ ای میل رجسٹرڈ نہیں ہے۔ پہلے رجسٹر کریں۔",
  },
  au_email_back: { en: "Use a different email or mobile", rm: "Doosra email ya mobile istemal karein", ur: "دوسرا ای میل یا موبائل استعمال کریں" },

  // ---- Card jo bataye ke hoga kya, aur neeche ki patti ----
  au_tip_channel_title: { en: "WhatsApp first, SMS after", rm: "WhatsApp pehle, SMS baad mein", ur: "واٹس ایپ پہلے، ایس ایم ایس بعد میں" },
  au_tip_channel_body: {
    en: "The OTP goes to WhatsApp first. If it does not arrive, it is sent by SMS.",
    rm: "Pehle WhatsApp par OTP jayega. Na aaye to SMS bheja jayega.",
    ur: "پہلے واٹس ایپ پر او ٹی پی جائے گا۔ نہ آئے تو ایس ایم ایس بھیجا جائے گا۔",
  },
  au_tip_resend_title: { en: "OTP did not arrive?", rm: "OTP na aaye?", ur: "او ٹی پی نہ آئے؟" },
  au_tip_resend_body: {
    en: 'Use "Send again" — WhatsApp is tried first, then SMS.',
    rm: '"Dobara bhejein" karein — pehle WhatsApp, phir SMS.',
    ur: '"دوبارہ بھیجیں" کریں — پہلے واٹس ایپ، پھر ایس ایم ایس۔',
  },
  au_tip_safe_title: { en: "Your data is safe", rm: "Aap ka data mehfooz hai", ur: "آپ کا ڈیٹا محفوظ ہے" },
  au_tip_safe_body: {
    en: "We keep your information safe and private.",
    rm: "Hum aap ki maloomat ko mehfooz aur raazdaar rakhte hain.",
    ur: "ہم آپ کی معلومات کو محفوظ اور رازدار رکھتے ہیں۔",
  },
  au_foot_safe: { en: "Safe & Secure", rm: "Safe & Secure", ur: "محفوظ اور مامون" },
  au_foot_safe_sub: { en: "Your data is safe", rm: "Aap ka data mehfooz hai", ur: "آپ کا ڈیٹا محفوظ ہے" },
  au_foot_fast: { en: "Fast & Easy", rm: "Fast & Easy", ur: "تیز اور آسان" },
  au_foot_fast_sub: { en: "Instant sign in with OTP", rm: "OTP se turant sign in", ur: "او ٹی پی سے فوری سائن اِن" },
  au_foot_farmer: { en: "Better for farmers", rm: "Kisan ke liye behtar", ur: "کسان کے لیے بہتر" },
  au_foot_farmer_sub: { en: "Every need, one place", rm: "Har zaroorat, ek jagah", ur: "ہر ضرورت، ایک جگہ" },
  au_foot_support: { en: "24/7 Support", rm: "24/7 Support", ur: "24/7 سپورٹ" },
  au_foot_support_sub: { en: "Always with you", rm: "Hamesha aap ke saath", ur: "ہمیشہ آپ کے ساتھ" },
  au_eg_email: { en: "you@example.com", rm: "aap@misal.com", ur: "aap@misal.com" },
  au_with_google: { en: "Continue with Google", rm: "Google se jaari rakhein", ur: "Google سے جاری رکھیں" },
  au_with_facebook: { en: "Continue with Facebook", rm: "Facebook se jaari rakhein", ur: "Facebook سے جاری رکھیں" },

  // ---- Registration ----
  au_register_farmer: { en: "Register as a Farmer", rm: "Kisan ke tor par registration", ur: "کسان کے طور پر رجسٹریشن" },
  au_or_fill_form: { en: "or fill in the form", rm: "ya form bhar dein", ur: "یا فارم بھر دیں" },
  au_name_req: { en: "Name *", rm: "Naam *", ur: "نام *" },
  au_mobile_req: { en: "Mobile Number *", rm: "Mobile number *", ur: "موبائل نمبر *" },
  au_email_req: { en: "Email Address *", rm: "Email *", ur: "ای میل *" },
  au_district_req: { en: "District *", rm: "Zila *", ur: "ضلع *" },
  au_eg_district: { en: "e.g. Jhang", rm: "misal: Jhang", ur: "مثال: جھنگ" },
  au_password_req: { en: "Password *", rm: "Password *", ur: "پاس ورڈ *" },
  au_min_six: { en: "At least 6 characters (numbers are fine)", rm: "Kam az kam 6 harf (hindse bhi chalenge)", ur: "کم از کم 6 حرف (ہندسے بھی چلیں گے)" },
  au_five_details: {
    en: "Just these five details — everything else (village, CNIC, farming details, documents) can be added later from your profile.",
    rm: "Bas ye paanch baatein — baqi sab (gaon, CNIC, kaasht ki tafseel, kaghaz) baad mein apni profile se daal sakte hain.",
    ur: "بس یہ پانچ باتیں — باقی سب (گاؤں، شناختی کارڈ، کاشت کی تفصیل، کاغذ) بعد میں اپنی پروفائل سے ڈال سکتے ہیں۔",
  },
  au_already_have: { en: "Already have an account?", rm: "Pehle se khata hai?", ur: "پہلے سے کھاتہ ہے؟" },
  au_sign_in: { en: "Sign in", rm: "Sign in karein", ur: "سائن اِن کریں" },
  au_registration_received: { en: "Registration Received", rm: "Registration pahunch gayi", ur: "رجسٹریشن پہنچ گئی" },
  au_back_home: { en: "Back to Home", rm: "Ghar wale safhe par wapas", ur: "گھر والے صفحے پر واپس" },

  // ---- Password reset ----
  au_reset_password: { en: "Reset Password", rm: "Password reset karein", ur: "پاس ورڈ ری سیٹ کریں" },
  au_reset_sent: {
    en: "If your email is in our system, a reset link has been sent. Please check your inbox.",
    rm: "Agar aap ki email hamare nizam mein hai, to reset link bhej diya gaya hai. Apni inbox dekh lein.",
    ur: "اگر آپ کی ای میل ہمارے نظام میں ہے، تو ری سیٹ لنک بھیج دیا گیا ہے۔ اپنا اِن باکس دیکھ لیں۔",
  },
  au_back_to_login: { en: "Back to Login", rm: "Wapis login karein", ur: "واپس لاگ اِن کریں" },
  au_set_new_password: { en: "Set a New Password", rm: "Naya password set karein", ur: "نیا پاس ورڈ سیٹ کریں" },
  au_new_password: { en: "New Password", rm: "Naya password", ur: "نیا پاس ورڈ" },
  au_confirm_password: { en: "Confirm Password", rm: "Password ki tasdeeq", ur: "پاس ورڈ کی تصدیق" },
  au_type_again: { en: "Type it again", rm: "Dobara likhein", ur: "دوبارہ لکھیں" },
  au_min_six_chars: { en: "At least 6 characters", rm: "Kam az kam 6 harf", ur: "کم از کم 6 حرف" },
  au_passwords_differ: { en: "The passwords do not match.", rm: "Dono password ek jaise nahi hain.", ur: "دونوں پاس ورڈ ایک جیسے نہیں ہیں۔" },
  au_password_changed: {
    en: "Password changed - taking you to the login page...",
    rm: "Password badal diya gaya - login ke safhe par le ja rahe hain...",
    ur: "پاس ورڈ بدل دیا گیا - لاگ اِن کے صفحے پر لے جا رہے ہیں...",
  },
  au_bad_link: {
    en: 'This link is not valid. Please try again from "Forgot Password".',
    rm: 'Ye link theek nahi hai. Barah-e-meherbani "Forgot Password" se dobara koshish karein.',
    ur: 'یہ لنک ٹھیک نہیں ہے۔ براہِ مہربانی "Forgot Password" سے دوبارہ کوشش کریں۔',
  },
  au_forgot_password_page: { en: "Forgot Password Page", rm: "Forgot Password ka safha", ur: "Forgot Password کا صفحہ" },
  au_loading: { en: "Loading...", rm: "Load ho raha hai...", ur: "لوڈ ہو رہا ہے..." },
  au_ar: { en: "AR", rm: "AR", ur: "AR" },
};
