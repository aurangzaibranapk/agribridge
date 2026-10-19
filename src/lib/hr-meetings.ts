/**
 * HR Meetings -- khalis (pure) helpers. DB ya React ke baghair, taake
 * tests seedhe chal sakein. Waqt hamesha Asia/Karachi (PKT) mein.
 */
export const PKT = "Asia/Karachi";
export const MEET_URL_RE = /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/;
export const FULL_ACCESS_ROLES = ["hr", "admin", "owner", "super_admin"] as const;
export const ACTION_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type MeetingStatus = "scheduled" | "held" | "cancelled";
export type CalView = "today" | "week" | "month";

export function hasFullAccess(role: string | null | undefined): boolean {
  return !!role && (FULL_ACCESS_ROLES as readonly string[]).includes(role);
}

/** 'YYYY-MM-DD' (PKT) */
export function pktDate(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", { timeZone: PKT, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
}
/** '10:00 AM' (PKT) */
export function pktTime(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { timeZone: PKT, hour: "numeric", minute: "2-digit" }).format(x);
}
/** '17 Oct 2026' */
export function pktDayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00Z`));
}
/** PKT tareekh + waqt -> ISO (PKT ka offset +05:00, DST nahi). */
export function pktToIso(date: string, time: string): string {
  return `${date}T${time.length === 5 ? time + ":00" : time}+05:00`;
}
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function isValidDate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
/** Hafte ka pehla din (Monday). */
export function weekStart(date: string): string {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}
export function weekDays(date: string): string[] {
  const s = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}
/** Mahine ka grid: Monday se shuru, poore hafte (35 ya 42 khane). */
export function monthGrid(date: string): { date: string; inMonth: boolean }[] {
  const first = `${date.slice(0, 7)}-01`;
  const start = weekStart(first);
  const month = date.slice(0, 7);
  const cells: { date: string; inMonth: boolean }[] = [];
  let d = start;
  do {
    for (let i = 0; i < 7; i++) {
      cells.push({ date: d, inMonth: d.slice(0, 7) === month });
      d = addDays(d, 1);
    }
  } while (d.slice(0, 7) === month);
  return cells;
}
export function viewRange(view: CalView, date: string): { from: string; to: string } {
  if (view === "today") return { from: date, to: date };
  if (view === "week") { const w = weekDays(date); return { from: w[0], to: w[6] }; }
  const g = monthGrid(date);
  return { from: g[0].date, to: g[g.length - 1].date };
}
export function shiftDate(view: CalView, date: string, dir: 1 | -1): string {
  if (view === "today") return addDays(date, dir);
  if (view === "week") return addDays(date, 7 * dir);
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + dir);
  return d.toISOString().slice(0, 10);
}

export interface MeetingInput {
  title: string; date: string; time: string; duration_min: number; agenda: string | null;
  location: string | null; meet_url: string | null; attendees: string[]; repeat: "none" | "weekly" | "monthly";
}
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Form ki jaanch -- wahi qanoon jo DB (600) mein hain, pehle yahan. */
export function parseMeetingForm(f: { get(k: string): unknown; getAll(k: string): unknown[] }): Parsed<MeetingInput> {
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const title = s("title");
  if (title.length < 3 || title.length > 200) return { ok: false, error: "Unwan 3 se 200 harf ka ho." };
  const date = s("date");
  if (!isValidDate(date)) return { ok: false, error: "Tareekh sahi nahi." };
  const time = s("time");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: "Waqt sahi nahi." };
  const duration_min = Number(s("duration_min") || 30);
  if (!Number.isInteger(duration_min) || duration_min < 5 || duration_min > 480) return { ok: false, error: "Dorania 5 se 480 minute." };
  const meet = s("meet_url");
  if (meet && !MEET_URL_RE.test(meet)) return { ok: false, error: "Google Meet ka link https://meet.google.com/... hona chahiye." };
  const attendees = Array.from(new Set(f.getAll("attendees").map((x) => String(x)).filter((x) => /^[0-9a-f-]{36}$/i.test(x))));
  if (attendees.length === 0) return { ok: false, error: "Kam az kam ek staff shamil karein." };
  const r = s("repeat");
  const repeat = r === "weekly" || r === "monthly" ? r : "none";
  return { ok: true, value: { title, date, time, duration_min, agenda: s("agenda") || null, location: s("location") || null, meet_url: meet || null, attendees, repeat } };
}

/** Repeat: kul 4 meetings (pehli + 3). */
export function seriesDates(date: string, repeat: MeetingInput["repeat"], count = 4): string[] {
  if (repeat === "none") return [date];
  const out = [date];
  for (let i = 1; i < count; i++) {
    if (repeat === "weekly") out.push(addDays(date, 7 * i));
    else {
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + i);
      out.push(d.toISOString().slice(0, 10));
    }
  }
  return out;
}

export type MeetingWarning = "no_decision" | "rescheduled" | "overdue_actions" | "postponed_actions";
export function meetingWarnings(m: { status: string; reschedule_count: number; decisions: number; overdue_actions?: number; max_postponed?: number }): MeetingWarning[] {
  const w: MeetingWarning[] = [];
  if (m.status === "held" && m.decisions === 0) w.push("no_decision");
  if (m.reschedule_count >= 2) w.push("rescheduled");
  if ((m.overdue_actions ?? 0) > 0) w.push("overdue_actions");
  if ((m.max_postponed ?? 0) >= 2) w.push("postponed_actions");
  return w;
}

/** Kaam ki haalat, aaj (PKT) ke hisaab se. */
export function actionState(a: { status: string; due_date: string }, today: string): "done" | "cancelled" | "overdue" | "due_soon" | "open" {
  if (a.status === "done") return "done";
  if (a.status === "cancelled") return "cancelled";
  if (a.due_date < today) return "overdue";
  if (a.due_date <= addDays(today, 3)) return "due_soon";
  return "open";
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Abhi chal rahi hai? */
export function isLive(startsAt: string, durationMin: number, now = new Date()): boolean {
  const s = Date.parse(startsAt);
  return now.getTime() >= s && now.getTime() < s + durationMin * 60000;
}

/** Ek waqt par kaun busy hai (doosri meeting) -- availability panel. */
export function overlaps(aStart: string, aMin: number, bStart: string, bMin: number): boolean {
  const a0 = Date.parse(aStart), a1 = a0 + aMin * 60000, b0 = Date.parse(bStart), b1 = b0 + bMin * 60000;
  return a0 < b1 && b0 < a1;
}

/**
 * Google Meet link ka hook. Abhi sirf 'manual' (link paste hota hai).
 * Kal Google Calendar API judegi to yahan ek provider lagega jo
 * { url, externalEventId } wapas kare -- DB mein meet_provider='google'
 * aur external_event_id (600) pehle se tayyar hain.
 */
export interface MeetLinkProvider {
  id: "manual" | "google";
  available: boolean;
  create(input: { title: string; startsAt: string; durationMin: number; attendeeEmails: string[] }): Promise<{ url: string; externalEventId: string } | null>;
}
export const manualMeetProvider: MeetLinkProvider = { id: "manual", available: false, create: async () => null };
export function getMeetProvider(): MeetLinkProvider {
  return manualMeetProvider;
}
