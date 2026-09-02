/**
 * Product ka naam milana -- score ke sath (H, naqshe ka #2).
 *
 * Bill par "SUFI-5LTR", sheet par "sufi oil 5 ltr", catalogue mein
 * "Sufi Cooking Oil 5 Ltr". Poora naam milne ka intezar karein to aadhi
 * qatarein khali reh jati hain; andaze se laga dein to ghalat product
 * par rate charh jata hai. Beech ka raasta: score nikalo, aur banda
 * tasdeeq kare.
 *
 * Teen darje:
 *   EXACT   1.00  nishan/space hata kar bilkul wohi -- apne aap lagta hai
 *   STRONG  >= 0.80 aur doosre se saaf aage -- lag jata hai magar
 *           "andaza" ka nishan sath, tasdeeq ke baghair rate nahi charhta
 *   WEAK    < 0.80 -- sirf sujhaav, product nahi lagta
 *
 * Score kaise: lafzon ka milaan (Dice) + harfon ke joRon ka milaan
 * (bigram Dice), aur pack ka adad alag ho (5 vs 10) to bhaari kataoti.
 */

export const MATCH_STRONG = 0.8;
export const MATCH_GAP = 0.08;

export function matchKey(s: string): string {
  return tokens(s).join("");
}

/**
 * Ikai ke lafz ek shakl mein (built-in). Units/Pack Sizes ke masters (273)
 * se registerAliases() is par aur lafz charhata hai -- "bori" -> bags,
 * "peti" -> ctn, "5 ltr" -> 5L -- taake bill ke Roman Urdu lafz bhi
 * catalogue se milein. Masters na milein to yehi fehrist chalti hai.
 */
const BUILTIN_UNITS: Record<string, string> = {
  ltr: "l", litre: "l", liter: "l", lt: "l", l: "l",
  kg: "kg", kgs: "kg", kilo: "kg",
  gm: "g", gms: "g", gram: "g", grams: "g", g: "g",
  ml: "ml",
  pcs: "pc", pc: "pc", piece: "pc", pieces: "pc",
  pkt: "pkt", packet: "pkt", pack: "pkt",
};
/** Master ke unit codes ko built-in shakl par lana (ltr/l, gm/g, pcs/pc). */
const CODE_CANON: Record<string, string> = { ltr: "l", gm: "g", pcs: "pc" };

let unitAliases: Record<string, string> = { ...BUILTIN_UNITS };
let packAliases: { re: RegExp; to: string }[] = [];

/**
 * Masters se aliases: unitMap = { bori: "bags", litre: "ltr" ... },
 * packMap = { "5 ltr": "5L", "adha kilo": "500g" ... }. Lambi phrases
 * pehle badalti hain taake "5 ltr" "5" aur "ltr" mein tootne se pehle mil jaye.
 */
export function registerAliases(unitMap: Record<string, string>, packMap: Record<string, string>): void {
  const merged: Record<string, string> = { ...BUILTIN_UNITS };
  for (const [alias, code] of Object.entries(unitMap)) {
    const a = alias.toLowerCase().trim();
    if (!a) continue;
    merged[a] = CODE_CANON[code] ?? BUILTIN_UNITS[code] ?? code;
  }
  unitAliases = merged;
  packAliases = Object.entries(packMap)
    .map(([alias, label]) => [alias.toLowerCase().trim(), label.toLowerCase()] as const)
    .filter(([a]) => a.length > 0)
    .sort((x, y) => y[0].length - x[0].length)
    .map(([a, label]) => ({
      re: new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]*")}(?=$|[^a-z0-9])`, "g"),
      to: `$1 ${label} `,
    }));
}

/** Pack ke lafz (5 ltr, adha kilo) ko master ke label (5l, 500g) par lana. */
export function normalizePackText(s: string): string {
  let out = s.toLowerCase();
  for (const { re, to } of packAliases) out = out.replace(re, to);
  return out;
}

function tokens(s: string): string[] {
  return normalizePackText(s)
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/[^a-z0-9.]+/g, " ")
    .split(" ")
    .map((w) => unitAliases[w] ?? w)
    .filter((w) => w.length > 0);
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

function dice(a: Map<string, number>, b: Map<string, number>): number {
  let inter = 0;
  let na = 0;
  let nb = 0;
  for (const v of a.values()) na += v;
  for (const v of b.values()) nb += v;
  if (na === 0 || nb === 0) return 0;
  for (const [k, v] of a) inter += Math.min(v, b.get(k) ?? 0);
  return (2 * inter) / (na + nb);
}

function tokenDice(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sb = new Set(b);
  let inter = 0;
  for (const w of new Set(a)) if (sb.has(w)) inter += 1;
  return (2 * inter) / (new Set(a).size + sb.size);
}

/** Naam mein jo adad hain (5, 500, 1.5) -- pack ka andaza. */
function numbers(s: string): string[] {
  return (s.toLowerCase().match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

export function scoreMatch(query: string, queryPack: string | null, name: string, pack: string | null): number {
  const q = `${query} ${queryPack ?? ""}`.trim();
  const c = `${name} ${pack ?? ""}`.trim();
  if (!q || !c) return 0;
  if (matchKey(q) === matchKey(c) || matchKey(query) === matchKey(name)) return 1;

  const tq = tokens(q);
  const tc = tokens(c);
  // Bill par naam chhota hota hai ("sufi 5 l"), catalogue mein poora
  // ("Sufi Cooking Oil 5 L"). Is liye sab se bhaari sawal ye hai: bill
  // ke SAARE lafz catalogue wale naam mein hain ya nahi (coverage).
  const covered = tq.filter((w) => tc.some((v) => v === w || (w.length >= 3 && v.startsWith(w)))).length;
  const coverage = tq.length ? covered / tq.length : 0;
  const byToken = tokenDice(tq, tc);
  const byChar = dice(bigrams(matchKey(q)), bigrams(matchKey(c)));
  // Coverage sab se bhaari: bill ke saare lafz catalogue mein milte hon
  // (ek bori = 50kg, bori = bags ke baad) to harfon ka farq kam ahem hai.
  let score = 0.55 * coverage + 0.25 * byToken + 0.2 * byChar;

  // Pack ka adad dono taraf ho: alag -> ye wo cheez nahi; wohi -> thora
  // aur yaqeen.
  const nq = numbers(q);
  const nc = numbers(c);
  if (nq.length && nc.length) {
    if (!nq.some((n) => nc.includes(n))) score *= 0.5;
    else score = Math.min(0.99, score + 0.05);
  }

  return Math.max(0, Math.min(0.99, score));
}

export interface MatchCandidate<T> {
  item: T;
  score: number;
}

export function bestMatches<T extends { name: string; pack_size?: string | null }>(
  query: string,
  queryPack: string | null,
  products: T[],
  limit = 5
): MatchCandidate<T>[] {
  const out: MatchCandidate<T>[] = [];
  for (const p of products) {
    const s = scoreMatch(query, queryPack, p.name, p.pack_size ?? null);
    if (s > 0.3) out.push({ item: p, score: s });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/**
 * Faisla: exact -> "exact"; strong aur doosre se saaf aage -> "strong";
 * warna null (sirf sujhaav). Do product ek jaise score par hon to koi
 * nahi lagta -- aadha sahi milaan poora ghalat milaan hai.
 */
export function decideMatch<T extends { name: string; pack_size?: string | null }>(
  query: string,
  queryPack: string | null,
  products: T[]
): { kind: "exact" | "strong"; item: T; score: number; candidates: MatchCandidate<T>[] } | { kind: "none"; candidates: MatchCandidate<T>[] } {
  const cands = bestMatches(query, queryPack, products, 5);
  if (cands.length === 0) return { kind: "none", candidates: [] };
  const [a, b] = cands;
  if (a.score >= 1) {
    // Exact do dafa (do products ka naam ek jaisa) -> koi nahi.
    if (b && b.score >= 1) return { kind: "none", candidates: cands };
    return { kind: "exact", item: a.item, score: 1, candidates: cands };
  }
  if (a.score >= MATCH_STRONG && (!b || a.score - b.score >= MATCH_GAP)) {
    return { kind: "strong", item: a.item, score: a.score, candidates: cands };
  }
  return { kind: "none", candidates: cands };
}
