/**
 * Kisan / Customer phone home ka hisaab.
 * Sample tab jab fehrist khali ho aur khata ka koi note na ho.
 * Jo record mila, us par sifar bhi sifar hai. Jo track nahi, wahan "—".
 */

import { milkInRange, milkLitres, pricedMilkTotal, rupees, shiftLabel, type MilkRow } from "./live-read";

export type MunshiPeriod = "aaj" | "hafte" | "mahine";

export type FarmFacts = {
  name: string;
  place: string;
  phone: string | null;
  code: string | null;
  farms: number | null;
  crops: number | null;
  animals: number | null;
  animalRows: { id?: string; tag_no?: string | null; species?: string | null }[];
};

export const EMPTY_FACTS: FarmFacts = {
  name: "",
  place: "",
  phone: null,
  code: null,
  farms: null,
  crops: null,
  animals: null,
  animalRows: [],
};

export type DeskEntry = {
  title: string;
  detail: string;
  amount: string;
  tone: "in" | "out";
  day: string;
};

const CLOSED = new Set(["delivered", "completed", "grn_submitted", "cancelled", "rejected", "void"]);
const MOVING = new Set(["dispatched", "in_transit", "processing", "approved"]);

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function dayOf(iso: string | null | undefined): string {
  const raw = String(iso || "");
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && raw.length <= 10) return raw.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function clockOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function homeUsesSample(input: {
  milkOk: boolean;
  milkCount: number;
  ordersOk: boolean;
  orderCount: number;
  healthOk: boolean;
  healthCount: number;
  khataOwed: number | null;
  khataNote: string | null;
}): boolean {
  if (!input.milkOk || !input.ordersOk || !input.healthOk) return false;
  if (input.khataNote) return false;
  return input.milkCount === 0 && input.orderCount === 0 && input.healthCount === 0 && input.khataOwed == null;
}

export function overviewDate(today: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [, month, day] = today.split("-");
  const label = months[Number(month) - 1] || "";
  return `${Number(day) || ""} ${label}`.trim();
}

export function litreLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)} L`;
}

export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "K";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function prettyPhone(raw: string | null | undefined): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  const local = digits.startsWith("92") && digits.length >= 12 ? `0${digits.slice(2)}` : digits;
  if (local.length === 11 && local.startsWith("0")) return `${local.slice(0, 4)}-${local.slice(4)}`;
  return local;
}

export function walletCard(owed: number | null, note: string | null): { value: string; sub: string } {
  if (owed == null) return { value: "—", sub: note ? "track nahi" : "wallet" };
  return { value: rupees(Math.abs(owed)), sub: "wallet" };
}

export function periodBounds(period: MunshiPeriod, today: string, week: { start: string; end: string }): { start: string; end: string; sub: string } {
  if (period === "aaj") return { start: today, end: today, sub: "aaj" };
  if (period === "hafte") return { start: week.start, end: today < week.end ? today : week.end, sub: "is hafte" };
  return { start: `${today.slice(0, 7)}-01`, end: today, sub: "is mahine" };
}

export function incomeText(rows: MilkRow[], start: string, end: string): string {
  const slice = milkInRange(rows, start, end);
  if (!slice.length) return rupees(0);
  const total = pricedMilkTotal(slice);
  return total == null ? "—" : rupees(total);
}

export function todayMilk(rows: MilkRow[], today: string): { litres: number; text: string; sub: string } {
  const list = rows.filter((row) => row.entry_date === today);
  const litres = milkLitres(list);
  const shifts = new Set(list.map((row) => shiftLabel(row.shift)));
  const sub = shifts.has("Subah") && shifts.has("Shaam") ? "subah + shaam" : shifts.has("Shaam") ? "shaam" : shifts.has("Subah") ? "subah" : "aaj";
  return { litres, text: litreLabel(litres), sub };
}

export function orderSpend(rows: { status?: string | null; grand_total?: number | string | null; created_at?: string | null }[], start: string, end: string): { text: string; count: number } {
  const slice = rows.filter((row) => {
    const status = String(row.status || "").toLowerCase();
    if (CLOSED.has(status)) return false;
    const day = dayOf(row.created_at);
    return day >= start && day <= end;
  });
  const total = slice.reduce((sum, row) => sum + num(row.grand_total), 0);
  return { text: slice.length ? rupees(total) : rupees(0), count: slice.length };
}

export function openOrderStats(rows: { status?: string | null }[]): { open: number; moving: number } {
  const openRows = rows.filter((row) => !CLOSED.has(String(row.status || "").toLowerCase()));
  const moving = openRows.filter((row) => MOVING.has(String(row.status || "").toLowerCase())).length;
  return { open: openRows.length, moving };
}

export function dueReminders(rows: { kind?: string | null; next_due?: string | null }[], today: string): { count: number; deworm: boolean } {
  const due = rows.filter((row) => row.next_due && String(row.next_due) >= today);
  return { count: due.length, deworm: due.some((row) => row.kind === "deworm") };
}

function speciesWord(species: string | null | undefined): string {
  if (species === "buffalo") return "Bhains";
  if (species === "cow") return "Gaye";
  if (species === "goat") return "Bakri";
  return "Janwar";
}

export function reminderInbox(
  health: { kind?: string | null; next_due?: string | null; notes?: string | null; animal_id?: string | null }[],
  animals: { id?: string; tag_no?: string | null; species?: string | null }[],
  today: string,
): { title: string; detail: string; dest: string }[] {
  const due = health.filter((row) => row.next_due && String(row.next_due) >= today);
  if (!due.length) return [];
  const deworm = due.filter((row) => row.kind === "deworm");
  const focus = deworm.length ? deworm : due;
  const tags = focus.map((row) => {
    const animal = animals.find((item) => item.id && item.id === row.animal_id);
    if (!animal) return "";
    const tag = String(animal.tag_no || "").replace(/^#/, "");
    const kind = speciesWord(animal.species);
    return tag ? `${kind} #${tag}` : kind;
  }).filter(Boolean);
  const when = focus.some((row) => row.next_due === today) ? "aaj" : String(focus[0]?.next_due || "");
  const title = deworm.length ? `Deworming due — ${focus.length} janwar` : `Vet reminder — ${focus.length} janwar`;
  const detail = `${tags.join(", ") || focus[0]?.notes || "Vet reminder"} · ${when}`;
  return [{ title, detail, dest: "vet" }];
}

export function orderInbox(rows: { order_number?: string | null; status?: string | null; grand_total?: number | string | null }[]): { title: string; detail: string; dest: string }[] {
  const openRows = rows.filter((row) => !CLOSED.has(String(row.status || "").toLowerCase()));
  const moving = openRows.find((row) => MOVING.has(String(row.status || "").toLowerCase())) ?? openRows[0];
  if (!moving) return [];
  const movingNow = MOVING.has(String(moving.status || "").toLowerCase());
  const title = `Order #${moving.order_number || "—"} ${movingNow ? "raste mein" : String(moving.status || "open")}`.trim();
  const detail = moving.grand_total == null || moving.grand_total === "" ? "order" : rupees(num(moving.grand_total));
  return [{ title, detail, dest: "karyana" }];
}

export function signedAmount(value: number, tone: "in" | "out"): string {
  const body = Math.round(Math.abs(value)).toLocaleString("en-PK");
  return tone === "out" ? `-${body}` : `+${body}`;
}

export function recentEntries(input: {
  milk: MilkRow[];
  names: Map<string, string>;
  orders: { order_number?: string | null; status?: string | null; grand_total?: number | string | null; created_at?: string | null }[];
  lines: { entry_date?: string | null; tafseel?: string | null; udhaar?: number | string | null; adaigi?: number | string | null }[];
  start: string;
  end: string;
}): DeskEntry[] {
  const items: DeskEntry[] = [];
  for (const row of milkInRange(input.milk, input.start, input.end)) {
    const who = row.mca_profile_id ? input.names.get(row.mca_profile_id) || "MCA" : row.route_name || "Dairy";
    const litres = row.quantity_liters != null ? num(row.quantity_liters) : num(row.field_collected_volume);
    const rate = row.rate_per_liter == null || row.rate_per_liter === "" ? null : num(row.rate_per_liter);
    const amount = row.total_amount == null || row.total_amount === "" ? null : num(row.total_amount);
    const clock = clockOf(row.collected_at) || shiftLabel(row.shift);
    items.push({
      title: `Doodh sale — ${who}`,
      detail: `${litreLabel(litres).replace(" L", "")} L${rate == null ? "" : ` × Rs ${Math.round(rate)}`} · ${clock}`,
      amount: amount == null ? "—" : signedAmount(amount, "in"),
      tone: "in",
      day: String(row.entry_date || ""),
    });
  }
  for (const row of input.orders) {
    const status = String(row.status || "").toLowerCase();
    if (CLOSED.has(status)) continue;
    const day = dayOf(row.created_at);
    if (!day || day < input.start || day > input.end) continue;
    const amount = row.grand_total == null || row.grand_total === "" ? null : num(row.grand_total);
    items.push({
      title: `Khareed — ${row.order_number || "Order"}`,
      detail: String(row.status || "order"),
      amount: amount == null ? "—" : signedAmount(amount, "out"),
      tone: "out",
      day,
    });
  }
  for (const line of input.lines) {
    const day = dayOf(line.entry_date);
    if (!day || day < input.start || day > input.end) continue;
    const adaigi = num(line.adaigi);
    const udhaar = num(line.udhaar);
    if (adaigi > 0) {
      items.push({
        title: `Wasooli — ${line.tafseel || "Adaigi"}`,
        detail: day,
        amount: signedAmount(adaigi, "in"),
        tone: "in",
        day,
      });
    } else if (udhaar > 0) {
      items.push({
        title: `Khareed — ${line.tafseel || "Udhaar"}`,
        detail: day,
        amount: signedAmount(udhaar, "out"),
        tone: "out",
        day,
      });
    }
  }
  return items.sort((a, b) => b.day.localeCompare(a.day)).slice(0, 6);
}

export function khataSides(owed: number | null, note: string | null): { lenay: string; dene: string; lenaySub: string; deneSub: string; cash: string } {
  if (owed == null) {
    return { lenay: "—", dene: "—", lenaySub: note ? "track nahi" : "khata", deneSub: note ? "track nahi" : "khata", cash: "—" };
  }
  if (owed < 0) {
    return { lenay: rupees(Math.abs(owed)), dene: rupees(0), lenaySub: "khata", deneSub: "khata", cash: rupees(Math.abs(owed)) };
  }
  return { lenay: rupees(0), dene: rupees(owed), lenaySub: "khata", deneSub: "khata", cash: rupees(Math.abs(owed)) };
}

export const SAMPLE_HOME = {
  doodh: "12.5 L",
  doodhSub: "subah + shaam",
  khata: "Rs 18,450",
  khataSub: "wallet",
  vet: "2",
  vetSub: "deworm due",
  orders: "3",
  ordersSub: "1 raste mein",
  animals: "8 janwar",
  crops: "3 active",
  doodhTile: "12.5 L aaj",
  ordersTile: "3 open",
  vetTile: "2 due",
  farms: "2",
  cash: "Rs 18,450",
  aamdani: "Rs 24,600",
  kharcha: "Rs 6,150",
  lenay: "Rs 9,300",
  lenaySub: "4 log",
  dene: "Rs 18,187",
  deneSub: "3 log",
};

export const SAMPLE_INBOX = [
  { title: "Deworming due — 3 janwar", detail: "Gaye #4, #7, Bhains #2 · aaj", dest: "vet" },
  { title: "Order #A-1182 raste mein", detail: "Wanda 2 bori · kal tak", dest: "karyana" },
];

export const SAMPLE_ENTRIES: DeskEntry[] = [
  { title: "Doodh sale — Haji Dairy", detail: "12.5 L × Rs 180 · 09:10", amount: "+2,250", tone: "in", day: "" },
  { title: "Khareed — Wanda 2 bori", detail: "Ali Feed Store · 11:40", amount: "-7,400", tone: "out", day: "" },
  { title: "Wasooli — Aslam", detail: "Purana udhaar · 13:05", amount: "+3,000", tone: "in", day: "" },
];
