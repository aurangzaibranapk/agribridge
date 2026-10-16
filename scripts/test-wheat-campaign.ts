/** Gandum Season 2026 campaign + signup pure tests.  npm run test:campaign */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCnic, formatCnic, isCampaignOpen, validateBooking, aggregateCampaignDemand, isMilkSupplier, signupDecision } from "../src/lib/campaigns/booking";

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`ok  ${name}`); }

test("CNIC normalize/format", () => {
  assert.equal(normalizeCnic("35202-1234567-1"), "3520212345671");
  assert.equal(normalizeCnic("3520212345671"), "3520212345671");
  assert.equal(normalizeCnic("35202-123"), null);
  assert.equal(formatCnic("3520212345671"), "35202-1234567-1");
});
test("deadline 20 Oct open till 23:59 PKT", () => {
  const c = { deadline: "2026-10-20", is_active: true };
  assert.equal(isCampaignOpen(c, new Date("2026-10-20T18:59:00Z")), true);
  assert.equal(isCampaignOpen(c, new Date("2026-10-20T19:01:00Z")), false);
  assert.equal(isCampaignOpen({ ...c, is_active: false }, new Date("2026-10-16T00:00:00Z")), false);
});
test("booking validation", () => {
  const cat = new Set(["p1", "p2"]);
  assert.equal(validateBooking({ acres: 0, lines: [] }, cat).ok, false);
  assert.equal(validateBooking({ acres: 5, lines: [] }, cat).ok, false);
  assert.equal(validateBooking({ acres: 5, lines: [{ kind: "seed", productId: "zz", quantity: 2 }] }, cat).ok, false);
  assert.equal(validateBooking({ acres: 5, lines: [{ kind: "seed", productId: "p1", quantity: -1 }] }, cat).ok, false);
  assert.equal(validateBooking({ acres: 5, lines: [{ kind: "x", productId: "p1", quantity: 1 }] }, cat).ok, false);
  const v = validateBooking({ acres: "12.5", notes: "  jaldi  ", lines: [
    { kind: "seed", productId: "p1", quantity: 2, unit: "bag" },
    { kind: "seed", productId: "p1", quantity: "3", unit: "bag" },
    { kind: "fertilizer", productId: "", quantity: "" },
    { kind: "pesticide", productId: "p2", quantity: 1, unit: "litre" },
  ] }, cat);
  assert.ok(v.ok);
  if (v.ok) {
    assert.equal(v.acres, 12.5);
    assert.equal(v.notes, "jaldi");
    assert.equal(v.lines.length, 2);
    assert.equal(v.lines[0].quantity, 5);
  }
});
test("campaign aggregate per product, excludes rejected/cancelled", () => {
  const t = aggregateCampaignDemand([
    { product_id: "dap", product_name: "DAP", unit: "bag", quantity: 2, farmer_id: "a", status: "pending" },
    { product_id: "dap", product_name: "DAP", unit: "bag", quantity: 3, farmer_id: "b", status: "approved" },
    { product_id: "dap", product_name: "DAP", unit: "bag", quantity: 1, farmer_id: "a", status: "pending" },
    { product_id: "dap", product_name: "DAP", unit: "bag", quantity: 9, farmer_id: "c", status: "cancelled" },
    { product_id: "urea", product_name: "Urea", unit: "bag", quantity: 4, farmer_id: "c", status: "rejected" },
    { product_id: "seed", product_name: "Akbar-19", unit: "bag", quantity: 1, farmer_id: "a", status: "pending" },
  ]);
  assert.deepEqual(t.map((x) => [x.productName, x.totalQuantity, x.farmerCount]), [["DAP", 6, 2], ["Akbar-19", 1, 1]]);
});
test("milk supplier flag", () => {
  const today = new Date("2026-10-16T00:00:00Z");
  assert.equal(isMilkSupplier({ milk_financing_enabled: true }, today), true);
  assert.equal(isMilkSupplier({ last_milk_entry_date: "2026-10-01" }, today), true);
  assert.equal(isMilkSupplier({ last_milk_entry_date: "2026-01-01" }, today), false);
  assert.equal(isMilkSupplier({}, today), false);
});
test("signup dedupe by CNIC or phone", () => {
  assert.deepEqual(signupDecision(null, null), { kind: "new" });
  assert.deepEqual(signupDecision({ id: "a" }, null), { kind: "existing", farmerId: "a" });
  assert.deepEqual(signupDecision(null, { id: "b" }), { kind: "existing", farmerId: "b" });
  assert.deepEqual(signupDecision({ id: "a" }, { id: "a" }), { kind: "existing", farmerId: "a" });
  assert.deepEqual(signupDecision({ id: "a" }, { id: "b" }), { kind: "conflict" });
});
test("OTP code never logged or returned; migration additive only", () => {
  for (const f of ["src/actions/farmer-signup.ts", "src/lib/farmers/otp.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/console\.(log|info|warn|error)\([^)]*\bcode\b/.test(src), `${f} logs code`);
  }
  assert.ok(!/code\s*[,}]/.test(readFileSync("src/actions/farmer-signup.ts", "utf8").match(/return \{[^}]*\}/g)!.join("\n")), "OTP code in a return value");
  const sql = readFileSync("supabase/migrations/535_wheat_season_campaign.sql", "utf8").replace(/--.*$/gm, "").toLowerCase();
  assert.ok(!/\bdrop\s+(table|column)\b|\balter\s+column\b|\bdelete\s+from\b|\btruncate\b|\bupdate\s+public\./.test(sql), "non-additive SQL");
});
console.log(`\n${n} tests passed`);
