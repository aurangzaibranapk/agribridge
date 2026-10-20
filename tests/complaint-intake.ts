import assert from "node:assert/strict";
import fs from "node:fs";
import {
  callCenterQueueDraft, canAssignComplaints, complaintDeskAccess, forwardGroups,
  mayCloseComplaint, staffComplaintRecord,
} from "../src/lib/support/complaint-intake";

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log(`  ok  ${name}`); };

ok("staff cannot choose or see departments", () => {
  for (const role of ["sales_staff", "finance", "manager", "admin_assistant", "call_center_agent", "hr"]) {
    const view = complaintDeskAccess(role);
    assert.equal(view.showDepartmentPicker, false);
    assert.equal(view.showAssigneePicker, false);
    assert.equal(canAssignComplaints(role), false);
  }
  assert.equal(complaintDeskAccess("admin").showDepartmentPicker, true);
  assert.equal(complaintDeskAccess("owner").showAssigneePicker, true);
  assert.equal(complaintDeskAccess("super_admin").showDepartmentPicker, true);
});

ok("staff complaint record ignores any assignee the client sent", () => {
  const row = staffComplaintRecord({
    title: "Rate list purani hai",
    description: "Urea update nahi hui.",
    assigneeId: "00000000-0000-0000-0000-0000000000a3",
    departmentId: "dept-accounts",
    agentKey: "codex_subscription",
  });
  assert.equal(row.intake_source, "staff");
  assert.equal(row.status, "new");
  assert.equal(row.assigned_to, null);
  assert.equal(row.department_id, null);
  assert.equal(row.assigned_kind, null);
  assert.equal(row.assigned_agent, null);
  assert.equal(row.suggested_department, null);
});

ok("only admin roles can assign", () => {
  assert.equal(canAssignComplaints("admin"), true);
  assert.equal(canAssignComplaints("owner"), true);
  assert.equal(canAssignComplaints("super_admin"), true);
  assert.equal(canAssignComplaints("sales_staff"), false);
  assert.equal(canAssignComplaints("finance"), false);
  assert.equal(canAssignComplaints("manager"), false);
});

ok("caller complaint keeps a suggestion and stays unassigned", () => {
  const row = callCenterQueueDraft({
    number: "CMP-000123",
    callerName: "Muhammad Aslam",
    description: "DAP bag galat hai.",
    suggestedDepartment: "accounts",
    priority: "high",
  });
  assert.equal(row.intake_source, "call_center");
  assert.equal(row.suggested_department, "accounts");
  assert.equal(row.assigned_to, null);
  assert.equal(row.department_id, null);
  assert.equal(row.priority, "urgent");
  assert.match(row.title, /CMP-000123/);
});

ok("forward list splits agent, department user, and developer", () => {
  const groups = forwardGroups([
    { id: "1", full_name: "Sana", role: "call_center_agent" },
    { id: "2", full_name: "Imran", role: "finance" },
    { id: "3", full_name: "Dev", role: "admin_assistant" },
    { id: "4", full_name: "Shop", role: "sales_staff" },
  ]);
  assert.deepEqual(groups.callCenter.map((p) => p.id), ["1"]);
  assert.deepEqual(groups.department.map((p) => p.id), ["2", "4"]);
  assert.deepEqual(groups.developer.map((p) => p.id), ["3"]);
});

ok("maker cannot close; assignee and another admin can; agent cannot", () => {
  assert.equal(mayCloseComplaint({ actorId: "s", submitterId: "s", actorRoles: ["sales_staff"], assigneeId: null }), false);
  assert.equal(mayCloseComplaint({ actorId: "a", submitterId: "s", actorRoles: ["admin"], assigneeId: null }), true);
  assert.equal(mayCloseComplaint({ actorId: "f", submitterId: "s", actorRoles: ["finance"], assigneeId: "f" }), true);
  assert.equal(mayCloseComplaint({ actorId: "f", submitterId: "s", actorRoles: ["finance"], assigneeId: null }), false);
  assert.equal(mayCloseComplaint({ actorId: "ag", submitterId: "s", actorRoles: ["call_center_agent"], assigneeId: "ag" }), false);
});

ok("desk hides the picker unless the viewer can assign", () => {
  const desk = fs.readFileSync("src/components/support/support-desk.tsx", "utf8");
  assert.match(desk, /canAssign &&/);
  assert.match(desk, /Seedha Admin/);
});

ok("staff post uses the unassigned queue function", () => {
  const route = fs.readFileSync("src/app/api/support/tickets/route.ts", "utf8");
  assert.match(route, /fn_staff_file_complaint/);
  assert.match(route, /canAssignComplaints/);
  const patch = fs.readFileSync("src/app/api/support/tickets/[id]/route.ts", "utf8");
  assert.match(patch, /fn_complaint_forward/);
  assert.match(patch, /fn_complaint_set_status/);
  assert.match(patch, /khud band nahi/);
});

console.log(`\ncomplaint-intake: ${n} checks pass`);
