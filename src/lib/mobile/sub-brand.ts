/** Phone par locked Kisan Pakistan + AgriBridge identity. */

import type { FetchLike } from "./live-login";
import type { LiveAuth } from "./live-read";

export type SubBrand = { name: string; logoUrl: string | null };

export type Tagline = { roman: string | null; urdu: string | null; english: string | null };

export type AppLang = "en" | "rm" | "ur";

export type BrandLockup = { title: string; line: string; rtl: boolean };

export type AppMark = { brand: SubBrand | null; tagline: Tagline };

export const DEFAULT_ROMAN_TAGLINE = "AgriBridge";
export const DEFAULT_URDU_TAGLINE = "AgriBridge";

const FORBIDDEN_TAGLINE = /the farmer['’]s bridge/i;

type BrandRow = { name?: unknown; logo_url?: unknown; current?: unknown };

export function emptyTagline(): Tagline {
  return { roman: null, urdu: null, english: null };
}

function textLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function allowedLine(value: string | null, fallback: string): string {
  if (!value || FORBIDDEN_TAGLINE.test(value)) return fallback;
  return value;
}

/** Khali field null. English gloss phone par nahi aati. */
export function taglineFrom(value: unknown): Tagline {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return emptyTagline();
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyTagline();
  const row = parsed as { roman?: unknown; urdu?: unknown; english?: unknown };
  return { roman: textLine(row.roman), urdu: textLine(row.urdu), english: null };
}

/** Settings khali hon to app ka default. Forbidden gloss default par laut aata hai. */
export function taglineWithDefault(value: Tagline | null | undefined): Tagline {
  const row = value ?? emptyTagline();
  return {
    roman: allowedLine(row.roman, DEFAULT_ROMAN_TAGLINE),
    urdu: allowedLine(row.urdu, DEFAULT_URDU_TAGLINE),
    english: null,
  };
}

export function taglineLines(tagline: Tagline): { text: string; urdu: boolean }[] {
  const row = taglineWithDefault(tagline);
  return [
    { text: row.roman || DEFAULT_ROMAN_TAGLINE, urdu: false },
    { text: row.urdu || DEFAULT_URDU_TAGLINE, urdu: true },
  ];
}

/** English aur Roman ek lockup. Urdu doosra. Beech mein koi teesri line nahi. */
export function brandLockup(lang: AppLang, _tagline?: Tagline | null): BrandLockup {
  if (lang === "ur") return { title: "کسان پاکستان", line: "AgriBridge", rtl: true };
  return { title: "Kisan Pakistan", line: "AgriBridge", rtl: false };
}

function httpsLogo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^https:\/\//i.test(url) ? url : null;
}

/** Website ka company naam. Phone is naam ko kabhi nahi dikhata. */
export function blockedAppBrand(name: string): boolean {
  return /al\s*rana/i.test(name);
}

/** Settings array ka parser. Screen is naam ko nahi likhti. Website wala naam yahan bhi reject hota hai. */
export function currentSubBrand(value: unknown): SubBrand | null {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as BrandRow;
    if (row.current !== true) continue;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name || blockedAppBrand(name)) continue;
    return { name, logoUrl: httpsLogo(row.logo_url) };
  }
  return null;
}

/** Branding database se badal nahi sakti; dono approved names har role par stable rehte hain. */
export async function loadAppMark(_auth: LiveAuth, _fetchImpl: FetchLike): Promise<AppMark> {
  return { brand: null, tagline: taglineWithDefault(null) };
}
