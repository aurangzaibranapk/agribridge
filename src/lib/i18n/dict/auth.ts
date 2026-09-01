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
