/** Phone par sirf AgriBridge aur tagline. Company naam screen par nahi, domain par rehta hai. */

import type { FetchLike } from "./live-login";
import { liveGet, type LiveAuth } from "./live-read";

export type SubBrand = { name: string; logoUrl: string | null };

export type Tagline = { roman: string | null; urdu: string | null; english: string | null };

export type AppMark = { brand: SubBrand | null; tagline: Tagline };

type BrandRow = { name?: unknown; logo_url?: unknown; current?: unknown };

export function emptyTagline(): Tagline {
  return { roman: null, urdu: null, english: null };
}

function textLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

/** Khali field null. App khud tagline nahi likhti. */
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
  return { roman: textLine(row.roman), urdu: textLine(row.urdu), english: textLine(row.english) };
}

export function taglineLines(tagline: Tagline): { text: string; urdu: boolean }[] {
  const lines: { text: string; urdu: boolean }[] = [];
  if (tagline.roman) lines.push({ text: tagline.roman, urdu: false });
  if (tagline.urdu) lines.push({ text: tagline.urdu, urdu: true });
  if (tagline.english) lines.push({ text: tagline.english, urdu: false });
  return lines;
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

/** Tagline settings se. Brand hamesha null: koi company naam phone par nahi aata. */
export async function loadAppMark(auth: LiveAuth, fetchImpl: FetchLike): Promise<AppMark> {
  const blank: AppMark = { brand: null, tagline: emptyTagline() };
  const res = await liveGet<{ key?: string; value?: unknown }>(auth, "website_settings?select=key,value&key=in.(app_brands,app_tagline)&limit=2", fetchImpl);
  if (!res.ok) return blank;
  let tagline = emptyTagline();
  for (const row of res.rows) {
    if (row.key === "app_tagline") tagline = taglineFrom(row.value);
  }
  return { brand: null, tagline };
}
