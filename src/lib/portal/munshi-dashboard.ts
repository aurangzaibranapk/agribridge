/**
 * Kisan ke "Digital Munshi" dashboard ka hisaab -- sirf khalis functions.
 *
 * Pehle dashboard ke card ghalat jagah se parhte the:
 *  - Wallet `wallets` table se (jo khali hai) -- asal udhaar to dukaan ke
 *    khate (customers + journal 1100) mein hai.
 *  - Maweshi `livestock_loans` ki ginti se -- yani jis ke 10 gaye hon us
 *    ka bhi 0 dikhta tha.
 *  - Khaad `fertilizer_requests` aur machinery `machinery_requests` se,
 *    halanke asal safhe `credit_requests` aur `machinery_bookings` mein
 *    likhte hain.
 *
 * Yahan koi database nahi -- loader data laata hai, ye sirf ginta hai.
 * Is liye har cheez test ho sakti hai (scripts/test-portal-munshi.ts).
 */

export type ActivityKind =
  | "khata_udhaar"
  | "khata_adaigi"
  | "milk"
  | "milk_payment"
  | "fertilizer"
  | "machinery"
  | "demand"
  | "crop"
  | "harvest"
  | "livestock_loan"
  | "campaign";

export interface ActivityItem {
  kind: ActivityKind;
  title: string;
  detail: string;
  date: string; // ISO date ya timestamp
  amount?: number | null;
}

export interface CreditPositionRow {
  kul_baqaya: number | string | null;
  late_amount?: number | string | null;
  oldest_days?: number | null;
  promise_date?: string | null;
  promise_amount?: number | string | null;
  promise_state?: string | null;
}

export interface KhataInput {
  /** fn_customer_credit_position ki qataarein -- har linked customer ki ek. */
  positions: CreditPositionRow[];
  /** customers.current_balance -- jab position na mile (fallback). */
  customerBalances: number[];
  /** Journal 1100 ka debit - credit, linked customers ka (doosra fallback). */
  journalNet: number | null;
  /** farmer_credit_ledger ka debit - credit (khaad / naqad udhaar). */
  farmerLedgerDue: number;
  /** Jo kisan ko MILNA hai: doodh + gandum ka baqaya. */
  milkPayable: number;
  grainPayable: number;
}

export interface KhataSummary {
  owed: number;
  late: number;
  oldestDays: number | null;
  promise: { date: string; amount: number } | null;
  receivable: number;
  source: "position" | "journal" | "balance" | "none";
  hasLinkedCustomer: boolean;
}

const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export function summarizeKhata(i: KhataInput): KhataSummary {
  const hasLinkedCustomer = i.positions.length > 0 || i.customerBalances.length > 0;
  let shop = 0;
  let source: KhataSummary["source"] = "none";
  if (i.positions.length > 0) {
    shop = i.positions.reduce((s, p) => s + n(p.kul_baqaya), 0);
    source = "position";
  } else if (i.journalNet !== null && hasLinkedCustomer) {
    shop = i.journalNet;
    source = "journal";
  } else if (i.customerBalances.length > 0) {
    shop = i.customerBalances.reduce((s, b) => s + n(b), 0);
    source = "balance";
  }
  const late = i.positions.reduce((s, p) => s + n(p.late_amount), 0);
  const days = i.positions.map((p) => p.oldest_days).filter((d): d is number => typeof d === "number");
  const promises = i.positions
    .filter((p) => p.promise_date && (p.promise_state ?? "open") === "open")
    .map((p) => ({ date: String(p.promise_date), amount: n(p.promise_amount) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    owed: Math.round((shop + Math.max(0, n(i.farmerLedgerDue))) * 100) / 100,
    late,
    oldestDays: days.length ? Math.max(...days) : null,
    promise: promises[0] ?? null,
    receivable: Math.max(0, n(i.milkPayable)) + Math.max(0, n(i.grainPayable)),
    source,
    hasLinkedCustomer,
  };
}

export interface FarmerAnimals {
  has_livestock?: boolean | null;
  cow_count?: number | null;
  buffalo_count?: number | null;
  calves_count?: number | null;
  milking_animal_count?: number | null;
  meat_animal_count?: number | null;
  milk_liters_per_day?: number | null;
}

export interface LivestockSummary {
  total: number;
  cows: number;
  buffalo: number;
  calves: number;
  milking: number;
  dry: number;
  meat: number;
  litersPerDay: number;
  /** Ginti kahan se aayi: Dairy ke janwar records ya profile par likhi ginti. */
  source: "dairy" | "profile";
  /** L/din kahan se: Dairy ki doodh entries (30 din ki ausat) ya kisan ka bataya. */
  litersSource: "dairy" | "profile";
}

/** Dairy Management ka janwar (sirf jo dashboard ko chahiye). */
export interface DairyAnimalLite {
  species: string;
  status: string;
}

const GONE = new Set(["sold", "dead"]);

/** Dairy ki doodh entries se rozana ausat: kul litre / jin dinon ki entry hai. */
export function dairyLitersPerDay(rows: { yield_date: string | null; liters: number | string | null }[]): number {
  const days = new Set<string>();
  let total = 0;
  for (const r of rows) {
    const l = n(r.liters);
    if (l <= 0 || !r.yield_date) continue;
    days.add(String(r.yield_date).slice(0, 10));
    total += l;
  }
  return days.size ? total / days.size : 0;
}

/**
 * Maweshi ki ginti. Livestock -> Dairy (malik ki manzoori, 19 Oct):
 * jab Dairy Management mein janwar darj hon to wahi asal record hai;
 * warna kisan ke profile par likhi purani ginti (purana data mehfooz).
 * `dairyLitersPerDay` -- Dairy ki doodh entries ki 30 din ki ausat (0/null = nahi).
 */
export function summarizeLivestock(f: FarmerAnimals, animals?: DairyAnimalLite[] | null, dairyLitersPerDay?: number | null): LivestockSummary {
  const fromDairyL = Math.max(0, n(dairyLitersPerDay));
  const liters = fromDairyL > 0
    ? { litersPerDay: Math.round(fromDairyL * 10) / 10, litersSource: "dairy" as const }
    : { litersPerDay: Math.max(0, n(f.milk_liters_per_day)), litersSource: "profile" as const };
  const active = (animals ?? []).filter((a) => !GONE.has(a.status));
  if (active.length > 0) {
    const calves = active.filter((a) => a.status === "calf").length;
    const adultsList = active.filter((a) => a.status !== "calf");
    const milking = adultsList.filter((a) => a.status === "milking").length;
    return {
      total: active.length,
      cows: adultsList.filter((a) => a.species === "cow").length,
      buffalo: adultsList.filter((a) => a.species === "buffalo").length,
      calves,
      milking,
      dry: adultsList.length - milking,
      meat: Math.max(0, n(f.meat_animal_count)),
      ...liters,
      source: "dairy",
    };
  }
  const cows = Math.max(0, n(f.cow_count));
  const buffalo = Math.max(0, n(f.buffalo_count));
  const calves = Math.max(0, n(f.calves_count));
  const adults = cows + buffalo;
  const milking = Math.min(adults, Math.max(0, n(f.milking_animal_count)));
  return {
    total: adults + calves,
    cows,
    buffalo,
    calves,
    milking,
    dry: adults - milking,
    meat: Math.max(0, n(f.meat_animal_count)),
    ...liters,
    source: "profile",
  };
}

export interface ProfitInput {
  harvests: { quantity_harvested: number | string | null; sale_rate: number | string | null }[];
  cropExpenses: number[];
  milkIncome: number;
}

export interface ProfitSummary {
  revenue: number;
  expense: number;
  net: number;
  hasData: boolean;
}

/**
 * Munafa = (kattai ki farokht + doodh ki aamdani) - fasal ka kharcha.
 * Pehle sirf kattai ginti thi -- kattai na ho to "-" aata tha, chahe kisan
 * roz doodh bech raha ho aur khaad par kharcha kar chuka ho.
 */
export function summarizeProfit(i: ProfitInput): ProfitSummary {
  const harvestRevenue = i.harvests.reduce(
    (s, h) => (h.sale_rate === null || h.sale_rate === undefined ? s : s + n(h.quantity_harvested) * n(h.sale_rate)),
    0
  );
  const revenue = harvestRevenue + Math.max(0, n(i.milkIncome));
  const expense = i.cropExpenses.reduce((s, e) => s + n(e), 0);
  return { revenue, expense, net: revenue - expense, hasData: revenue > 0 || expense > 0 };
}

export interface RequestCounts {
  total: number;
  open: number;
  needsReply: number;
}

const FERT_OPEN = new Set(["pending", "admin_approved"]);
export function countFertilizer(rows: { status: string | null }[]): RequestCounts {
  return {
    total: rows.length,
    open: rows.filter((r) => FERT_OPEN.has(String(r.status))).length,
    needsReply: rows.filter((r) => r.status === "admin_approved").length,
  };
}

const MACH_DONE = new Set(["closed", "cancelled"]);
export function countMachinery(rows: { status: string | null }[]): RequestCounts {
  return {
    total: rows.length,
    open: rows.filter((r) => !MACH_DONE.has(String(r.status))).length,
    needsReply: rows.filter((r) => r.status === "payment_pending").length,
  };
}

/** Sab services ki sargarmi -- nayi pehle, aakhri `limit`. */
export function mergeActivity(lists: ActivityItem[][], limit = 8): ActivityItem[] {
  return lists
    .flat()
    .filter((a) => a.date && !Number.isNaN(new Date(a.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

export interface MonthPoint {
  key: string; // YYYY-MM
  label: string;
  udhaar: number;
  adaigi: number;
  milk: number;
  kharcha: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Pichhle `count` mahine (is mahine samait), purane pehle. */
export function monthBuckets(now: Date, count = 6): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: MONTHS[d.getUTCMonth()], udhaar: 0, adaigi: 0, milk: 0, kharcha: 0 });
  }
  return out;
}

export function addToMonths(
  months: MonthPoint[],
  field: "udhaar" | "adaigi" | "milk" | "kharcha",
  rows: { date: string | null; amount: number | string | null }[]
): MonthPoint[] {
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const r of rows) {
    if (!r.date) continue;
    const i = idx.get(String(r.date).slice(0, 7));
    if (i === undefined) continue;
    months[i][field] += n(r.amount);
  }
  return months;
}

export interface DayPoint {
  date: string; // YYYY-MM-DD
  label: string;
  liters: number;
}

/** Doodh -- pichhle `days` din, har din ka jor (subah + shaam). */
export function milkDaily(
  now: Date,
  rows: { entry_date: string | null; quantity_liters: number | string | null }[],
  days = 30
): DayPoint[] {
  const out: DayPoint[] = [];
  const idx = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const iso = d.toISOString().slice(0, 10);
    idx.set(iso, out.length);
    out.push({ date: iso, label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, liters: 0 });
  }
  for (const r of rows) {
    const i = r.entry_date ? idx.get(String(r.entry_date).slice(0, 10)) : undefined;
    if (i !== undefined) out[i].liters += n(r.quantity_liters);
  }
  return out;
}

/** Ek hi fasal do baar likhi ho (wohi farm, wohi naam, wohi tareekh) to ek gino. */
export function dedupeCrops<T extends { crop_name: string | null; sowing_date: string | null; farm_id?: string | null }>(
  crops: T[]
): T[] {
  const seen = new Set<string>();
  return crops.filter((c) => {
    const k = `${c.farm_id ?? ""}|${(c.crop_name ?? "").trim().toLowerCase()}|${c.sowing_date ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const SCORE_BANDS = ["platinum", "gold", "silver", "bronze", "low"] as const;

export interface OfficialScore {
  score: number | null;
  band: string | null;
  state: string;
  level: string | null;
  snapshotDate: string | null;
}

/** 541 wala sarkari darja -- score_snapshots + fn_credit_eligibility. */
export function officialScore(
  snap: { score: number | null; band: string | null; state: string | null; snapshot_date?: string | null } | null,
  elig: { level: string | null } | null
): OfficialScore {
  return {
    score: snap?.score ?? null,
    band: snap?.band ?? null,
    state: snap?.state ?? "insufficient_data",
    level: elig?.level ?? null,
    snapshotDate: snap?.snapshot_date ?? null,
  };
}

/** Rs 10,00,000 -> "Rs 10,00,000" (Pakistani grouping). */
export function rs(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}Rs ${Math.round(Math.abs(v)).toLocaleString("en-IN")}`;
}

export function pct(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export type TaskKind = "promise" | "late" | "fert_reply" | "mach_pay" | "profile" | "pin" | "campaign";

export interface TaskItem {
  kind: TaskKind;
  /** Farm ya campaign ka naam -- jahan zaroorat ho. */
  subject?: string;
  date?: string | null;
  amount?: number | null;
  urgent: boolean;
}

export interface TaskInput {
  today: string; // YYYY-MM-DD
  khata: KhataSummary;
  fert: RequestCounts;
  mach: RequestCounts;
  profileComplete: boolean;
  farmsWithoutPin: string[];
  campaigns: { name: string; deadline: string | null }[];
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);

/** "Aaj ke kaam" -- sirf asal record se, koi namoona nahi. Zaroori pehle. */
export function buildTasks(i: TaskInput): TaskItem[] {
  const out: TaskItem[] = [];
  if (i.khata.late > 0) out.push({ kind: "late", amount: i.khata.late, urgent: true });
  if (i.khata.promise) {
    const d = daysBetween(i.today, i.khata.promise.date);
    out.push({ kind: "promise", date: i.khata.promise.date, amount: i.khata.promise.amount, urgent: d <= 3 });
  }
  if (i.fert.needsReply > 0) out.push({ kind: "fert_reply", amount: i.fert.needsReply, urgent: true });
  if (i.mach.needsReply > 0) out.push({ kind: "mach_pay", amount: i.mach.needsReply, urgent: true });
  for (const c of i.campaigns) {
    if (!c.deadline) continue;
    const d = daysBetween(i.today, c.deadline.slice(0, 10));
    if (d >= 0) out.push({ kind: "campaign", subject: c.name, date: c.deadline.slice(0, 10), urgent: d <= 7 });
  }
  if (!i.profileComplete) out.push({ kind: "profile", urgent: false });
  for (const f of i.farmsWithoutPin) out.push({ kind: "pin", subject: f, urgent: false });
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

/** Dukaan ke khate ki bohat si chhoti qataarein -- ek din, ek simt = ek sargarmi. */
export function groupKhataByDay(
  lines: { date: string; debit: number | string | null; credit: number | string | null }[]
): { date: string; debit: number; credit: number; count: number }[] {
  const m = new Map<string, { date: string; debit: number; credit: number; count: number }>();
  for (const l of lines) {
    const d = String(l.date).slice(0, 10);
    const cur = m.get(d) ?? { date: d, debit: 0, credit: 0, count: 0 };
    cur.debit += n(l.debit);
    cur.credit += n(l.credit);
    cur.count += 1;
    m.set(d, cur);
  }
  return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
}
