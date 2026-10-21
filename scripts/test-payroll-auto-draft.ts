import assert from "node:assert/strict";
import fs from "node:fs";
import { isLastDayOfMonthPkt, pktParts, payrollDraftMessage, previewAdjust } from "../src/lib/payroll/auto-draft";

// 31 Oct 2026 PKT = 30 Oct 19:00Z se
assert.equal(isLastDayOfMonthPkt(new Date("2026-10-31T10:00:00Z")), true);
assert.equal(isLastDayOfMonthPkt(new Date("2026-10-30T18:59:00Z")), false);
assert.equal(isLastDayOfMonthPkt(new Date("2026-10-30T19:30:00Z")), true, "PKT mein 31 ho chuka");
assert.equal(isLastDayOfMonthPkt(new Date("2028-02-29T08:00:00Z")), true, "leap year");
assert.equal(isLastDayOfMonthPkt(new Date("2026-02-28T08:00:00Z")), true);
assert.deepEqual(pktParts(new Date("2026-12-31T20:00:00Z")), { year: 2027, month: 1, day: 1 });
const msg = payrollDraftMessage({ lines: 3, warnings: 1, incomplete: true }, "October 2026");
assert.match(msg, /3 staff/); assert.match(msg, /tankhwah darj nahi/); assert.match(msg, /Hazri adhoori/);
const base = { basic: 30000, allowances: 0, absent_deduction: 1000, other_deductions: 0, advance_deduction: 2000 };
assert.deepEqual(previewAdjust(base, "allowances", 2000), { gross: 32000, net: 29000, ok: true });
assert.equal(previewAdjust(base, "other_deductions", 40000).ok, false);

const route = fs.readFileSync("src/app/api/cron/payroll-draft/route.ts", "utf8");
assert.match(route, /CRON_SECRET/); assert.match(route, /fn_payroll_auto_draft/); assert.match(route, /Payroll draft tayyar hai/);
assert.match(route, /isLastDayOfMonthPkt/);
const ui = fs.readFileSync("src/app/admin/hr/payroll/payroll-client.tsx", "utf8");
assert.match(ui, /adjustPayrollLine/); assert.match(ui, /tankhwah darj nahi/); assert.match(ui, /a\.adjusted_by === me\.id/);
console.log("test-payroll-auto-draft: ok");
