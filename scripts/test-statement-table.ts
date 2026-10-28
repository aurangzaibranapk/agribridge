/** Bank-statement table style — contract + usage snapshot. npm run test:statement-table */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ST, fmtAmt, fmtBal } from "../src/lib/ui/statement-table";

let ok = 0; const pass = (n: string) => { ok++; console.log(`  ok  ${n}`); };

assert.equal(fmtAmt(1234567.5), "1,234,567.5");
assert.equal(fmtAmt(30000), "30,000");
assert.equal(fmtAmt(0), "—");
assert.equal(fmtAmt(null), "—");
assert.equal(fmtAmt(0, { blankZero: false }), "0");
pass("fmtAmt: thousands separators, blank zero");

assert.equal(fmtBal(15000, "Cr"), "15,000 Cr");
assert.equal(fmtBal(-15000, "Cr"), "15,000 Dr");
assert.equal(fmtBal(17049, "Dr"), "17,049 Dr");
assert.equal(fmtBal(-2049, "Dr"), "2,049 Cr");
assert.equal(fmtBal(0, "Dr"), "0");
pass("fmtBal: Dr/Cr by side");

for (const k of ["thAmt", "tdAmt", "tdBal"] as const) {
  assert.match(ST[k], /min-w-\[1[3-5]\dpx\]/, `${k} min width 130-150px`);
  assert.match(ST[k], /\btext-end\b/, `${k} end aligned (RTL safe)`);
  assert.match(ST[k], /\bborder-s\b/, `${k} vertical divider`);
  assert.match(ST[k], /\bpx-4\b/, `${k} padding`);
  assert.match(ST[k], /\[direction:ltr\]/, `${k} numbers stay LTR in Urdu`);
}
assert.match(ST.tdAmt, /tabular-nums/); assert.match(ST.tdBal, /tabular-nums/);
assert.match(ST.thAmt, /font-bold/); assert.match(ST.th, /font-bold/);
assert.match(ST.tr, /even:bg-/); assert.match(ST.tr, /dark:even:bg-/);
assert.match(ST.wrap, /overflow-x-auto/); assert.match(ST.table, /min-w-\[\d+px\]/);
assert.doesNotMatch(Object.values(ST).join(" "), /\btext-(left|right)\b/, "use start/end for RTL");
pass("style contract: width, end-align, divider, bold header, zebra, dark, scroll, RTL");

const users: Record<string, RegExp[]> = {
  "src/app/admin/suppliers/[id]/statement/statement-client.tsx": [/ST\.thAmt/, /fmtBal\(e\.runningBalance, "Cr"\)/],
  "src/app/admin/crm/[id]/statement/page.tsx": [/ST\.thAmt/, /fmtBal\(r\.balance, "Dr"\)/],
  "src/app/admin/finance/ledger/page.tsx": [/ST\.thAmt/, /fmtBal\(l\.balance, pos\)/],
  "src/components/party360/party-360-view.tsx": [/ST\.thAmt/, /amountCols/],
  "src/lib/intelligence/party360/load.ts": [/amountCols: \[2, 3, 4\][\s\S]*amountCols: \[2, 3, 4\]/, /fmtBal\(l\.net\.net, "Dr"\)/],
};
for (const [f, res] of Object.entries(users)) {
  const src = readFileSync(f, "utf8");
  for (const r of res) assert.match(src, r, `${f} uses ${r}`);
}
pass("snapshot: supplier/customer statement, ledger, Party 360 ledger + linked net use shared style");

console.log(`statement-table: ${ok} passed`);
