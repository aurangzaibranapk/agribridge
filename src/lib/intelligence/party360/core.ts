/**
 * Party 360 (per type) -- pure hisaab. Sirf parhta hai; test: npm run test:party-360.
 */
export type Tone = "neutral" | "good" | "bad" | "warn" | "info";
export type Kpi = { label: string; value: number | string | null; fmt?: "rs" | "num" | "kg" | "text"; hint?: string; tone?: Tone };
export type Section = { title: string; note?: string; columns: string[]; rows: (string | number | null)[][]; empty?: string; href?: string;
  /** Bank-statement amount columns (index): fixed width, end-aligned, divider. */
  amountCols?: number[] };
export type TimelineItem = { date: string; label: string; amount?: number | null; tone?: Tone };
export type ShopLine = { key: string; label: string; weSold: number; weBought: number; received: number; paid: number; balance: number; note?: string };
export type Party360Data = {
  type: "farmer" | "customer" | "dealer" | "supplier" | "buyer";
  id: string;
  name: string;
  code?: string | null;
  sub: string[];
  badges: { label: string; tone: Tone }[];
  actions: { label: string; href: string; primary?: boolean }[];
  kpis: Kpi[];
  monthly: { title: string; months: string[]; series: { name: string; values: number[]; color: string }[] } | null;
  aging: AgingBuckets | null;
  agingNote?: string;
  creditCustomerId?: string | null;
  shops?: ShopLine[];
  net?: { theyOwe: number; weOwe: number; net: number } | null;
  links?: { label: string; href: string }[];
  activity?: import("./activity").Activity | null;
  sections: Section[];
  timeline: TimelineItem[];
  empty?: string | null;
  notes: string[];
};

export const r2 = (v: number) => Math.round(v * 100) / 100;
export const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** PKT (UTC+5) mahina key "YYYY-MM". */
export function pktMonthKey(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+05:00` : iso);
  const p = new Date(d.getTime() + 5 * 3600_000);
  return `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** Pichle n mahine (aakhri = now ka mahina), labels + keys. */
export function lastMonths(now: Date, n = 6): { keys: string[]; labels: string[] } {
  const p = new Date(now.getTime() + 5 * 3600_000);
  const keys: string[] = [], labels: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    labels.push(MONTHS[d.getUTCMonth()]);
  }
  return { keys, labels };
}
export function monthlySeries(rows: { date: string; amount: number }[], keys: string[]): number[] {
  const m = new Map<string, number>();
  for (const r of rows) if (r.date) { const k = pktMonthKey(r.date); m.set(k, (m.get(k) ?? 0) + num(r.amount)); }
  return keys.map((k) => r2(m.get(k) ?? 0));
}

export type AgingBuckets = { d0_30: number; d31_60: number; d61_90: number; d90p: number; total: number };
/**
 * FIFO aging: purane udhaar pehle chukte hain. `outstanding` = aaj ka asal baqaya
 * (ledger se). Sab se naye udhaar bache hue maane jaate hain.
 */
export function agingFifo(credits: { date: string; amount: number }[], outstanding: number, now: Date): AgingBuckets {
  const b: AgingBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0, total: 0 };
  let left = Math.max(0, outstanding);
  const sorted = credits.filter((c) => c.amount > 0).sort((a, z) => (a.date < z.date ? 1 : -1)); // newest first
  for (const c of sorted) {
    if (left <= 0) break;
    const take = Math.min(left, c.amount); left -= take;
    const days = Math.floor((now.getTime() - new Date(c.date.length === 10 ? `${c.date}T00:00:00+05:00` : c.date).getTime()) / 86_400_000);
    if (days <= 30) b.d0_30 += take; else if (days <= 60) b.d31_60 += take; else if (days <= 90) b.d61_90 += take; else b.d90p += take;
  }
  // jo baqaya kisi udhaar bill se match na ho (opening/journal) wo sab se purana
  if (left > 0) b.d90p += left;
  b.d0_30 = r2(b.d0_30); b.d31_60 = r2(b.d31_60); b.d61_90 = r2(b.d61_90); b.d90p = r2(b.d90p);
  b.total = r2(b.d0_30 + b.d31_60 + b.d61_90 + b.d90p);
  return b;
}

/** Net position: + = party humein deni hai, - = hum ne deni hai. */
export function netPosition(lines: ShopLine[]): { theyOwe: number; weOwe: number; net: number } {
  let theyOwe = 0, weOwe = 0;
  for (const l of lines) { if (l.balance > 0) theyOwe += l.balance; else weOwe += -l.balance; }
  return { theyOwe: r2(theyOwe), weOwe: r2(weOwe), net: r2(theyOwe - weOwe) };
}

/** Shop ka business_type -> 360 ki line. */
export function shopKey(businessType: string | null | undefined, name?: string | null): { key: string; label: string } {
  const bt = String(businessType ?? "").toLowerCase();
  if (bt === "vet") return { key: "vets", label: "Kisaan Vets (services/dawai)" };
  if (bt === "karyana") return { key: "karyana", label: "Kisaan Karyana" };
  if (bt === "agri_inputs") return { key: "dukan", label: "Kisaan Dukan (khaad/beej/spray/wanda)" };
  if (bt === "dairy") return { key: "milk_shop", label: "Kisaan Milk Center (POS)" };
  if (bt === "grain_procurement") return { key: "procurement_pos", label: "Procurement (POS)" };
  return { key: `shop:${name ?? "other"}`, label: name ?? "Doosri dukan" };
}

/** Grain sale ka hisaab: mand = kg/40, rate/mand = rate_per_kg*40. */
export function grainSaleRow(s: { quantity_kg: unknown; rate_per_kg: unknown; total_amount: unknown; amount_received: unknown }) {
  const kg = num(s.quantity_kg), total = num(s.total_amount), rec = num(s.amount_received);
  return { kg, mand: r2(kg / 40), ratePerMand: r2(num(s.rate_per_kg) * 40), total, received: rec, due: r2(Math.max(0, total - rec)) };
}

/** Explicit links hi: customers.farmer_id = farmer.id, buyers.customer_id. Phone match sirf "mumkin" hint. */
export function phoneKey(p: string | null | undefined): string | null {
  const d = String(p ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.slice(-10);
}
