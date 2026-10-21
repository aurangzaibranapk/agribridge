import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAssistantTicket, assistantPill } from "../src/lib/data-health/assistant-ticket";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok", name); };
const f = { id: "f1", title: "Batch aur ginti barabar nahi", description: "Rain Surf: farq -120", department: "inventory", severity: "high", related_label: "Rain Surf", amount: -120, related_table: "inventory_items", related_id: "x" };

t("ticket title + label", () => assert.equal(buildAssistantTicket(f).title, "Data Health: Batch aur ginti barabar nahi — Rain Surf"));
t("high = urgent, else normal", () => {
  assert.equal(buildAssistantTicket(f).priority, "urgent");
  assert.equal(buildAssistantTicket({ ...f, severity: "medium" }).priority, "normal");
});
t("description has details + note + approval line", () => {
  const d = buildAssistantTicket(f, "gin kar batayenge").description;
  for (const s of ["Rain Surf: farq -120", "Finding id: f1", "Note: gin kar batayenge", "approval"]) assert.ok(d.includes(s), s);
});
t("limits respected", () => {
  const b = buildAssistantTicket({ ...f, title: "x".repeat(300), description: "y".repeat(9000) });
  assert.ok(b.title.length <= 160 && b.description.length <= 5000);
});
t("pill states", () => {
  assert.equal(assistantPill("assigned", "queued").kind, "sent");
  assert.equal(assistantPill("investigating", null).kind, "working");
  assert.equal(assistantPill("resolved", null).kind, "done");
});
t("action assigns to built-in agent, skips already-sent", () => {
  const src = readFileSync("src/actions/data-health.ts", "utf8");
  for (const s of ['assigned_kind: "agent"', "assigned_agent: BUILTIN_ASSISTANT_KEY", 'assignment_status: "queued"', "!f.support_ticket_id", 'status: "sent_to_assistant"', 'requireAction("system.data_health", "edit")']) assert.ok(src.includes(s), s);
  assert.ok(src.includes('"sent_to_claude", "dismissed", "resolved"'), "Claude flow kept");
});
t("UI keeps Claude button and adds assistant + bulk", () => {
  const c = readFileSync("src/app/admin/data-health/data-health-client.tsx", "utf8");
  for (const s of ["AgriBridge Assistant ko bhej do", "Claude ko bhej do check karne", "Sab AgriBridge Assistant ko bhej do", "Theek hai, chhoड़ do"]) assert.ok(c.includes(s), s);
});
t("migration 694 additive with rollback", () => {
  const m = readFileSync("supabase/migrations/694_data_health_assistant.sql", "utf8");
  assert.ok(m.includes("sent_to_assistant") && m.includes("'sent_to_claude'") && m.includes("support_ticket_id"));
  assert.ok(!/drop table|drop column/i.test(m));
  assert.ok(readFileSync("supabase/migrations/694_data_health_assistant.rollback.sql", "utf8").includes("drop column if exists support_ticket_id"));
});
console.log(`${n} passed`);
