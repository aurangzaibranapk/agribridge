/**
 * Naqshe ki tiles kahan se aayein (Season Booking / farm pin map).
 *
 * 19 Oct 2026: kisan ke map par OpenStreetMap ki "Access blocked 403"
 * tiles aa rahi thin. Wajah: <img referrerPolicy="no-referrer"> -- OSM ki
 * tile policy bina Referer wali browser requests rok deti hai aur 200 ke
 * saath "blocked" wali tasveer bhejti hai (is liye onError bhi nahi chalta).
 * Ab Referer jata hai (browser ka default strict-origin-when-cross-origin)
 * aur attribution ka sahi link dikhta hai.
 *
 * Provider badalna ho to code nahi, sirf .env:
 *   NEXT_PUBLIC_MAP_TILE_URL="https://.../{z}/{x}/{y}.png"   ({s} = a/b/c ikhtiyari)
 *   NEXT_PUBLIC_MAP_TILE_ATTRIBUTION="© ..."                  (link ke saath dikhega)
 *   NEXT_PUBLIC_MAP_TILE_ATTRIBUTION_URL="https://..."
 * Khali ho to OSM standard.
 */
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const OSM_ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright";

/** Browser ko Referer bhejne do -- OSM policy ke liye zaroori. "no-referrer" kabhi nahi. */
export const TILE_REFERRER_POLICY = "strict-origin-when-cross-origin" as const;

export interface TileConfig { template: string; attribution: string; attributionUrl: string }

export function tileConfig(env: Record<string, string | undefined> = {
  NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL,
  NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION,
  NEXT_PUBLIC_MAP_TILE_ATTRIBUTION_URL: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION_URL,
}): TileConfig {
  const raw = (env.NEXT_PUBLIC_MAP_TILE_URL ?? "").trim();
  const ok = /^https:\/\/[^\s]+$/.test(raw) && raw.includes("{z}") && raw.includes("{x}") && raw.includes("{y}");
  if (!ok) return { template: OSM_TILE_URL, attribution: OSM_ATTRIBUTION, attributionUrl: OSM_ATTRIBUTION_URL };
  const attribution = (env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ?? "").trim() || OSM_ATTRIBUTION;
  const url = (env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION_URL ?? "").trim();
  return { template: raw, attribution, attributionUrl: /^https:\/\//.test(url) ? url : OSM_ATTRIBUTION_URL };
}

/** Ek tile ka URL. x pehle hi wrap ho chuka ho (0..2^z-1). */
export function tileUrl(template: string, z: number, x: number, y: number): string {
  const sub = "abc"[Math.abs(x + y) % 3];
  return template.replace("{s}", sub).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}
