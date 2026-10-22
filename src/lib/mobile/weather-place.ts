/** Shehar ka naam. District "TEST" shehar nahi. Sample mausam nahi. */

export type PlaceRow = {
  village?: string | null;
  tehsil?: string | null;
  district?: string | null;
};

export type GeoHit = {
  country_code?: string | null;
  country?: string | null;
};

const SKIP = /^(test|—|-|n\/a|na)$/i;

export function usablePlace(value: string | null | undefined): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || SKIP.test(text)) return "";
  return text;
}

export function preferVillage(rows: PlaceRow[]): string {
  const places: string[] = [];
  for (const row of rows) {
    const place = usablePlace(row.village) || usablePlace(row.tehsil) || usablePlace(row.district);
    if (place && !places.includes(place)) places.push(place);
  }
  return places.find((place) => /^chak\b/i.test(place)) || places[0] || "";
}

/** Open-Meteo ki pehli hit India ho sakti hai. Pakistan wali lo, warna null. */
export function pickPakistan<T extends GeoHit>(results: T[] | null | undefined): T | null {
  if (!results?.length) return null;
  return results.find((row) => row.country_code === "PK" || /pakistan/i.test(row.country || "")) ?? null;
}
