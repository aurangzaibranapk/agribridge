/**
 * Website ka naam aur tagline — ek hi jagah.
 *
 * Jo banda ye badle, header, footer, login, unwan, meta, aur
 * tarjume (`{brand}` / `{tagline}`) usi waqt badal jayein.
 * Domain alranatraders.pk, email pate, package id, database id
 * aur API URL yahan nahi — wo pata hain, naam nahi.
 */
export const BRAND_NAME = "AgriBridge";

export const BRAND_TAGLINE = {
  en: "The farmer's bridge",
  rm: "Kisan ka Wasela",
  ur: "کسان کا وسیلہ",
} as const;

export type BrandLang = keyof typeof BRAND_TAGLINE;

export function brandTagline(lang: string): string {
  if (lang === "en" || lang === "rm" || lang === "ur") return BRAND_TAGLINE[lang];
  return BRAND_TAGLINE.en;
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
 * Tarjume aur templates. `{brand}` naam hai, `{tagline}` us zaban ki line.
 * Purana trading-naam agar kisi jumle mein reh gaya ho to yahin naam ban jata hai.
 */
export function applyBrand(text: string, lang: BrandLang = "en"): string {
  const name = BRAND_NAME;
  const tag = BRAND_TAGLINE[lang] ?? BRAND_TAGLINE.en;
  const filled = text
    .replaceAll("{brand}", name)
    .replaceAll("{tagline}", tag)
    .replaceAll("Al Rana Traders", name)
    .replaceAll("AL RANA TRADERS", name)
    .replaceAll("الرانا ٹریڈرز", name)
    .replaceAll("ال رانا ٹریڈرز", name)
    .replaceAll("اے آر ٹی", name)
    .replace(/\bAl Rana\b/g, name)
    .replaceAll("الرانا", name)
    .replaceAll("ال رانا", name)
    .replace(/\bART\b(?!-)/g, name);
  return collapsePair(filled, name);
}
