/** Kharchon ki report: filter, jor, safha, CSV. npm run test:expense-report */
import assert from "node:assert/strict";
import {
  ASAL_KIND_VALUES,
  BANK_UNTRACKED,
  FETCH_CAP,
  MISSING,
  PAGE_SIZE,
  SHOP_UNTRACKED,
  amountShare,
  applyExpenseFilters,
  categoryChoices,
  expenseCsv,
  expenseExportPath,
  expenseQueryPlan,
  expenseReportPath,
  groupExpenses,
  mapExpenseRow,
  paginateLines,
  parseExpenseFilters,
  readAmount,
  resolveReportScope,
  summarizeExpenses,
  type ExpenseFilterChain,
  type ExpenseLine,
  type RawExpense,
} from "../src/lib/reports/expense-report";

let n = 0;
function test(name: string, fn: () => void) {
  fn();
  n += 1;
  console.log(`ok  ${name}`);
}

const names = {
  shops: new Map([
    ["milk", "Kisaan Milk Center"],
    ["kryana", "Kisaan Kryana 157 NB"],
  ]),
  branches: new Map([["br", "Head Office"]]),
  banks: new Map([["bank", "HBL"]]),
};

function raw(partial: Partial<RawExpense> & { id: string }): ExpenseLine {
  return mapExpenseRow(
    {
      expense_number: `EXP-${partial.id}`,
      kind: "kharcha",
      category: "fuel",
      amount: 100,
      description: "",
      status: "pending",
      expense_date: "2026-10-15",
      shop_id: "milk",
      branch_id: "br",
      paid_from_account_id: "bank",
      party_name: "Baba",
      ...partial,
    },
    names,
  );
}

test("default is this year, real expenses, page 1", () => {
  const f = parseExpenseFilters(undefined, "2026-10-30");
  assert.equal(f.from, "2026-01-01");
  assert.equal(f.to, "2026-10-30");
  assert.equal(f.kind, "asal");
  assert.equal(f.page, 1);
  assert.equal(f.status, "");
});

test("bad status and kind fall back, dates swap, missing shop stays", () => {
  const f = parseExpenseFilters(
    { from: "2026-10-20", to: "2026-10-01", status: "posted", kind: "nope", shop: MISSING, branch: "not-a-uuid", page: "3" },
    "2026-10-30",
  );
  assert.equal(f.from, "2026-10-01");
  assert.equal(f.to, "2026-10-20");
  assert.equal(f.status, "");
  assert.equal(f.kind, "asal");
  assert.equal(f.shopId, MISSING);
  assert.equal(f.branchId, "");
  assert.equal(f.page, 3);
});

test("manager is locked to their branch and cannot ask for another", () => {
  const open = parseExpenseFilters({ branch: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", shop: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, "2026-10-30");
  const scoped = resolveReportScope(open, {
    unrestricted: false,
    scope: "own_branch",
    branchId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    shopId: null,
  });
  assert.equal(scoped.ok, true);
  if (!scoped.ok) return;
  assert.equal(scoped.lockBranch, true);
  assert.equal(scoped.filters.branchId, "cccccccc-cccc-cccc-cccc-cccccccccccc");
  assert.equal(scoped.filters.shopId, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
});

test("manager with no branch does not see a fake empty company", () => {
  const scoped = resolveReportScope(parseExpenseFilters(undefined, "2026-10-30"), {
    unrestricted: false,
    scope: "own_branch",
    branchId: null,
    shopId: null,
  });
  assert.deepEqual(scoped, { ok: false, reason: "no_branch" });
});

test("owner keeps the requested shop", () => {
  const id = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const scoped = resolveReportScope(parseExpenseFilters({ shop: id }, "2026-10-30"), {
    unrestricted: true,
    scope: "all",
    branchId: null,
    shopId: null,
  });
  assert.equal(scoped.ok, true);
  if (!scoped.ok) return;
  assert.equal(scoped.filters.shopId, id);
  assert.equal(scoped.lockShop, false);
});

test("query plan: asal kinds, missing shop, status, date or", () => {
  const plan = expenseQueryPlan(
    parseExpenseFilters({ shop: MISSING, status: "pending", kind: "asal", bank: MISSING }, "2026-10-30"),
  );
  assert.deepEqual(plan.kinds, [...ASAL_KIND_VALUES]);
  assert.equal(plan.shop.mode, "none");
  assert.equal(plan.bank.mode, "none");
  assert.equal(plan.status, "pending");
  assert.match(plan.dateOr, /expense_date\.gte\.2026-01-01/);
  assert.match(plan.dateOr, /expense_date\.is\.null,created_at\.gte\."2026-01-01T00:00:00"/);
  assert.ok(ASAL_KIND_VALUES.includes("kharcha"));
  assert.equal(ASAL_KIND_VALUES.includes("supplier_ko_diya"), false);
});

test("filter chain records shop, status and kinds", () => {
  const calls: string[] = [];
  const q: ExpenseFilterChain = {
    eq(column, value) {
      calls.push(`eq:${column}=${value}`);
      return q;
    },
    in(column, values) {
      calls.push(`in:${column}=${values.join("|")}`);
      return q;
    },
    is(column) {
      calls.push(`is:${column}`);
      return q;
    },
    or(filters) {
      calls.push(`or:${filters}`);
      return q;
    },
  };
  const filters = parseExpenseFilters({ status: "approved", kind: "kharcha", shop: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" }, "2026-10-30");
  applyExpenseFilters(q, expenseQueryPlan(filters));
  assert.equal(calls[0]?.startsWith("or:"), true);
  assert.ok(calls.some((c) => c === "eq:status=approved"));
  assert.ok(calls.some((c) => c === "in:kind=kharcha"));
  assert.ok(calls.some((c) => c.startsWith("eq:shop_id=")));
});

test("two shops plus an unrecorded shop do not collapse, and the sum matches", () => {
  const lines = [
    raw({ id: "1", shop_id: "milk", amount: 1000, status: "pending" }),
    raw({ id: "2", shop_id: "kryana", amount: 2500, status: "approved", category: "rent" }),
    raw({ id: "3", shop_id: null, amount: 400, status: "pending", paid_from_account_id: null }),
    raw({ id: "4", kind: "supplier_ko_diya", amount: 9000, shop_id: "milk" }),
  ];
  const expenses = lines.filter((line) => line.asalKharcha);
  assert.equal(expenses.length, 3);
  const byShop = groupExpenses(expenses, "shop");
  assert.deepEqual(
    byShop.map((row) => [row.label, row.amount, row.recorded]),
    [
      ["Kisaan Kryana 157 NB", 2500, true],
      ["Kisaan Milk Center", 1000, true],
      [SHOP_UNTRACKED, 400, false],
    ],
  );
  const summary = summarizeExpenses(expenses);
  assert.equal(summary.amount, 3900);
  assert.equal(summary.gap, 0);
  assert.equal(byShop.reduce((sum, row) => sum + row.amount, 0), summary.amount);
  const byBank = groupExpenses(expenses, "bank");
  assert.equal(byBank.find((row) => row.key === "untracked")?.label, BANK_UNTRACKED);
  assert.equal(byBank.find((row) => row.key === "untracked")?.amount, 400);
  const pending = groupExpenses(expenses.filter((line) => line.status === "pending"), "status");
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.amount, 1400);
});

test("missing amount is a gap, not zero, and a zero total has no share", () => {
  const line = raw({ id: "x", amount: null });
  assert.equal(line.amount, null);
  const summary = summarizeExpenses([line]);
  assert.equal(summary.amount, 0);
  assert.equal(summary.gap, 1);
  assert.equal(amountShare(0, 0), null);
  assert.equal(readAmount("1,250.50"), 1250.5);
  assert.equal(readAmount("nope"), null);
});

test("name lookup failure is not the same as an unrecorded shop", () => {
  const line = mapExpenseRow({ id: "z", shop_id: "gone", amount: 50, kind: "kharcha", category: "fuel", status: "approved", expense_date: "2026-10-02" }, names);
  assert.equal(line.shopRecorded, true);
  assert.equal(line.shopName, null);
  const [row] = groupExpenses([line], "shop");
  assert.equal(row?.label, "naam nahi mila");
  assert.equal(row?.recorded, true);
});

test("pagination is 50, not a 200 hard cap", () => {
  const lines = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => raw({ id: String(i + 1), amount: 1 }));
  const page = paginateLines(lines, 2);
  assert.equal(page.pages, 2);
  assert.equal(page.slice.length, 1);
  assert.ok(FETCH_CAP > 200);
  const clamped = paginateLines(lines, 99);
  assert.equal(clamped.page, 2);
});

test("csv has both shops, the unrecorded label, and an escaped comma", () => {
  const lines = [
    raw({ id: "1", description: 'chai, "extra"' }),
    raw({ id: "2", shop_id: "kryana", amount: 2500 }),
    raw({ id: "3", shop_id: null, amount: 400 }),
  ];
  const csv = expenseCsv(lines);
  assert.ok(csv.charCodeAt(0) === 0xfeff);
  assert.match(csv, /Kisaan Milk Center/);
  assert.match(csv, /Kisaan Kryana 157 NB/);
  assert.match(csv, /dukan likhi nahi/);
  assert.match(csv, /"chai, ""extra"""/);
  assert.match(csv, /Dukan\r\nNaam,Qatarein,Raqam/);
  assert.equal(/wasila|wasela/i.test(csv), false);
  const href = expenseExportPath(parseExpenseFilters({ status: "pending", page: "4" }, "2026-10-30"));
  assert.equal(href.startsWith("/admin/reports/expenses/export?"), true);
  assert.equal(href.includes("page="), false);
  assert.match(expenseReportPath(parseExpenseFilters({ status: "pending" }, "2026-10-30"), { page: 2 }), /page=2/);
});

test("custom category stays beside the fixed list", () => {
  const choices = categoryChoices(["fuel", "spray wala"]);
  assert.ok(choices.some((c) => c.value === "fuel"));
  assert.ok(choices.some((c) => c.value === "spray wala"));
  assert.equal(choices.filter((c) => c.value === "fuel").length, 1);
});

console.log(`expense-report: ${n}/${n} pass`);
