import assert from "node:assert/strict";
import { unwrapWebsiteSetting, cmsWriteAllowed, addressNeedsOwner, SHOP_PHONE_E164, SHOP_PHONE_WHATSAPP } from "../src/lib/cms/website-setting";
import { ownerAccountChangeBlocked, makerCheckerBlock } from "../src/lib/hr/owner-guard";
import { payrollPayDecision } from "../src/lib/payroll/pay-once";
import { batchDeductPlan, batchIsSellable, canCancelTransfer, todayPkt } from "../src/lib/inventory/batch-guard";
import { grainAmountFromRate, grainRatePresentation } from "../src/lib/grain/rate-unit";
import { grainSaleWithinBought } from "../src/lib/grain/sold-vs-bought";
import { statementPartyVisible } from "../src/lib/statements/branch-scope";

const triple = JSON.stringify(JSON.stringify(JSON.stringify("Al Rana Traders — AgriBridge")));
assert.equal(unwrapWebsiteSetting(triple), "Al Rana Traders — AgriBridge");
assert.equal(unwrapWebsiteSetting('"Pakistan"'), "Pakistan");
assert.equal(unwrapWebsiteSetting("0312-6513294"), "0312-6513294");
assert.equal(SHOP_PHONE_E164, "+923126513294");
assert.equal(SHOP_PHONE_WHATSAPP, "923126513294");
assert.equal(cmsWriteAllowed("sales_staff"), false);
assert.equal(cmsWriteAllowed("admin"), true);
assert.equal(cmsWriteAllowed("owner", false), false);
assert.equal(addressNeedsOwner("Pakistan"), true);
assert.equal(addressNeedsOwner(""), true);
assert.equal(addressNeedsOwner("Chak Mahabali, Dakkhana Shah Nikdar"), false);

assert.equal(ownerAccountChangeBlocked("owner"), "Owner account suspend, band ya delete nahi ho sakta.");
assert.equal(ownerAccountChangeBlocked("admin"), null);
assert.ok(makerCheckerBlock("a", "a"));
assert.equal(makerCheckerBlock("a", "b"), null);

assert.equal(payrollPayDecision({ status: "paid", createdBy: "m", actorId: "a", payJournalId: "j", payLock: null, payLockAt: null }), "already_paid");
assert.equal(payrollPayDecision({ status: "approved", createdBy: "a", actorId: "a", payJournalId: null, payLock: null, payLockAt: null }), "maker");
assert.equal(payrollPayDecision({ status: "approved", createdBy: "m", actorId: "a", payJournalId: null, payLock: "x", payLockAt: new Date().toISOString(), nowMs: Date.now() }), "busy");
assert.equal(payrollPayDecision({ status: "approved", createdBy: "m", actorId: "a", payJournalId: null, payLock: null, payLockAt: null }), "claimed");

assert.equal(batchDeductPlan(10, 10, 3).ok && (batchDeductPlan(10, 10, 3) as { next: number }).next, 7);
assert.equal(batchDeductPlan(12, 10, 1).ok, false);
assert.equal(batchDeductPlan(4, 10, 5).ok, false);
assert.equal(batchIsSellable("2020-01-01", "2026-10-20"), false);
assert.equal(batchIsSellable("2026-10-20", "2026-10-20"), true);
assert.equal(batchIsSellable(null, "2026-10-20"), true);
assert.equal(canCancelTransfer("completed"), false);
assert.equal(canCancelTransfer("in_transit"), true);
assert.match(todayPkt(new Date("2026-10-20T20:30:00Z")), /^2026-10-21$/);

assert.equal(grainAmountFromRate(80, 4000, "per_maund"), 8000);
assert.equal(grainAmountFromRate(80, 100, "per_kg"), 8000);
assert.equal(grainRatePresentation(4000, "per_maund").perKg, 100);
assert.equal(grainRatePresentation(4000, "legacy_as_stored").legacy, true);
assert.equal(grainRatePresentation(100, "per_kg").perMaund, 4000);

assert.equal(grainSaleWithinBought(40530, 45905, 1).ok, false);
assert.equal(grainSaleWithinBought(100, 40, 60).ok, true);
assert.equal(grainSaleWithinBought(100, 40, 61).ok, false);

assert.equal(statementPartyVisible({ role: "sales_staff", callerBranchId: "b1", partyBranchId: "b2" }), false);
assert.equal(statementPartyVisible({ role: "sales_staff", callerBranchId: "b1", partyBranchId: "b1" }), true);
assert.equal(statementPartyVisible({ role: "admin", callerBranchId: null, partyBranchId: "b2" }), true);
assert.equal(statementPartyVisible({ role: "owner", callerBranchId: null, partyBranchId: null }), true);
assert.equal(statementPartyVisible({ role: "warehouse", callerBranchId: "b1", partyBranchId: null }), false);

console.log("dept-review 660 lib: theek");
