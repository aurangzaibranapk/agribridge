/** Department login ki shaakh aur dukan. DB ke baghair. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CUSTOMER_PORTAL_ALL_CUSTOMERS,
  branchRequired,
  canEditLoginPlace,
  describePlaceChange,
  formatAuditChangeLines,
  keepsAllCustomerPortal,
  normalizePlaceId,
  placeCaption,
  resolvePlaceWrite,
  shopOptionLabel,
  shopsForBranch,
  validateLoginPlace,
  type PlaceBranch,
  type PlaceShop,
} from "../src/lib/access/login-place";

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n += 1;
  console.log("ok", name);
};

const branches: PlaceBranch[] = [
  { id: "mah", name: "Main Branch Mahabali", is_active: true },
  { id: "nb", name: "157 NB", is_active: true },
  { id: "old", name: "Purani shaakh", is_active: false },
];
const shops: PlaceShop[] = [
  { id: "dukan", name: "Kisaan Dukan Mahabali", branch_id: "mah", business_type: "agri_inputs", is_active: true },
  { id: "karyana", name: "Kisaan Karyana Mahabali", branch_id: "mah", business_type: "karyana", is_active: true },
  { id: "nbk", name: "157 Karyana", branch_id: "nb", business_type: "karyana", is_active: true },
  { id: "shut", name: "Band dukan", branch_id: "mah", business_type: "karyana", is_active: false },
];

const base = {
  beforeBranchId: "mah" as string | null,
  beforeShopId: "dukan" as string | null,
  branches,
  shops,
};

test("ids: blank is null", () => {
  assert.equal(normalizePlaceId("  "), null);
  assert.equal(normalizePlaceId(null), null);
  assert.equal(normalizePlaceId(" mah "), "mah");
});

test("only owner/admin edit, and only while active", () => {
  assert.equal(canEditLoginPlace("owner", true), true);
  assert.equal(canEditLoginPlace("admin", true), true);
  assert.equal(canEditLoginPlace("super_admin", true), true);
  assert.equal(canEditLoginPlace("owner", false), false);
  assert.equal(canEditLoginPlace("hr", true), false);
  assert.equal(canEditLoginPlace("finance", true), false);
  assert.equal(canEditLoginPlace("manager", true), false);
});

test("department login needs one branch; org-wide may sit without one", () => {
  for (const role of ["manager", "sales_staff", "hr", "procurement", "warehouse", "milk_collection", "finance", "admin_assistant"]) {
    assert.equal(branchRequired(role), true, role);
    const missing = validateLoginPlace({ ...base, role, branchId: null, shopId: null, beforeBranchId: null, beforeShopId: null });
    assert.equal(missing.ok, false);
  }
  const owner = validateLoginPlace({ ...base, role: "owner", branchId: null, shopId: null, beforeBranchId: null, beforeShopId: null });
  assert.deepEqual(owner, { ok: true, branchId: null, shopId: null });
});

test("shop must belong to the chosen branch and is optional", () => {
  const ok = validateLoginPlace({ ...base, role: "sales_staff", branchId: "mah", shopId: null });
  assert.equal(ok.ok, true);
  const foreign = validateLoginPlace({ ...base, role: "sales_staff", branchId: "mah", shopId: "nbk" });
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.match(foreign.error, /usi shaakh/);
  const same = validateLoginPlace({ ...base, role: "sales_staff", branchId: "nb", shopId: "nbk" });
  assert.equal(same.ok, true);
  const noBranch = validateLoginPlace({ ...base, role: "owner", branchId: null, shopId: "dukan", beforeBranchId: null, beforeShopId: null });
  assert.equal(noBranch.ok, false);
});

test("shops in the card are filtered by the selected branch", () => {
  assert.deepEqual(shopsForBranch(shops, "mah").map((shop) => shop.id), ["dukan", "karyana"]);
  assert.deepEqual(shopsForBranch(shops, "nb").map((shop) => shop.id), ["nbk"]);
  assert.deepEqual(shopsForBranch(shops, null), []);
  assert.deepEqual(shopsForBranch(shops, "mah", "shut").map((shop) => shop.id), ["dukan", "karyana", "shut"]);
});

test("two karyana shops stay distinct by name", () => {
  const a = shopOptionLabel(shops[1]);
  const b = shopOptionLabel(shops[2]);
  assert.equal(a, "Kisaan Karyana Mahabali (Karyana)");
  assert.equal(b, "157 Karyana (Karyana)");
  assert.notEqual(a, b);
  assert.equal(shopOptionLabel(shops[3]), "Band dukan (Karyana) (band)");
});

test("inactive branch or shop cannot be newly assigned; the current one can stay", () => {
  const ontoOld = validateLoginPlace({ ...base, role: "hr", branchId: "old", shopId: null });
  assert.equal(ontoOld.ok, false);
  const stay = validateLoginPlace({ ...base, role: "hr", branchId: "old", shopId: null, beforeBranchId: "old", beforeShopId: null });
  assert.equal(stay.ok, true);
  const ontoShut = validateLoginPlace({ ...base, role: "sales_staff", branchId: "mah", shopId: "shut" });
  assert.equal(ontoShut.ok, false);
  const keepShut = validateLoginPlace({ ...base, role: "sales_staff", branchId: "mah", shopId: "shut", beforeShopId: "shut" });
  assert.equal(keepShut.ok, true);
});

test("unknown ids are refused", () => {
  const branch = validateLoginPlace({ ...base, role: "manager", branchId: "nope", shopId: null });
  const shop = validateLoginPlace({ ...base, role: "manager", branchId: "mah", shopId: "nope" });
  assert.equal(branch.ok, false);
  assert.equal(shop.ok, false);
});

test("changing branch clears a shop from the other branch", () => {
  const moved = resolvePlaceWrite("branch", { branchId: "mah", shopId: "dukan" }, { branchId: "nb", shopId: null }, shops);
  assert.deepEqual(moved, { branchId: "nb", shopId: null });
  const kept = resolvePlaceWrite("branch", { branchId: "mah", shopId: "dukan" }, { branchId: "mah", shopId: null }, shops);
  assert.deepEqual(kept, { branchId: "mah", shopId: "dukan" });
  const cleared = resolvePlaceWrite("branch", { branchId: "mah", shopId: "dukan" }, { branchId: null, shopId: null }, shops);
  assert.deepEqual(cleared, { branchId: null, shopId: null });
  const shopOnly = resolvePlaceWrite("shop", { branchId: "mah", shopId: null }, { branchId: "nb", shopId: "karyana" }, shops);
  assert.deepEqual(shopOnly, { branchId: "mah", shopId: "karyana" });
});

test("audit names the old and new place, and skips a no-op", () => {
  const change = describePlaceChange({
    beforeBranchId: "mah",
    beforeShopId: "dukan",
    afterBranchId: "nb",
    afterShopId: "nbk",
    branches,
    shops,
  });
  assert.equal(change.changed, true);
  assert.deepEqual(change.changes.Shaakh, { pehle: "Main Branch Mahabali", ab: "157 NB" });
  assert.deepEqual(change.changes.Dukan, { pehle: "Kisaan Dukan Mahabali", ab: "157 Karyana" });
  assert.match(change.description, /Main Branch Mahabali → 157 NB/);
  assert.match(change.description, /Kisaan Dukan Mahabali → 157 Karyana/);
  const same = describePlaceChange({
    beforeBranchId: "mah",
    beforeShopId: null,
    afterBranchId: "mah",
    afterShopId: null,
    branches,
    shops,
  });
  assert.equal(same.changed, false);
  assert.deepEqual(same.changes, {});
  const cleared = describePlaceChange({
    beforeBranchId: "mah",
    beforeShopId: "dukan",
    afterBranchId: "mah",
    afterShopId: null,
    branches,
    shops,
  });
  assert.deepEqual(cleared.changes.Dukan, { pehle: "Kisaan Dukan Mahabali", ab: null });
  assert.deepEqual(formatAuditChangeLines(cleared.changes), ["Dukan: Kisaan Dukan Mahabali → (khali)"]);
  assert.deepEqual(formatAuditChangeLines(null), []);
});

test("missing place is not shown as a zero", () => {
  assert.deepEqual(placeCaption(branches, null), { tone: "none", text: null });
  assert.deepEqual(placeCaption(branches, "gone"), { tone: "missing", text: null });
  assert.deepEqual(placeCaption(branches, "mah"), { tone: "named", text: "Main Branch Mahabali" });
});

test("finance and admin assistant keep the all-customers portal", () => {
  assert.equal(keepsAllCustomerPortal("finance"), true);
  assert.equal(keepsAllCustomerPortal("admin_assistant"), true);
  assert.equal(keepsAllCustomerPortal("sales_staff"), false);
  assert.equal(branchRequired("finance"), true);
  assert.equal(branchRequired("admin_assistant"), true);
  const sql = readFileSync("supabase/migrations/572_customer_portal_read.sql", "utf8");
  const match = sql.match(/function public\.fn_cp_is_admin\(\)[\s\S]*?array\[([^\]]+)\]/);
  assert.ok(match);
  const roles = [...match[1].matchAll(/'([a-z_]+)'/g)].map((item) => item[1]);
  assert.deepEqual(roles, [...CUSTOMER_PORTAL_ALL_CUSTOMERS]);
  const commit = readFileSync("src/lib/access/commit-login-place.ts", "utf8");
  assert.doesNotMatch(commit, /fn_cp_|create or replace function|alter policy/i);
  assert.match(commit, /branch_id: verdict\.branchId/);
  assert.match(commit, /shop_id: verdict\.shopId/);
  assert.match(commit, /module: "user_place"/);
  assert.match(commit, /logAudit/);
  assert.match(commit, /canEditLoginPlace/);
});

test("screen writes both columns and does not revive the old dropdowns", () => {
  const page = readFileSync("src/app/admin/users/page.tsx", "utf8");
  const card = readFileSync("src/app/admin/users/user-place-card.tsx", "utf8");
  const action = readFileSync("src/actions/login-place.ts", "utf8");
  assert.match(page, /UserPlaceCard/);
  assert.match(page, /canEditLoginPlace/);
  assert.doesNotMatch(page, /BranchSelector|ShopSelector/);
  assert.match(card, /data-testid="user-place-branch"/);
  assert.match(card, /data-testid="user-place-shop"/);
  assert.match(card, /createPortal/);
  assert.match(card, /shopsForBranch/);
  assert.match(card, /keepsAllCustomerPortal/);
  assert.doesNotMatch(card, /Al Rana|الرانا/);
  assert.match(action, /policy: "both"/);
  const branchAction = readFileSync("src/actions/branches.ts", "utf8");
  const shopAction = readFileSync("src/actions/shops.ts", "utf8");
  assert.match(branchAction, /policy: "branch"/);
  assert.match(shopAction, /policy: "shop"/);
  const coach = readFileSync("src/lib/ai/work-coach.ts", "utf8");
  assert.match(coach, /profiles\.branch_id/);
  assert.match(coach, /profiles\.shop_id/);
  assert.match(coach, /572/);
  const logs = readFileSync("src/app/admin/activity-logs/page.tsx", "utf8");
  assert.match(logs, /formatAuditChangeLines/);
  assert.match(logs, /l\.description/);
});

console.log(`\n${n} tests passed`);
