/**
 * /account-deletion -- Google Play ki shart (Data deletion URL).
 *
 * Play Console "Data safety" mein ek PUBLIC safha maangta hai jo bina
 * login khule aur bataye ke account kaise mitwaya jaye, kya mitta hai
 * aur kya rakha jata hai. Ye wohi safha hai; Android app (TWA) bhi isi
 * website ko kholti hai.
 *
 * Asal amal (src/actions/portal-accounts.ts): Admin login account mitata
 * hai (auth user delete); jis account se khata juda ho us par doosra
 * Admin manzoori deta hai (maker-checker). KHATA KABHI NAHI MITTA --
 * hisaab/qanooni record hai. Isi liye yahan wahi likha hai jo system
 * waqai karta hai, us se zyada nahi.
 *
 * Raabta: website_settings (contact_phone / contact_email), warna wahi
 * fallback jo footer/contact par hain -- koi naya number yahan nahi.
 */
export type DeletionLang = "en" | "rm" | "ur";

export const DELETION_FALLBACK_PHONE = "+92 333 1116727";
export const DELETION_FALLBACK_EMAIL = "info@alranatraders.pk";

export interface DeletionCopy {
  label: string;
  title: string;
  intro: string;
  howTitle: string;
  steps: string[];
  deletedTitle: string;
  deleted: string[];
  keptTitle: string;
  kept: string[];
  timeTitle: string;
  time: string;
  whatsapp: string;
  email: string;
  template: string;
}

export const DELETION_COPY: Record<DeletionLang, DeletionCopy> = {
  en: {
    label: "English",
    title: "Delete your AgriBridge account",
    intro:
      "This page explains how to delete your AgriBridge (Al Rana Traders) account, used on alranatraders.pk and in the AgriBridge Android app. It applies to farmers, customers, dealers and staff logins.",
    howTitle: "How to request deletion",
    steps: [
      "Send us a message on WhatsApp or email from the phone number / email linked to your account.",
      "Write \"Delete my AgriBridge account\" with your full name and registered phone number.",
      "We verify that the request comes from the account owner (we may call you back on the registered number).",
      "An admin deletes your login account. Where your account is linked to a khata (ledger), a second admin approves the deletion.",
      "We confirm on WhatsApp/email once it is done.",
    ],
    deletedTitle: "What is deleted",
    deleted: [
      "Your login account (phone/email sign-in and password).",
      "Your access to the customer/farmer portal and the Android app.",
      "Profile details used only for the app (such as language and notification preferences).",
    ],
    keptTitle: "What is kept, and why",
    kept: [
      "Financial records — khata/ledger entries, bills, invoices, payments, grain, dairy and loan/qist records — are kept as required by Pakistani tax and accounting law and for audit (normally at least 6 years).",
      "Any outstanding balance remains payable/receivable; deleting the login does not cancel it.",
      "Security and activity logs needed to prevent fraud are kept for a limited time.",
    ],
    timeTitle: "How long it takes",
    time: "We aim to complete verified requests within 30 days.",
    whatsapp: "WhatsApp",
    email: "Email",
    template: "Delete my AgriBridge account. Name: ____ Registered phone: ____",
  },
  rm: {
    label: "Roman Urdu",
    title: "Apna AgriBridge account mitwayein",
    intro:
      "Is safhe par bataya gaya hai ke AgriBridge (Al Rana Traders) ka account — jo alranatraders.pk aur AgriBridge Android app par chalta hai — kaise mitwaya jata hai. Ye kisan, gahak, dealer aur staff sab ke login par lagu hai.",
    howTitle: "Darkhwast kaise dein",
    steps: [
      "Jo phone number / email aap ke account se juda hai, us se hamein WhatsApp ya email karein.",
      "Likhein \"Mera AgriBridge account delete kar dein\", saath apna poora naam aur registered phone number.",
      "Hum tasdeeq karenge ke darkhwast account ke maalik ki hai (registered number par call bhi aa sakti hai).",
      "Admin aap ka login account mita dega. Agar account se khata juda ho to doosra Admin manzoori deta hai.",
      "Kaam hone par hum WhatsApp/email par bata denge.",
    ],
    deletedTitle: "Kya mit jata hai",
    deleted: [
      "Aap ka login account (phone/email se login aur password).",
      "Customer/kisan portal aur Android app tak rasai.",
      "Sirf app ke liye profile ki tafseel (jaise zubaan aur notification ki pasand).",
    ],
    keptTitle: "Kya rakha jata hai, aur kyun",
    kept: [
      "Maali record — khata, bill, invoice, adaigiyan, gandum, dairy aur qist ka record — Pakistan ke tax aur hisaab ke qanoon aur audit ki wajah se rakha jata hai (aam taur par kam az kam 6 saal).",
      "Jo baqaya lena/dena ho wo qaim rehta hai; login mitane se wo khatam nahi hota.",
      "Dhoke se bachao ke liye security aur activity log kuch muddat tak rakhe jate hain.",
    ],
    timeTitle: "Kitna waqt lagta hai",
    time: "Tasdeeq shuda darkhwast 30 din ke andar poori karne ki koshish hoti hai.",
    whatsapp: "WhatsApp",
    email: "Email",
    template: "Mera AgriBridge account delete kar dein. Naam: ____ Registered phone: ____",
  },
  ur: {
    label: "اردو",
    title: "اپنا AgriBridge اکاؤنٹ ختم کروائیں",
    intro:
      "اس صفحے پر بتایا گیا ہے کہ AgriBridge (الرانا ٹریڈرز) کا اکاؤنٹ، جو alranatraders.pk اور AgriBridge اینڈرائیڈ ایپ پر چلتا ہے، کیسے ختم کروایا جاتا ہے۔ یہ کسان، گاہک، ڈیلر اور اسٹاف سب کے لاگ اِن پر لاگو ہے۔",
    howTitle: "درخواست کیسے دیں",
    steps: [
      "جو فون نمبر یا ای میل آپ کے اکاؤنٹ سے جڑا ہے، اسی سے ہمیں واٹس ایپ یا ای میل کریں۔",
      "لکھیں \"میرا AgriBridge اکاؤنٹ ختم کر دیں\"، ساتھ اپنا پورا نام اور رجسٹرڈ فون نمبر۔",
      "ہم تصدیق کریں گے کہ درخواست اکاؤنٹ کے مالک کی ہے (رجسٹرڈ نمبر پر کال بھی آ سکتی ہے)۔",
      "ایڈمن آپ کا لاگ اِن اکاؤنٹ ختم کر دے گا۔ اگر اکاؤنٹ سے کھاتہ جڑا ہو تو دوسرا ایڈمن منظوری دیتا ہے۔",
      "کام مکمل ہونے پر ہم واٹس ایپ یا ای میل پر بتا دیں گے۔",
    ],
    deletedTitle: "کیا ختم ہوتا ہے",
    deleted: [
      "آپ کا لاگ اِن اکاؤنٹ (فون یا ای میل سے لاگ اِن اور پاس ورڈ)۔",
      "کسٹمر/کسان پورٹل اور اینڈرائیڈ ایپ تک رسائی۔",
      "صرف ایپ کے لیے پروفائل کی تفصیل (جیسے زبان اور نوٹیفکیشن کی پسند)۔",
    ],
    keptTitle: "کیا رکھا جاتا ہے، اور کیوں",
    kept: [
      "مالی ریکارڈ — کھاتہ، بل، انوائس، ادائیگیاں، گندم، ڈیری اور قسط کا ریکارڈ — پاکستان کے ٹیکس اور حساب کتاب کے قانون اور آڈٹ کی وجہ سے رکھا جاتا ہے (عام طور پر کم از کم 6 سال)۔",
      "جو بقایا لینا یا دینا ہو وہ قائم رہتا ہے؛ لاگ اِن ختم کرنے سے وہ ختم نہیں ہوتا۔",
      "دھوکے سے بچاؤ کے لیے سیکیورٹی اور ایکٹیویٹی لاگ کچھ مدت تک رکھے جاتے ہیں۔",
    ],
    timeTitle: "کتنا وقت لگتا ہے",
    time: "تصدیق شدہ درخواست 30 دن کے اندر مکمل کرنے کی کوشش کی جاتی ہے۔",
    whatsapp: "واٹس ایپ",
    email: "ای میل",
    template: "میرا AgriBridge اکاؤنٹ ختم کر دیں۔ نام: ____ رجسٹرڈ فون: ____",
  },
};

/** Settings ki qeemat saaf karo ("..." hatao); khali ho to fallback. */
export function cleanSetting(raw: unknown, fallback: string): string {
  const v = raw == null ? "" : String(raw).replace(/^"|"$/g, "").trim();
  return v.length > 0 ? v : fallback;
}

/** wa.me ke liye sirf hindse; 03xx ko 923xx bana do. */
export function whatsappDigits(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "92" + d.slice(1);
  return d || "923331116727";
}

/** Pehle cookie wali zubaan, phir baqi dono. */
export function deletionOrder(first: DeletionLang): DeletionLang[] {
  return [first, ...(["en", "rm", "ur"] as DeletionLang[]).filter((l) => l !== first)];
}
