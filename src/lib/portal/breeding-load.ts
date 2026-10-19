import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "./dairy-admin-load";
import { parseAdminBreed, parseEvents, parseHealth, parseRepro, parseTasks, type AdminBreedRow, type BreedEvent, type DueTask, type HealthEvent, type Repro } from "./breeding";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
// 569-571 abhi generated types mein nahi -- dheela type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const breedDb = () => createClient() as any;
const rpc = (): Rpc => { const sb = createClient(); return sb.rpc.bind(sb) as unknown as Rpc; };

const EV_COLS = "id, animal_id, event_type, event_date, heat_signs, bull_name, semen_breed, semen_company, straw_no, sexed, technician, pd_result, pd_method, service_id, calving_ease, calf_animal_id, calf_sex, calf_alive, cost, expense_id, notes, voided";
const H_COLS = "id, animal_id, kind, vaccine_code, diagnosis, medicine, dose, event_date, last_dose_date, withdrawal_days, withdrawal_until, vet_name, next_due, cost, expense_id, notes, voided";

/** RLS: sirf apne janwar ke waqiat. */
export async function loadBreeding(opts: { animalId?: string; from?: string } = {}): Promise<{ events: BreedEvent[]; health: HealthEvent[]; repro: Repro[]; error: string | null }> {
  const db = breedDb();
  let e = db.from("dairy_breeding_events").select(EV_COLS).eq("voided", false).order("event_date", { ascending: false }).limit(2000);
  let h = db.from("dairy_health_events").select(H_COLS).eq("voided", false).order("event_date", { ascending: false }).limit(2000);
  if (opts.animalId) { e = e.eq("animal_id", opts.animalId); h = h.or(`animal_id.eq.${opts.animalId},animal_id.is.null`); }
  if (opts.from) { e = e.gte("event_date", opts.from); h = h.gte("event_date", opts.from); }
  const [er, hr, rr] = await Promise.all([e, h, db.from("v_dairy_repro_status").select("*").order("tag_no")]);
  return { events: parseEvents(er.data), health: parseHealth(hr.data), repro: parseRepro(rr.data), error: er.error?.message ?? hr.error?.message ?? rr.error?.message ?? null };
}
/** Rewar wale sehat waqiat mein ye janwar shamil tha? (fan-out table) */
export async function healthEventIdsFor(animalId: string): Promise<Set<string>> {
  const { data } = await breedDb().from("dairy_health_event_animals").select("event_id").eq("animal_id", animalId).limit(2000);
  return new Set(((data ?? []) as { event_id: string }[]).map((x) => x.event_id));
}
export async function loadTasks(days = 30): Promise<{ tasks: DueTask[]; error: string | null }> {
  const r = await rpc()("fn_my_due_tasks", { p_days: days });
  return { tasks: parseTasks(r.data), error: r.error?.message ?? null };
}
export async function loadCoverage(): Promise<{ code: string; covered: number; eligible: number; last_date: string | null; next_due: string | null }[]> {
  const r = await rpc()("fn_my_vaccine_coverage");
  return Array.isArray(r.data) ? (r.data as Record<string, unknown>[]).map((c) => ({ code: String(c.code), covered: Number(c.covered) || 0, eligible: Number(c.eligible) || 0, last_date: c.last_date ? String(c.last_date) : null, next_due: c.next_due ? String(c.next_due) : null })) : [];
}
export async function loadPrefs(): Promise<Record<string, boolean>> {
  const { data } = await breedDb().from("dairy_task_state").select("task_key, state").like("task_key", "pref:%");
  const out: Record<string, boolean> = {};
  for (const r of (data ?? []) as { task_key: string; state: string }[]) out[r.task_key.slice(5)] = r.state !== "muted";
  return out;
}
/** Aaj ke naye in-app reminders (cron) -- dekhne par "seen". */
export async function unseenReminders(): Promise<number> {
  const { count } = await breedDb().from("dairy_reminders").select("id", { count: "exact", head: true }).is("seen_at", null);
  return count ?? 0;
}
export async function markRemindersSeen(): Promise<void> { await rpc()("fn_dairy_reminders_seen"); }
/** Vets/dawai kharche jo kisi waqia se link ho sakte hain (dukaan + pehle se likhe). */
export async function linkableVetExpenses(): Promise<{ id: string; date: string; amount: number; note: string; source: string }[]> {
  const db = breedDb();
  const [ex, b, h] = await Promise.all([
    db.from("dairy_expenses").select("id, expense_date, amount, note, paid_to, source").eq("voided", false).eq("category", "vets").in("source", ["erp_pos", "manual"]).order("expense_date", { ascending: false }).limit(40),
    db.from("dairy_breeding_events").select("expense_id").not("expense_id", "is", null).limit(2000),
    db.from("dairy_health_events").select("expense_id").not("expense_id", "is", null).limit(2000),
  ]);
  const used = new Set([...(b.data ?? []), ...(h.data ?? [])].map((x: { expense_id: string }) => x.expense_id));
  return ((ex.data ?? []) as Record<string, unknown>[]).filter((x) => !used.has(String(x.id))).map((x) => ({ id: String(x.id), date: String(x.expense_date), amount: Number(x.amount), note: [x.note, x.paid_to].filter(Boolean).join(" · "), source: String(x.source) }));
}

// ---- admin ----
export async function isBreedAdmin(): Promise<boolean> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return ADMIN_ROLES.includes(String(data?.role ?? ""));
}
export async function loadAdminBreed(asOf: string): Promise<{ rows: AdminBreedRow[]; error: string | null }> {
  const r = await rpc()("fn_admin_breeding_totals", { p_as_of: asOf });
  return { rows: parseAdminBreed(r.data), error: r.error?.message ?? null };
}
export async function loadAdminUpcoming(asOf: string, days = 30): Promise<{ farmer_id: string; farmer_code: string | null; full_name: string | null; tag_no: string; animal_name: string | null; expected_calving: string }[]> {
  const r = await rpc()("fn_admin_breeding_upcoming", { p_as_of: asOf, p_days: days });
  return Array.isArray(r.data) ? (r.data as Record<string, unknown>[]).map((x) => ({ farmer_id: String(x.farmer_id), farmer_code: (x.farmer_code as string) ?? null, full_name: (x.full_name as string) ?? null, tag_no: String(x.tag_no), animal_name: (x.animal_name as string) ?? null, expected_calving: String(x.expected_calving) })) : [];
}
