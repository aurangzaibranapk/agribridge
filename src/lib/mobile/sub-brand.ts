/** Phone ka chhota brand. AgriBridge code mein rehta hai. Naam aur logo website_settings se. */

import type { FetchLike } from "./live-login";
import { liveGet, type LiveAuth } from "./live-read";

export type SubBrand = { name: string; logoUrl: string | null };

type BrandRow = { name?: unknown; logo_url?: unknown; current?: unknown };

function httpsLogo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^https:\/\//i.test(url) ? url : null;
}

/** Sirf current: true wali pehli brand. Naam khali ho to null. Logo sirf https. */
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
    if (!name) continue;
    return { name, logoUrl: httpsLogo(row.logo_url) };
  }
  return null;
}

/** Key na ho ya read fail ho to null. App khud naam nahi banati. */
export async function loadCurrentSubBrand(auth: LiveAuth, fetchImpl: FetchLike): Promise<SubBrand | null> {
  const res = await liveGet<{ value?: unknown }>(auth, "website_settings?select=value&key=eq.app_brands&limit=1", fetchImpl);
  if (!res.ok) return null;
  return currentSubBrand(res.rows[0]?.value);
}
