/**
 * Mock chrome for ?glass=1 and empty TEST cards.
 * Live flavor never reads these numbers. The literals stay in this file.
 */
import type { TimelineStep } from "../../../src/lib/mobile/glass-metrics";
import { monthBuckets } from "../../../src/lib/mobile/glass-metrics";
import { karachiDate, type HealthRow, type MilkRow, type OrderRow } from "../../../src/lib/mobile/live-read";

export type DemoBadge = { kind: "pct" | "count"; value: number };

export type DemoLine = {
  title: string;
  sub: string;
  pill: string;
  tone: "green" | "orange" | "red" | "blue";
  mark?: "check" | "dot" | "bang";
};

let flavor: string | null = null;

export function setAppFlavor(value: string | null): void {
  flavor = value === "test" || value === "live" ? value : null;
}

export function previewOn(): boolean {
  if (typeof globalThis === "undefined" || !("location" in globalThis)) return false;
  const search = String((globalThis as { location?: { search?: string } }).location?.search || "");
  return /(?:^|[?&])glass=1(?:&|$)/.test(search);
}

/** Full preview, or the TEST build. Unset flavor stays off. */
export function demoChromeOn(): boolean {
  return previewOn() || flavor === "test";
}

export function previewChip(): string | null {
  return previewOn() ? "MISAAL DATA" : null;
}

export function demoTag(): string {
  return "MISAAL";
}

const FACES: Record<string, string> = {
  Kisan: "Rashid",
  MCA: "Bilal",
  "MCO / Chiller": "Usman",
  Admin: "Aurangzaib",
  Customer: "Hamza",
  Dealer: "Tariq Traders",
  Staff: "Anwar",
  Vet: "Dr. Saima",
};

export function demoFace(role?: string): { name: string; place: string } {
  return { name: (role && FACES[role]) || "Rashid", place: "Sahiwal" };
}

export function demoWeather(): {
  place: string;
  temp: string;
  condition: string;
  humidity: string;
  wind: string;
  when: string;
  note: string | null;
} {
  return {
    place: "Sahiwal",
    temp: "31°C",
    condition: "Halki dhoop",
    humidity: "58%",
    wind: "12 km/h",
    when: "Thu, 22 Oct",
    note: null,
  };
}

const VALUES: Record<string, string> = {
  "Total sales": "Rs 4.8M",
  "Milk collection": "2,325 L",
  "Grain stock": "860 mn",
  "Active farmers": "412",
  "Wallet balance": "Rs 18,450",
  "Aaj ka doodh": "12.5 L",
  "Fat / SNF avg": "4.2 / 8.6",
  "Hafte ki kamai": "Rs 12,320",
  "Aaj ki collection": "342 L",
  "Kisan count": "28",
  "Pending entries": "4",
  "Avg fat": "4.1%",
  "mco-fat": "4.05%",
  "Subah ka doodh": "1,240 L",
  "Shaam ka doodh": "1,085 L",
  "Pending checks": "6",
  "Mere orders": "14",
  "Baqi balance": "Rs 6,200",
  "Is mahine orders": "38",
  "HQ khata balance": "Rs 2.4L",
  "Stock items": "64",
  "Kam stock": "5",
  "Is mahine tankhwah": "Rs 32,000",
  "Advance baqi": "Rs 5,000",
  "Tasks done": "7/10",
  "Aaj ke visits": "6",
  "Pending cases": "4",
  "Ilaj mukammal": "23",
  "Kisan ke janwar": "186",
};

const BADGES: Record<string, DemoBadge> = {
  "Total sales": { kind: "pct", value: 12.4 },
  "Milk collection": { kind: "pct", value: 3.1 },
  "Grain stock": { kind: "pct", value: -4.6 },
  "Active farmers": { kind: "count", value: 18 },
  "Wallet balance": { kind: "pct", value: 6.2 },
  "Aaj ka doodh": { kind: "pct", value: 4.1 },
  "Fat / SNF avg": { kind: "pct", value: -1.3 },
  "Hafte ki kamai": { kind: "pct", value: 8.5 },
  "Aaj ki collection": { kind: "pct", value: 5.4 },
  "Kisan count": { kind: "count", value: 2 },
  "Pending entries": { kind: "pct", value: -20 },
  "Avg fat": { kind: "pct", value: 0.5 },
  "mco-fat": { kind: "pct", value: 0.8 },
  "Subah ka doodh": { kind: "pct", value: 3.2 },
  "Shaam ka doodh": { kind: "pct", value: -2.1 },
  "Pending checks": { kind: "count", value: -3 },
  "Mere orders": { kind: "count", value: 3 },
  "Baqi balance": { kind: "pct", value: -15 },
  "Is mahine orders": { kind: "pct", value: 11 },
  "HQ khata balance": { kind: "pct", value: -8 },
  "Stock items": { kind: "count", value: 4 },
  "Kam stock": { kind: "count", value: -2 },
  "Is mahine tankhwah": { kind: "pct", value: 5 },
  "Advance baqi": { kind: "pct", value: -28 },
  Hazri: { kind: "pct", value: 90 },
  "Tasks done": { kind: "pct", value: 12 },
  "Aaj ke visits": { kind: "count", value: 2 },
  "Pending cases": { kind: "count", value: -1 },
  "Ilaj mukammal": { kind: "pct", value: 15 },
  "Kisan ke janwar": { kind: "count", value: 9 },
};

function alias(key: string): string {
  if (key.startsWith("Hazri")) return "Hazri";
  return key;
}

export function demoValue(key: string): string | null {
  const name = alias(key);
  if (name === "Hazri") return "19/21";
  return VALUES[name] ?? null;
}

export function demoBadge(key: string): DemoBadge | null {
  return BADGES[alias(key)] ?? null;
}

export function demoSub(_key: string): string {
  return "";
}

function wave(end: number): number[] {
  const start = end * 0.72;
  return [start, start * 1.08, start * 0.84, start * 1.12, end * 0.9, end * 0.97, end];
}

export function demoSeries(key: string): number[] | null {
  const name = alias(key);
  if (!demoValue(name) && name !== "Hazri") return null;
  const end = name === "Hazri" ? 19 : name === "Tasks done" ? 7 : 8;
  return wave(end);
}

export function demoWeekLitres(): number[] {
  return [10.4, 11.2, 9.5, 12.9, 13.8, 14.4, 12.5];
}

export function demoMcaBars(): number[] {
  return [310, 325, 298, 340, 330, 355, 342];
}

export function demoAdminMonths(): { values: number[]; labels: string[] } {
  const labels = monthBuckets(karachiDate(), 6).map((bucket) => bucket.label);
  return { labels, values: [160000, 190000, 140000, 210000, 225000, 240105] };
}

export function demoDealerMonths(): { values: number[]; labels: string[] } {
  const labels = monthBuckets(karachiDate(), 6).map((bucket) => bucket.label);
  return { labels, values: [180000, 210000, 195000, 240000, 225000, 260000] };
}

export function demoCustomerMonths(): { values: number[]; labels: string[] } {
  const labels = monthBuckets(karachiDate(), 6).map((bucket) => bucket.label);
  return { labels, values: [8000, 14000, 9000, 18000, 11000, 16000] };
}

export function demoTank(): { celsius: number; status: string; levels: { name: string; pct: number }[] } {
  return {
    celsius: 3.8,
    status: "OK",
    levels: [
      { name: "Tank 1", pct: 82 },
      { name: "Tank 2", pct: 64 },
      { name: "Tank 3", pct: 37 },
      { name: "Bulk", pct: 71 },
    ],
  };
}

export function demoShift(): { window: string; place: string; hazriSub: string } {
  return {
    window: "8:00 AM – 5:00 PM",
    place: "Godam + delivery route Chak 12",
    hazriSub: "Check-in · 8:02 AM · Godam Sahiwal",
  };
}

export function demoTasks(): { label: string; detail: string; count: number; status: string }[] {
  return [
    { label: "Wanda 40 bori load", detail: "Truck LHR-2231", count: 0, status: "done" },
    { label: "Chak 12 delivery", detail: "5 orders", count: 1, status: "jari" },
    { label: "Stock ginti", detail: "Godam B", count: 1, status: "baqi" },
  ];
}

export function demoStock(): { label: string; value: number; unit: string }[] {
  return [
    { label: "Wanda Pro 40kg", value: 120, unit: "bori" },
    { label: "Khal Binola", value: 35, unit: "bori" },
    { label: "Mineral Mix", value: 8, unit: "dabbe" },
  ];
}

export function demoCats(): { label: string; value: number }[] {
  return [
    { label: "Doodh", value: 45 },
    { label: "Feed", value: 25 },
    { label: "Grain", value: 20 },
    { label: "Dawai", value: 10 },
  ];
}

export function demoDonutCenter(): string {
  return "Rs 4.8M";
}

export function demoMunafa(): { title: string; sub: string; net: string } {
  return {
    title: "Is mahina munafa",
    sub: "Income 21.6L – Kharch 16.9L",
    net: "+ Rs 4.7L",
  };
}

export function demoAdminRows(): DemoLine[] {
  return [
    { title: "Feed purchase Rs 85,000", sub: "Entry: Anwar", pill: "Pending", tone: "orange" },
  ];
}

export function demoAdminBaqi(): DemoLine[] {
  return [
    { title: "Milk payment Rs 1.2L", sub: "Entry: Usman", pill: "Check baqi", tone: "orange" },
    { title: "Salary advance Rs 5,000", sub: "Entry: Anwar", pill: "Pending", tone: "orange" },
  ];
}

function dayStamp(iso: string, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${iso}T${hh}:${mm}:00+05:00`;
}

function shiftDay(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00+05:00`);
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function demoFarmerRows(): MilkRow[] {
  const today = karachiDate();
  const yesterday = shiftDay(today, -1);
  return [
    {
      id: "milk-subah",
      shift: "morning",
      quantity_liters: 12.5,
      entry_date: today,
      fat_percentage: 4.2,
      snf_percentage: 8.6,
      rate_per_liter: 145,
      total_amount: 1813,
      chiller_name: "Chak 12 center",
      status: "pending_fat",
      mca_profile_id: "mca-bilal",
      collected_at: dayStamp(today, 6, 40),
      fat_at: dayStamp(today, 7, 55),
    },
    {
      id: "milk-shaam",
      shift: "evening",
      quantity_liters: 11,
      entry_date: yesterday,
      fat_percentage: "4.0",
      rate_per_liter: 145,
      total_amount: 1595,
      status: "verified",
      mca_profile_id: "mca-bilal",
    },
  ];
}

export function demoFarmerNames(): Map<string, string> {
  return new Map([["mca-bilal", "MCA Bilal"]]);
}

export function demoMilkSteps(): TimelineStep[] {
  return [
    { label: "MCA ne uthaya", detail: "Chak 12 center · 12.5 L", state: "done", time: "6:40 AM" },
    { label: "Chiller par check", detail: "Fat check baqi hai", state: "action", time: "7:55 AM", actionLabel: "Fat check karwayein" },
    { label: "Rate laga", detail: "Rs 145/L", state: "pending" },
    { label: "Wallet mein credit", detail: "Andaza Rs 1,813", state: "pending" },
  ];
}

export function demoMcaPack(): { rows: MilkRow[]; names: Map<string, string> } {
  const today = karachiDate();
  const names = new Map([
    ["f-rashid", "Rashid Ali"],
    ["f-nadeem", "Nadeem"],
    ["f-akram", "Akram"],
  ]);
  const rows: MilkRow[] = [
    { id: "e1", farmer_id: "f-rashid", entry_date: today, quantity_liters: 12.5, fat_percentage: 4.2, status: "verified" },
    { id: "e2", farmer_id: "f-nadeem", entry_date: today, quantity_liters: 9, fat_percentage: 3.9, status: "pending_fat" },
    { id: "e3", farmer_id: "f-akram", entry_date: today, quantity_liters: 15.2, fat_percentage: 4.4, status: "verified" },
  ];
  return { rows, names };
}

export function demoReceipts(): DemoLine[] {
  return [
    { title: "Center Chak 12", sub: "Bilal · 342 L · Fat 4.1", pill: "Checked", tone: "green" },
    { title: "Center Chak 45", sub: "Imran · 288 L · Fat 3.8", pill: "Pending", tone: "orange" },
    { title: "Center Kot", sub: "Asif · 210 L · LR 26", pill: "Reject 12 L", tone: "red" },
  ];
}

export function demoCustomerOrders(): OrderRow[] {
  const today = karachiDate();
  const yesterday = shiftDay(today, -1);
  return [
    { id: "c1", order_number: "1045 · Doodh 20 L", status: "in_transit", grand_total: 3600, created_at: dayStamp(today, 9, 5) },
    { id: "c2", order_number: "1039 · Wanda 2 bori", status: "delivered", grand_total: 7800, created_at: dayStamp(yesterday, 18, 0) },
    { id: "c3", order_number: "1031 · Gandum 5 mn", status: "submitted", grand_total: 19500, created_at: "2026-10-18T08:00:00+05:00" },
    { id: "c4", order_number: "1028 · Ghee 2 kg", status: "cancelled", grand_total: 4400, created_at: "2026-10-15T08:00:00+05:00" },
  ];
}

export function demoCustomerTrack(): { title: string; detail: string; steps: TimelineStep[]; progressNote: string } {
  return {
    title: "Order #1045",
    detail: "Doodh 20 L · Rs 3,600",
    progressNote: "Gaari 3 stop door",
    steps: [
      { label: "Order mila", detail: "App se order", state: "done", time: "9:05 AM" },
      { label: "Pack hua", detail: "Godam Sahiwal", state: "done", time: "9:40 AM" },
      { label: "Rawana hua", detail: "Rider: Anwar · LHR-2231", state: "done", time: "10:15 AM" },
      { label: "Raste mein", detail: "Chak 12 ki taraf", state: "active", time: "Abhi" },
      { label: "Pohanch gaya", detail: "Andaza 11:30 AM", state: "pending" },
    ],
  };
}

export function demoDealerOrders(): OrderRow[] {
  const today = karachiDate();
  const yesterday = shiftDay(today, -1);
  return [
    { id: "d1", order_number: "D-221 · Wanda 50 bori", status: "dispatch", grand_total: 195000, created_at: dayStamp(today, 11, 0) },
    { id: "d2", order_number: "D-218 · Khal 20 bori", status: "delivered", grand_total: 64000, created_at: dayStamp(yesterday, 16, 0) },
  ];
}

export function demoAdminTrack(): { title: string; detail: string; steps: TimelineStep[] } {
  return {
    title: "Approval #AP-318",
    detail: "Feed purchase Rs 85,000",
    steps: [
      { label: "Entry hui", detail: "Anwar (Staff)", state: "done", time: "9:10 AM" },
      { label: "Check hui", detail: "Bilal", state: "done", time: "10:02 AM" },
      { label: "Manzoor hui", detail: "Admin: Aurangzaib", state: "done", time: "11:20 AM" },
      { label: "Khata mein post", detail: "Ledger GL-2210", state: "done", time: "11:21 AM" },
    ],
  };
}

export function demoVetPack(): {
  health: HealthRow[];
  places: Map<string, { name: string; village: string }>;
  animals: Map<string, { tag_no?: string | null; name?: string | null; species?: string | null }>;
} {
  const today = karachiDate();
  const yesterday = shiftDay(today, -1);
  const places = new Map([
    ["f1", { name: "Rashid Ali", village: "Chak 12" }],
    ["f2", { name: "Nadeem", village: "Chak 45" }],
    ["f3", { name: "Akram", village: "Kot" }],
  ]);
  const animals = new Map<string, { tag_no?: string | null; name?: string | null; species?: string | null }>([
    ["a1", { tag_no: "G-14", species: "cow" }],
    ["a2", { tag_no: "B-07", species: "buffalo" }],
    ["a3", { species: "calf" }],
    ["a4", { tag_no: "G-22", species: "cow" }],
  ]);
  const health: HealthRow[] = [
    { id: "v1", farmer_id: "f1", animal_id: "a1", diagnosis: "Bukhar", event_date: today, created_at: dayStamp(today, 10, 30) },
    { id: "v2", farmer_id: "f2", animal_id: "a2", diagnosis: "Thanela", event_date: today, notes: "urgent" },
    { id: "v3", farmer_id: "f3", animal_id: "a3", kind: "vaccine", event_date: today },
    { id: "v4", farmer_id: "f2", animal_id: "a2", medicine: "Antibiotic", dose: "3 din", event_date: yesterday, last_dose_date: yesterday, withdrawal_days: 3, next_due: shiftDay(today, 2) },
    { id: "v5", farmer_id: "f1", animal_id: "a4", medicine: "Mastitis check", event_date: yesterday, next_due: today },
  ];
  return { health, places, animals };
}
