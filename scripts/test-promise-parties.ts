import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PromisePartyCell } from "../src/components/recovery/promise-party-cell";
import { promiseCardSvg } from "../src/lib/recovery/promise-card";
import {
  PROMISE_PARTY_SOURCES,
  focusPageIndex,
  formatPromiseDate,
  indexOutstanding,
  loadPartyReceipts,
  loadPromiseParties,
  outstandingOf,
  promiseChatOpener,
  promisePartyOf,
  promiseRecoveryHref,
  promiseWhatsAppHref,
  receivedOf,
  recoveryFocusKey,
  rsLabel,
  type PartyLookupDb,
  type ReceiptLookupDb,
} from "../src/lib/recovery/promise-parties";

const customerId = "11111111-1111-4111-8111-111111111111";
const farmerId = "22222222-2222-4222-8222-222222222222";
const dealerId = "33333333-3333-4333-8333-333333333333";
const supplierId = "44444444-4444-4444-8444-444444444444";

assert.equal(promiseRecoveryHref("customer", customerId), `/admin/finance/recovery?customer=${customerId}`);
assert.equal(promiseRecoveryHref("farmer", farmerId), `/admin/finance/recovery?focus=${encodeURIComponent(`farmer:${farmerId}`)}`);
assert.equal(promiseRecoveryHref("dealer", dealerId), `/admin/finance/recovery?focus=${encodeURIComponent(`dealer:${dealerId}`)}`);
assert.equal(promiseRecoveryHref("supplier", supplierId), `/admin/finance/recovery?focus=${encodeURIComponent(`supplier:${supplierId}`)}`);

assert.equal(recoveryFocusKey({ customer: customerId }), `customer:${customerId}`);
assert.equal(recoveryFocusKey({ focus: `Farmer:${farmerId}` }), `farmer:${farmerId}`);
assert.equal(recoveryFocusKey({ focus: "nope", customer: "not-a-uuid" }), null);
assert.equal(recoveryFocusKey({ focus: `dealer:${dealerId}`, customer: customerId }), `dealer:${dealerId}`);

const parties = Array.from({ length: 10 }, (_, i) => ({ type: "customer", id: `id-${i}` }));
parties[9] = { type: "farmer", id: farmerId.toUpperCase() };
assert.deepEqual(focusPageIndex(parties, `farmer:${farmerId}`, 8), { key: `farmer:${farmerId.toUpperCase()}`, page: 1 });
assert.deepEqual(focusPageIndex(parties, `customer:${customerId}`, 8), { key: null, page: 0 });

assert.equal(PROMISE_PARTY_SOURCES.customer.name, "name");
assert.equal(PROMISE_PARTY_SOURCES.farmer.name, "full_name");
assert.equal(PROMISE_PARTY_SOURCES.dealer.name, "business_name");
assert.equal(PROMISE_PARTY_SOURCES.supplier.name, "name");
assert.equal(PROMISE_PARTY_SOURCES.customer.phone, "phone_number");

const calls: { table: string; select: string; ids: string[] }[] = [];
const many = Array.from({ length: 151 }, (_, i) => `c${i}`);
const db: PartyLookupDb = {
  from(table) {
    return {
      select(columns) {
        return {
          async in(_column, ids) {
            calls.push({ table, select: columns, ids: [...ids] });
            if (table === "customers" && ids.includes(customerId)) {
              return { data: [{ id: customerId, name: " Ali Rana ", phone_number: " 03001234567 " }] };
            }
            if (table === "farmers") return { data: [{ id: farmerId, full_name: "Kisan B", phone_number: "" }] };
            if (table === "dealers") return { data: [{ id: dealerId, business_name: "Rana Traders", phone_number: "03111111111" }] };
            if (table === "suppliers") return { data: [{ id: supplierId, name: "   ", phone_number: "0300" }] };
            return { data: ids.map((id) => ({ id, name: `N-${id}`, phone_number: null })) };
          },
        };
      },
    };
  },
};

async function main() {
const directory = await loadPromiseParties(db, [
  { party_type: "customer", party_id: customerId },
  { party_type: "customer", party_id: customerId },
  { party_type: "farmer", party_id: farmerId },
  { party_type: "dealer", party_id: dealerId },
  { party_type: "supplier", party_id: supplierId },
  { party_type: "staff", party_id: customerId },
  ...many.map((id) => ({ party_type: "customer", party_id: id })),
]);

assert.deepEqual(promisePartyOf(directory, "customer", customerId), { name: "Ali Rana", phone: "03001234567" });
assert.deepEqual(promisePartyOf(directory, "farmer", farmerId), { name: "Kisan B", phone: null });
assert.equal(promisePartyOf(directory, "dealer", dealerId).name, "Rana Traders");
assert.deepEqual(promisePartyOf(directory, "supplier", supplierId), { name: null, phone: "0300" });
assert.equal(calls.filter((c) => c.table === "customers").length, 2);
assert.equal(calls.find((c) => c.table === "farmers")?.select, "id, full_name, phone_number");
assert.equal(calls.find((c) => c.table === "customers")?.ids.filter((id) => id === customerId).length, 1);
assert.equal(calls.some((c) => c.table === "profiles"), false);

assert.equal(formatPromiseDate("2026-11-15"), "15 Nov 2026");
assert.match(rsLabel(160473), /^Rs \S/);
assert.equal(rsLabel(0), "Rs 0");
assert.equal(rsLabel(null), "—");
const opener = promiseChatOpener("Ali Rana");
assert.equal(opener, "Assalam o Alaikum Ali Rana sb, Al Rana Traders ki payment reminder card.");
assert.doesNotMatch(opener, /Aap ne promise kiya tha/);

const wa = promiseWhatsAppHref("0300 1234567", opener);
assert.ok(wa);
assert.match(wa!, /^https:\/\/wa\.me\/923001234567\?text=/);
assert.equal(decodeURIComponent(wa!.split("?text=")[1]), opener);
assert.equal(promiseWhatsAppHref("+92-300-1234567", "Hi"), "https://wa.me/923001234567?text=Hi");
assert.equal(promiseWhatsAppHref("0300", opener), null);
assert.equal(promiseWhatsAppHref(null, opener), null);
assert.doesNotMatch(wa!, /graph\.facebook|business/);

const balances = indexOutstanding([
  { party_type: "customer", party_id: customerId, outstanding: 210000 },
  { party_type: "farmer", party_id: farmerId, outstanding: 0 },
]);
assert.equal(outstandingOf(balances, "customer", customerId), 210000);
assert.equal(outstandingOf(balances, "farmer", farmerId), 0);
assert.equal(outstandingOf(balances, "dealer", dealerId), null);
assert.equal(outstandingOf(null, "customer", customerId), null);

const receiptCalls: string[] = [];
const receiptDb: ReceiptLookupDb = {
  from(table) {
    return {
      select() {
        const filters: Record<string, string> = {};
        const api = {
          eq(column: string, value: string) {
            filters[column] = value;
            return api;
          },
          in() { return api; },
          gt() { return api; },
          async range() {
            receiptCalls.push(`${table}:${filters.party_type}:${filters.account_code}`);
            if (filters.party_type === "customer") {
              return { data: [{ party_type: "customer", party_id: customerId, credit: 40000 }, { party_type: "customer", party_id: customerId, credit: 500 }], error: null };
            }
            if (filters.party_type === "farmer") return { data: [], error: null };
            return { data: null, error: { message: "khata band" } };
          },
        };
        return api;
      },
    };
  },
};
const paid = await loadPartyReceipts(receiptDb, [
  { party_type: "customer", party_id: customerId },
  { party_type: "customer", party_id: customerId },
  { party_type: "farmer", party_id: farmerId },
]);
assert.equal(receivedOf(paid, "customer", customerId), 40500);
assert.equal(receivedOf(paid, "farmer", farmerId), 0);
assert.ok(receiptCalls.includes("journal_lines:customer:1100"));
assert.ok(receiptCalls.includes("journal_lines:farmer:1150"));
const failedPaid = await loadPartyReceipts(receiptDb, [{ party_type: "dealer", party_id: dealerId }]);
assert.equal(failedPaid, null);
assert.equal(receivedOf(failedPaid, "dealer", dealerId), null);

const card = {
  partyName: "Ali Rana",
  promiseDate: "15 Nov 2026",
  promiseAmount: rsLabel(160473),
  totalOutstanding: rsLabel(210000),
  totalReceived: rsLabel(40500),
};
const svg = promiseCardSvg(card);
assert.match(svg, /AL RANA TRADERS/);
assert.match(svg, /Payment Reminder/);
assert.match(svg, /Ali Rana/);
assert.match(svg, /15 Nov 2026/);
assert.match(svg, /THIS PROMISE/);
assert.match(svg, /TOTAL OUTSTANDING/);
assert.match(svg, /TOTAL PAYMENT/);
assert.match(svg, /already received/);
assert.match(svg, new RegExp(rsLabel(160473).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(svg, /Meherbani karke apna wada poora karein/);
assert.doesNotMatch(svg, />Customer</);
const unknownSvg = promiseCardSvg({
  partyName: "Naam nahi mila",
  promiseDate: "—",
  promiseAmount: "—",
  totalOutstanding: "—",
  totalReceived: "—",
});
assert.match(unknownSvg, /Naam nahi mila/);
assert.doesNotMatch(unknownSvg, /Naam nahi mila sb/);
assert.doesNotMatch(unknownSvg, /Rs 0/);

const named = renderToStaticMarkup(
  React.createElement(PromisePartyCell, {
    name: "Ali Rana",
    phone: "03001234567",
    partyType: "customer",
    recoveryHref: promiseRecoveryHref("customer", customerId),
    whatsAppHref: wa,
    card,
  }),
);
assert.match(named, /Ali Rana/);
assert.match(named, /03001234567/);
assert.match(named, /Reminder card/);
assert.match(named, />WhatsApp</);
assert.match(named, /Recovery dashboard/);
assert.match(named, /https:\/\/wa\.me\/923001234567\?text=/);
assert.match(named, /target="_blank"/);
assert.match(named, new RegExp(`/admin/finance/recovery\\?customer=${customerId}`));
assert.doesNotMatch(named, />Customer</);
const decoded = decodeURIComponent(named.match(/text=([^"]+)/)![1].replace(/&amp;/g, "&"));
assert.match(decoded, /payment reminder card/);
assert.doesNotMatch(decoded, /Aap ne promise kiya tha/);

const missing = renderToStaticMarkup(
  React.createElement(PromisePartyCell, {
    name: null,
    phone: null,
    partyType: "farmer",
    recoveryHref: promiseRecoveryHref("farmer", farmerId),
    whatsAppHref: null,
    card: {
      partyName: "Naam nahi mila",
      promiseDate: "15 Nov 2026",
      promiseAmount: rsLabel(1000),
      totalOutstanding: "—",
      totalReceived: "—",
    },
  }),
);
assert.match(missing, /Naam nahi mila/);
assert.match(missing, /Reminder card/);
assert.match(missing, /Phone number nahi mila/);
assert.doesNotMatch(missing, /wa\.me/);
assert.match(missing, /focus=/);

const page = readFileSync("src/app/admin/finance/recovery/promises/page.tsx", "utf8");
assert.match(page, /loadPromiseParties/);
assert.match(page, /loadPartyReceipts/);
assert.match(page, /fn_recovery_outstanding/);
assert.match(page, /promiseWhatsAppHref/);
assert.match(page, /promiseChatOpener/);
assert.match(page, /PromisePartyCell/);
assert.doesNotMatch(page, /promiseReminderText/);
assert.doesNotMatch(page, /api\.whatsapp\.com\/send|graph\.facebook/);
assert.match(page, /updatePromiseStatus/);
assert.match(page, /name="status"/);
assert.match(page, /name="promisedAmount"/);
assert.doesNotMatch(page, /\{r\.party_type\}<\/td>/);

const recovery = readFileSync("src/app/admin/finance/recovery/page.tsx", "utf8");
assert.match(recovery, /initialFocusKey=\{focusKey\}/);
assert.match(recovery, /recoveryFocusKey/);

const client = readFileSync("src/app/admin/finance/recovery/recovery-client.tsx", "utf8");
assert.match(client, /focusPageIndex/);
assert.match(client, /initialFocusKey/);

console.log("PASS: promise party names and reminder links");
}

main();
