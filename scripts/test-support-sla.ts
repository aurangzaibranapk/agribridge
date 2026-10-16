/** Support Center pure tests.  npm run test:support */
import assert from "node:assert/strict";
import { parseAssignChoice, reporterNotice } from "../src/lib/support/assign";
import { mapPriority, mapStatus, normalize, views, developerCounts, summaries, weekKey, canTransition, moduleFromUrl } from "../src/lib/support/sla";

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`ok  ${name}`); }
const now = new Date("2026-10-15T12:00:00Z");
const base = { ticket_no: 1, title: "POS bill print nahi hota", page_url: "/admin/pos/sale", reporter_id: "r1" };

test("legacy priority mapping", () => {
  assert.equal(mapPriority("work_stopped"), "critical");
  assert.equal(mapPriority("urgent"), "high");
  assert.equal(mapPriority("normal"), "normal");
  assert.equal(mapPriority("urgent", "low"), "low");
});
test("legacy status mapping", () => {
  assert.equal(mapStatus("new"), "new");
  assert.equal(mapStatus("assigned"), "acknowledged");
  assert.equal(mapStatus("investigating"), "in_progress");
  assert.equal(mapStatus("assigned", "blocked"), "waiting");
  assert.equal(mapStatus("resolved"), "resolved");
  assert.equal(mapStatus("resolved", null, "closed"), "closed");
});
test("module from url", () => {
  assert.equal(moduleFromUrl("https://x.com/admin/stock-count/1"), "Stock Count");
  assert.equal(moduleFromUrl(null), "General");
});
test("first response ignores reporter's own comment; missing is null", () => {
  const t = normalize({ ...base, id: "a", priority: "normal", status: "new", created_at: "2026-10-15T10:00:00Z" }, undefined,
    [{ ticket_id: "a", created_at: "2026-10-15T10:05:00Z", author_id: "r1" }], now);
  assert.equal(t.firstResponseAt, null);
  const t2 = normalize({ ...base, id: "a", priority: "normal", status: "new", created_at: "2026-10-15T10:00:00Z" }, undefined,
    [{ ticket_id: "a", created_at: "2026-10-15T10:05:00Z", author_id: "r1" }, { ticket_id: "a", created_at: "2026-10-15T11:00:00Z", author_id: "dev" }], now);
  assert.equal(t2.firstResponseAt, "2026-10-15T11:00:00Z");
});
test("overdue: critical without response after 1h", () => {
  const t = normalize({ ...base, id: "b", priority: "work_stopped", status: "new", created_at: "2026-10-15T09:00:00Z" }, undefined, [], now);
  assert.equal(t.overdue, true);
  const ok = normalize({ ...base, id: "c", priority: "normal", status: "new", created_at: "2026-10-15T09:00:00Z" }, undefined, [], now);
  assert.equal(ok.overdue, false);
});
test("turnaround and resolved today, repeats", () => {
  const rows = [
    normalize({ ...base, id: "d", priority: "normal", status: "resolved", created_at: "2026-10-15T06:00:00Z", resolved_at: "2026-10-15T09:00:00Z", assignee_name: "Dev A" }, undefined, [], now),
    normalize({ ...base, id: "e", priority: "normal", status: "new", created_at: "2026-10-14T06:00:00Z", assignee_name: "Dev A" }, undefined, [], now),
  ];
  assert.equal(rows[0].turnaroundHours, 3);
  const v = views(rows, now);
  assert.equal(v.resolvedToday.length, 1);
  assert.equal(v.pending.length, 1);
  assert.equal(v.repeat.length, 1);
  const dev = developerCounts(rows)[0];
  assert.deepEqual([dev.name, dev.total, dev.open, dev.resolved], ["Dev A", 2, 1, 1]);
  const days = summaries(rows, "day");
  assert.equal(days.find((d) => d.period === "2026-10-15")!.resolved, 1);
  assert.equal(summaries(rows, "month")[0].raised, 2);
});
test("week key is Monday", () => { assert.equal(weekKey("2026-10-15"), "2026-10-12"); });
test("transitions: closed only reopens", () => {
  assert.equal(canTransition("closed", "in_progress"), false);
  assert.equal(canTransition("closed", "reopened"), true);
  assert.equal(canTransition("new", "new"), false);
});
test("assign choice parsing: empty = unassigned triage", () => {
  assert.deepEqual(parseAssignChoice(""), { kind: "unassigned" });
  assert.deepEqual(parseAssignChoice("person:0b6f2c1e-1111-4222-8333-944445555666"), { kind: "person", id: "0b6f2c1e-1111-4222-8333-944445555666" });
  assert.deepEqual(parseAssignChoice("agent:codex_subscription"), { kind: "agent", key: "codex_subscription" });
  assert.equal(parseAssignChoice("person:not-a-uuid").kind, "invalid");
  assert.equal(parseAssignChoice("agent:https://evil").kind, "invalid");
});
test("reporter notice: skip self, resolved title", () => {
  assert.equal(reporterNotice({ reporterId: "a", actorId: "a", event: "status", ref: "ISS-1", detail: "x" }), null);
  assert.match(reporterNotice({ reporterId: "a", actorId: "b", event: "resolved", ref: "ISS-1", detail: "x" })!.title, /Hal ho gaya/);
});
console.log(`\n${n} tests passed`);
