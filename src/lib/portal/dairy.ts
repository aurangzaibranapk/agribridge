/**
 * Kisan portal Dairy (Phase 3) -- khalis hisaab (pure), tests ke liye.
 * Data 566/567 se aata hai (RLS: sirf apna).
 */
export const SPECIES = ["cow", "buffalo", "goat"] as const;
export const SEXES = ["F", "M"] as const;
export const STATUSES = ["milking", "dry", "pregnant", "heifer", "calf", "bull", "sold", "dead"] as const;
export const ACTIVE_STATUSES = ["milking", "dry", "pregnant", "heifer", "calf", "bull"] as const;
export const SOURCES = ["born", "purchased"] as const;
export const BREEDS = ["Sahiwal", "Cholistani", "Red Sindhi", "HF Cross", "Jersey Cross", "Nili-Ravi", "Kundi", "Beetal", "Desi", "Other"];
export type Species = (typeof SPECIES)[number];
export type Status = (typeof STATUSES)[number];
export type Shift = "am" | "pm";

export const STATUS_TONE: Record<Status, string> = {
  milking: "green", pregnant: "violet", dry: "amber", heifer: "indigo", calf: "indigo", bull: "slate", sold: "slate", dead: "rose",
};
export const SPECIES_EMOJI: Record<Species, string> = { cow: "🐄", buffalo: "🐃", goat: "🐐" };

export interface Animal {
  id: string; tag_no: string; rfid_tag: string | null; name: string | null; species: Species; breed: string | null; sex: "F" | "M";
  dob: string | null; dob_estimated: boolean; dam_id: string | null; sire_text: string | null; source: "born" | "purchased";
  purchase_price: number | null; status: Status; photo_path: string | null; photo_thumb_path: string | null; lactation_no: number; last_calving_date: string | null;
  farm_id: string | null; created_at: string;
}
export interface Yield { animal_id: string; yield_date: string; shift: Shift; liters: number; fat: number | null; withheld: boolean; note: string | null }
export interface DayRow { date: string; am: number; pm: number; total: number }

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export const r1 = (n: number) => Math.round(n * 10) / 10;

export function parseAnimals(raw: unknown): Animal[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a: Record<string, unknown>) => ({
    id: String(a.id), tag_no: String(a.tag_no ?? ""), rfid_tag: (a.rfid_tag as string) ?? null, name: (a.name as string) ?? null,
    species: (SPECIES as readonly string[]).includes(a.species as string) ? (a.species as Species) : "cow",
    breed: (a.breed as string) ?? null, sex: a.sex === "M" ? "M" : "F", dob: (a.dob as string) ?? null, dob_estimated: !!a.dob_estimated,
    dam_id: (a.dam_id as string) ?? null, sire_text: (a.sire_text as string) ?? null, source: a.source === "purchased" ? "purchased" : "born",
    purchase_price: numOrNull(a.purchase_price), status: (STATUSES as readonly string[]).includes(a.status as string) ? (a.status as Status) : "milking",
    photo_path: (a.photo_path as string) ?? null, photo_thumb_path: (a.photo_thumb_path as string) ?? null, lactation_no: num(a.lactation_no), last_calving_date: (a.last_calving_date as string) ?? null,
    farm_id: (a.farm_id as string) ?? null, created_at: String(a.created_at ?? ""),
  }));
}
export function parseYields(raw: unknown): Yield[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((y: Record<string, unknown>) => ({
    animal_id: String(y.animal_id), yield_date: String(y.yield_date).slice(0, 10), shift: y.shift === "pm" ? "pm" : "am",
    liters: num(y.liters), fat: numOrNull(y.fat), withheld: !!y.withheld, note: (y.note as string) ?? null,
  }));
}

/** ISO date arithmetic without timezone surprises. */
export function addDays(iso: string, d: number): string {
  const [y, m, dd] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd + d));
  return t.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Umar: "4y 2m" / "8m" / "12d". */
export function ageText(dob: string | null, asOf: string): string {
  if (!dob) return "—";
  const [y1, m1, d1] = dob.split("-").map(Number), [y2, m2, d2] = asOf.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (months < 0) return "—";
  if (months === 0) return `${Math.max(0, daysBetween(dob, asOf))}d`;
  const y = Math.floor(months / 12); months %= 12;
  return y ? (months ? `${y}y ${months}m` : `${y}y`) : `${months}m`;
}

/** Rozana silsila (khali din = 0), purane se naya. */
export function dailySeries(yields: Yield[], from: string, to: string, animalId?: string): DayRow[] {
  const map = new Map<string, DayRow>();
  const n = daysBetween(from, to);
  for (let i = 0; i <= n; i++) { const d = addDays(from, i); map.set(d, { date: d, am: 0, pm: 0, total: 0 }); }
  for (const y of yields) {
    if (animalId && y.animal_id !== animalId) continue;
    const row = map.get(y.yield_date);
    if (!row) continue;
    row[y.shift] = r1(row[y.shift] + y.liters);
    row.total = r1(row.am + row.pm);
  }
  return Array.from(map.values());
}

export function avg(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
/** % badlao: pichhle 7 din ka avg vs us se pehle ke 7. */
export function weekChange(series: DayRow[]): number | null {
  if (series.length < 14) return null;
  const last = avg(series.slice(-7).map((d) => d.total)), prev = avg(series.slice(-14, -7).map((d) => d.total));
  return prev > 0 ? Math.round(((last - prev) / prev) * 100) : null;
}

export interface HerdSummary {
  today: DayRow; total30: number; milking: number; active: number; perCow: number; change: number | null;
  byStatus: { status: Status; count: number }[]; pendingPm: number; pendingAm: number;
}
export function herdSummary(animals: Animal[], yields: Yield[], asOf: string): HerdSummary {
  const series = dailySeries(yields, addDays(asOf, -29), asOf);
  const today = series[series.length - 1];
  const active = animals.filter((a) => (ACTIVE_STATUSES as readonly string[]).includes(a.status));
  const milkingNow = active.filter((a) => a.status === "milking" || a.status === "pregnant");
  const todays = yields.filter((y) => y.yield_date === asOf);
  const milkedToday = new Set(todays.map((y) => y.animal_id));
  const haveShift = (s: Shift) => new Set(todays.filter((y) => y.shift === s).map((y) => y.animal_id));
  const am = haveShift("am"), pm = haveShift("pm");
  const counts = new Map<Status, number>();
  for (const a of active) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  return {
    today, total30: r1(series.reduce((s, d) => s + d.total, 0)), milking: milkingNow.length, active: active.length,
    // Aaj ka din adhoora ho sakta hai (shaam baqi) -- avg aur % kal tak ke poore dinon se.
    perCow: perCow7(yields, animals, asOf, milkedToday.size), change: weekChange(series.slice(0, -1)),
    byStatus: Array.from(counts.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    pendingAm: milkingNow.filter((a) => !am.has(a.id)).length, pendingPm: milkingNow.filter((a) => !pm.has(a.id)).length,
  };
}

function perCow7(yields: Yield[], animals: Animal[], asOf: string, fallback: number): number {
  const from = addDays(asOf, -7), to = addDays(asOf, -1);
  const days = dailySeries(yields, from, to).filter((d) => d.total > 0);
  if (!days.length) return 0;
  const cows = new Set(yields.filter((y) => y.yield_date >= from && y.yield_date <= to).map((y) => y.animal_id)).size || fallback || 1;
  void animals;
  return r1(avg(days.map((d) => d.total)) / cows);
}

export interface AnimalStat { id: string; today: number; last7: number[]; avg7: number; dropPct: number | null }
export function animalStats(animals: Animal[], yields: Yield[], asOf: string): Map<string, AnimalStat> {
  const out = new Map<string, AnimalStat>();
  const from = addDays(asOf, -6);
  for (const a of animals) {
    const s = dailySeries(yields, from, asOf, a.id).map((d) => d.total);
    // Girawat: kal tak ke poore din (aaj adhoora ho sakta hai)
    const full = dailySeries(yields, addDays(asOf, -7), addDays(asOf, -1), a.id).map((d) => d.total).filter((x) => x > 0);
    const first = full[0] ?? 0, last = full[full.length - 1] ?? 0;
    out.set(a.id, { id: a.id, today: s[s.length - 1], last7: s, avg7: r1(avg(s.filter((x) => x > 0))), dropPct: full.length >= 3 && first > 0 ? Math.round(((last - first) / first) * 100) : null });
  }
  return out;
}
/** Doodh 10%+ gira -> alert. */
/** Chart ka aakhri din: aaj sirf tab jab shaam ka doodh bhi darj ho, warna kal. */
export function chartEnd(yields: Yield[], asOf: string): string {
  return yields.some((y) => y.yield_date === asOf && y.shift === "pm") ? asOf : addDays(asOf, -1);
}
export function dropAlerts(animals: Animal[], stats: Map<string, AnimalStat>, threshold = -10) {
  return animals
    .map((a) => ({ a, s: stats.get(a.id)! }))
    .filter((x) => x.s && x.s.dropPct !== null && x.s.dropPct <= threshold)
    .sort((x, y) => (x.s.dropPct ?? 0) - (y.s.dropPct ?? 0));
}

export function statusFilter(animals: Animal[], f: string): Animal[] {
  if (f === "gone") return animals.filter((a) => a.status === "sold" || a.status === "dead");
  if (f === "young") return animals.filter((a) => a.status === "heifer" || a.status === "calf");
  if ((STATUSES as readonly string[]).includes(f)) return animals.filter((a) => a.status === f);
  return animals.filter((a) => a.status !== "sold" && a.status !== "dead");
}
export function sortByTag(animals: Animal[]): Animal[] {
  return [...animals].sort((a, b) => a.tag_no.localeCompare(b.tag_no, "en", { numeric: true }));
}
/** Agla tag: sab se bara numeric tag + 1. */
export function nextTag(animals: Animal[]): string {
  const nums = animals.map((a) => parseInt(a.tag_no.replace(/\D/g, ""), 10)).filter((n) => Number.isFinite(n));
  return String(nums.length ? Math.max(...nums) + 1 : 1);
}
/** Days in milk (Phase 4 last_calving_date bharega). */
export function dim(a: Animal, asOf: string): number | null {
  return a.last_calving_date ? daysBetween(a.last_calving_date, asOf) : null;
}

// --- Form validation (server action + tests) ---
export interface AnimalInput {
  tag_no: string; rfid_tag: string | null; name: string | null; species: Species; breed: string | null; sex: "F" | "M";
  dob: string | null; dob_estimated: boolean; status: Status; dam_id: string | null; source: "born" | "purchased";
  purchase_price: number | null; farm_id: string | null; sire_text: string | null;
}
const s = (v: FormDataEntryValue | null | undefined) => (typeof v === "string" ? v.trim() : "");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
export function validateAnimal(fd: { get(k: string): FormDataEntryValue | null }, asOf: string, existingTags: string[]): { ok: true; value: AnimalInput } | { ok: false; error: string } {
  const tag = s(fd.get("tag_no"));
  if (!tag) return { ok: false, error: "dy_err_tag" };
  if (tag.length > 30) return { ok: false, error: "dy_err_tag" };
  if (existingTags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())) return { ok: false, error: "dy_err_tag_dup" };
  const species = s(fd.get("species")) as Species;
  if (!(SPECIES as readonly string[]).includes(species)) return { ok: false, error: "dy_err_species" };
  const status = s(fd.get("status")) as Status;
  if (!(ACTIVE_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "dy_err_status" };
  let dob = s(fd.get("dob")) || null;
  if (dob && /^\d{4}-\d{2}$/.test(dob)) dob = `${dob}-01`;
  if (dob && (!ISO.test(dob) || dob > asOf)) return { ok: false, error: "dy_err_dob" };
  const priceRaw = s(fd.get("purchase_price"));
  const price = priceRaw ? Number(priceRaw.replace(/,/g, "")) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0)) return { ok: false, error: "dy_err_price" };
  const dam = s(fd.get("dam_id")) || null, farm = s(fd.get("farm_id")) || null;
  if ((dam && !UUID.test(dam)) || (farm && !UUID.test(farm))) return { ok: false, error: "dy_err_generic" };
  const name = s(fd.get("name")).slice(0, 60) || null;
  return {
    ok: true,
    value: {
      tag_no: tag, rfid_tag: s(fd.get("rfid_tag")) || null, name, species, breed: s(fd.get("breed")) || null,
      sex: s(fd.get("sex")) === "M" ? "M" : "F", dob, dob_estimated: s(fd.get("dob_estimated")) === "1" || /^\d{4}-\d{2}$/.test(s(fd.get("dob"))),
      status, dam_id: dam, source: s(fd.get("source")) === "purchased" ? "purchased" : "born", purchase_price: price, farm_id: farm,
      sire_text: s(fd.get("sire_text")) || null,
    },
  };
}
export function parseLiters(v: string): number | null | "bad" {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 60) return "bad";
  return Math.round(n * 100) / 100;
}
export function validateDate(d: string, asOf: string): boolean {
  return ISO.test(d) && d <= asOf && daysBetween(d, asOf) <= 60;
}

/** "Ghar par darj" vs "Centre par diya" farq. */
export function reconcile(home: number, centre: number) {
  return { home: r1(home), centre: r1(centre), diff: r1(home - centre) };
}
export function rangeDays(r: string | undefined): number { return r === "7" ? 7 : r === "90" ? 90 : 30; }
