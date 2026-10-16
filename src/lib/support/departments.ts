/**
 * Support departments (539) -- khalis faisle, test ho sakte hain.
 * Test: npm run test:support-departments
 */
export type DeptMember = { id: string; department_id: string; member_kind: "person" | "agent"; profile_id: string | null; agent_key: string | null; agent_label: string | null; is_active: boolean; full_name?: string | null };
export type Department = { id: string; name: string; is_default_intake: boolean; return_to_department_id: string | null; notify_scope: "reporter_team" | "all_staff"; is_active: boolean };

export function intakeDepartment(depts: Department[]): Department | null {
  return depts.find((d) => d.is_active && d.is_default_intake) ?? depts.find((d) => d.is_active && d.name === "Development Team") ?? null;
}

/** Department -> member choice: "person:<uuid>" ya "agent:<key>"; member usi department ka aur active hona chahiye. */
export function validateMemberChoice(members: DeptMember[], departmentId: string, choice: { kind: "person"; id: string } | { kind: "agent"; key: string } | { kind: "unassigned" }): string | null {
  if (choice.kind === "unassigned") return null;
  const ok = members.some((m) => m.is_active && m.department_id === departmentId && (choice.kind === "person" ? m.member_kind === "person" && m.profile_id === choice.id : m.member_kind === "agent" && m.agent_key === choice.key));
  return ok ? null : "Ye member is department mein nahi hai.";
}

/** Resolve ke baad kis department ko wapas jaye: chuna hua > department ki default > Admin. */
export function handbackTarget(depts: Department[], current: string | null, chosen: string | null): Department | null {
  if (chosen) return depts.find((d) => d.id === chosen && d.is_active) ?? null;
  const cur = depts.find((d) => d.id === current);
  if (cur?.return_to_department_id) return depts.find((d) => d.id === cur.return_to_department_id) ?? null;
  return depts.find((d) => d.name === "Admin") ?? null;
}

/** Verify & close par notification kis ko: sab staff, ya reporter + team (department ke insaan members). Karne wala khud nahi. */
export function resolvedRecipients(input: { scope: "reporter_team" | "all_staff"; reporterId: string | null; actorId: string; teamProfileIds: string[]; allStaffIds: string[]; assigneeId?: string | null }): string[] {
  const set = new Set<string>(input.scope === "all_staff" ? input.allStaffIds : input.teamProfileIds);
  if (input.reporterId) set.add(input.reporterId);
  if (input.assigneeId) set.add(input.assigneeId);
  set.delete(input.actorId);
  return Array.from(set);
}

export const SUPPORT_STATUS_LABEL: Record<string, string> = {
  new: "Reported", assigned: "Assigned", investigating: "Analysis / Working", testing: "Testing",
  resolved_pending_verify: "Resolved — Admin verify", resolved: "Verified & Closed", reopened: "Reopened",
};
