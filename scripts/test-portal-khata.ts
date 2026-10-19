/**
 * Kisan portal "Mera Khata" (Phase 2) -- hisaab, filter aur zaban ke tests.
 * Chalayein: npm run test:portal-khata   (565 ka asal SQL test: tests/portal-khata-sql.mjs)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  agingBars, breakdown, creditUse, filterStatement, KHATA_CATEGORIES, parseRange, parseStatement, parseSummary,
  promiseProgress, qs, rangePresets, rs, sourceCards, statementTotals, tafseelKey, tafseelText,
} from "../src/lib/portal/khata";
import { portalKhataDict } from "../src/lib/i18n/dict/portal-khata";
import { t } from "../src/lib/i18n/translations";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

// FRM-000003 jaisi shakal (565 ka jawab, numeric strings ke saath)
const RAW = {
  as_of: "2026-10-17",
  owed: "55489.00",
  by_category: [
    { category: "khaad", udhaar: "45550.00", adaigi: "0", balance: "45550.00", count: 3 },
    { category: "karyana", udhaar: "6969", adaigi: "0", balance: "6969", count: 1 },
    { category: "vets", udhaar: "3870", adaigi: "0", balance: "3870", count: 1 },
    { category: "adaigi", udhaar: "0", adaigi: "900", balance: "-900", count: 1 },
    { category: "doodh", udhaar: "1000", adaigi: "3250", balance: "-2250", count: 3 },
    { category: "gandum", udhaar: "0", adaigi: "0", balance: "0", count: 0 },
  ],
  aging: { d0_15: "34519", d16_30: "18000", d31_60: "2970", d60_plus: 0, oldest_days: 35 },
  promise: { amount: "2870.00", fulfilled: "0", date: "2026-11-15", status: "open", days_left: 29, channel: "verbal", created_at: "2026-10-17T11:28:57+05:00" },
  credit_limit: "1000000.00",
  score: { score: 100, band: "platinum", state: "active", snapshot_date: "2026-10-17" },
  level: "unproven",
  qist: { plans: 0, remaining: 0, next_due: null },
  last_payment: { date: "2026-09-21", amount: "900" },
  has_farmer: true,
  customer_count: 1,
};

test("parseSummary: numbers, null-safe", () => {
  const s = parseSummary(RAW)!;
  assert.equal(s.owed, 55489);
  assert.equal(s.credit_limit, 1000000);
  assert.equal(s.promise!.amount, 2870);
  assert.equal(s.aging.d16_30, 18000);
  assert.equal(parseSummary(null), null);
  assert.equal(parseSummary("x"), null);
  const bare = parseSummary({ owed: null })!;
  assert.equal(bare.owed, 0);
  assert.equal(bare.promise, null);
  assert.deepEqual(bare.by_category, []);
});

test("sourceCards: dukaan = karyana+khaad+vets+adaigi; doodh/gandum alag; qist sirf jab plan ho", () => {
  const c = sourceCards(parseSummary(RAW)!);
  assert.equal(c.shop, 45550 + 6969 + 3870 - 900);
  assert.equal(c.milk, -2250);
  assert.equal(c.grain, 0);
  assert.equal(c.qistRemaining, null);
  const q = sourceCards(parseSummary({ ...RAW, qist: { plans: 1, remaining: "3500", next_due: "2026-10-30" } })!);
  assert.equal(q.qistRemaining, 3500);
  assert.equal(q.qistNext, "2026-10-30");
});

test("breakdown: adaigi aur khali bahar, bara pehle", () => {
  const b = breakdown(parseSummary(RAW)!);
  assert.deepEqual(b.map((x) => x.category), ["khaad", "karyana", "vets", "doodh"]);
});

const ROWS = parseStatement([
  { entry_date: "2026-09-20", ref: null, category: "opening", kind: "opening", tafseel: "Pichhla baqaya", udhaar: 0, adaigi: 0, baqaya: "3870", is_opening: true },
  { entry_date: "2026-09-21", ref: "RCP-1", category: "adaigi", kind: "adaigi", tafseel: "Adaigi", udhaar: "0", adaigi: "900", baqaya: "2970", is_opening: false },
  { entry_date: "2026-09-23", ref: "POS-1", category: "khaad", kind: "udhaar", tafseel: "DAP x2", udhaar: "18000", adaigi: "0", baqaya: "20970", is_opening: false },
  { entry_date: "2026-10-12", ref: null, category: "doodh", kind: "doodh", tafseel: "Doodh 15 L", udhaar: "0", adaigi: "2250", baqaya: "18720", is_opening: false },
  { entry_date: "2026-10-14", ref: null, category: "doodh", kind: "udhaar", tafseel: "Doodh ki raqam", udhaar: "1000", adaigi: "0", baqaya: "19720", is_opening: false },
  { entry_date: "2026-10-15", ref: "GRN-1", category: "gandum", kind: "adaigi", tafseel: "Gandum", udhaar: "0", adaigi: "3000", baqaya: "16720", is_opening: false },
]);

test("filterStatement: chips mockup jaise; opening hamesha", () => {
  assert.equal(filterStatement(ROWS, "all").length, 6);
  assert.deepEqual(filterStatement(ROWS, "udhaar").map((r) => r.ref ?? r.tafseel), ["Pichhla baqaya", "POS-1"]);
  assert.deepEqual(filterStatement(ROWS, "adaigi").map((r) => r.ref ?? r.tafseel), ["Pichhla baqaya", "RCP-1"]);
  assert.equal(filterStatement(ROWS, "doodh").filter((r) => !r.is_opening).length, 2);
  assert.equal(filterStatement(ROWS, "gandum").filter((r) => !r.is_opening).length, 1);
});

test("statementTotals: opening + udhaar - adaigi = closing", () => {
  const tt = statementTotals(ROWS);
  assert.equal(tt.opening, 3870);
  assert.equal(tt.udhaar, 19000);
  assert.equal(tt.adaigi, 6150);
  assert.equal(tt.closing, 16720);
  assert.equal(tt.opening + tt.udhaar - tt.adaigi, tt.closing);
  assert.deepEqual(statementTotals([]), { opening: 0, udhaar: 0, adaigi: 0, closing: 0 });
});

test("agingBars: teen dabbe, 30+ = 31-60 + 60+", () => {
  const b = agingBars({ d0_15: 34519, d16_30: 18000, d31_60: 2000, d60_plus: 970, oldest_days: 70 });
  assert.deepEqual(b.map((x) => x.amount), [34519, 18000, 2970]);
  assert.equal(b.reduce((a, x) => a + x.pct, 0) >= 99, true);
  assert.deepEqual(agingBars({ d0_15: 0, d16_30: 0, d31_60: 0, d60_plus: 0, oldest_days: null }).map((x) => x.pct), [0, 0, 0]);
});

test("promiseProgress + creditUse", () => {
  const s = parseSummary(RAW)!;
  assert.equal(promiseProgress(s.promise!, "2026-10-17"), 0);
  assert.equal(promiseProgress({ ...s.promise!, created_at: "2026-10-01" }, "2026-11-15"), 100);
  assert.equal(promiseProgress({ ...s.promise!, created_at: null }, "2026-10-17"), 0);
  const c = creditUse(s);
  assert.deepEqual(c, { limit: 1000000, used: 55489, available: 944511, pct: 6 });
  assert.equal(creditUse({ ...s, owed: -500, credit_limit: 0 }).pct, 0);
});

test("parseRange: ghalat tareekh hataye, ulti range seedhi, filter whitelist", () => {
  assert.deepEqual(parseRange({ from: "2026-10-01", to: "2026-09-01", f: "doodh" }), { from: "2026-09-01", to: "2026-10-01", filter: "doodh" });
  assert.deepEqual(parseRange({ from: "'; drop", to: ["2026-10-17"], f: "evil" }), { from: null, to: "2026-10-17", filter: "all" });
  assert.deepEqual(parseRange({}), { from: null, to: null, filter: "all" });
});

test("rangePresets + qs", () => {
  const p = rangePresets("2026-10-17");
  assert.deepEqual(p.map((x) => [x.key, x.from, x.to]), [
    ["month", "2026-10-01", "2026-10-17"], ["3m", "2026-08-01", "2026-10-17"], ["year", "2026-01-01", "2026-10-17"], ["all", null, null],
  ]);
  assert.equal(qs({ from: "2026-10-01", to: null, f: "doodh" }), "?from=2026-10-01&f=doodh");
  assert.equal(qs({}), "");
  assert.equal(rs(1000000), "Rs 10,00,000");
  assert.equal(rs(-900), "-Rs 900");
});

test("har pk_ lafz teeno zabanon mein; Roman mein Urdu script nahi; har qism ka label", () => {
  for (const [k, v] of Object.entries(portalKhataDict)) {
    assert.ok(v.en && v.rm && v.ur, `${k} adhoora`);
    assert.ok(!/[\u0600-\u06FF]/.test(v.rm), `${k} rm mein Urdu`);
    assert.ok(/[\u0600-\u06FF]/.test(v.ur) || /^[A-Za-z0-9 #/().·+−-]+$/.test(v.ur), `${k} ur`);
  }
  for (const c of [...KHATA_CATEGORIES, "opening"]) assert.notEqual(t(`pk_cat_${c}` as any, "rm"), `pk_cat_${c}`);
  for (const f of ["all", "udhaar", "adaigi", "doodh", "gandum"]) assert.notEqual(t(`pk_f_${f}` as any, "rm"), `pk_f_${f}`);
  for (const k of ["month", "3m", "year", "all"]) assert.notEqual(t(`pk_p_${k}` as any, "rm"), `pk_p_${k}`);
});

test("SQL categories == UI categories (565 ke har khane ka label)", () => {
  const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/565_portal_own_khata.sql"), "utf8");
  // "then 'x'" -- category aur kind dono; kind "udhaar" category nahi.
  const cats = new Set([...sql.matchAll(/then '([a-z]+)'/g)].map((m) => m[1]).filter((c) => c !== "udhaar"));
  assert.ok(cats.size >= 10, `only ${cats.size}`);
  for (const c of cats) {
    assert.ok((KHATA_CATEGORIES as readonly string[]).includes(c), `SQL category ${c} UI mein nahi`);
  }
});

test("565: security definer, anon se band, koi parameter 'kis ka' nahi; page sirf apne session se", () => {
  const root = path.resolve(__dirname, "..");
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/565_portal_own_khata.sql"), "utf8");
  assert.match(sql, /revoke all on function public\.fn_my_khata_summary\(date\) from public, anon;/);
  assert.match(sql, /revoke all on function public\.fn_my_khata_statement\(date, date\) from public, anon;/);
  assert.match(sql, /revoke all on function public\.fn_khata_lines_for\(uuid, uuid\[\]\) from public, anon, authenticated;/);
  assert.ok(!/fn_my_khata_(summary|statement)\(\s*p_(farmer|customer|party)/.test(sql), "portal function party id na le");
  assert.ok(!/l\.memo|e\.description/.test(sql), "memo/description bahar nahi jana chahiye");
  const load = fs.readFileSync(path.join(root, "src/lib/portal/khata-load.ts"), "utf8");
  assert.ok(load.includes('"fn_my_khata_summary"') && load.includes('"fn_my_khata_statement"'));
  assert.ok(!load.includes("createServiceClient"), "service client nahi -- auth.uid() hi daira hai");
  const page = fs.readFileSync(path.join(root, "src/app/portal/wallet/page.tsx"), "utf8");
  assert.ok(page.includes("loadKhata") && page.includes("WalletView"), "khata naya, purana wallet bhi salamat");
  assert.ok(!/wa\.me|whatsapp/i.test(page), "kisan ko seedha message nahi");
});

test("tafseel: 565 ki har Roman tafseel ka tarjuma; POS cheezein waisi", () => {
  const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/565_portal_own_khata.sql"), "utf8");
  const fixed = [...sql.matchAll(/then '([A-Z][^']+)'/g), ...sql.matchAll(/else '([A-Z][^']+)'/g)].map((m) => m[1]);
  assert.ok(fixed.length >= 10);
  for (const f of new Set(fixed)) assert.ok(tafseelKey(f), `tafseel "${f}" ka tarjuma nahi`);
  const tr = (k: string) => t(k as any, "en");
  assert.equal(tafseelText("Adaigi", tr, "en"), "Payment");
  assert.equal(tafseelText("Doodh 15 L", tr, "en"), "Milk 15 L");
  assert.equal(tafseelText("Doodh 15 L", (k) => t(k as any, "rm"), "rm"), "Doodh 15 L");
  assert.equal(tafseelText("Urea x2, DAP x1", tr, "en"), "Urea x2, DAP x1");
  assert.equal(tafseelText("Adaigi", (k) => t(k as any, "ur"), "ur"), "ادائیگی");
});

console.log(`\n${passed} passed`);
