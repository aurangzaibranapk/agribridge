/** Login v6 (design1) ki ibaarat -- EN / Roman / Urdu. Ek waqt mein sirf ek zaban. */
import { tx as v5tx, type V5Lang } from "@/app/login/v5-text";
import { BRAND_TAGLINE } from "@/lib/brand";

export type V6Lang = V5Lang;
type Row = Record<V6Lang, string>;
const T = {
  brand_sub: { ...BRAND_TAGLINE },
  welcome: { en: "Welcome back", rm: "Khush aamdeed", ur: "خوش آمدید" },
  welcome_p: { en: "Sign in to your AgriBridge account", rm: "Apne AgriBridge account mein login karein", ur: "اپنے ایگری برج اکاؤنٹ میں لاگ ان کریں" },
  id_label: { en: "User ID, email, mobile or CNIC", rm: "User ID, email, mobile ya CNIC", ur: "یوزر آئی ڈی، ای میل، موبائل یا شناختی کارڈ" },
  id_ph: { en: "0300 1234567", rm: "0300 1234567", ur: "0300 1234567" },
  pw: { en: "Password", rm: "Password", ur: "پاس ورڈ" },
  show: { en: "Show password", rm: "Password dikhayein", ur: "پاس ورڈ دکھائیں" },
  hide: { en: "Hide password", rm: "Password chhupayein", ur: "پاس ورڈ چھپائیں" },
  forgot: { en: "Forgot password?", rm: "Password bhool gaye?", ur: "پاس ورڈ بھول گئے؟" },
  login: { en: "Sign in", rm: "Login", ur: "لاگ ان" },
  social: { en: "or sign up with", rm: "ya in se sign up karein", ur: "یا ان سے سائن اپ کریں" },
  google: { en: "Continue with Google", rm: "Google se jaari rakhein", ur: "گوگل سے جاری رکھیں" },
  facebook: { en: "Continue with Facebook", rm: "Facebook se jaari rakhein", ur: "فیس بک سے جاری رکھیں" },
  no_acc: { en: "Don't have an account?", rm: "Account nahi?", ur: "اکاؤنٹ نہیں ہے؟" },
  signup: { en: "Sign up", rm: "Sign up", ur: "سائن اپ" },
  back: { en: "Back", rm: "Wapas", ur: "واپس" },
  slide_hi_title: { en: "Welcome!", rm: "Khush aamdeed!", ur: "خوش آمدید!" },
  slide_hi_p: { en: "New here? Create an account\nand join AgriBridge", rm: "Naye hain? Account banayein\naur AgriBridge se jur jayein", ur: "نئے ہیں؟ اکاؤنٹ بنائیں\nاور ایگری برج سے جڑ جائیں" },
  slide_back_title: { en: "Welcome back!", rm: "Wapas aaye?", ur: "واپس آئے؟" },
  slide_back_p: { en: "Already have an account?\nSign in with your details", rm: "Pehle se account hai?\nApni maloomat se login karein", ur: "پہلے سے اکاؤنٹ ہے؟\nاپنی معلومات سے لاگ ان کریں" },
  m_new: { en: "New here?", rm: "Naye hain?", ur: "نئے ہیں؟" },
  m_have: { en: "Already have an account", rm: "Pehle se account hai", ur: "پہلے سے اکاؤنٹ ہے" },
  pill_signup: { en: "SIGN UP", rm: "SIGN UP", ur: "سائن اپ" },
  pill_login: { en: "LOGIN", rm: "LOGIN", ur: "لاگ ان" },
  tagline: { ...BRAND_TAGLINE },
  // signup
  su_title: { en: "Create your account", rm: "Naya account banayein", ur: "نیا اکاؤنٹ بنائیں" },
  su_p: { en: "Enter your details", rm: "Apni maloomat darj karein", ur: "اپنی معلومات درج کریں" },
  name: { en: "Full name", rm: "Poora naam", ur: "پورا نام" },
  name_ph: { en: "e.g. Muhammad Aslam", rm: "Misal: Muhammad Aslam", ur: "مثال: محمد اسلم" },
  email: { en: "Email", rm: "Email", ur: "ای میل" },
  email_ph: { en: "name@example.com", rm: "name@example.com", ur: "name@example.com" },
  mobile: { en: "Mobile number", rm: "Mobile number", ur: "موبائل نمبر" },
  cnic: { en: "CNIC", rm: "CNIC", ur: "شناختی کارڈ نمبر" },
  cnic_help: { en: "13 digits, format 12345-1234567-1", rm: "13 hindse, is tarah: 12345-1234567-1", ur: "13 ہندسے، اس طرح: 12345-1234567-1" },
  pw_rule: { en: "At least 8 characters, including a number.", rm: "Kam az kam 8 harf, aik number zaroor ho.", ur: "کم از کم 8 حروف، ایک ہندسہ ضرور ہو۔" },
  create: { en: "Create account", rm: "Account banayein", ur: "اکاؤنٹ بنائیں" },
  unique_note: { en: "Each email, mobile number, CNIC and User ID can be used for one account only.", rm: "Har email, mobile, CNIC aur User ID sirf aik account par istemal ho sakta hai.", ur: "ہر ای میل، موبائل، شناختی کارڈ اور یوزر آئی ڈی صرف ایک اکاؤنٹ پر استعمال ہو سکتا ہے۔" },
  unique_short: { en: "One account per email, mobile, CNIC and User ID.", rm: "Har email, mobile, CNIC aur User ID sirf aik account.", ur: "ہر ای میل، موبائل، شناختی کارڈ اور یوزر آئی ڈی صرف ایک اکاؤنٹ۔" },
  have_acc: { en: "Already have an account?", rm: "Pehle se account hai?", ur: "پہلے سے اکاؤنٹ ہے؟" },
  reset_instead: { en: "Reset your password", rm: "Password reset karein", ur: "پاس ورڈ ری سیٹ کریں" },
  // forgot
  fp_title: { en: "Forgot password?", rm: "Password bhool gaye?", ur: "پاس ورڈ بھول گئے؟" },
  fp_first_title: { en: "Set your password", rm: "Apna password banayein", ur: "اپنا پاس ورڈ بنائیں" },
  fp_p: { en: "Enter the mobile number, CNIC or email on your account. We'll send you a verification code.", rm: "Apna register mobile number, CNIC ya email likhein. Hum aap ko tasdeeqi code bhejenge.", ur: "اپنا رجسٹرڈ موبائل نمبر، شناختی کارڈ یا ای میل لکھیں۔ ہم آپ کو تصدیقی کوڈ بھیجیں گے۔" },
  fp_label: { en: "Mobile number, CNIC or email", rm: "Mobile number, CNIC ya email", ur: "موبائل نمبر، شناختی کارڈ یا ای میل" },
  how: { en: "How should we send the code?", rm: "Code kis tarah mangwayein?", ur: "کوڈ کس طرح منگوائیں؟" },
  ch_sms: { en: "SMS", rm: "SMS", ur: "ایس ایم ایس" },
  ch_sms_p: { en: "4-digit code", rm: "4 hindse ka code", ur: "4 ہندسوں کا کوڈ" },
  ch_wa: { en: "WhatsApp", rm: "WhatsApp", ur: "واٹس ایپ" },
  ch_wa_p: { en: "6-digit code", rm: "6 hindse ka code", ur: "6 ہندسوں کا کوڈ" },
  send: { en: "Send code", rm: "Code bhejein", ur: "کوڈ بھیجیں" },
  // otp
  otp_title: { en: "Enter the code", rm: "Code darj karein", ur: "کوڈ درج کریں" },
  otp_p_sms: { en: "We sent a {n}-digit code by SMS to", rm: "{n} hindse ka code SMS se bheja gaya", ur: "{n} ہندسوں کا کوڈ ایس ایم ایس سے بھیجا گیا" },
  otp_p_wa: { en: "We sent a {n}-digit code on WhatsApp to", rm: "{n} hindse ka code WhatsApp par bheja gaya", ur: "{n} ہندسوں کا کوڈ واٹس ایپ پر بھیجا گیا" },
  otp_digit: { en: "Digit {n}", rm: "Hindsa {n}", ur: "ہندسہ {n}" },
  expires: { en: "Code expires in", rm: "Code khatam hoga", ur: "کوڈ ختم ہوگا" },
  expired: { en: "Code expired", rm: "Code ki muddat khatam", ur: "کوڈ کی مدت ختم" },
  tries: { en: "Attempts left", rm: "Baqi koshishein", ur: "باقی کوششیں" },
  verify: { en: "Verify", rm: "Tasdeeq karein", ur: "تصدیق کریں" },
  no_code: { en: "Didn't get the code?", rm: "Code nahi mila?", ur: "کوڈ نہیں ملا؟" },
  resend: { en: "Resend", rm: "Dobara bhejein", ur: "دوبارہ بھیجیں" },
  change_number: { en: "Change number", rm: "Number badlein", ur: "نمبر تبدیل کریں" },
  // new password
  verified: { en: "Verified", rm: "Tasdeeq ho gayi", ur: "تصدیق ہو گئی" },
  np_title: { en: "Set a new password", rm: "Naya password banayein", ur: "نیا پاس ورڈ بنائیں" },
  np: { en: "New password", rm: "Naya password", ur: "نیا پاس ورڈ" },
  np2: { en: "Confirm new password", rm: "Naya password dobara likhein", ur: "نیا پاس ورڈ دوبارہ لکھیں" },
  match: { en: "Passwords match", rm: "Dono password aik jaise hain", ur: "دونوں پاس ورڈ ایک جیسے ہیں" },
  save_pw: { en: "Save password", rm: "Password save karein", ur: "پاس ورڈ محفوظ کریں" },
  // user id
  uid_hi: { en: "Welcome", rm: "Khush aamdeed", ur: "خوش آمدید" },
  uid_title: { en: "Create your User ID", rm: "Apni User ID banayein", ur: "اپنی یوزر آئی ڈی بنائیں" },
  uid_p: { en: "Optional — with a User ID you can sign in without typing your mobile number or CNIC.", rm: "Ikhtiyari — User ID se aap mobile ya CNIC likhe baghair login kar sakenge.", ur: "اختیاری — یوزر آئی ڈی سے آپ موبائل یا شناختی کارڈ لکھے بغیر لاگ ان کر سکیں گے۔" },
  uid: { en: "User ID", rm: "User ID", ur: "یوزر آئی ڈی" },
  uid_ok: { en: "{u} is available", rm: "{u} dastiyab hai", ur: "{u} دستیاب ہے" },
  uid_checking: { en: "Checking…", rm: "Dekh rahe hain…", ur: "دیکھ رہے ہیں…" },
  uid_rule: { en: "4–20 characters: letters, numbers, dot or underscore; starts with a letter.", rm: "4 se 20 harf: huroof, hindse, dot ya underscore; pehla harf huroof.", ur: "4 سے 20 حروف: حروف، ہندسے، ڈاٹ یا انڈر اسکور؛ پہلا حرف انگریزی حرف۔" },
  uid_save: { en: "Save User ID", rm: "User ID save karein", ur: "یوزر آئی ڈی محفوظ کریں" },
  uid_settings_title: { en: "Set your User ID", rm: "Apni User ID rakhein", ur: "اپنی یوزر آئی ڈی رکھیں" },
  uid_have_title: { en: "Your User ID", rm: "Aap ki User ID", ur: "آپ کی یوزر آئی ڈی" },
  uid_settings_p: { en: "Optional. Sign in with this instead of your mobile or CNIC. You can change it here any time.", rm: "Ikhtiyari. Is se mobile ya CNIC ke baghair login ho sakta hai. Yahan kabhi bhi badal sakte hain.", ur: "اختیاری۔ اس سے موبائل یا شناختی کارڈ کے بغیر لاگ ان ہو سکتا ہے۔ یہاں کبھی بھی بدل سکتے ہیں۔" },
  uid_yours: { en: "This is your User ID", rm: "Yeh aap ki User ID hai", ur: "یہ آپ کی یوزر آئی ڈی ہے" },
  uid_saved: { en: "Saved. You can sign in with this User ID.", rm: "Save ho gayi. Ab is User ID se login ho sakta hai.", ur: "محفوظ ہو گئی۔ اب اس یوزر آئی ڈی سے لاگ ان ہو سکتا ہے۔" },
  skip: { en: "Not now, later", rm: "Abhi nahi, baad mein", ur: "ابھی نہیں، بعد میں" },
  wait: { en: "Please wait…", rm: "Thora intezar…", ur: "انتظار کریں…" },
  help: { en: "Help on WhatsApp", rm: "WhatsApp madad", ur: "واٹس ایپ مدد" },
  terms: { en: "Terms", rm: "Sharait", ur: "شرائط" },
  privacy: { en: "Privacy", rm: "Raazdari", ur: "رازداری" },
  // v6 errors (baqi v5-text se)
  e_code_len: { en: "Enter all {n} digits.", rm: "Poore {n} hindse likhein.", ur: "پورے {n} ہندسے لکھیں۔" },
  e_cnic: { en: "Enter the CNIC as 12345-1234567-1 (13 digits).", rm: "CNIC is tarah likhein: 12345-1234567-1 (13 hindse).", ur: "شناختی کارڈ اس طرح لکھیں: 12345-1234567-1 (13 ہندسے)۔" },
  e_cnic_taken: { en: "This CNIC is already registered.", rm: "Yeh CNIC pehle se register hai.", ur: "یہ شناختی کارڈ پہلے سے رجسٹرڈ ہے۔" },
  e_phone_taken: { en: "This mobile number is already registered.", rm: "Yeh mobile number pehle se register hai.", ur: "یہ موبائل نمبر پہلے سے رجسٹرڈ ہے۔" },
  e_email_taken: { en: "This email is already registered.", rm: "Yeh email pehle se register hai.", ur: "یہ ای میل پہلے سے رجسٹرڈ ہے۔" },
  e_email_bad: { en: "Enter a valid email address.", rm: "Sahi email likhein.", ur: "درست ای میل لکھیں۔" },
  e_identifier: { en: "Enter a valid User ID, email, mobile number or CNIC.", rm: "Sahi User ID, email, mobile number ya CNIC likhein.", ur: "درست یوزر آئی ڈی، ای میل، موبائل نمبر یا شناختی کارڈ لکھیں۔" },
  e_not_found: { en: "No account found. Check the details or sign up.", rm: "Account nahi mila. Maloomat dekhein ya sign up karein.", ur: "اکاؤنٹ نہیں ملا۔ معلومات دیکھیں یا سائن اپ کریں۔" },
  e_uid_shape: { en: "Use 4–20 letters, numbers, dot or underscore, starting with a letter.", rm: "4 se 20 harf likhein (huroof, hindse, dot, underscore), pehla harf huroof.", ur: "4 سے 20 حروف لکھیں، پہلا حرف انگریزی حرف ہو۔" },
  e_uid_taken: { en: "This User ID is not available. Try another.", rm: "Yeh User ID dastiyab nahi. Koi aur aazmaen.", ur: "یہ یوزر آئی ڈی دستیاب نہیں۔ کوئی اور آزمائیں۔" },
  e_uid_already: { en: "You already have a User ID.", rm: "Aap ki User ID pehle se bani hui hai.", ur: "آپ کی یوزر آئی ڈی پہلے سے بنی ہوئی ہے۔" },
} satisfies Record<string, Row>;

export type V6Key = keyof typeof T;
/** v6 ki chaabi pehle, warna v5 ki (purane error codes) -- dono ek hi zaban mein. */
export function t6(lang: V6Lang, key: string, vars: Record<string, string | number> = {}): string {
  const row = (T as Record<string, Row>)[key];
  if (!row) return v5tx(lang, key, vars);
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), row[lang] ?? row.rm);
}
export const V6_KEYS = Object.keys(T);
export const V6_TEXT = T as Record<string, Row>;
