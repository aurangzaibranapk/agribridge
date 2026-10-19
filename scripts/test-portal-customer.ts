/**
 * Customer Portal (Phase 5) -- helpers, validation, i18n aur wiring ke tests.
 * Chalayein: npm run test:portal-customer   (572-573 ka asal SQL test: tests/portal-customer-sql.mjs)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  addDaysIso, addMonthsYm, adminFilter, adminKpis, daysBetween, dbErrorKey, invitePreview, limitUsedPct, monthlySeries, monthTotals, orderOpen,
  parseAdminCustomers, parseBills, parseOrders, parseProfile, parsePromises, parseQueue, parseRequests, profileComplete, promiseState, promisesKept,
  proofOk, proofPath, rs, stepIndex, validateChange, validateClaim, validateDispute, validatePromise, PROOF_MAX_BYTES, TERMS_VERSION,
} from "../src/lib/portal/customer";
import { portalCustomerDict } from "../src/lib/i18n/dict/portal-customer";

let passed = 0;
const test = (n: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${n}`); };
const T = "2026-10-19";
const fd = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) }) as unknown as FormData;
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test("profile parse + darwaza (naam + mobile)", () => {
  assert.equal(parseProfile(null), null);
  assert.equal(parseProfile({ customers: [] }), null);
  const p = parseProfile({ customers: [{ id: "a", code: "C-1", name: "Ali", has_phone: true, credit_limit: "5000" }], farmer_linked: false })!;
  assert.equal(p.customers[0].credit_limit, 5000);
  assert.ok(profileComplete(p.customers[0]));
  assert.ok(!profileComplete({ ...p.customers[0], has_phone: false }));
  assert.ok(!profileComplete({ ...p.customers[0], name: "  " }));
});

test("no cost / profit fields reach the UI types", () => {
  const b = parseBills([{ id: "1", ref: "POS-1", date: "2026-10-01T10:00", total: 900, items: [{ name: "Urea", qty: 1, rate: 900, amount: 900, unit_cost: 700, line_cogs: 700 }], profit: 200 }]);
  assert.equal(b[0].date, "2026-10-01");
  assert.deepEqual(Object.keys(b[0].items[0]).sort(), ["amount", "name", "qty", "rate"]);
  assert.ok(!("profit" in b[0]));
  const sql = read("supabase/migrations/572_customer_portal_read.sql");
  // 572 ke jawab mein kabhi cost/cogs/profit ki chaabi nahi
  for (const k of ["'unit_cost'", "'line_cogs'", "'cost'", "'profit'", "'margin'", "'cogs'"]) assert.ok(!sql.includes(k), k);
});

test("orders: marhale aur khula/band", () => {
  const [o] = parseOrders([{ id: "o", number: "AO-1", status: "dispatched", steps: { sales: true, finance: true, approved: true } }]);
  assert.equal(stepIndex(o.steps), 4);
  assert.ok(orderOpen(o));
  assert.ok(!orderOpen({ ...o, steps: { ...o.steps, delivered: true } }));
  assert.ok(!orderOpen({ ...o, rejected: true }));
});

test("promises: kept / partly / broken / open", () => {
  const ps = parsePromises([
    { id: "1", amount: 1000, fulfilled: 1000, status: "closed" }, { id: "2", amount: 1000, fulfilled: 300, status: "closed" },
    { id: "3", amount: 1000, fulfilled: 0, status: "broken" }, { id: "4", amount: 500, fulfilled: 0, status: "open" },
  ]);
  assert.deepEqual(ps.map(promiseState), ["kept", "partly", "broken", "open"]);
  assert.deepEqual(promisesKept(ps), { kept: 1, closed: 3 });
});

test("hisaab: maheene, totals, limit, rs, dates", () => {
  assert.equal(addMonthsYm("2026-01", -1), "2025-12");
  assert.equal(addMonthsYm("2026-11", 2), "2027-01");
  const rows = [
    { entry_date: "2026-10-03", udhaar: 500, adaigi: 0, is_opening: false }, { entry_date: "2026-09-10", udhaar: 0, adaigi: 200, is_opening: false },
    { entry_date: null, udhaar: 9999, adaigi: 0, is_opening: true },
  ] as never;
  const s = monthlySeries(rows, T, 3);
  assert.deepEqual(s.map((x) => x.month), ["2026-08", "2026-09", "2026-10"]);
  assert.equal(s[2].buy, 500); assert.equal(s[1].paid, 200);
  const mt = monthTotals(parseBills([{ id: "1", date: "2026-10-02", total: 300, items: [{ name: "A" }, { name: "B" }] }, { id: "2", date: "2026-09-02", total: 50 }]),
    [{ date: "2026-10-05", ref: null, kind: "adaigi", amount: 100 }], T);
  assert.deepEqual([mt.buy, mt.bills, mt.products, mt.paid, mt.lastPaid], [300, 1, 2, 100, "2026-10-05"]);
  assert.equal(limitUsedPct(500, 0), null); assert.equal(limitUsedPct(750, 1000), 75); assert.equal(limitUsedPct(5000, 1000), 100); assert.equal(limitUsedPct(-5, 1000), 0);
  assert.equal(rs(125000), "Rs 1,25,000"); assert.equal(rs(-50), "-Rs 50");
  assert.equal(daysBetween("2026-10-01", T), 18); assert.equal(addDaysIso(T, 30), "2026-11-18");
});

test("validate: payment claim", () => {
  assert.ok(validateClaim(fd({ amount: "5,000", method: "jazzcash", paid_on: T }), T).ok);
  assert.equal((validateClaim(fd({ amount: "0", method: "cash" }), T) as { error: string }).error, "pc_err_amount");
  assert.equal((validateClaim(fd({ amount: "10", method: "crypto" }), T) as { error: string }).error, "pc_err_generic");
  assert.equal((validateClaim(fd({ amount: "10", method: "cash", paid_on: "2026-10-20" }), T) as { error: string }).error, "pc_err_date");
  assert.equal((validateClaim(fd({ amount: "10", method: "cash", paid_on: "2026-06-01" }), T) as { error: string }).error, "pc_err_date");
});

test("validate: promise (sharaait + 30 din)", () => {
  assert.equal((validatePromise(fd({ amount: "100", promise_date: "2026-10-25" }), T) as { error: string }).error, "pc_err_terms");
  assert.ok(validatePromise(fd({ accept: "on", amount: "100", promise_date: "2026-10-25" }), T).ok);
  assert.equal((validatePromise(fd({ accept: "on", amount: "100", promise_date: "2026-11-30" }), T) as { error: string }).error, "pc_err_promise_date");
  assert.equal((validatePromise(fd({ accept: "on", amount: "100", promise_date: "2026-10-01" }), T) as { error: string }).error, "pc_err_promise_date");
  assert.equal(TERMS_VERSION, "v3");
});

test("validate: change + dispute", () => {
  assert.ok(validateChange(fd({ field: "address", value: "Chak 12" })).ok);
  assert.ok(!validateChange(fd({ field: "credit_limit", value: "999999" })).ok); // had khud nahi badal sakta
  assert.ok(!validateChange(fd({ field: "name", value: "X" })).ok);
  assert.ok(!validateChange(fd({ field: "cnic", value: "123" })).ok);
  assert.ok(validateChange(fd({ field: "cnic", value: "35202-1234567-1" })).ok);
  assert.ok(!validateChange(fd({ field: "email", value: "nope" })).ok);
  assert.ok(!validateDispute(fd({ message: "x" })).ok);
  assert.ok(validateDispute(fd({ message: "Ye bill mera nahi", ref: "POS-1" })).ok);
});

test("proof file: qisam + size + apna folder", () => {
  assert.ok(proofOk({ size: 1000, type: "image/jpeg" }));
  assert.ok(!proofOk({ size: PROOF_MAX_BYTES + 1, type: "image/jpeg" }));
  assert.ok(!proofOk({ size: 10, type: "text/html" }));
  assert.ok(!proofOk({ size: 0, type: "image/png" }));
  assert.equal(proofPath("cust1", "id1", "application/pdf"), "cust1/id1.pdf");
  assert.ok(PROOF_MAX_BYTES < 1_000_000, "server action ki 1MB had se kam");
});

test("db errors -> chaabi", () => {
  assert.equal(dbErrorKey("Aaj ki had poori"), "pc_err_limit");
  assert.equal(dbErrorKey("relation x does not exist"), "pc_err_generic");
  assert.equal(dbErrorKey(null), "pc_err_generic");
});

test("admin: list, filter, kpis, queue, invite preview", () => {
  const rows = parseAdminCustomers([
    { id: "1", code: "C-1", name: "Ali", farmer_code: "F-1", balance: 2000, credit_limit: 1000, portal: "active", pending: 2 },
    { id: "2", code: "C-2", name: "Shop", balance: 0, credit_limit: 0, portal: "weird", pending: 0 },
  ]);
  assert.equal(rows[1].portal, "none");
  assert.equal(adminFilter(rows, "over", "").length, 1);
  assert.equal(adminFilter(rows, "shop", "").length, 1);
  assert.equal(adminFilter(rows, "all", "ali").length, 1);
  const k = adminKpis(rows);
  assert.deepEqual([k.total, k.farmer, k.shop, k.active, k.noLogin, k.pending, k.over, k.overAmt], [2, 1, 1, 1, 1, 2, 1, 2000]);
  const q = parseQueue([{ kind: "evil", id: "q", amount: null, can_check: 1 }]);
  assert.equal(q[0].kind, "claim"); assert.equal(q[0].can_check, true); assert.equal(q[0].can_approve, false);
  assert.equal(invitePreview("Salam {name} {url}", "Ali", "https://x"), "Salam Ali https://x");
  const r = parseRequests({ claims: [{ id: "c", amount: "10", status: "submitted" }] });
  assert.equal(r.claims[0].amount, 10); assert.deepEqual(r.disputes, []);
});

test("i18n: har pc_ chaabi teeno zabanon mein, Urdu rasm-ul-khat", () => {
  const entries = Object.entries(portalCustomerDict) as [string, { en: string; rm: string; ur: string }][];
  assert.ok(entries.length > 200);
  for (const [k, v] of entries) {
    assert.ok(k.startsWith("pc_"), k);
    assert.ok(v.en && v.rm && v.ur, `${k} khali`);
  }
  const urduCount = entries.filter(([, v]) => /[\u0600-\u06FF]/.test(v.ur)).length;
  assert.ok(urduCount / entries.length > 0.9, `urdu ${urduCount}/${entries.length}`);
  // UI mein istemal hone wali har pc_ chaabi dict mein maujood ho
  const files = [...walk("src/app/portal/c"), ...walk("src/app/admin/customer-portal"), ...walk("src/components/portal/customer"), "src/components/portal/sidebar.tsx"];
  const used = new Set(files.flatMap((f) => [...read(f).matchAll(/["'`](pc_[a-z0-9_]+)["'`]/g)].map((m) => m[1])));
  for (const k of used) assert.ok(k in portalCustomerDict, `gum chaabi ${k}`);
  assert.ok(read("src/lib/i18n/translations.ts").includes("portalCustomerDict"));
});

test("wiring: no service role, no direct writes, no sends", () => {
  const files = [...walk("src/app/portal/c"), ...walk("src/app/admin/customer-portal"), ...walk("src/components/portal/customer"), "src/lib/portal/customer.ts", "src/lib/portal/customer-load.ts"];
  for (const f of files) {
    const s = read(f);
    assert.ok(!/service_role|SERVICE_ROLE|createAdminClient|supabaseAdmin/.test(s), `service role: ${f}`);
    assert.ok(!/customer_(payment_claims|change_requests|khata_disputes|promise_requests)["'`]\)\s*\.(insert|update|delete|upsert)/.test(s), `direct write: ${f}`);
    assert.ok(!/\.delete\(/.test(s), `delete: ${f}`);
    assert.ok(!/sendWhatsApp|sendSms|sendEmail|twilio|resend\.|nodemailer|wa\.me|graph\.facebook/i.test(s), `send: ${f}`);
  }
  const act = read("src/app/portal/c/actions.ts");
  for (const fn of ["fn_my_submit_payment_claim", "fn_my_request_promise", "fn_my_request_change", "fn_my_open_dispute"]) assert.ok(act.includes(fn), fn);
  assert.ok(act.includes("upsert: false"));
  const inv = read("src/app/admin/customer-portal/invite-button.tsx");
  assert.ok(/disabled aria-disabled="true"/.test(inv), "invite send band");
  assert.ok(!/fetch\(|"use server"|Action\(/.test(inv), "invite: koi server call nahi");
  const adm = read("src/app/admin/customer-portal/actions.ts");
  for (const fn of ["fn_cp_check", "fn_cp_approve", "fn_cp_reject", "fn_cp_dispute_update"]) assert.ok(adm.includes(fn), fn);
  assert.ok(read("src/lib/utils/roles.ts").includes('if (role === "customer") return "/portal/c"'));
});

test("migrations: additive, maker-checker, no delete", () => {
  const m = read("supabase/migrations/573_customer_portal_requests.sql");
  const r = read("supabase/migrations/572_customer_portal_read.sql");
  for (const sql of [m, r]) {
    assert.ok(!/\bdrop\s+table\b/i.test(sql)); assert.ok(!/\btruncate\b/i.test(sql)); assert.ok(!/\bdelete\s+from\b/i.test(sql));
    assert.ok(!/\balter\s+table\s+\S+\s+drop\b/i.test(sql));
  }
  assert.ok(/fn_cp_no_delete/.test(m));
  assert.ok(/approved_by\s*<>\s*created_by/i.test(m) || /approved_by\s+is\s+distinct\s+from\s+created_by/i.test(m), "approver != entrant check");
  assert.ok(!/for\s+delete/i.test(m), "koi delete policy nahi");
});

console.log(`portal-customer: ${passed} passed`);
