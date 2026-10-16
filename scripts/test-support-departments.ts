/** 539: Support departments ke faisle. npx tsx scripts/test-support-departments.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { intakeDepartment, validateMemberChoice, handbackTarget, resolvedRecipients, SUPPORT_STATUS_LABEL, type Department, type DeptMember } from "../src/lib/support/departments";
import { mapStatus } from "../src/lib/support/sla";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok -", name); };
const D = (id: string, name: string, extra: Partial<Department> = {}): Department => ({ id, name, is_default_intake: false, return_to_department_id: null, notify_scope: "reporter_team", is_active: true, ...extra });
const admin = D("a", "Admin"), dev = D("d", "Development Team", { is_default_intake: true, return_to_department_id: "a", notify_scope: "all_staff" }), acc = D("c", "Accounts");
const depts = [admin, dev, acc];
const M = (id: string, dep: string, kind: "person" | "agent", v: string): DeptMember => ({ id, department_id: dep, member_kind: kind, profile_id: kind === "person" ? v : null, agent_key: kind === "agent" ? v : null, agent_label: null, is_active: true });
const members = [M("1", "d", "agent", "agribridge_assistant"), M("2", "d", "person", "dev-1"), M("3", "a", "person", "owner-1")];

t("Naya issue Development Team (intake) mein", () => {
  assert.equal(intakeDepartment(depts)?.name, "Development Team");
  assert.equal(intakeDepartment([admin, D("d", "Development Team")])?.name, "Development Team");
  assert.equal(intakeDepartment([admin]), null);
});
t("Member usi department ka hona chahiye", () => {
  assert.equal(validateMemberChoice(members, "d", { kind: "agent", key: "agribridge_assistant" }), null);
  assert.equal(validateMemberChoice(members, "d", { kind: "person", id: "dev-1" }), null);
  assert.ok(validateMemberChoice(members, "d", { kind: "person", id: "owner-1" }));
  assert.ok(validateMemberChoice(members, "a", { kind: "agent", key: "agribridge_assistant" }));
  assert.equal(validateMemberChoice(members, "c", { kind: "unassigned" }), null);
});
t("Hand back: chuna hua > department default > Admin", () => {
  assert.equal(handbackTarget(depts, "d", "c")?.name, "Accounts");
  assert.equal(handbackTarget(depts, "d", null)?.name, "Admin");
  assert.equal(handbackTarget(depts, "c", null)?.name, "Admin");
  assert.equal(handbackTarget(depts, "d", "missing"), null);
});
t("Notification: sab staff ya reporter + team; karne wala khud nahi", () => {
  const all = resolvedRecipients({ scope: "all_staff", reporterId: "r", actorId: "owner-1", teamProfileIds: ["dev-1"], allStaffIds: ["owner-1", "s1", "s2"] });
  assert.deepEqual(all.sort(), ["r", "s1", "s2"]);
  const team = resolvedRecipients({ scope: "reporter_team", reporterId: "r", actorId: "owner-1", teamProfileIds: ["dev-1"], allStaffIds: ["s1"], assigneeId: "dev-1" });
  assert.deepEqual(team.sort(), ["dev-1", "r"]);
});
t("resolved_pending_verify: label + SLA mein khula (waiting)", () => {
  assert.match(SUPPORT_STATUS_LABEL.resolved_pending_verify, /verify/);
  assert.equal(mapStatus("resolved_pending_verify"), "waiting");
});
t("Migration 539 additive + seed + status superset", () => {
  const sql = readFileSync("supabase/migrations/539_support_departments.sql", "utf8");
  assert.doesNotMatch(sql, /drop table|drop column|truncate|delete from/i);
  assert.match(sql, /'Development Team'/);
  assert.match(sql, /resolved_pending_verify/);
  for (const s of ["new", "assigned", "investigating", "testing", "resolved", "reopened"]) assert.match(sql, new RegExp(`'${s}'`));
});
t("API: resolve_handback + verify-close notification + reopen button", () => {
  const api = readFileSync("src/app/api/support/tickets/[id]/route.ts", "utf8");
  assert.match(api, /resolve_handback/); assert.match(api, /resolvedRecipients/);
  const desk = readFileSync("src/components/support/support-desk.tsx", "utf8");
  assert.match(desk, /Abhi bhi masla hai/); assert.match(desk, /Department chunein/);
});
console.log(`\n${n} tests passed`);
