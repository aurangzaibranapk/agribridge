import { TRAINING_TYPES, RATINGS, EXIT_REASONS, GENDERS, STAGE_STATUS, type Stage } from "@/lib/hr-kpi/core";

/** Form ki jaanch -- pure, test ho sakti hai. Ghalti par Roman Urdu paighaam. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
type R<T> = { ok: true; value: T } | { ok: false; error: string };
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export function parseTraining(f: FormData, today: string): R<{ profile_id: string; training_type: string; title: string; training_date: string; hours: number; cost: number; notes: string | null }> {
  const profile_id = s(f, "profile_id");
  const training_type = s(f, "training_type");
  const title = s(f, "title");
  const training_date = s(f, "training_date");
  const hours = Number(s(f, "hours"));
  const cost = s(f, "cost") === "" ? 0 : Number(s(f, "cost"));
  if (!UUID.test(profile_id)) return { ok: false, error: "Staff chunein" };
  if (!(TRAINING_TYPES as readonly string[]).includes(training_type)) return { ok: false, error: "Training ki qism chunein" };
  if (title.length < 2 || title.length > 200) return { ok: false, error: "Training ka naam likhein" };
  if (!DATE.test(training_date) || training_date > today) return { ok: false, error: "Sahi tareekh (aaj tak)" };
  if (!Number.isFinite(hours) || hours <= 0 || hours > 500) return { ok: false, error: "Ghante 0 se zyada aur 500 tak" };
  if (!Number.isFinite(cost) || cost < 0) return { ok: false, error: "Kharcha 0 ya zyada" };
  return { ok: true, value: { profile_id, training_type, title, training_date, hours, cost, notes: s(f, "notes") || null } };
}

export function parseReview(f: FormData, me: string): R<{ profile_id: string; period_month: string; rating: string; comment: string | null }> {
  const profile_id = s(f, "profile_id");
  const month = s(f, "period_month");
  const rating = s(f, "rating");
  if (!UUID.test(profile_id)) return { ok: false, error: "Staff chunein" };
  if (profile_id === me) return { ok: false, error: "Apna review khud nahi kar sakte" };
  if (!MONTH.test(month)) return { ok: false, error: "Mahina chunein" };
  if (!(RATINGS as readonly string[]).includes(rating)) return { ok: false, error: "Rating chunein" };
  return { ok: true, value: { profile_id, period_month: `${month}-01`, rating, comment: s(f, "comment") || null } };
}

export function parseTarget(f: FormData, deptKeys: string[]): R<{ department_key: string; period_month: string; target_amount: number; actual_manual: number | null }> {
  const department_key = s(f, "department_key");
  const month = s(f, "period_month");
  const target = Number(s(f, "target_amount"));
  const actualRaw = s(f, "actual_manual");
  const actual = actualRaw === "" ? null : Number(actualRaw);
  if (!deptKeys.includes(department_key)) return { ok: false, error: "Department chunein" };
  if (!MONTH.test(month)) return { ok: false, error: "Mahina chunein" };
  if (!Number.isFinite(target) || target <= 0) return { ok: false, error: "Target 0 se zyada" };
  if (actual != null && (!Number.isFinite(actual) || actual < 0)) return { ok: false, error: "Actual 0 ya zyada" };
  return { ok: true, value: { department_key, period_month: `${month}-01`, target_amount: target, actual_manual: department_key === "sales" ? null : actual } };
}

export function parseJoinExit(f: FormData, today: string): R<{ id: string; gender: string | null; hire_date: string | null; exit_date: string | null; exit_reason: string | null }> {
  const id = s(f, "id");
  const gender = s(f, "gender") || null;
  const hire = s(f, "hire_date") || null;
  const exit = s(f, "exit_date") || null;
  const reason = s(f, "exit_reason") || null;
  if (!UUID.test(id)) return { ok: false, error: "Staff ghalat" };
  if (gender && !(GENDERS as readonly string[]).includes(gender)) return { ok: false, error: "Gender ghalat" };
  if (hire && (!DATE.test(hire) || hire > today)) return { ok: false, error: "Joining date ghalat" };
  if (exit && !DATE.test(exit)) return { ok: false, error: "Exit date ghalat" };
  if (exit && hire && exit < hire) return { ok: false, error: "Exit date joining se pehle nahi ho sakti" };
  if (exit && !reason) return { ok: false, error: "Chhorne ki wajah chunein" };
  if (reason && !(EXIT_REASONS as readonly string[]).includes(reason)) return { ok: false, error: "Wajah ghalat" };
  return { ok: true, value: { id, gender, hire_date: hire, exit_date: exit, exit_reason: exit ? reason : null } };
}

export function parseCandidate(f: FormData): R<{ vacancy_id: string; full_name: string; email: string; phone: string | null; status: string }> {
  const vacancy_id = s(f, "vacancy_id");
  const full_name = s(f, "full_name");
  const email = s(f, "email").toLowerCase();
  const phone = s(f, "phone") || null;
  if (!UUID.test(vacancy_id)) return { ok: false, error: "Vacancy chunein" };
  if (full_name.length < 2) return { ok: false, error: "Naam likhein" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Sahi email likhein" };
  if (phone && !/^[0-9+\- ]{7,16}$/.test(phone)) return { ok: false, error: "Sahi mobile likhein" };
  return { ok: true, value: { vacancy_id, full_name, email, phone, status: "pending" } };
}

export function stageToStatus(stage: string): string | null {
  return stage in STAGE_STATUS ? STAGE_STATUS[stage as Stage] : null;
}

export function parsePulse(f: FormData, today: string): R<{ score: number; period_month: string }> {
  const score = Number(s(f, "score"));
  if (!Number.isInteger(score) || score < 1 || score > 5) return { ok: false, error: "1 se 5 tak chunein" };
  return { ok: true, value: { score, period_month: `${today.slice(0, 7)}-01` } };
}
