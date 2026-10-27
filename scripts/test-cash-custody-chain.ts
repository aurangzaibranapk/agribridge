import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canOpenCustodyDesk,
  canSeeCustodyPacket,
  holdDuration,
  isCustodyOverdue,
  kindLabel,
  parseSlipCopy,
  timelinePhrase,
  CUSTODY_VERIFY_MS,
} from "../src/lib/cash-custody/chain";
import {
  canApproveCustodyJama,
  cardTrail,
  holdShort,
  kpisFromOpen,
  kpisUnread,
  needsCue,
  pktDayStart,
  rsCompact,
  showApprove,
  showAskWhy,
  sortNeeds,
} from "../src/lib/cash-custody/needs";

const day = CUSTODY_VERIFY_MS;
const opened = "2026-10-26T00:00:00.000Z";

assert.equal(isCustodyOverdue(opened, null, Date.parse(opened) + day), false);
assert.equal(isCustodyOverdue(opened, null, Date.parse(opened) + day + 1), true);
assert.equal(isCustodyOverdue(opened, "2026-10-27T00:00:00.000Z", Date.parse(opened) + day * 5), false);
assert.equal(isCustodyOverdue("not-a-date", null), false);

assert.equal(holdDuration(opened, new Date(Date.parse(opened) + 90 * 60000).toISOString()), "1 ghante 30 minute");
assert.equal(holdDuration(opened, new Date(Date.parse(opened) + 2 * day).toISOString()), "2 din");
assert.equal(holdDuration(opened, new Date(Date.parse(opened) + 26 * 3600000).toISOString()), "26 ghante");
assert.equal(holdDuration(opened, new Date(Date.parse(opened) + 50 * 3600000).toISOString()), "2 din 2 ghante");
assert.equal(holdDuration(null, null), "—");

assert.equal(canOpenCustodyDesk("admin"), true);
assert.equal(canOpenCustodyDesk("owner"), true);
assert.equal(canOpenCustodyDesk("sales_staff"), false);
assert.equal(canOpenCustodyDesk("manager"), true);

assert.equal(
  canSeeCustodyPacket({ role: "sales_staff", userId: "a", branchId: null, packetBranchId: "b", involvedProfileIds: ["a"] }),
  true
);
assert.equal(
  canSeeCustodyPacket({ role: "sales_staff", userId: "a", branchId: null, packetBranchId: "b", involvedProfileIds: ["z"] }),
  false
);
assert.equal(
  canSeeCustodyPacket({ role: "manager", userId: "m", branchId: "br1", packetBranchId: "br1", involvedProfileIds: [] }),
  true
);
assert.equal(
  canSeeCustodyPacket({ role: "manager", userId: "m", branchId: "br1", packetBranchId: "br2", involvedProfileIds: [] }),
  false
);
assert.equal(
  canSeeCustodyPacket({ role: "admin", userId: "a", branchId: null, packetBranchId: "br2", involvedProfileIds: [] }),
  true
);

assert.equal(parseSlipCopy(undefined), "both");
assert.equal(parseSlipCopy("staff"), "staff");
assert.equal(parseSlipCopy("nope"), "both");
assert.match(kindLabel("wasoli"), /wasoli/);
assert.match(
  timelinePhrase({ holderName: "Ali", kind: "pos_close", startedAt: opened, endedAt: new Date(Date.parse(opened) + 2 * 3600000).toISOString() }),
  /Ali ne 2 ghante rakha/
);

const handover = readFileSync("src/actions/cash-handover.ts", "utf8");
const receive = handover.slice(handover.indexOf("export async function receiveCash"));
assert.match(receive, /canRecordHandoverReceipt/);
assert.match(receive, /Bhejne wala khud wusool nahi likh sakta/);
assert.doesNotMatch(receive, /custody_packet/);

const custodyAction = readFileSync("src/actions/cash-custody-chain.ts", "utf8");
assert.match(custodyAction, /packet\.status !== "with_holder"/);
assert.doesNotMatch(custodyAction, /receiveCash/);

const pos = readFileSync("src/actions/pos-collection.ts", "utf8");
assert.match(pos, /submitted_by === user\.id/);
assert.match(pos, /submitted_by: user\.id/);

const shiftBar = readFileSync("src/components/pos/shift-bar.tsx", "utf8");
assert.match(shiftBar, /CustodySlipLinks/);
assert.match(shiftBar, /copy=both/);

const sql = readFileSync("supabase/migrations/717_pos_cash_custody_chain.sql", "utf8");
assert.match(sql, /interval '1 day'/);
assert.match(sql, /fn_cash_custody_overdue_notify/);
assert.match(sql, /'CS-' \|\| v_year::text \|\| '-' \|\| v_num/);
assert.match(sql, /'CD-' \|\| v_year::text \|\| '-' \|\| v_num/);
assert.match(sql, /role::text in \('admin', 'super_admin', 'owner'\)/);
assert.doesNotMatch(sql, /yasir|2030/i);
assert.doesNotMatch(sql, /receiveCash/);

assert.deepEqual(needsCue("with_sales", false), { stage: "pos_close", action: "ask_why", tone: "rose" });
assert.deepEqual(needsCue("in_transit", true), { stage: "pos_close", action: "ask_why", tone: "rose" });
assert.deepEqual(needsCue("with_holder", false), { stage: "manager_held", action: "ask_why", tone: "amber" });
assert.deepEqual(needsCue("with_holder", true), { stage: "manager_held", action: "admin_alert", tone: "amber" });
assert.deepEqual(needsCue("deposit_pending", false), { stage: "verify", action: "approve", tone: "green" });

assert.equal(showAskWhy("admin", "ask_why", "a", "b"), true);
assert.equal(showAskWhy("admin", "ask_why", "a", "a"), false);
assert.equal(showAskWhy("manager", "ask_why", "m", "b"), false);
assert.equal(showAskWhy("owner", "admin_alert", "a", "b"), false);
assert.equal(showApprove({ role: "finance", action: "approve", viewerId: "f", originId: "s", holderId: "m", depositId: "d", makerIds: ["s"] }), true);
assert.equal(showApprove({ role: "finance", action: "approve", viewerId: "s", originId: "s", holderId: "m", depositId: "d", makerIds: [] }), false);
assert.equal(showApprove({ role: "manager", action: "approve", viewerId: "m", originId: "s", holderId: "h", depositId: "d", makerIds: [] }), false);
assert.equal(showApprove({ role: "admin", action: "approve", viewerId: "a", originId: "s", holderId: "h", depositId: null, makerIds: [] }), false);
assert.equal(canApproveCustodyJama("owner"), true);
assert.equal(canApproveCustodyJama("sales_staff"), false);

assert.equal(holdShort(opened, new Date(Date.parse(opened) + 18 * 3600000).toISOString()), "18h");
assert.equal(holdShort(opened, new Date(Date.parse(opened) + 3 * day).toISOString()), "3d");
assert.equal(rsCompact(240000), "Rs 2.4L");
assert.equal(rsCompact(45000), "Rs 45,000");
assert.equal(rsCompact(Number.NaN), "—");

const noonPkt = new Date("2026-05-24T07:00:00.000Z");
assert.equal(pktDayStart(noonPkt), "2026-05-23T19:00:00.000Z");
assert.equal(pktDayStart(new Date("2026-05-23T18:30:00.000Z")), "2026-05-22T19:00:00.000Z");

const kpis = kpisFromOpen(
  [
    { status: "with_sales", openedAt: opened, verifiedAt: null },
    { status: "with_holder", openedAt: opened, verifiedAt: null },
    { status: "deposit_pending", openedAt: new Date(Date.parse(opened) + 2 * 3600000).toISOString(), verifiedAt: null },
  ],
  240000,
  Date.parse(opened) + day + 1
);
assert.equal(kpis.aajJama, 240000);
assert.equal(kpis.stuck, 2);
assert.equal(kpis.managerPaas, 1);
assert.equal(kpis.verifyPending, 1);
assert.equal(kpisUnread().stuck, null);

assert.equal(
  cardTrail([
    { kind: "pos_close", holderName: "Ali", fromName: null, toName: null, startedAt: opened, endedAt: new Date(Date.parse(opened) + 2 * 3600000).toISOString() },
    { kind: "staff_copy_confirmed", holderName: "Ali", fromName: null, toName: null, startedAt: opened, endedAt: null },
  ]),
  "Ali · 2 ghante"
);

const ranked = sortNeeds([
  { id: "new", overdue: false, opened_at: "2026-10-27T00:00:00.000Z" },
  { id: "old", overdue: true, opened_at: "2026-10-20T00:00:00.000Z" },
  { id: "mid", overdue: true, opened_at: "2026-10-25T00:00:00.000Z" },
]);
assert.deepEqual(ranked.map((r) => r.id), ["old", "mid", "new"]);

assert.match(custodyAction, /askCustodyWhy/);
assert.match(custodyAction, /approveCustodyJama/);
assert.match(custodyAction, /verifyCollectionDeposit/);
assert.match(custodyAction, /CUSTODY_ASK_PREFIX/);
assert.match(custodyAction, /Apni jama karayi hui deposit khud tasdeeq nahi kar sakte/);
assert.doesNotMatch(readFileSync("src/app/admin/cash-custody/page.tsx", "utf8"), /fuel|payroll|petty/i);

const help = readFileSync("supabase/migrations/720_cash_needs_you_help.sql", "utf8");
assert.match(help, /Cash custody/);
assert.match(help, /Ask why/);
assert.doesNotMatch(help, /create table/i);
assert.doesNotMatch(help, /yasir|2030/i);
assert.match(readFileSync("supabase/migrations/720_cash_needs_you_help.rollback.sql", "utf8"), /Kis ke paas Cash/);

console.log("cash custody chain tests passed");
