import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DECISION_COMMENT_MAX,
  DECISION_COMMENT_MIN,
  approvalHeadline,
  cardRupees,
  countFromContentRange,
  filterInbox,
  litreLabel,
  milkSteps,
  planLeaveDecision,
  planMilkDecision,
  planPurchaseDecision,
  roleTitle,
  type InboxItem,
} from "../src/lib/mobile/admin-desk";
import { ROLE_NAV } from "../src/lib/mobile/nav";

const milkSrc = readFileSync("src/lib/milk-collection.ts", "utf8");
assert.match(milkSrc, /VERIFY_COMMENT_MIN = 5/);
assert.match(milkSrc, /VERIFY_COMMENT_MAX = 255/);
assert.equal(DECISION_COMMENT_MIN, 5);
assert.equal(DECISION_COMMENT_MAX, 255);

assert.equal(cardRupees(120000), "Rs 1.2L");
assert.equal(cardRupees(840), "Rs 840");
assert.equal(cardRupees(null), "—");
assert.equal(litreLabel(5.5), "5.5 L");
assert.equal(litreLabel(840), "840 L");
assert.equal(countFromContentRange("0-0/99"), 99);
assert.equal(countFromContentRange("*/0"), 0);
assert.equal(countFromContentRange(null), null);
assert.equal(roleTitle("super_admin"), "Super Admin");

assert.deepEqual(ROLE_NAV.admin.tabs.map((tab) => tab.label), ["Home", "Work", "Approvals", "HR", "Profile"]);

const now = Date.parse("2026-05-10T12:00:00+05:00");
const item = (partial: Partial<InboxItem>): InboxItem => ({
  category: "milk_verify",
  groupKey: "milk",
  itemId: "11111111-1111-1111-1111-111111111111",
  ref: null,
  title: "Rajesh Dairy Farm",
  amount: 2175,
  createdAt: "2026-05-10T10:00:00+05:00",
  enteredBy: "22222222-2222-2222-2222-222222222222",
  enteredByName: "MCA",
  actorName: null,
  pendingWith: "milk_verifier",
  isOwn: false,
  ...partial,
});

const rows = [
  item({}),
  item({ category: "purchases", title: "Shreeji Feeds", itemId: "33333333-3333-3333-3333-333333333333", createdAt: "2026-05-10T09:00:00+05:00" }),
  item({ category: "leave", title: "casual", enteredByName: "Amit Kumar", amount: null, itemId: "44444444-4444-4444-4444-444444444444", isOwn: true, createdAt: "2026-05-10T07:00:00+05:00" }),
];
assert.equal(approvalHeadline(rows[2]), "Amit Kumar");
assert.deepEqual(filterInbox(rows, "doodh", false).map((row) => row.title), ["Rajesh Dairy Farm"]);
assert.equal(filterInbox(rows, "all", true).some((row) => row.isOwn), false);
assert.equal(filterInbox(rows, "leave", false)[0].enteredByName, "Amit Kumar");
void now;

const priced = milkSteps({
  status: "priced",
  collectedAt: "2025-05-10T03:15:00Z",
  fatAt: "2025-05-10T03:45:00Z",
  verifiedAt: null,
  requestedBy: "Rajesh",
  checkedBy: "MCO",
  decidedBy: null,
});
assert.deepEqual(priced.map((step) => step.state), ["done", "done", "current", "wait"]);
assert.equal(priced[0].title, "Entry hui");
assert.equal(priced[2].title, "Manzoor hui");
assert.match(priced[0].detail, /Rajesh/);
assert.match(priced[1].detail, /MCO/);
assert.equal(priced[2].detail, "Pending approval");
assert.match(priced[3].detail, /Next/);

const actor = { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", role: "admin" };
const milkId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const short = planMilkDecision({
  readOnly: false,
  actor,
  row: { id: milkId, status: "priced", createdBy: actor.id, mcaProfileId: null },
  decision: "approve",
  comment: "ok",
  nowIso: "2026-05-10T08:00:00.000Z",
});
assert.equal(short.ok, false);
const ownAdmin = planMilkDecision({
  readOnly: false,
  actor,
  row: { id: milkId, status: "priced", createdBy: actor.id, mcaProfileId: null },
  decision: "approve",
  comment: "Rate theek hai",
  nowIso: "2026-05-10T08:00:00.000Z",
});
assert.equal(ownAdmin.ok, true);
if (ownAdmin.ok) assert.equal(ownAdmin.patch.status, "verified");
const managerOwn = planMilkDecision({
  readOnly: false,
  actor: { ...actor, role: "manager" },
  row: { id: milkId, status: "priced", createdBy: actor.id, mcaProfileId: null },
  decision: "approve",
  comment: "Rate theek hai",
  nowIso: "2026-05-10T08:00:00.000Z",
});
assert.equal(managerOwn.ok, false);
const notPriced = planMilkDecision({
  readOnly: false,
  actor,
  row: { id: milkId, status: "pending_fat", createdBy: "cccccccc-cccc-cccc-cccc-cccccccccccc", mcaProfileId: null },
  decision: "approve",
  comment: "Rate theek hai",
  nowIso: "2026-05-10T08:00:00.000Z",
});
assert.equal(notPriced.ok, false);

const ownLeave = planLeaveDecision({
  readOnly: false,
  actor,
  row: { id: milkId, profileId: actor.id, status: "pending" },
  decision: "approve",
  comment: "Theek hai ji",
  nowIso: "2026-05-10T08:00:00.000Z",
});
assert.equal(ownLeave.ok, false);
const leave = planLeaveDecision({
  readOnly: false,
  actor,
  row: { id: milkId, profileId: "cccccccc-cccc-cccc-cccc-cccccccccccc", status: "pending" },
  decision: "reject",
  comment: "Staff kam hai",
  nowIso: "2026-05-10T08:00:00.000Z",
});
assert.equal(leave.ok, true);
if (leave.ok && leave.kind === "leave") assert.equal(leave.patch.status, "rejected");

const held = planPurchaseDecision({
  readOnly: false,
  actor,
  row: {
    id: milkId,
    reviewStatus: "verified",
    status: "pending",
    createdBy: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    verifiedBy: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    creatorRole: "manager",
    held: { amount: 500, posted: false },
  },
  decision: "approve",
  comment: "Bill theek hai",
  nowIso: "2026-05-10T08:00:00.000Z",
});
assert.equal(held.ok, false);
const purchase = planPurchaseDecision({
  readOnly: false,
  actor,
  row: {
    id: milkId,
    reviewStatus: "verified",
    status: "pending",
    createdBy: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    verifiedBy: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    creatorRole: "manager",
    held: null,
  },
  decision: "approve",
  comment: "Bill theek hai",
  nowIso: "2026-05-10T08:00:00.000Z",
});
assert.equal(purchase.ok, true);
if (purchase.ok && purchase.kind === "purchase") {
  assert.equal(purchase.patch.review_status, "approved");
  assert.equal(purchase.comment.body, "Bill theek hai");
}

const screen = readFileSync("apps/mobile/src/roles/admin-ui.tsx", "utf8");
for (const line of ["Today overview", "Pending Approvals", "Check baqi", "Same record as ERP website", "Kisan Pakistan", "Approve", "Reject"]) {
  assert.ok(screen.includes(line), line);
}
const desk = readFileSync("src/lib/mobile/admin-desk.ts", "utf8");
assert.ok(desk.includes("Manzoor hui"));
assert.ok(desk.includes("Khata mein post"));

console.log("mobile admin desk ok");
