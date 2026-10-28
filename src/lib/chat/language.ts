import type { Lang } from "@/lib/i18n/translations";

/**
 * Visitor jis script mein likhe, jawab usi script mein.
 * Cookie sirf tab, jab jumle par koi nishan na ho (salam, "ok").
 * Greeting alag hai — wo cookie se aati hai, yahan nahi.
 */
export type ChatLang = Lang;

const URDU = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

/** Roman Urdu ke lafzi jo English jumle mein aam nahi. */
const ROMAN_STRONG = new Set([
  "mujh", "mujhe", "mujhse", "aap", "aapka", "aapki", "aapke", "aapko",
  "mera", "meri", "mere", "hamara", "hamari", "humara", "apna", "apni", "apne",
  "kya", "kyu", "kyun", "kaise", "kese", "kaisay", "kesay",
  "kro", "karo", "krna", "karna", "karein", "karain", "kijiye", "karunga", "karungi",
  "batao", "bataen", "bataein", "batain", "btao", "batata", "batati",
  "chahiye", "chahie", "chaiye",
  "hai", "hain", "hoon", "hun", "hon",
  "nahi", "nahin", "nai",
  "shukriya", "meherbani", "meharbani", "assalam", "alaikum", "walaikum",
  "haan", "han", "jee",
  "kitna", "kitne", "kitni", "qeemat", "qimat", "qemat", "keemat", "daam",
  "kisan", "fasal", "beej", "khaad", "wasela", "gandum", "anaj",
  "sawal", "jawab", "baat", "bat", "madad", "nokri", "naukri", "mulazmat",
  "rabta", "raabta", "theek", "thik", "bohat", "bahut", "zyada",
  "sasta", "mehnga", "gahak", "khata", "hisaab", "niji",
  "maujood", "fehrist", "mukammal", "pooch", "poochain", "poochein",
  "sakte", "sakti", "tareeqa", "tarika", "karne", "krne", "khuli", "jagah",
  "aasamiyan", "ishtehar", "safha", "safhe", "safhon", "darkhwast",
  "bhejein", "bhejen", "likhein", "likhen", "dekhein", "dekhen",
  "istemal", "koshish", "dobara", "kharab", "gaya", "ho", "raaste", "raasta",
  "jaise", "sab", "isi", "dakhil", "naam", "andar", "kholta", "kholtay",
  "dein", "dikha", "dikhe", "gi", "phir", "bhi", "yahan", "wahan",
  "bimari", "ilaj", "ghee", "dukaan", "zameen", "paani", "pani",
  "shamil", "jari", "zaroor", "meharbani",
]);

/** Sirf tab ginti, jab koi mazboot Roman lafz pehle mil chuka ho. */
const ROMAN_MEDIUM = new Set([
  "se", "ko", "ka", "ki", "ke", "men", "mein", "par", "pe", "aur", "ya",
  "abhi", "ye", "yeh", "woh", "wo", "koi", "kuch", "hum", "tum",
  "wali", "wala", "walay", "na", "mat", "bas", "jab", "tab",
  "kahan", "kis", "kisi", "lekin", "magar", "agar", "bhi",
]);

const ENGLISH_CONTENT = new Set([
  "what", "where", "when", "how", "which", "who", "why",
  "please", "hello", "hi", "hey", "thanks",
  "product", "products", "price", "prices", "contact", "register", "registration",
  "farmer", "dealer", "customer", "job", "jobs", "vacancy", "vacancies",
  "branch", "branches", "sell", "buy", "open", "apply", "about",
  "service", "services", "phone", "email", "hours", "list", "show", "tell",
  "machinery", "marketplace", "grain", "dairy", "english", "speak", "reply",
]);

const ENGLISH_FUNCTION = new Set([
  "the", "a", "an", "is", "are", "am", "i", "you", "your", "our", "we",
  "and", "with", "for", "from", "on", "of", "or", "it", "this", "that",
  "be", "was", "were", "will", "not", "do", "does", "did", "have", "to",
  "can", "could", "would", "in", "at", "as", "by", "if", "my", "me",
]);

function stripNonLanguage(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\w.+-]+@[\w.-]+\.\w+/g, " ")
    .replace(/\/[a-z][a-z0-9#/_-]*/gi, " ");
}

export function scoreChatLatin(text: string): { roman: number; english: number } {
  const words = stripNonLanguage(text).toLowerCase().match(/[a-z]+/g) ?? [];
  let roman = 0;
  let english = 0;
  let strong = 0;
  const medium: string[] = [];
  for (const word of words) {
    if (ROMAN_STRONG.has(word)) {
      roman += 2;
      strong += 1;
    } else if (ROMAN_MEDIUM.has(word)) medium.push(word);
    if (ENGLISH_CONTENT.has(word)) english += 2;
    else if (ENGLISH_FUNCTION.has(word)) english += 1;
  }
  if (strong > 0) roman += medium.length;
  return { roman, english };
}

export function urduLetterCount(text: string): { urdu: number; latin: number } {
  const sample = stripNonLanguage(text);
  return {
    urdu: (sample.match(URDU) ?? []).length,
    latin: (sample.match(/[A-Za-z]/g) ?? []).length,
  };
}

export function detectChatLanguage(text: string, siteLang: ChatLang = "en"): ChatLang {
  const { urdu, latin } = urduLetterCount(text);
  if (urdu >= 2 && latin === 0) return "ur";
  // Urdu jumla jisme Angrezi product ka naam ho, phir bhi Urdu hai.
  if (urdu >= 12 && urdu * 2 >= latin) return "ur";
  if (urdu > latin && urdu >= 2) return "ur";

  const { roman, english } = scoreChatLatin(text);
  if (roman >= 2 && roman > english) return "rm";
  if (english >= 2 && english > roman) return "en";
  if (roman >= 2 && english >= 2) {
    if (siteLang === "en" || siteLang === "rm") return siteLang;
    return "rm";
  }
  if (siteLang === "en" || siteLang === "rm" || siteLang === "ur") return siteLang;
  return "en";
}

/** Jawab usi zaban ka hai? Tie ko pas nahi kiya — dono taraf wazeh hona chahiye. */
export function replyFitsLanguage(text: string, lang: ChatLang): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const { urdu, latin } = urduLetterCount(trimmed);
  if (lang === "ur") return urdu >= 12 && urdu * 2 >= latin;
  if (latin === 0) return false;
  const { roman, english } = scoreChatLatin(trimmed);
  if (lang === "rm") return roman >= 2 && roman > english && urdu < latin;
  return english > roman && urdu < 8;
}

export function textDirection(text: string): "rtl" | "ltr" {
  const { urdu, latin } = urduLetterCount(text);
  return urdu > latin ? "rtl" : "ltr";
}
