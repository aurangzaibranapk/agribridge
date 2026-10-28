/* eslint-disable @typescript-eslint/no-explicit-any */
import { daysBetween, incrementBucket, nextAnniversary, type IncrementBucket } from "./salary-offer";

export interface UpcomingRow {
  profile_id: string; full_name: string; designation: string | null; hire_date: string | null;
  current_basic: number | null; drafts_pending: number; due_date: string | null; days_left: number | null; bucket: IncrementBucket;
}

/** v_upcoming_increments (691); view na ho to wahi hisaab yahan. */
export async function loadUpcomingIncrements(sb: any, today: string): Promise<{ rows: UpcomingRow[]; fromView: boolean }> {
  const v = await sb.from("v_upcoming_increments").select("*");
  if (!v.error) {
    return { fromView: true, rows: (v.data ?? []).map((r: any) => ({ ...r, current_basic: r.current_basic == null ? null : Number(r.current_basic), drafts_pending: Number(r.drafts_pending ?? 0) })) };
  }
  const [{ data: staff }, { data: profs }, { data: structs }] = await Promise.all([
    sb.from("staff_details").select("*").eq("is_active", true),
    sb.from("profiles").select("id, full_name, is_active"),
    sb.from("staff_salary_structures").select("profile_id, basic, status, effective_from, approved_at").order("effective_from", { ascending: false }),
  ]);
  const pm = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
  const rows: UpcomingRow[] = (staff ?? []).filter((s: any) => pm.get(s.profile_id)?.is_active).map((s: any) => {
    const mine = (structs ?? []).filter((x: any) => x.profile_id === s.profile_id);
    const cur = mine.find((x: any) => x.status === "approved" && x.effective_from <= today);
    const due = s.next_increment_due ?? nextAnniversary(s.hire_date, today);
    return {
      profile_id: s.profile_id, full_name: pm.get(s.profile_id)?.full_name ?? "—", designation: s.designation ?? null, hire_date: s.hire_date ?? null,
      current_basic: cur ? Number(cur.basic) : s.basic_salary != null ? Number(s.basic_salary) : null,
      drafts_pending: mine.filter((x: any) => x.status === "draft").length,
      due_date: due, days_left: due ? daysBetween(today, due) : null, bucket: incrementBucket(due, today),
    };
  });
  return { rows, fromView: false };
}
