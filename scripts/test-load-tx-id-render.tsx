/** Server-render Load & Bill entry forms and assert Tx ID is required. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";

// Stock react-dom 18.3 has no useFormState; Next's compiled copy does.
// Patch before the client module loads so the form can render here.
const nodeRequire = createRequire(__filename);
const reactDom = nodeRequire("react-dom") as {
  useFormState?: (action: unknown, initial: unknown) => [unknown, () => void];
  useFormStatus?: () => { pending: boolean };
};
reactDom.useFormState = (_action, initial) => {
  const [state] = React.useState(initial);
  return [state, () => {}];
};
reactDom.useFormStatus = () => ({ pending: false });

const base = {
  shopId: "shop-1",
  shopName: "Test Shop",
  branchName: "Test Branch",
  providers: [{ id: "p1", name: "Jazz", kind: "load", billCategory: null }],
  accounts: [{ id: "a1", title: "CBA", accountRef: "332", providerId: null, providerName: "—", float: 5000 }],
  financeAccounts: [
    { id: "f1", name: "Cash drawer", accountType: "cash" },
    { id: "f2", name: "JazzCash shop", accountType: "jazzcash" },
  ],
  customers: [],
  farmers: [],
  ledgerToday: [],
  bankTransfers: [],
  summary: { floatBalance: 5000, cashReceived: 0, volume: 0, recovery: 0, pendingProof: 1 },
  canReverse: false,
  today: [{
    shopName: "Test Shop",
    branchName: "Test Branch",
    id: "old-1",
    number: "LD-2026-00002",
    kind: "load",
    reference: "03001234567",
    billCategory: null,
    principal: 100,
    serviceCharge: null,
    commissionExpected: null,
    commissionConfirmed: null,
    commissionStatus: "muntazir",
    method: "cash",
    tid: null,
    status: "saboot_baqi",
    settled: true,
    customer: "Walk-in",
    waqt: "2026-10-28T06:00:00.000Z",
    provider: "Jazz",
  }],
};

async function main() {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LoadBillClient } = await import("../src/app/admin/load-bill/load-bill-client");
  // shuruKind accepts only the POS deep-links "load" and "bill".
  // Bank transfer is a tab on the same page; its required Tx ID is
  // asserted in scripts/test-load-tx-id.ts against the real form markup.
  function markup(kind: "load" | "bill") {
    return renderToStaticMarkup(
      React.createElement(LoadBillClient, { ...base, shuruKind: kind })
    );
  }

  const load = markup("load");
  const bill = markup("bill");

assert.match(load, /Transaction ID \(Trex \/ Tx ID\)/);
assert.match(load, /name="provider_tid"/);
assert.match(load, /required/);
assert.match(load, /minLength="3"/);
assert.match(load, /Bina is ke load save nahi hota/);
assert.doesNotMatch(load, /Abhi na ho to baad mein/);
assert.match(load, /Save TID/);

assert.match(bill, /Bina is ke bill save nahi hota/);
assert.match(bill, /name="provider_tid"[^>]*required/);

mkdirSync("/tmp/load-tx-id-preview", { recursive: true });
const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font:16px/1.4 system-ui,sans-serif;background:#f6f7f4;color:#17251e;margin:24px}
  form{max-width:640px;background:#fff;border:1px solid #d9e0da;border-radius:12px;padding:16px}
  label{display:block;font-weight:650;margin:12px 0 6px}
  input,select{width:100%;box-sizing:border-box;height:40px;border:1px solid #c9d2cb;border-radius:8px;padding:0 10px}
  .text-red-600{color:#dc2626}
  p{color:#3f5c49;font-size:13px}
  button{margin-top:12px;background:#087a42;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:700}
</style></head><body><h1>${title}</h1>${body}</body></html>`;
writeFileSync("/tmp/load-tx-id-preview/load.html", page("Mobile Load", load));
writeFileSync("/tmp/load-tx-id-preview/bill.html", page("Bill Payment", bill));
console.log("rendered load and bill with required Tx ID");
}

main();
