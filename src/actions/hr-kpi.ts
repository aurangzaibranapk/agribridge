"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aajKaKhana } from "@/lib/utils/format";
import { parseCandidate, parseJoinExit, parsePulse, parseReview, parseTarget, parseTraining, stageToStatus } from "@/lib/hr-kpi/validate";

/**
 * HR KPI ke forms. Sab likhai USER ke session se (RLS: hr/admin/owner/super_admin).
 * Maker-checker aur audit database ke triggers mein (688). Service client yahan nahi.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any; auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> } };

async function ctx() {
  const db = createClient() as unknown as Db;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  return { db, me: user!.id };
}
function back(path: string, r: { error?: string; ok?: string }): never {
  revalidatePath(path);
  revalidatePath("/admin/hr-dashboard");
  const q = r.error ? `err=${encodeURIComponent(r.error)}` : `ok=${encodeURIComponent(r.ok ?? "Mehfooz")}`;
  redirect(`${path}?${q}`);
}
const msg = (e: { message?: string } | null) => (e?.message ?? "Mehfooz nahi hua").replace(/^.*?:\s*/, "");

export async function addTraining(f: FormData) {
  const { db } = await ctx();
  const p = parseTraining(f, aajKaKhana());
  if (!p.ok) back("/admin/hr/training", { error: p.error });
  const { error } = await db.from("hr_training_records").insert(p.value);
  back("/admin/hr/training", error ? { error: msg(error) } : { ok: "Training darj ho gayi" });
}

export async function addReview(f: FormData) {
  const { db, me } = await ctx();
  const p = parseReview(f, me);
  if (!p.ok) back("/admin/hr/performance", { error: p.error });
  const { error } = await db.from("hr_performance_reviews").insert({ ...p.value, reviewed_by: me, status: "pending" });
  back("/admin/hr/performance", error ? { error: error.code === "23505" ? "Is mahine ka review pehle se hai" : msg(error) } : { ok: "Review manzoori ke liye bhej diya" });
}

export async function decideReview(f: FormData) {
  const { db } = await ctx();
  const id = String(f.get("id") ?? "");
  const decision = String(f.get("decision") ?? "");
  if (!["approved", "rejected"].includes(decision)) back("/admin/hr/performance", { error: "Faisla ghalat" });
  const { error } = await db.from("hr_performance_reviews").update({ status: decision }).eq("id", id).eq("status", "pending");
  back("/admin/hr/performance", error ? { error: msg(error) } : { ok: decision === "approved" ? "Manzoor" : "Rad" });
}

export async function addTarget(f: FormData) {
  const { db, me } = await ctx();
  const { data: depts } = await db.from("departments").select("key");
  const p = parseTarget(f, ((depts ?? []) as { key: string }[]).map((d) => d.key));
  if (!p.ok) back("/admin/hr/targets", { error: p.error });
  const { error } = await db.from("hr_department_targets").insert({ ...p.value, created_by: me, status: "pending" });
  back("/admin/hr/targets", error ? { error: error.code === "23505" ? "Is mahine ka target pehle se hai" : msg(error) } : { ok: "Target manzoori ke liye bhej diya" });
}

export async function decideTarget(f: FormData) {
  const { db } = await ctx();
  const id = String(f.get("id") ?? "");
  const decision = String(f.get("decision") ?? "");
  if (!["approved", "rejected"].includes(decision)) back("/admin/hr/targets", { error: "Faisla ghalat" });
  const { error } = await db.from("hr_department_targets").update({ status: decision }).eq("id", id).eq("status", "pending");
  back("/admin/hr/targets", error ? { error: msg(error) } : { ok: decision === "approved" ? "Manzoor" : "Rad" });
}

export async function updateTargetActual(f: FormData) {
  const { db } = await ctx();
  const id = String(f.get("id") ?? "");
  const actual = Number(f.get("actual_manual"));
  if (!Number.isFinite(actual) || actual < 0) back("/admin/hr/targets", { error: "Actual 0 ya zyada" });
  const { error } = await db.from("hr_department_targets").update({ actual_manual: actual }).eq("id", id).neq("department_key", "sales");
  back("/admin/hr/targets", error ? { error: msg(error) } : { ok: "Actual darj" });
}

export async function saveJoinExit(f: FormData) {
  const { db } = await ctx();
  const p = parseJoinExit(f, aajKaKhana());
  if (!p.ok) back("/admin/hr/joining-exit", { error: p.error });
  const v = p.value;
  const patch: Record<string, unknown> = { gender: v.gender, hire_date: v.hire_date, exit_date: v.exit_date, exit_reason: v.exit_reason };
  if (v.exit_date) patch.employment_status = "ended";
  const { error } = await db.from("staff_details").update(patch).eq("id", v.id);
  back("/admin/hr/joining-exit", error ? { error: msg(error) } : { ok: "Mehfooz" });
}

export async function addCandidate(f: FormData) {
  const { db } = await ctx();
  const p = parseCandidate(f);
  if (!p.ok) back("/admin/hr/recruitment", { error: p.error });
  const { error } = await db.from("job_applications").insert(p.value);
  back("/admin/hr/recruitment", error ? { error: msg(error) } : { ok: "Candidate darj" });
}

export async function moveStage(f: FormData) {
  const { db } = await ctx();
  const id = String(f.get("id") ?? "");
  const status = stageToStatus(String(f.get("stage") ?? ""));
  if (!status) back("/admin/hr/recruitment", { error: "Marhala ghalat" });
  const { error } = await db.from("job_applications").update({ status }).eq("id", id);
  back("/admin/hr/recruitment", error ? { error: msg(error) } : { ok: "Marhala badal gaya" });
}

export async function submitPulse(f: FormData) {
  const { db, me } = await ctx();
  const p = parsePulse(f, aajKaKhana());
  if (!p.ok) back("/admin/my-hr", { error: p.error });
  const { error } = await db.from("hr_pulse_responses").insert({ ...p.value, profile_id: me });
  back("/admin/my-hr", error ? { error: error.code === "23505" ? "Is mahine ka jawab pehle de chuke" : msg(error) } : { ok: "Shukriya! Aap ka jawab gumnaam rahega" });
}

export async function updateSalaryDueDay(f: FormData) {
  const { db } = await ctx();
  const day = Number(f.get("salary_due_day"));
  const path = "/admin/hr-dashboard";
  if (!Number.isInteger(day) || day < 1 || day > 28) redirect(`${path}?tab=tankhwah&err=${encodeURIComponent("Tareekh 1 se 28")}`);
  const { error } = await db.from("hr_payroll_settings").update({ salary_due_day: day }).eq("id", 1);
  revalidatePath(path);
  redirect(`${path}?tab=tankhwah&${error ? `err=${encodeURIComponent(msg(error))}` : "ok=Due%20date%20mehfooz"}`);
}
