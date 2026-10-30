/**
 * Website ka naam aur tagline — ek hi jagah.
 *
 * Jo banda ye badle, header, footer, login, unwan, meta, aur
 * tarjume (`{brand}` / `{tagline}`) usi waqt badal jayein.
 * Domain alranatraders.pk, email pate, package id, database id
 * aur API URL yahan nahi — wo pata hain, naam nahi.
 */
/** English aur Roman ka naam. Email, meta, PDF (bina zaban) yahi Latin lafz. */
export const BRAND_NAME = "AgriBridge";

/** Logon ko dikhne wala naam. Neeche koi slogan nahi. */
export const PUBLIC_BRAND = "Kisan Pakistan";

/**
 * ERP ka andaruni naam AgriBridge rehta hai.
 * Purana slogan ("Kisan ka Wasela" / کسان کا وسیلہ) kahin nahi likha jata.
 */
export const BRAND_COPY = {
  en: { name: "AgriBridge", tagline: "" },
  rm: { name: "AgriBridge", tagline: "" },
  ur: { name: "ایگری بریج", tagline: "" },
} as const;

export type BrandLang = keyof typeof BRAND_COPY;

/** Bina zaban wale meta, email, PDF — English/Roman tagline. */
export const BRAND_TAGLINE = BRAND_COPY.en.tagline;

export function asBrandLang(lang?: string): BrandLang {
  if (lang === "en" || lang === "rm" || lang === "ur") return lang;
  return "en";
}

export function brandName(lang?: string): string {
  return BRAND_COPY[asBrandLang(lang)].name;
}

export function brandTagline(lang?: string): string {
  return BRAND_COPY[asBrandLang(lang)].tagline;
}

/** Purane trading-naam jo site par kabhi na dikhein. */
const HIDDEN_BRAND = /al\s*rana|الرانا|ال\s*رانا|اے\s*آر\s*ٹی|(^|\s)ART(?!-)/i;

export function isHiddenBrand(value: string | null | undefined): boolean {
  const text = value?.trim();
  if (!text) return false;
  return HIDDEN_BRAND.test(text);
}

function collapsePair(text: string, name: string): string {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`${n}\\s+by\\s+${n}`, "g"), name)
    .replace(new RegExp(`${n}\\s+and\\s+${n}`, "g"), name)
    .replace(new RegExp(`${n}\\s*[·•]\\s*${n}`, "g"), name)
    .replace(new RegExp(`${n}\\s+-\\s+${n}`, "g"), name)
    .replace(new RegExp(`${n}\\s+—\\s+${n}`, "g"), name)
    .replace(new RegExp(`${n}\\s*\\(${n}\\)`, "g"), name)
    .replace(new RegExp(`${n}\\s+${n}`, "g"), name);
}

/**
 * Tarjume aur templates. `{brand}` naam hai, `{tagline}` har zaban mein wahi line.
 * Purana trading-naam agar kisi jumle mein reh gaya ho to yahin naam ban jata hai.
 */
const RETIRED_SLOGAN = /kisan ka wase[li]a|کسان کا وسیلہ/gi;

export function applyBrand(text: string, lang: BrandLang = "en"): string {
  const name = brandName(lang);
  const filled = text
    .replaceAll("{brand}", name)
    .replaceAll("{tagline}", "")
    .replace(RETIRED_SLOGAN, "")
    .replaceAll("Al Rana Traders", name)
    .replaceAll("AL RANA TRADERS", name)
    .replaceAll("الرانا ٹریڈرز", name)
    .replaceAll("ال رانا ٹریڈرز", name)
    .replaceAll("اے آر ٹی", name)
    .replace(/\bAl Rana\b/g, name)
    .replaceAll("الرانا", name)
    .replaceAll("ال رانا", name)
    .replace(/\bART\b(?!-)/g, name);
  return collapsePair(filled, name)
    .replace(/\s+[·•]\s*(?=[,.]|$)/g, "")
    .replace(/[·•]\s*(?=[,.]|$)/g, "")
    .replace(/,\s*\./g, ".")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}
