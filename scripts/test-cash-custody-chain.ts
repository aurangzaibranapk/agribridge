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

console.log("cash custody chain tests passed");
