/** Wasooli (523) ka khalis hisaab -- database nahi chhoota. npx tsx scripts/test-receivable-recovery.ts */
import assert from "node:assert/strict";
import {
  computeAging, reminderDue, isCreditBlocked, reminderStageFor, buildReminderMessage, blockMessage, DEFAULT_RECOVERY_SETTINGS as DEFAULTS,
} from "../src/lib/recovery/aging";

const S = { ...DEFAULTS, effective_from: "2020-01-01", min_amount: 100 };

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok -", name); };

t("FIFO: wapsi purane udhaar ko pehle chukati hai", () => {
  const a = computeAging([
    { date: "2026-08-01", debit: 1000, credit: 0 },
    { date: "2026-09-20", debit: 500, credit: 0 },
    { date: "2026-10-05", debit: 300, credit: 0 },
    { date: "2026-10-06", debit: 0, credit: 1200 },
  ], "2026-10-10");
  assert.equal(a.balance, 600);
  assert.equal(a.oldestUnpaidDate, "2026-09-20");
  assert.equal(a.oldestDays, 20);
  assert.equal(a.dueDate, "2026-10-20");
  assert.equal(a.bucket15to30, 300);
  assert.equal(a.bucket0to15, 300);
  assert.equal(a.bucket30plus, 0);
});

t("Poora chuka to koi aging nahi", () => {
  const a = computeAging([{ date: "2026-01-01", debit: 500, credit: 0 }, { date: "2026-02-01", debit: 0, credit: 500 }], "2026-10-10");
  assert.equal(a.balance, 0);
  assert.equal(a.oldestUnpaidDate, null);
});

t("30+ din: block; 29 din: nahi; band setting: nahi; chhota baqaya: nahi", () => {
  assert.equal(isCreditBlocked({ balance: 5000, oldestDays: 30 }, S), true);
  assert.equal(isCreditBlocked({ balance: 5000, oldestDays: 29 }, S), false);
  assert.equal(isCreditBlocked({ balance: 5000, oldestDays: 90 }, { ...S, block_overdue_credit: false }), false);
  assert.equal(isCreditBlocked({ balance: 50, oldestDays: 90 }, S), false);
});

t("Stage: 14->null, 15->day15, 29->day15, 30->day30", () => {
  const st = (d: number) => reminderStageFor({ balance: 1000, oldestDays: d }, S);
  assert.equal(st(14), null);
  assert.equal(st(15), "day15");
  assert.equal(st(29), "day15");
  assert.equal(st(30), "day30");
});

t("Default: yaad-dihani BAND", () => assert.equal(S.reminders_enabled, false));

t("Paighaam mein raqam, tareekh aur dukan", () => {
  const m = buildReminderMessage({ stage: "day15", customerName: "Ali", amount: 12500, dueDate: "2026-10-20", shopName: "Kisan Karyana" });
  assert.match(m, /Rs 12,500/); assert.match(m, /20-10-2026/); assert.match(m, /Kisan Karyana/);
  const f = buildReminderMessage({ stage: "day30", customerName: "Ali", amount: 12500, dueDate: "2026-10-20", shopName: "X" });
  assert.match(f, /AAKHRI NOTICE/);
  assert.match(blockMessage("Ali", 1000, 35), /wajah likh kar ijazat/);
});

t("Policy date: old debt blocked only from 15 October; all positive balances count", () => {
  assert.equal(isCreditBlocked({ balance: 50, oldestDays: 90 }, DEFAULTS, "2026-10-14"), false);
  assert.equal(isCreditBlocked({ balance: 50, oldestDays: 90 }, DEFAULTS, "2026-10-15"), true);
  assert.equal(isCreditBlocked({ balance: 0, oldestDays: 90 }, DEFAULTS, "2026-10-15"), false);
  assert.equal(reminderStageFor({ balance: 50, oldestDays: 15 }, DEFAULTS, "2026-10-14"), null);
  assert.equal(reminderStageFor({ balance: 50, oldestDays: 15 }, DEFAULTS, "2026-10-15"), "day15");
});

t("Reminder cadence: weekly, final stage immediate, failed send retry", () => {
  const last = { stage: "day15", sent_at: "2026-10-15T04:00:00Z" };
  assert.equal(reminderDue("day15", last, "2026-10-21", 7), false);
  assert.equal(reminderDue("day15", last, "2026-10-22", 7), true);
  assert.equal(reminderDue("day30", last, "2026-10-16", 7), true);
  assert.equal(reminderDue("day15", null, "2026-10-16", 7), true);
});
console.log(`\n${n} tests passed`);
