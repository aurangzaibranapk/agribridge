/**
 * Dairy Hisaab (Phase 3b) -- P&L, kharcha/aamdani validation, admin export aur wiring ke tests.
 * Chalayein: npm run test:portal-dairy-pl   (574-578 ka asal SQL test: tests/portal-dairy-pl-sql.mjs)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  adminCsv, adminFilter, addMonths, avgCostPerLitre, costPerLitre, withMilk, categoryShares, changePct, csvCell, fitSize, grandTotal, parseAdminRows, parsePnl, photoOk, photoPath,
  resolvePeriod, sumPnl, validateExpense, validateIncome, PHOTO_MAX_BYTES,
} from "../src/lib/portal/dairy-pl";
import { portalDairyPlDict } from "../src/lib/i18n/dict/portal-dairy-pl";
import { portalDairyDict } from "../src/lib/i18n/dict/portal-dairy";

let passed = 0;
const test = (n: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${n}`); };
const AS = "2026-10-17";
const fd = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });

test("periods", () => {
  assert.deepEqual(resolvePeriod({}, AS), { key: "month", from: "2026-10-01", to: AS });
  assert.deepEqual(resolvePeriod({ p: "last" }, AS), { key: "last", from: "2026-09-01", to: "2026-09-30" });
  assert.equal(resolvePeriod({ p: "year" }, AS).from, "2026-01-01");
  assert.equal(resolvePeriod({ p: "3m" }, AS).from, "2026-08-01");
  assert.equal(resolvePeriod({ p: "week" }, AS).to, AS);
  assert.deepEqual(resolvePeriod({ p: "custom", from: "2026-10-05", to: "2026-10-10" }, AS), { key: "custom", from: "2026-10-05", to: "2026-10-10" });
  assert.equal(resolvePeriod({ p: "custom", from: "2026-10-10", to: "2026-10-05" }, AS).key, "month"); // ulta range
  assert.equal(resolvePeriod({ p: "custom", from: "2026-10-10", to: "2027-01-01" }, AS).key, "month"); // mustaqbil
  assert.equal(resolvePeriod({ p: "junk" }, AS).key, "month");
  assert.equal(addMonths("2026-01-31", 1).slice(0, 7), "2026-02");
});
test("expense validation: qty × rate wins, bad input rejected", () => {
  const ok = validateExpense(fd({ category: "chara", sub_type: "green", qty: "40", unit: "maund", rate: "450", amount: "1", expense_date: AS, payment: "cash" }), AS);
  assert.ok(ok.ok && ok.value.amount === 18000 && ok.value.sub_type === "green");
  const flat = validateExpense(fd({ category: "vets", amount: "3,870", expense_date: AS, sub_type: "green" }), AS);
  assert.ok(flat.ok && flat.value.amount === 3870 && flat.value.sub_type === null && flat.value.qty === null);
  const e = (o: Record<string, string>) => { const r = validateExpense(fd(o), AS); return r.ok ? "ok" : r.error; };
  assert.equal(e({ category: "beer", amount: "5", expense_date: AS }), "dy2_err_cat");
  assert.equal(e({ category: "khal", amount: "5", expense_date: "2026-10-18" }), "dy2_err_date");
  assert.equal(e({ category: "khal", amount: "0", expense_date: AS }), "dy2_err_amount");
  assert.equal(e({ category: "khal", qty: "-2", rate: "5", expense_date: AS }), "dy2_err_qty");
  assert.equal(e({ category: "khal", amount: "5", expense_date: AS, animal_id: "x' or 1=1" }), "dy2_err_generic");
  const p = validateExpense(fd({ category: "khal", amount: "5", expense_date: AS, payment: "bitcoin" }), AS);
  assert.ok(p.ok && p.value.payment === "cash");
});
test("income validation: animal sale needs an animal", () => {
  const r = validateIncome(fd({ kind: "animal_sale", amount: "10200", income_date: AS }), AS);
  assert.ok(!r.ok && r.error === "dy2_err_animal");
  const ok = validateIncome(fd({ kind: "home_milk", qty: "112", rate: "180", income_date: AS }), AS);
  assert.ok(ok.ok && ok.value.amount === 20160);
  const bad = validateIncome(fd({ kind: "centre_milk", amount: "5", income_date: AS }), AS); // centre sirf ERP se
  assert.ok(!bad.ok);
});
test("P&L parse + sum + shares", () => {
  const rows = parsePnl([
    { period: "2026-09-01", income: { centre_milk: 200000, centre_litres: 1000, home_milk: 10000 }, income_total: 210000, expense: { chara: 50000, khal: 10000, hack: 9 }, expense_total: 60000, profit: 150000, litres: 1200, animals: 10 },
    { period: "2026-10-01", income: { centre_milk: 100000, centre_litres: 500 }, income_total: 100000, expense: { chara: 30000, vets: 5000 }, expense_total: 35000, profit: 65000, litres: 700, animals: 8 },
  ]);
  assert.equal(rows[0].expense["hack" as "chara"], undefined);
  const S = sumPnl(rows);
  assert.equal(S.income_total, 310000); assert.equal(S.expense_total, 95000); assert.equal(S.profit, 215000);
  assert.equal(S.cost_per_litre, 50); assert.equal(S.animals, 8); assert.equal(S.feed_per_animal, 11250); assert.equal(S.centre_litres, 1500);
  const sh = categoryShares(S.expense);
  assert.equal(sh[0].cat, "chara"); assert.equal(sh.reduce((a, b) => a + b.pct, 0) >= 99, true);
  assert.equal(sumPnl([]).cost_per_litre, null);
  assert.equal(changePct(110, 100), 10); assert.equal(changePct(5, 0), null); assert.equal(changePct(-50, -100), 50);
  assert.deepEqual(parsePnl("junk"), []);
});
test("admin totals, filter, CSV (formula injection guarded)", () => {
  const rows = parseAdminRows([
    { farmer_id: "1", farmer_code: "FRM-000003", full_name: "Aslam", village: "Mahabali", animals: 10, milking: 8, litres: 1602, expense: 147770, income: 288360, profit: 140590 },
    { farmer_id: "2", farmer_code: "FRM-000066", full_name: "=HYPERLINK(\"http://x\")", village: "Chak 9", customer_name: "Malik, Dairy", animals: 8, milking: 5, litres: 1180, expense: 142800, income: 129600, profit: -13200 },
  ]);
  const g = grandTotal(rows);
  assert.equal(g.animals, 18); assert.equal(grandTotal([...rows, { ...rows[0], farmer_id: "3", litres: 0, expense: 999999 }]).cost_per_litre, g.cost_per_litre); assert.equal(g.profit, 127390); assert.equal(g.losses, 1);
  assert.equal(adminFilter(rows, "loss", "").length, 1); assert.equal(adminFilter(rows, "customer", "").length, 1); assert.equal(adminFilter(rows, "all", "mahab").length, 1);
  assert.equal(csvCell("=1+1"), "'=1+1"); assert.equal(csvCell("-13200"), "-13200"); assert.equal(csvCell("@cmd"), "'@cmd"); assert.equal(csvCell('a"b'), '"a""b"');
  const csv = adminCsv(rows, "2026-10-01", AS);
  assert.ok(csv.startsWith("\uFEFF")); assert.ok(csv.includes("GRAND TOTAL")); assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`)); assert.ok(csv.includes('"Malik, Dairy"'));
  assert.ok(!/\n=/.test(csv));
});
test("cost per litre skips farmers/periods with zero milk records", () => {
  const base = { farmer_code: null, full_name: "X", village: null, customer_name: null, animals: 1, milking: 1, centre_litres: 0, income: 0, profit: 0, cost_per_litre: null };
  const rows = [
    { ...base, farmer_id: "a", litres: 100, expense: 5000 },   // 50/L
    { ...base, farmer_id: "b", litres: 300, expense: 9000 },   // 30/L
    { ...base, farmer_id: "c", litres: 0, expense: 80000 },    // koi doodh record nahi
    { ...base, farmer_id: "d", litres: Number.NaN, expense: 7000 },
  ];
  const g = grandTotal(rows);
  assert.equal(g.cost_per_litre, 35);          // (5000+9000)/400 -- c aur d ka kharcha shamil nahi
  assert.equal(g.avg_cost_per_litre, 40);      // (50+30)/2 -- 0-litre kisan average nahi bigaarta
  assert.equal(g.milk_farmers, 2);
  assert.equal(g.expense, 5000 + 9000 + 80000 + 7000); // kul kharcha phir bhi poora dikhta hai
  assert.equal(withMilk(rows).length, 2);
  // sab zero litre: null (divide-by-zero nahi, NaN/Infinity nahi)
  const z = grandTotal([{ ...base, farmer_id: "z", litres: 0, expense: 100 }]);
  assert.equal(z.cost_per_litre, null); assert.equal(z.avg_cost_per_litre, null); assert.equal(z.milk_farmers, 0);
  assert.equal(grandTotal([]).cost_per_litre, null); assert.equal(grandTotal([]).avg_cost_per_litre, null);
  assert.equal(costPerLitre([{ litres: -5, expense: 10 }]), null); assert.equal(avgCostPerLitre([]), null);
  // farmer ke kai maheene: jis maheene doodh record nahi, us ka kharcha lagat/L mein nahi
  const S = sumPnl(parsePnl([
    { period: "2026-09-01", income: {}, income_total: 0, expense: { chara: 20000 }, expense_total: 20000, profit: -20000, litres: 0, animals: 4 },
    { period: "2026-10-01", income: {}, income_total: 0, expense: { chara: 6000 }, expense_total: 6000, profit: -6000, litres: 200, animals: 4 },
  ]));
  assert.equal(S.cost_per_litre, 30); assert.equal(S.expense_total, 26000);
  assert.equal(sumPnl(parsePnl([{ period: "2026-10-01", income: {}, income_total: 0, expense: {}, expense_total: 500, profit: -500, litres: 0, animals: 1 }])).cost_per_litre, null);
});
test("photo limits and paths", () => {
  assert.ok(photoOk({ size: 500000, type: "image/webp" }));
  assert.ok(!photoOk({ size: PHOTO_MAX_BYTES + 1, type: "image/webp" }));
  assert.ok(!photoOk({ size: 10, type: "image/svg+xml" }));
  assert.ok(!photoOk(null));
  assert.ok(photoPath("F", "A", "X").startsWith("F/A/"));
  assert.ok(photoPath("F", "A", "X", true).includes("thumb"));
  assert.deepEqual(fitSize(4000, 3000, 1600), { w: 1600, h: 1200 });
  assert.deepEqual(fitSize(800, 600, 1600), { w: 800, h: 600 });
});
test("dictionary: every key has en, rm and ur; ur is Urdu script; no clash with phase-3 keys", () => {
  for (const [k, v] of Object.entries(portalDairyPlDict)) {
    const e = v as { en: string; rm?: string; ur: string };
    assert.ok(e.en && e.rm && e.ur, k);
    if (!/^(CSV|Google Sheets|Rs|P&L)/.test(e.ur)) assert.match(e.ur, /[\u0600-\u06FF]/, `${k} ur`);
    assert.ok(!(k in portalDairyDict), `clash ${k}`);
  }
  assert.match(fs.readFileSync("src/lib/i18n/translations.ts", "utf8"), /portalDairyPlDict/);
});
const FILES = [
  "src/app/portal/dairy/hisaab/page.tsx", "src/app/portal/dairy/hisaab/expense/page.tsx", "src/app/portal/dairy/hisaab/income/page.tsx", "src/app/portal/dairy/hisaab/actions.ts",
  "src/app/admin/dairy/page.tsx", "src/app/admin/dairy/[farmerId]/page.tsx", "src/app/admin/dairy/export/route.ts",
  "src/components/portal/dairy/pl-parts.tsx", "src/lib/portal/dairy-pl.ts", "src/app/portal/dairy/animals/[id]/page.tsx", "src/app/portal/dairy/animals/new/page.tsx",
];
test("code used keys exist in dictionary", () => {
  const keys = new Set(Object.keys({ ...portalDairyPlDict, ...portalDairyDict }));
  for (const f of FILES) for (const m of Array.from(fs.readFileSync(f, "utf8").matchAll(/["'`]((?:dy2|ad)_[a-z0-9_]*[a-z0-9])["'`]/g))) assert.ok(keys.has(m[1]), `${f}: ${m[1]}`);
});
test("wiring: gate, admin guard, no service role, no deletes", () => {
  const act = fs.readFileSync("src/app/portal/dairy/hisaab/actions.ts", "utf8");
  assert.match(act, /gate\.allowed/);
  assert.match(act, /fn_dairy_add_from_shop/);
  for (const f of ["src/app/admin/dairy/page.tsx", "src/app/admin/dairy/[farmerId]/page.tsx", "src/app/admin/dairy/export/route.ts"]) assert.match(fs.readFileSync(f, "utf8"), /isDairyAdmin\(\)/, f);
  assert.match(fs.readFileSync("src/lib/portal/dairy-admin-load.ts", "utf8"), /"owner", "super_admin", "admin"/);
  for (const f of [...FILES, "src/lib/portal/dairy-pl-load.ts", "src/lib/portal/dairy-admin-load.ts"]) {
    const s = fs.readFileSync(f, "utf8");
    assert.ok(!/service_role|SERVICE_ROLE|createAdminClient/.test(s), `service role in ${f}`);
    assert.ok(!/\.delete\(/.test(s), `delete in ${f}`);
  }
  assert.match(fs.readFileSync("src/app/portal/dairy/actions.ts", "utf8"), /savePhoto/);
  assert.match(fs.readFileSync("src/lib/portal/nav.ts", "utf8"), /\/portal\/dairy\/hisaab/); // phase 6: menu ab lib/portal/nav.ts mein
  assert.match(fs.readFileSync("src/app/admin/dairy/export/route.ts", "utf8"), /content-disposition/);
});
console.log(`\n${passed} passed`);
