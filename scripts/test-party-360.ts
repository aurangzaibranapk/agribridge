/** Party 360 pure tests.  npm run test:party-360 */
import assert from "node:assert/strict";
import { agingFifo, grainSaleRow, lastMonths, monthlySeries, netPosition, phoneKey, pktMonthKey, shopKey } from "../src/lib/intelligence/party360/core";
import { buildShopLines, rolesFrom } from "../src/lib/intelligence/party360/activity";

let c = 0;
function test(name: string, fn: () => void) { fn(); c++; console.log(`ok  ${name}`); }
const now = new Date("2026-10-16T08:00:00Z");

test("PKT month key: 30 Sep 21:00Z is October in PKT", () => { assert.equal(pktMonthKey("2026-09-30T21:00:00Z"), "2026-10"); assert.equal(pktMonthKey("2026-09-30"), "2026-09"); });
test("lastMonths ends at current month", () => { const m = lastMonths(now, 6); assert.deepEqual(m.labels, ["May", "Jun", "Jul", "Aug", "Sep", "Oct"]); assert.equal(m.keys[5], "2026-10"); });
test("monthlySeries buckets", () => { const { keys } = lastMonths(now, 3); assert.deepEqual(monthlySeries([{ date: "2026-10-01", amount: 5 }, { date: "2026-10-09", amount: 7 }, { date: "2026-08-02", amount: 1 }], keys), [1, 0, 12]); });
test("aging FIFO: newest credits remain outstanding", () => {
  const a = agingFifo([{ date: "2026-06-01", amount: 1000 }, { date: "2026-09-01", amount: 1000 }, { date: "2026-10-10", amount: 500 }], 1200, now);
  assert.equal(a.d0_30, 500); assert.equal(a.d31_60, 700); assert.equal(a.d90p, 0); assert.equal(a.total, 1200);
});
test("aging: unmatched balance (opening/journal) goes to 90+", () => { const a = agingFifo([{ date: "2026-10-12", amount: 490 }], 175200, now); assert.equal(a.d0_30, 490); assert.equal(a.d90p, 174710); });
test("grain sale row: Malik Traders GRN-SALE-26-00006", () => {
  const r = grainSaleRow({ quantity_kg: 9450, rate_per_kg: 130, total_amount: 1228500, amount_received: 150000 });
  assert.equal(r.mand, 236.25); assert.equal(r.ratePerMand, 5200); assert.equal(r.due, 1078500);
});
test("shopKey maps business types", () => { assert.equal(shopKey("vet").key, "vets"); assert.equal(shopKey("karyana").key, "karyana"); assert.equal(shopKey("agri_inputs").key, "dukan"); assert.equal(shopKey(null, "X").key, "shop:X"); });
test("phoneKey last 10 digits", () => { assert.equal(phoneKey("+92 344-4035480"), "3444035480"); assert.equal(phoneKey("123"), null); });
test("shop lines + net: milk supplier who buys from shops", () => {
  const lines = buildShopLines({
    pos: [{ total: 1000, credit: 600, shopBt: "vet", shopName: "Vets" }, { total: 500, credit: 0, shopBt: "karyana", shopName: "K" }],
    khataBalance: 600, hasKhata: true, milk: { amount: 20000, paid: 5000, due: null }, grain: { amount: 100000, paid: 25000 },
    fertCredit: { debit: 8000, credit: 3000, balance: 5000 }, supplier: null, buyer: null,
  });
  const vets = lines.find((l) => l.key === "vets")!; assert.equal(vets.weSold, 1000); assert.equal(vets.received, 400); assert.equal(vets.balance, 0);
  assert.equal(lines.find((l) => l.key === "milk")!.balance, -15000);
  assert.equal(lines.find((l) => l.key === "grain")!.balance, -75000);
  const n = netPosition(lines); assert.equal(n.theyOwe, 5600); assert.equal(n.weOwe, 90000); assert.equal(n.net, -84400);
});
test("milk due prefers milk_farmer_balances", () => { const l = buildShopLines({ pos: [], khataBalance: 0, hasKhata: false, milk: { amount: 100, paid: 0, due: 40 }, grain: null, fertCredit: null, supplier: null, buyer: null }); assert.equal(l[0].balance, -40); });
test("supplier + buyer lines", () => {
  const l = buildShopLines({ pos: [], khataBalance: 0, hasKhata: false, milk: null, grain: null, fertCredit: null, supplier: { bought: 618592, paid: 31440 }, buyer: { sold: 3253700, received: 2175200 } });
  assert.equal(l.find((x) => x.key === "supplier")!.balance, -587152); assert.equal(l.find((x) => x.key === "buyer")!.balance, 1078500);
});
test("roles from records", () => { assert.deepEqual(rolesFrom({ farmers: 1, customers: 2, milk: true, suppliers: 0, buyers: 1 }), ["kisan", "customer", "milk", "buyer"]); assert.deepEqual(rolesFrom({ farmers: 0, customers: 0, milk: false, suppliers: 0, buyers: 0, dealer: true }), ["dealer"]); });
console.log(`\n${c} passed`);
import { ACCENT, kpiIcon, resolveTheme, short as shortRs } from "../src/components/party360/theme";
test("theme: default light, only saved 'dark' is dark", () => { assert.equal(resolveTheme(null), "light"); assert.equal(resolveTheme("light"), "light"); assert.equal(resolveTheme("x"), "light"); assert.equal(resolveTheme("dark"), "dark"); });
test("theme: every party type has a 2-stop accent", () => { for (const k of ["farmer", "customer", "dealer", "supplier", "buyer"] as const) assert.equal(ACCENT[k].length, 2); });
test("theme: kpi icons + short money", () => { assert.equal(kpiIcon("Hum ne dena"), "down"); assert.equal(kpiIcon("Wasooli"), "cash"); assert.equal(kpiIcon("Fasal becha"), "leaf"); assert.equal(shortRs(1228500), "12.3L"); assert.equal(shortRs(16227230), "1.6Cr"); });
console.log(`${c} passed (incl. theme)`);
