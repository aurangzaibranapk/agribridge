/**
 * Nasal-kashi + Sehat (Phase 4) -- khalis hisaab (pure), tests ke liye.
 * Data 569/570/571 se aata hai (RLS: sirf apna). Yaad-dihani sirf app ke andar.
 */
import { addDays, daysBetween } from "./dairy";
import { csvCell } from "./dairy-pl";

export const EVENT_TYPES = ["heat", "ai", "natural", "pd", "calving", "abortion", "dry_off"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const HEAT_SIGNS = ["bellow", "mucus", "mounting", "restless", "milk_drop"] as const;
export const PD_RESULTS = ["positive", "negative", "doubtful"] as const;
export const PD_METHODS = ["rectal", "ultrasound", "kit"] as const;
export const CALVING_EASE = ["easy", "assisted", "vet", "c_section"] as const;
export const HEALTH_KINDS = ["vaccine", "treatment", "deworm", "vet_visit"] as const;
export type HealthKind = (typeof HEALTH_KINDS)[number];
export const VACCINES = ["FMD", "HS", "LSD", "BQ", "ANTHRAX", "BRUCELLA", "PPR"] as const;
export const CORE_VACCINES = ["FMD", "HS", "LSD", "BQ"] as const;
export const SEMEN_COMPANIES = ["Govt LDD", "Semen Production Unit Qadirabad", "Semen Production Unit Karaniwala", "ABS", "WWS", "Alta Genetics", "Other"];
export const TASKS = ["dry_off", "no_heat", "calving", "pd_due", "heat_watch", "vaccine", "vaccine_gap", "withheld", "deworm"] as const;
export type Task = (typeof TASKS)[number];
export const PREF_TASKS = ["heat_watch", "pd_due", "dry_off", "calving", "vaccine", "withheld", "deworm"] as const;
export const SEVERITIES = ["overdue", "today", "week", "later", "active"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Hamal ke din: gaye 283, bhains 310, bakri 150 (SQL fn_dairy_gestation_days jaisa). */
export function gestationDays(species: string): number { return species === "buffalo" ? 310 : species === "goat" ? 150 : 283; }

/** Tukhm (AI) ki tareekh se aage ki tareekhein. */
export function previewDates(species: string, serviceDate: string) {
  const g = gestationDays(species);
  return { nextHeat: addDays(serviceDate, 21), pdFrom: addDays(serviceDate, 35), pdTo: addDays(serviceDate, 45), dryOff: addDays(serviceDate, g - 60), calving: addDays(serviceDate, g), gestation: g };
}

export const EVENT_COLOR: Record<string, string> = {
  heat: "#f43f5e", ai: "#6366f1", natural: "#6366f1", pd: "#0ea5e9", calving: "#a855f7", abortion: "#64748b", dry_off: "#f59e0b",
  vaccine: "#14b8a6", deworm: "#84cc16", treatment: "#e11d48", vet_visit: "#6366f1",
};
export const EVENT_ICON: Record<string, string> = {
  heat: "🔥", ai: "🧬", natural: "🐂", pd: "🔬", calving: "🍼", abortion: "⚠️", dry_off: "🟠", vaccine: "💉", deworm: "🪱", treatment: "💊", vet_visit: "🩺",
};
export const TASK_STYLE: Record<Task, { icon: string; color: string }> = {
  dry_off: { icon: "⚠️", color: "#e11d48" }, no_heat: { icon: "🔍", color: "#f59e0b" }, calving: { icon: "🍼", color: "#a855f7" },
  pd_due: { icon: "🔬", color: "#0ea5e9" }, heat_watch: { icon: "🔥", color: "#f43f5e" }, vaccine: { icon: "💉", color: "#14b8a6" },
  vaccine_gap: { icon: "💉", color: "#14b8a6" }, withheld: { icon: "🥛", color: "#e11d48" }, deworm: { icon: "🪱", color: "#84cc16" },
};
export const SEVERITY_TONE: Record<Severity, string> = { overdue: "rose", today: "amber", week: "indigo", later: "slate", active: "rose" };

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
const d10 = (v: unknown): string | null => (v ? String(v).slice(0, 10) : null);

export interface BreedEvent {
  id: string; animal_id: string; event_type: EventType; event_date: string; heat_signs: string[]; bull_name: string | null; semen_breed: string | null;
  semen_company: string | null; straw_no: string | null; sexed: boolean; technician: string | null; pd_result: string | null; pd_method: string | null;
  service_id: string | null; calving_ease: string | null; calf_animal_id: string | null; calf_sex: string | null; calf_alive: boolean | null;
  cost: number | null; expense_id: string | null; notes: string | null; voided: boolean;
}
export function parseEvents(raw: unknown): BreedEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: Record<string, unknown>) => ({
    id: String(e.id), animal_id: String(e.animal_id), event_type: (EVENT_TYPES as readonly string[]).includes(e.event_type as string) ? (e.event_type as EventType) : "heat",
    event_date: d10(e.event_date) ?? "", heat_signs: Array.isArray(e.heat_signs) ? (e.heat_signs as string[]) : [], bull_name: str(e.bull_name), semen_breed: str(e.semen_breed),
    semen_company: str(e.semen_company), straw_no: str(e.straw_no), sexed: !!e.sexed, technician: str(e.technician), pd_result: str(e.pd_result), pd_method: str(e.pd_method),
    service_id: str(e.service_id), calving_ease: str(e.calving_ease), calf_animal_id: str(e.calf_animal_id), calf_sex: str(e.calf_sex),
    calf_alive: e.calf_alive === null || e.calf_alive === undefined ? null : !!e.calf_alive, cost: e.cost === null || e.cost === undefined ? null : num(e.cost),
    expense_id: str(e.expense_id), notes: str(e.notes), voided: !!e.voided,
  }));
}
export interface HealthEvent {
  id: string; animal_id: string | null; kind: HealthKind; vaccine_code: string | null; diagnosis: string | null; medicine: string | null; dose: string | null;
  event_date: string; last_dose_date: string | null; withdrawal_days: number; withdrawal_until: string | null; vet_name: string | null; next_due: string | null;
  cost: number | null; expense_id: string | null; notes: string | null; voided: boolean;
}
export function parseHealth(raw: unknown): HealthEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: Record<string, unknown>) => ({
    id: String(e.id), animal_id: str(e.animal_id), kind: (HEALTH_KINDS as readonly string[]).includes(e.kind as string) ? (e.kind as HealthKind) : "vet_visit",
    vaccine_code: str(e.vaccine_code), diagnosis: str(e.diagnosis), medicine: str(e.medicine), dose: str(e.dose), event_date: d10(e.event_date) ?? "",
    last_dose_date: d10(e.last_dose_date), withdrawal_days: num(e.withdrawal_days), withdrawal_until: d10(e.withdrawal_until), vet_name: str(e.vet_name),
    next_due: d10(e.next_due), cost: e.cost === null || e.cost === undefined ? null : num(e.cost), expense_id: str(e.expense_id), notes: str(e.notes), voided: !!e.voided,
  }));
}
export interface Repro {
  animal_id: string; tag_no: string; name: string | null; species: string; status: string; lactation_no: number; last_calving_date: string | null;
  gestation_days: number; last_heat: string | null; last_service_id: string | null; last_service_date: string | null; services_lactation: number;
  pregnant: boolean; preg_service_id: string | null; preg_service_date: string | null; days_pregnant: number | null; expected_calving: string | null;
  dry_off_due: string | null; dried: boolean; pd_pending: boolean; pd_from: string | null; pd_to: string | null; next_heat: string | null; dim: number | null; repeat_breeder: boolean;
}
export function parseRepro(raw: unknown): Repro[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => ({
    animal_id: String(r.animal_id), tag_no: String(r.tag_no ?? ""), name: str(r.name), species: String(r.species ?? "cow"), status: String(r.status ?? ""),
    lactation_no: num(r.lactation_no), last_calving_date: d10(r.last_calving_date), gestation_days: num(r.gestation_days) || gestationDays(String(r.species)),
    last_heat: d10(r.last_heat), last_service_id: str(r.last_service_id), last_service_date: d10(r.last_service_date), services_lactation: num(r.services_lactation),
    pregnant: !!r.pregnant, preg_service_id: str(r.preg_service_id), preg_service_date: d10(r.preg_service_date), days_pregnant: r.days_pregnant === null || r.days_pregnant === undefined ? null : num(r.days_pregnant),
    expected_calving: d10(r.expected_calving), dry_off_due: d10(r.dry_off_due), dried: !!r.dried, pd_pending: !!r.pd_pending, pd_from: d10(r.pd_from), pd_to: d10(r.pd_to),
    next_heat: d10(r.next_heat), dim: r.dim === null || r.dim === undefined ? null : num(r.dim), repeat_breeder: !!r.repeat_breeder,
  }));
}
export interface DueTask { task_key: string; task: Task; animal_id: string | null; tag_no: string | null; animal_name: string | null; due_date: string; until_date: string | null; severity: Severity; info: Record<string, unknown> }
export function parseTasks(raw: unknown): DueTask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t: Record<string, unknown>) => (TASKS as readonly string[]).includes(String(t.task)))
    .map((t: Record<string, unknown>) => ({
      task_key: String(t.task_key), task: t.task as Task, animal_id: str(t.animal_id), tag_no: str(t.tag_no), animal_name: str(t.animal_name),
      due_date: d10(t.due_date) ?? "", until_date: d10(t.until_date), severity: (SEVERITIES as readonly string[]).includes(String(t.severity)) ? (t.severity as Severity) : "later",
      info: (t.info && typeof t.info === "object" ? t.info : {}) as Record<string, unknown>,
    }));
}

/** Alerts page ke hisse: der / aaj / is hafta / agle 30 din. Doodh roka "is hafta" mein. */
export function groupTasks(tasks: DueTask[]) {
  const g = { overdue: [] as DueTask[], today: [] as DueTask[], week: [] as DueTask[], later: [] as DueTask[] };
  for (const t of tasks) (t.severity === "active" ? g.week : g[t.severity as keyof typeof g]).push(t);
  return g;
}
/** Dashboard: sab se zaroori pehle. */
export function priorityTasks(tasks: DueTask[], n = 6): DueTask[] {
  const rank: Record<Severity, number> = { overdue: 0, today: 1, active: 2, week: 3, later: 4 };
  return [...tasks].sort((a, b) => rank[a.severity] - rank[b.severity] || (a.due_date < b.due_date ? -1 : 1)).slice(0, n);
}
export function relDays(due: string, asOf: string): number { return daysBetween(asOf, due); }

/** Rewar ki nasal haalat (donut). */
export function herdRepro(rows: Repro[]) {
  let pregnant = 0, pdPending = 0, open = 0, young = 0;
  for (const r of rows) {
    if (r.status === "calf") continue;
    if (r.pregnant) pregnant++;
    else if (r.pd_pending) pdPending++;
    else if (r.status === "heifer" && !r.last_service_date) young++;
    else open++;
  }
  return { pregnant, pdPending, open, young, total: pregnant + pdPending + open + young };
}

/** 12 maheene ki kaarkardagi: pehli AI se hamal %, AI fi hamal, byaane ka faasla, byaane se hamal. */
export function fertilityStats(events: BreedEvent[], asOf: string) {
  const ev = events.filter((e) => !e.voided);
  const since = addDays(asOf, -365);
  const services = ev.filter((e) => (e.event_type === "ai" || e.event_type === "natural") && e.event_date > since);
  const positiveSvc = new Set(ev.filter((e) => (e.event_type === "pd" && e.pd_result === "positive") || (e.event_type === "calving" && e.service_id)).map((e) => e.service_id));
  const byAnimal = new Map<string, BreedEvent[]>();
  for (const e of ev) { const l = byAnimal.get(e.animal_id) ?? []; l.push(e); byAnimal.set(e.animal_id, l); }
  // pehli service: byaane/isqat ke baad pehla tukhm
  let firstKnown = 0, firstPos = 0;
  for (const [, list] of Array.from(byAnimal.entries())) {
    const sorted = [...list].sort((a, b) => (a.event_date < b.event_date ? -1 : 1));
    let after = true;
    for (const e of sorted) {
      if (e.event_type === "calving" || e.event_type === "abortion") { after = true; continue; }
      if ((e.event_type === "ai" || e.event_type === "natural") && e.event_date > since) {
        if (after) {
          const later = sorted.some((x) => (x.event_type === "ai" || x.event_type === "natural") && x.event_date > e.event_date);
          const neg = sorted.some((x) => x.event_type === "pd" && x.service_id === e.id && x.pd_result === "negative");
          if (positiveSvc.has(e.id)) { firstKnown++; firstPos++; } else if (later || neg) firstKnown++;
        }
        after = false;
      }
    }
  }
  const pregnancies = services.filter((s) => positiveSvc.has(s.id)).length;
  const calvings = ev.filter((e) => e.event_type === "calving").sort((a, b) => (a.event_date < b.event_date ? -1 : 1));
  const intervals: number[] = [], open: number[] = [];
  for (const [, list] of Array.from(byAnimal.entries())) {
    const cs = list.filter((e) => e.event_type === "calving").map((e) => e.event_date).sort();
    for (let i = 1; i < cs.length; i++) intervals.push(daysBetween(cs[i - 1], cs[i]));
    for (const c of cs) {
      const svc = list.filter((e) => (e.event_type === "ai" || e.event_type === "natural") && e.event_date > c && positiveSvc.has(e.id)).map((e) => e.event_date).sort()[0];
      if (svc) open.push(daysBetween(c, svc));
    }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const ci = avg(intervals);
  return {
    conception: firstKnown ? Math.round((firstPos / firstKnown) * 100) : null,
    aiPerPregnancy: pregnancies ? Math.round((services.length / pregnancies) * 10) / 10 : null,
    calvingIntervalMonths: ci === null ? null : Math.round((ci / 30.44) * 10) / 10,
    daysOpen: avg(open) === null ? null : Math.round(avg(open)!),
    calvings: calvings.length,
  };
}

/** Calendar: maheene ke dabbe (Monday se), har din ke waqiat + aane wale kaam. */
export interface CalItem { date: string; type: string; label: string }
export function monthGrid(month: string): { date: string; inMonth: boolean }[] {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = dow; i > 0; i--) cells.push({ date: addDays(first, -i), inMonth: false });
  for (let d = 0; d < daysIn; d++) cells.push({ date: addDays(first, d), inMonth: true });
  while (cells.length % 7) cells.push({ date: addDays(first, daysIn + cells.length - daysIn - dow), inMonth: false });
  return cells;
}
export function calendarItems(events: BreedEvent[], health: HealthEvent[], tasks: DueTask[], tagOf: (id: string | null) => string): CalItem[] {
  const out: CalItem[] = [];
  for (const e of events) if (!e.voided) out.push({ date: e.event_date, type: e.event_type === "natural" ? "ai" : e.event_type, label: `${tagOf(e.animal_id)} ${e.event_type === "pd" ? `PD ${e.pd_result === "positive" ? "✓" : e.pd_result === "negative" ? "✗" : "?"}` : e.event_type === "ai" ? "AI" : ""}`.trim() });
  for (const h of health) if (!h.voided) out.push({ date: h.event_date, type: h.kind === "treatment" ? "treatment" : h.kind, label: `${h.animal_id ? tagOf(h.animal_id) : "×"} ${h.kind === "vaccine" ? h.vaccine_code : h.kind === "treatment" ? (h.medicine ?? "") : ""}`.trim() });
  const TT: Partial<Record<Task, string>> = { heat_watch: "heat", no_heat: "heat", pd_due: "pd", dry_off: "dry_off", calving: "calving", vaccine: "vaccine", vaccine_gap: "vaccine", deworm: "deworm", withheld: "treatment" };
  for (const t of tasks) {
    out.push({ date: t.due_date, type: TT[t.task] ?? "heat", label: `${t.tag_no ? `#${t.tag_no}` : String(t.info.code ?? "")} ${t.task === "withheld" ? "✓" : "?"}`.trim() });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
}

/** Vaccine coverage %. */
export function coveragePct(covered: number, eligible: number): number | null { return eligible > 0 ? Math.round((Math.min(covered, eligible) / eligible) * 100) : null; }

// ---------- validation (server actions) ----------
type FD = { get: (k: string) => unknown; getAll?: (k: string) => unknown[] };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
function money(v: unknown): number | null | "bad" {
  const t = s(v).replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 1000000 ? Math.round(n * 100) / 100 : "bad";
}
export type Valid<T> = { ok: true; value: T } | { ok: false; error: string };
export function validateBreeding(fd: FD, asOf: string): Valid<Record<string, unknown>> {
  const type = s(fd.get("event_type"));
  if (!(EVENT_TYPES as readonly string[]).includes(type) || type === "calving") return { ok: false, error: "bh_err_type" };
  const animal = s(fd.get("animal_id"));
  if (!UUID.test(animal)) return { ok: false, error: "bh_err_animal" };
  const date = s(fd.get("event_date"));
  if (!ISO.test(date) || date > asOf || daysBetween(date, asOf) > 400) return { ok: false, error: "bh_err_date" };
  const time = s(fd.get("event_time"));
  const signs = (fd.getAll ? fd.getAll("heat_signs") : []).map(String).filter((x) => (HEAT_SIGNS as readonly string[]).includes(x));
  const cost = money(fd.get("cost"));
  if (cost === "bad") return { ok: false, error: "bh_err_cost" };
  const bull = s(fd.get("bull_name")).slice(0, 80);
  if (type === "ai" && !bull) return { ok: false, error: "bh_err_bull" };
  const service = s(fd.get("service_id"));
  const pd = s(fd.get("pd_result"));
  if (type === "pd" && (!UUID.test(service) || !(PD_RESULTS as readonly string[]).includes(pd))) return { ok: false, error: "bh_err_pd" };
  const phone = s(fd.get("technician_phone"));
  if (phone && !/^[0-9+ -]{7,16}$/.test(phone)) return { ok: false, error: "bh_err_phone" };
  const pay = s(fd.get("payment"));
  return {
    ok: true,
    value: {
      animal_id: animal, event_type: type, event_date: date, event_time: /^\d{2}:\d{2}$/.test(time) ? time : null,
      heat_signs: type === "heat" || type === "ai" || type === "natural" ? (signs.length ? signs : null) : null,
      bull_name: type === "ai" || type === "natural" ? bull || null : null,
      semen_breed: type === "ai" || type === "natural" ? s(fd.get("semen_breed")).slice(0, 40) || null : null,
      semen_company: type === "ai" ? s(fd.get("semen_company")).slice(0, 80) || null : null,
      straw_no: type === "ai" ? s(fd.get("straw_no")).slice(0, 40) || null : null,
      sexed: type === "ai" && s(fd.get("sexed")) === "1",
      technician: s(fd.get("technician")).slice(0, 80) || null, technician_phone: phone || null,
      pd_result: type === "pd" ? pd : null, pd_method: type === "pd" && (PD_METHODS as readonly string[]).includes(s(fd.get("pd_method"))) ? s(fd.get("pd_method")) : null,
      service_id: type === "pd" || type === "abortion" ? (UUID.test(service) ? service : null) : null,
      cost: cost ?? null, payment: ["cash", "udhaar", "bank"].includes(pay) ? pay : "cash", notes: s(fd.get("notes")).slice(0, 300) || null,
    },
  };
}
export function validateCalving(fd: FD, asOf: string): Valid<{ animal: string; date: string; service: string | null; ease: string; calf: Record<string, unknown>; notes: string | null }> {
  const animal = s(fd.get("animal_id"));
  if (!UUID.test(animal)) return { ok: false, error: "bh_err_animal" };
  const date = s(fd.get("event_date"));
  if (!ISO.test(date) || date > asOf || daysBetween(date, asOf) > 400) return { ok: false, error: "bh_err_date" };
  const ease = s(fd.get("calving_ease"));
  const alive = s(fd.get("calf_alive")) !== "0";
  const tag = s(fd.get("calf_tag")).slice(0, 30);
  if (alive && !tag) return { ok: false, error: "bh_err_calf_tag" };
  const service = s(fd.get("service_id"));
  return {
    ok: true,
    value: {
      animal, date, service: UUID.test(service) ? service : null, ease: (CALVING_EASE as readonly string[]).includes(ease) ? ease : "easy",
      calf: { tag_no: alive ? tag : null, name: s(fd.get("calf_name")).slice(0, 60) || null, sex: s(fd.get("calf_sex")) === "M" ? "M" : "F", alive, twins: s(fd.get("twins")) === "1" },
      notes: s(fd.get("notes")).slice(0, 300) || null,
    },
  };
}
export function validateHealth(fd: FD, asOf: string): Valid<Record<string, unknown>> {
  const kind = s(fd.get("kind"));
  if (!(HEALTH_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "bh_err_kind" };
  const animal = s(fd.get("animal_id"));
  if (animal && !UUID.test(animal)) return { ok: false, error: "bh_err_animal" };
  const date = s(fd.get("event_date"));
  if (!ISO.test(date) || date > asOf || daysBetween(date, asOf) > 400) return { ok: false, error: "bh_err_date" };
  const code = s(fd.get("vaccine_code"));
  if (kind === "vaccine" && !(VACCINES as readonly string[]).includes(code)) return { ok: false, error: "bh_err_vaccine" };
  const medicine = s(fd.get("medicine")).slice(0, 120);
  if ((kind === "treatment" || kind === "deworm") && medicine.length < 2) return { ok: false, error: "bh_err_medicine" };
  const doses = Math.max(1, Math.min(30, Math.round(Number(s(fd.get("doses")) || "1")) || 1));
  const wd = s(fd.get("withdrawal_days"));
  const wdn = wd ? Math.round(Number(wd)) : 0;
  if (!Number.isFinite(wdn) || wdn < 0 || wdn > 60) return { ok: false, error: "bh_err_withdrawal" };
  const cost = money(fd.get("cost"));
  if (cost === "bad") return { ok: false, error: "bh_err_cost" };
  const next = s(fd.get("next_due"));
  if (next && (!ISO.test(next) || next <= date)) return { ok: false, error: "bh_err_next" };
  const pay = s(fd.get("payment"));
  return {
    ok: true,
    value: {
      kind, animal_id: animal || null, event_date: date, vaccine_code: kind === "vaccine" ? code : null,
      diagnosis: s(fd.get("diagnosis")).slice(0, 120) || null, medicine: medicine || null, dose: s(fd.get("dose")).slice(0, 60) || null,
      last_dose_date: doses > 1 ? addDays(date, doses - 1) : null, withdrawal_days: kind === "vaccine" ? 0 : wdn,
      vet_name: s(fd.get("vet_name")).slice(0, 80) || null, next_due: next || null,
      cost: cost ?? null, payment: ["cash", "udhaar", "bank"].includes(pay) ? pay : "cash", notes: s(fd.get("notes")).slice(0, 300) || null,
    },
  };
}
/** Doodh kab tak roka (form preview): aakhri khuraak + din. */
export function withdrawalUntil(firstDose: string, doses: number, days: number): string | null {
  if (!days) return null;
  return addDays(addDays(firstDose, Math.max(1, doses) - 1), days);
}

// ---------- admin ----------
export interface AdminBreedRow {
  farmer_id: string; farmer_code: string | null; full_name: string | null; village: string | null; customer_name: string | null; animals: number; pregnant: number;
  calvings_30: number; conception_pct: number | null; services_known: number; fmd_pct: number | null; hs_pct: number | null; lsd_pct: number | null; bq_pct: number | null;
  fmd_missing: number; withheld: number; overdue: number; vets_cost: number;
}
const nn = (v: unknown) => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export function parseAdminBreed(raw: unknown): AdminBreedRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => ({
    farmer_id: String(r.farmer_id), farmer_code: str(r.farmer_code), full_name: str(r.full_name), village: str(r.village), customer_name: str(r.customer_name),
    animals: num(r.animals), pregnant: num(r.pregnant), calvings_30: num(r.calvings_30), conception_pct: nn(r.conception_pct), services_known: num(r.services_known),
    fmd_pct: nn(r.fmd_pct), hs_pct: nn(r.hs_pct), lsd_pct: nn(r.lsd_pct), bq_pct: nn(r.bq_pct), fmd_missing: num(r.fmd_missing), withheld: num(r.withheld), overdue: num(r.overdue), vets_cost: num(r.vets_cost),
  }));
}
export function adminBreedFilter(rows: AdminBreedRow[], f: string, q: string): AdminBreedRow[] {
  const qq = q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f === "overdue" && r.overdue === 0) return false;
    if (f === "lowvax" && (r.fmd_pct ?? 100) >= 85) return false;
    if (f === "calving" && r.calvings_30 === 0) return false;
    if (qq && !`${r.farmer_code ?? ""} ${r.full_name ?? ""} ${r.customer_name ?? ""} ${r.village ?? ""}`.toLowerCase().includes(qq)) return false;
    return true;
  });
}
/** Jama: % wazan (janwar / services) ke saath. */
export function adminBreedTotal(rows: AdminBreedRow[]) {
  const sum = (k: keyof AdminBreedRow) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const known = sum("services_known");
  const conc = known ? Math.round(rows.reduce((a, r) => a + (r.conception_pct ?? 0) * r.services_known, 0) / known) : null;
  const wavg = (k: "fmd_pct" | "hs_pct" | "lsd_pct" | "bq_pct") => {
    const w = rows.filter((r) => r[k] !== null);
    const den = w.reduce((a, r) => a + r.animals, 0);
    return den ? Math.round(w.reduce((a, r) => a + (r[k] ?? 0) * r.animals, 0) / den) : null;
  };
  return {
    farmers: rows.length, animals: sum("animals"), pregnant: sum("pregnant"), calvings_30: sum("calvings_30"), conception: conc,
    fmd: wavg("fmd_pct"), hs: wavg("hs_pct"), lsd: wavg("lsd_pct"), bq: wavg("bq_pct"), fmd_missing: sum("fmd_missing"), withheld: sum("withheld"),
    overdue: sum("overdue"), overdueFarmers: rows.filter((r) => r.overdue > 0).length, vets_cost: sum("vets_cost"),
  };
}
export function adminBreedCsv(rows: AdminBreedRow[], asOf: string): string {
  const head = ["Code", "Naam", "Customer", "Ilaqa", "Janwar", "Gaabhan", "Byaana 30 din", "Conception %", "FMD %", "HS %", "LSD %", "BQ %", "FMD baqi", "Doodh roka", "Overdue", "Vets kharcha (maheena)"];
  const lines = rows.map((r) => [r.farmer_code, r.full_name, r.customer_name, r.village, r.animals, r.pregnant, r.calvings_30, r.conception_pct, r.fmd_pct, r.hs_pct, r.lsd_pct, r.bq_pct, r.fmd_missing, r.withheld, r.overdue, Math.round(r.vets_cost)].map(csvCell).join(","));
  const t = adminBreedTotal(rows);
  lines.push(["GRAND TOTAL", "", "", "", t.animals, t.pregnant, t.calvings_30, t.conception, t.fmd, t.hs, t.lsd, t.bq, t.fmd_missing, t.withheld, t.overdue, Math.round(t.vets_cost)].map(csvCell).join(","));
  return "\uFEFF" + [`Breeding & Sehat -- ${asOf}`, head.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}
