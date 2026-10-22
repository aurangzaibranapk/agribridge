/** Escalation level, owner summary, filters. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mayDecideEntry, selfDecisionLabel } from "../src/lib/approval/guards";
import {
  DEFAULT_SLA_HOURS,
  escalationLevel,
  escalationReason,
  itemMatchesFilter,
  ownerEscalationSummary,
} from "../src/lib/pending/escalation";

const H = 3_600_000;
const now = Date.parse("2026-10-22T12:00:00Z");

assert.equal(DEFAULT_SLA_HOURS, 24);
assert.equal(escalationLevel(new Date(now - 23 * H).toISOString(), 24, now), "manager");
assert.equal(escalationLevel(new Date(now - 24 * H).toISOString(), 24, now), "escalated");
assert.equal(escalationLevel(new Date(now - 30 * H).toISOString(), 48, now), "manager");
assert.equal(escalationReason(24), "Manager ne 24 ghante mein approve nahi kiya");
assert.equal(escalationReason(6), "Manager ne 6 ghante mein approve nahi kiya");

assert.equal(mayDecideEntry("manager", "m", ["m"]), false);
assert.equal(mayDecideEntry("sales_staff", "s", ["s"]), false);
assert.equal(mayDecideEntry("manager", "m", ["other"]), true);
assert.equal(mayDecideEntry("admin", "a", ["a"]), true);
assert.equal(mayDecideEntry("owner", "o", ["o", "o"]), true);
assert.equal(mayDecideEntry("super_admin", "a", ["a"]), true);
assert.equal(selfDecisionLabel("admin", "approve"), "Khud approve (Admin)");
assert.equal(selfDecisionLabel("owner", "approve"), "Khud approve (Owner)");

const rows = [
  { category: "cash_handover", item_id: "1", opened_at: new Date(now - 50 * H).toISOString(), maker_id: "m", maker_name: "Anwar", level: "escalated" as const },
  { category: "purchases", item_id: "2", opened_at: new Date(now - 30 * H).toISOString(), maker_id: "m", maker_name: "Anwar", level: "escalated" as const },
  { category: "pos_returns", item_id: "3", opened_at: new Date(now - 10 * H).toISOString(), maker_id: "s", maker_name: "Sana", level: "manager" as const },
];
const sum = ownerEscalationSummary(rows, now);
assert.equal(sum.count, 2);
assert.equal(sum.byPerson.length, 1);
assert.equal(sum.byPerson[0].name, "Anwar");
assert.equal(sum.byPerson[0].count, 2);
assert.ok(sum.oldest && sum.oldest < rows[1].opened_at);

assert.equal(itemMatchesFilter("escalated", { escalation_level: "escalated" }, "owner"), true);
assert.equal(itemMatchesFilter("escalated", { escalation_level: "escalated" }, "admin"), true);
assert.equal(itemMatchesFilter("escalated", { escalation_level: "escalated" }, "manager"), false);
assert.equal(itemMatchesFilter("overdue", { overdue: true }, "manager"), true);
assert.equal(itemMatchesFilter("mine", { is_own: true }, "manager"), false);
assert.equal(itemMatchesFilter("all", { is_own: true }, "manager"), true);

const sql = readFileSync("supabase/migrations/698_pending_escalation.sql", "utf8");
assert.match(sql, /fn_pending_escalate/);
assert.match(sql, /fn_may_decide_entry/);
assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /whatsapp|twilio|sms_outbox/i);
assert.match(sql, /admin', 'super_admin', 'owner'/);
assert.match(readFileSync("src/app/api/cron/pending-escalation/route.ts", "utf8"), /CRON_SECRET/);
assert.match(readFileSync("src/lib/i18n/dict/admin-pending.ts", "utf8"), /Admin aur Owner apni entry/);
assert.match(readFileSync("src/lib/i18n/dict/admin-pending.ts", "utf8"), /apb_filter_escalated/);
assert.match(readFileSync("src/lib/i18n/dict/admin-pending.ts", "utf8"), /apb_filter_overdue/);

console.log("pending escalation lib ok");
