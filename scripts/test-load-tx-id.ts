/** Load / bill / bank transfer: Tx ID lazmi at save. npm run test:load-tx-id */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { providerTidForEntry, PROVIDER_TID_MIN } from "../src/lib/load-bill/provider-tid";

let n = 0;
function test(name: string, fn: () => void) {
  fn();
  n++;
  console.log(`ok  ${name}`);
}

function sliceFn(source: string, name: string, next: string): string {
  const start = source.indexOf(`export async function ${name}`);
  const end = source.indexOf(`export async function ${next}`);
  assert.ok(start >= 0 && end > start, `${name} body`);
  return source.slice(start, end);
}

test("empty, whitespace, and short Tx ID are rejected", () => {
  for (const kind of ["load", "bill", "bank"] as const) {
    for (const raw of ["", "   ", "ab", null]) {
      const result = providerTidForEntry(raw, kind);
      assert.ok("error" in result, `${kind} ${JSON.stringify(raw)}`);
      assert.match(result.error, /Trex \/ Tx ID/);
    }
  }
  assert.equal(PROVIDER_TID_MIN, 3);
});

test("a real Tx ID is kept trimmed", () => {
  const result = providerTidForEntry("  JC-99881  ", "load");
  assert.deepEqual(result, { tid: "JC-99881" });
});

test("create paths store darj and do not queue saboot_baqi", () => {
  const source = readFileSync("src/actions/load-bill.ts", "utf8");
  const load = sliceFn(source, "createLoadTransaction", "createBankTransfer");
  const bank = sliceFn(source, "createBankTransfer", "attachBankTransferTid");
  for (const body of [load, bank]) {
    assert.match(body, /providerTidForEntry/);
    assert.match(body, /status: "darj"/);
    assert.doesNotMatch(body, /saboot_baqi/);
    assert.doesNotMatch(body, /abhi nahi lagi|proof abhi baqi/);
  }
  assert.match(source, /export async function attachProviderTid/);
  assert.match(source, /export async function attachBankTransferTid/);
  assert.match(source, /\.eq\("status", "saboot_baqi"\)/);
});

test("entry forms require Tx ID; later attach stays for old rows", () => {
  const client = readFileSync("src/app/admin/load-bill/load-bill-client.tsx", "utf8");
  const loadInput = client.split("\n").find((line) => line.includes('id="provider_tid"'));
  const bankInput = client.split("\n").find((line) => line.includes('id="bank_provider_tid"'));
  assert.ok(loadInput && bankInput);
  for (const line of [loadInput, bankInput]) {
    assert.match(line, /required/);
    assert.match(line, /minLength=\{3\}/);
    assert.match(line, /name="provider_tid"/);
  }
  assert.doesNotMatch(client, /Abhi na ho to baad mein bhi lag sakti hai/);
  assert.doesNotMatch(client, /Pending Proof/);
  assert.match(client, /t\.status === "saboot_baqi" && <form action=\{tidAction\}/);
  assert.match(client, /bt\.status === "saboot_baqi" && <form action=\{bankTidAction\}/);
});

test("help migration only rewrites the old optional-proof sentences", () => {
  const sql = readFileSync("supabase/migrations/722_load_tx_id_required_help.sql", "utf8");
  assert.match(sql, /feature_key = 'load-bill'/);
  assert.match(sql, /array_replace/);
  assert.doesNotMatch(sql, /alter table/i);
  assert.doesNotMatch(sql, /provider_tid/i);
});

console.log(`\n${n} tests passed`);
