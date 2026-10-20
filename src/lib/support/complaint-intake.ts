/**
 * Staff / call-center complaints jo Support Dashboard ki queue mein aati hain.
 * Staff khud department ya assignee nahi chunta.
 * Assign: Owner, super admin, Admin hamesha. Manager sirf jab Owner/Admin
 * us user ko ijazat de (default band).
 */

export const COMPLAINT_ADMIN_ROLES = ["owner", "super_admin", "admin"] as const;

const DEPARTMENT_ROLES = [
  "finance",
  "sales_staff",
  "warehouse",
  "milk_collection",
  "hr",
  "procurement",
  "machinery",
  "agronomist",
] as const;

/** Owner / super admin / Admin. Manager is list mein nahi — us ke liye grant alag hai. */
export function canAssignComplaints(role: string): boolean {
  return (COMPLAINT_ADMIN_ROLES as readonly string[]).includes(role);
}

/** Manager tab hi forward karta hai jab us ki apni ijazat on ho. */
export function canForwardComplaint(input: { role: string; managerGrant?: boolean }): boolean {
  if (canAssignComplaints(input.role)) return true;
  return input.role === "manager" && input.managerGrant === true;
}

/** Grant na do to purana behaviour: Manager ko picker nahi dikhta. */
export function complaintDeskAccess(role: string, managerGrant = false): { showDepartmentPicker: boolean; showAssigneePicker: boolean } {
  const show = canForwardComplaint({ role, managerGrant });
  return { showDepartmentPicker: show, showAssigneePicker: show };
}

export interface StaffComplaintInput {
  title: string;
  description: string;
  assigneeId?: string | null;
  departmentId?: string | null;
  agentKey?: string | null;
}

/** Client kuch bhi bheje, record hamesha Admin ki khali queue mein girta hai. */
export function staffComplaintRecord(input: StaffComplaintInput) {
  return {
    intake_source: "staff" as const,
    title: input.title.trim().slice(0, 160),
    description: input.description.trim().slice(0, 5000),
    assigned_to: null as null,
    department_id: null as null,
    assigned_kind: null as null,
    assigned_agent: null as null,
    suggested_department: null as null,
    status: "new" as const,
  };
}

/** Caller complaint: category ki tajweez rehti hai, insaan assign nahi hota. */
export function callCenterQueueDraft(input: {
  number: string;
  callerName: string;
  description: string;
  suggestedDepartment: string;
  priority: "high" | "normal" | "low";
}) {
  return {
    intake_source: "call_center" as const,
    title: `${input.number} · ${input.callerName}`.slice(0, 160),
    description: input.description,
    suggested_department: input.suggestedDepartment,
    priority: input.priority === "high" ? "urgent" as const : "normal" as const,
    assigned_to: null as null,
    department_id: null as null,
    status: "new" as const,
  };
}

export interface ForwardPerson {
  id: string;
  full_name: string;
  role: string;
}

export function forwardGroups(people: ForwardPerson[]) {
  return {
    callCenter: people.filter((p) => p.role === "call_center_agent"),
    department: people.filter((p) => (DEPARTMENT_ROLES as readonly string[]).includes(p.role)),
    developer: people.filter((p) =>
      ["owner", "super_admin", "admin", "admin_assistant", "manager"].includes(p.role),
    ),
  };
}

/**
 * Band karna: banane wala nahi, call-center ohda nahi.
 * Admin (jo maker nahi) ya jis user ko ye complaint mili.
 */
export function mayCloseComplaint(input: {
  actorId: string;
  submitterId: string;
  actorRoles: readonly string[];
  assigneeId: string | null;
}): boolean {
  if (!input.actorId || input.actorId === input.submitterId) return false;
  if (input.actorRoles.includes("call_center_agent")) return false;
  if (input.actorRoles.some((r) => canAssignComplaints(r))) return true;
  return Boolean(input.assigneeId && input.assigneeId === input.actorId);
}
