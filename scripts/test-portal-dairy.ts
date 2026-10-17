/**
 * Kisan portal Dairy (Phase 3) -- hisaab, validation, zaban aur page wiring ke tests.
 * Chalayein: npm run test:portal-dairy   (566-568 ka asal SQL test: tests/portal-dairy-sql.mjs)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  addDays, ageText, animalStats, dailySeries, dropAlerts, herdSummary, nextTag, parseAnimals, parseLiters, parseYields,
  rangeDays, reconcile, sortByTag, statusFilter, validateAnimal, validateDate, weekChange,
} from "../src/lib/portal/dairy";
import { portalDairyDict } from "../src/lib/i18n/dict/portal-dairy";

let passed = 0;
const test = (n: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${n}`); };
const AS = "2026-10-17";
const animals = parseAnimals([
  { id: "a1", tag_no: "104", name: "Rani", species: "cow", status: "milking", dob: "2022-08-10", sex: "F" },
  { id: "a2", tag_no: "117", name: "Gori", species: "cow", status: "pregnant", sex: "F" },
  { id: "a3", tag_no: "120", name: "Sheeru", species: "cow", status: "dry", sex: "F" },
  { id: "a4", tag_no: "9", name: "Old", species: "buffalo", status: "sold", sex: "F" },
  { id: "a5", tag_no: "129", name: "Kajal", species: "cow", status: "heifer", sex: "F" },
  { id: "a6", tag_no: "x", species: "zebra", status: "??", sex: "?" },
]);
const yields = parseYields([
  ...Array.from({ length: 14 }, (_, i) => ({ animal_id: "a1", yield_date: addDays(AS, -i), shift: "am", liters: "5" })),
  ...Array.from({ length: 14 }, (_, i) => ({ animal_id: "a1", yield_date: addDays(AS, -i), shift: "pm", liters: i < 7 ? "4.2" : "3.8" })),
  ...Array.from({ length: 7 }, (_, i) => ({ animal_id: "a2", yield_date: addDays(AS, -i), shift: "am", liters: String(6.1 + i * 0.15) })),
  { animal_id: "a1", yield_date: "2026-01-01", shift: "am", liters: 99 },
]);

test("parsers sanitise unknown values", () => {
  assert.equal(animals[5].species, "cow"); assert.equal(animals[5].status, "milking"); assert.equal(animals[5].sex, "F");
  assert.equal(yields[0].liters, 5); assert.deepEqual(parseAnimals(null), []); assert.deepEqual(parseYields("x"), []);
});
test("date helpers & age", () => {
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(ageText("2022-08-10", AS), "4y 2m"); assert.equal(ageText("2026-02-17", AS), "8m"); assert.equal(ageText(null, AS), "—");
  assert.equal(ageText("2027-01-01", AS), "—");
});
test("daily series fills gaps and ignores out-of-range", () => {
  const s = dailySeries(yields, addDays(AS, -29), AS);
  assert.equal(s.length, 30); assert.equal(s[0].total, 0);
  assert.equal(s[29].am, 11.1); assert.equal(s[29].pm, 4.2); assert.equal(s[29].total, 15.3);
  assert.equal(dailySeries(yields, addDays(AS, -6), AS, "a1")[6].total, 9.2);
});
test("herd summary", () => {
  const h = herdSummary(animals.slice(0, 5), yields, AS);
  assert.equal(h.today.total, 15.3); assert.equal(h.milking, 2); assert.equal(h.active, 4);
  assert.equal(h.perCow, 7.4); assert.equal(h.pendingAm, 0); assert.equal(h.pendingPm, 1);
  assert.deepEqual(h.byStatus.map((x) => x.status).sort(), ["dry", "heifer", "milking", "pregnant"]);
});
test("week change and drop alerts", () => {
  assert.equal(weekChange(dailySeries(yields, addDays(AS, -13), AS, "a1")), 5);
  assert.equal(weekChange(dailySeries(yields, addDays(AS, -5), AS)), null);
  const st = animalStats(animals, yields, AS);
  assert.equal(st.get("a2")!.dropPct, -10);
  assert.equal(st.get("a1")!.dropPct, 5); // aaj ki adhoori shaam girawat nahi ginti
  assert.deepEqual(dropAlerts(animals, st).map((x) => x.a.id), ["a2"]);
});
test("filters, sorting, next tag", () => {
  assert.equal(statusFilter(animals, "all").length, 5);
  assert.deepEqual(statusFilter(animals, "gone").map((a) => a.id), ["a4"]);
  assert.deepEqual(statusFilter(animals, "young").map((a) => a.id), ["a5"]);
  assert.deepEqual(sortByTag(animals).map((a) => a.tag_no).slice(0, 3), ["9", "104", "117"]);
  assert.equal(nextTag(animals), "130"); assert.equal(nextTag([]), "1");
});
const fd = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });
test("animal form validation", () => {
  const ok = validateAnimal(fd({ tag_no: " 132 ", species: "cow", status: "milking", sex: "F", dob: "2023-03", purchase_price: "2,40,000" }), AS, ["104"]);
  assert.ok(ok.ok); if (ok.ok) { assert.equal(ok.value.tag_no, "132"); assert.equal(ok.value.dob, "2023-03-01"); assert.equal(ok.value.dob_estimated, true); assert.equal(ok.value.purchase_price, 240000); }
  const bad = (o: Record<string, string>, e: string) => { const r = validateAnimal(fd({ tag_no: "1", species: "cow", status: "milking", ...o }), AS, ["104"]); assert.ok(!r.ok); if (!r.ok) assert.equal(r.error, e); };
  bad({ tag_no: "" }, "dy_err_tag"); bad({ tag_no: "104" }, "dy_err_tag_dup"); bad({ species: "zebra" }, "dy_err_species");
  bad({ status: "sold" }, "dy_err_status"); bad({ dob: "2027-01-01" }, "dy_err_dob"); bad({ purchase_price: "-5" }, "dy_err_price");
  bad({ dam_id: "drop table" }, "dy_err_generic");
});
test("litres and date validation", () => {
  assert.equal(parseLiters(""), null); assert.equal(parseLiters("7.25"), 7.25); assert.equal(parseLiters("61"), "bad"); assert.equal(parseLiters("abc"), "bad"); assert.equal(parseLiters("-1"), "bad");
  assert.ok(validateDate(AS, AS)); assert.ok(!validateDate("2026-10-18", AS)); assert.ok(!validateDate("2026-08-01", AS)); assert.ok(!validateDate("17-10-2026", AS));
});
test("reconcile & range", () => {
  assert.deepEqual(reconcile(65.44, 58), { home: 65.4, centre: 58, diff: 7.4 });
  assert.equal(rangeDays("7"), 7); assert.equal(rangeDays("x"), 30); assert.equal(rangeDays("90"), 90);
});
test("dictionary: every key has en, rm and ur; ur is Urdu script", () => {
  for (const [k, v] of Object.entries(portalDairyDict)) {
    assert.ok(v.en && v.rm && v.ur, k);
    assert.match(v.ur, /[\u0600-\u06FF]/, `${k} ur`);
  }
});
test("code used keys exist in dictionary", () => {
  const files = ["src/app/portal/dairy/page.tsx", "src/app/portal/dairy/animals/page.tsx", "src/app/portal/dairy/animals/[id]/page.tsx",
    "src/app/portal/dairy/animals/new/page.tsx", "src/app/portal/dairy/milk/page.tsx", "src/lib/portal/dairy.ts", "src/app/portal/dairy/actions.ts"];
  const keys = new Set(Object.keys(portalDairyDict));
  for (const f of files) for (const m of Array.from(fs.readFileSync(f, "utf8").matchAll(/["'`](dy_[a-z0-9_]*[a-z0-9])["'`]/g))) assert.ok(keys.has(m[1]), `${f}: ${m[1]}`);
});
test("pages keep verification gate and never use service role", () => {
  const layout = fs.readFileSync("src/app/portal/dairy/layout.tsx", "utf8");
  assert.match(layout, /gate\.allowed/); assert.match(layout, /VerificationGateMessage/);
  for (const f of ["src/lib/portal/dairy-load.ts", "src/app/portal/dairy/actions.ts"]) {
    const s = fs.readFileSync(f, "utf8");
    assert.doesNotMatch(s, /service|SERVICE_ROLE|createAdminClient/i, f);
    assert.doesNotMatch(s, /\.delete\(/, `${f} no deletes`);
    assert.doesNotMatch(s, /from\("milk_entries"\)/, `${f}: ERP only via read-only RPC`);
  }
  assert.match(fs.readFileSync("src/app/portal/dairy/actions.ts", "utf8"), /gate\.allowed/);
  assert.match(fs.readFileSync("src/components/portal/sidebar.tsx", "utf8"), /\/portal\/dairy/);
});
console.log(`portal-dairy: ${passed} passed`);
