/**
 * Animated search -- pure helpers (koi DOM nahi), taake tests chal sakein.
 * Flag: NEXT_PUBLIC_ANIM_SEARCH=1. Band ho to purana search bilkul waisa hi.
 */
export type SearchLang = "en" | "rm" | "ur";

export function animSearchEnabled(env: Record<string, string | undefined> = { NEXT_PUBLIC_ANIM_SEARCH: process.env.NEXT_PUBLIC_ANIM_SEARCH }): boolean {
  return env.NEXT_PUBLIC_ANIM_SEARCH === "1";
}

export const DEFAULT_PLACEHOLDER: Record<SearchLang, string> = {
  en: "Search…",
  rm: "Talash karein…",
  ur: "تلاش کریں…",
};

export const LABELS: Record<SearchLang, { open: string; close: string; mic: string; micStop: string; results: string }> = {
  en: { open: "Open search", close: "Close search", mic: "Dictate search (voice to text)", micStop: "Stop dictation", results: "Search results" },
  rm: { open: "Search kholein", close: "Search band karein", mic: "Bol kar likhwayein", micStop: "Bolna band", results: "Nataij" },
  ur: { open: "تلاش کھولیں", close: "تلاش بند کریں", mic: "بول کر لکھوائیں", micStop: "بولنا بند", results: "نتائج" },
};

export function speechLang(lang: SearchLang): string {
  return lang === "ur" ? "ur-PK" : lang === "rm" ? "en-PK" : "en-US";
}

export const EXPAND_MS = 450;
export const EASING = "cubic-bezier(.65,0,.35,1)";

/** Global shortcut: Ctrl/Cmd+K hamesha; '/' sirf jab user kisi field mein na likh raha ho. */
export function isOpenShortcut(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, targetIsEditable: boolean): boolean {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") return true;
  if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !targetIsEditable) return true;
  return false;
}

/** Arrow up/down par active result -- wrap around; -1 = koi nahi. */
export function nextActive(current: number, count: number, key: string): number {
  if (count <= 0) return -1;
  if (key === "ArrowDown") return current < 0 || current >= count - 1 ? 0 : current + 1;
  if (key === "ArrowUp") return current <= 0 ? count - 1 : current - 1;
  return current;
}

/**
 * Dictation: aawaz sirf alfaz banti hai. Pehle se likhe text ke baad jod do.
 * Ye function kabhi koi action nahi chalata -- sirf naya text lautata hai.
 */
export function mergeDictation(existing: string, spoken: string): string {
  const s = spoken.trim();
  if (!s) return existing;
  const e = existing.replace(/\s+$/, "");
  return e ? `${e} ${s}` : s;
}

export type SearchResult = { id: string; label: string; hint?: string; group?: string; href?: string };

export function groupResults(results: SearchResult[]): Array<{ group: string; items: Array<SearchResult & { index: number }> }> {
  const out: Array<{ group: string; items: Array<SearchResult & { index: number }> }> = [];
  results.forEach((r, index) => {
    const g = r.group ?? "";
    let bucket = out.find((b) => b.group === g);
    if (!bucket) { bucket = { group: g, items: [] }; out.push(bucket); }
    bucket.items.push({ ...r, index });
  });
  return out;
}
