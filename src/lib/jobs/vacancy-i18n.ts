import type { Lang } from "@/lib/i18n/translations";
import { BRAND_NAME, isHiddenBrand } from "@/lib/brand";

/**
 * Public naukri ka unwan aur tafseel.
 *
 * Zaban ka khana bhara ho to wahi. Khali ho to English, phir wohi
 * purana title/description jo pehle se table mein hai. Sifar nahi —
 * khali ka matlab "likha hi nahi", is liye agla khana dikhta hai.
 */
export interface VacancySource {
  id: string;
  title: string;
  description: string | null;
  requirements?: string | null;
  seats_total?: number | null;
  branch_name?: string | null;
  title_en?: string | null;
  title_ur?: string | null;
  title_roman?: string | null;
  description_en?: string | null;
  description_ur?: string | null;
  description_roman?: string | null;
  brand?: string | null;
  brand_en?: string | null;
  brand_ur?: string | null;
  brand_roman?: string | null;
}

export interface CareerCard {
  id: string;
  title: string;
  location: string | null;
  salary: string | null;
  positions: number | null;
  blurb: string | null;
  brand: string | null;
}

function filled(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function pick(specific: string | null | undefined, english: string | null | undefined, base: string | null | undefined): string | null {
  return filled(specific) ?? filled(english) ?? filled(base);
}

export function vacancyText(row: VacancySource, lang: Lang): { title: string; description: string | null } {
  const titleSpecific = lang === "ur" ? row.title_ur : lang === "rm" ? row.title_roman : row.title_en;
  const descriptionSpecific = lang === "ur" ? row.description_ur : lang === "rm" ? row.description_roman : row.description_en;
  return {
    title: pick(titleSpecific, row.title_en, row.title) ?? row.title,
    description: pick(descriptionSpecific, row.description_en, row.description),
  };
}

/** "Rs 25,000" ya "25,000 روپے". Sifar aur khali dono null — card par kuch nahi. */
export function parseSalaryAmount(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/(?:Rs\.?\s*)(\d{1,3}(?:,\d{3})+|\d{4,})|(\d{1,3}(?:,\d{3})+|\d{4,})\s*روپے/i);
  const raw = match?.[1] || match?.[2];
  if (!raw) return null;
  const digits = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(digits) || digits <= 0) return null;
  return raw;
}

/** Ielan mein likhi aasamiyan. Na mile to seats_total, warna null. */
export function parsePositions(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(?:Positions|Aasamiyan|آسامیاں)\s*[:：]?\s*(\d+)/i);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? count : null;
}

export function vacancyLocation(title: string, branchName: string | null | undefined): string | null {
  const branch = filled(branchName);
  if (branch) return branch;
  const parts = title.split(/\s[-–—]\s/).map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

export function vacancyBlurb(description: string | null | undefined): string | null {
  const text = filled(description);
  if (!text) return null;
  const cleaned = text
    .replace(/(?:Salary|Tankhwah|تنخواہ)\s*:[^.۔\n]*[.۔]?/gi, "")
    .replace(/(?:Positions|Aasamiyan|آسامیاں)\s*:[^.۔\n]*[.۔]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || text;
}

/** Khali, platform ka apna naam, ya chhupa hua trading-naam — tag nahi. */
export function vacancyBrand(row: VacancySource, lang: Lang): string | null {
  const specific = lang === "ur" ? row.brand_ur : lang === "rm" ? row.brand_roman : row.brand_en;
  const raw = pick(specific, row.brand_en, row.brand);
  if (!raw || isHiddenBrand(raw) || raw.trim() === BRAND_NAME) return null;
  return raw;
}

export function presentVacancy(row: VacancySource, lang: Lang): CareerCard {
  const text = vacancyText(row, lang);
  const fromText = parsePositions(text.description);
  const fromSeats = row.seats_total && row.seats_total > 0 ? row.seats_total : null;
  return {
    id: row.id,
    title: text.title,
    location: vacancyLocation(text.title, row.branch_name),
    salary: parseSalaryAmount(text.description),
    positions: fromText ?? fromSeats,
    blurb: vacancyBlurb(text.description),
    brand: vacancyBrand(row, lang),
  };
}
