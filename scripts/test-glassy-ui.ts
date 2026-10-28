/* Glassy UI (wallet card, payment modal, receipt print): pure helpers + wiring. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { maskFrm, optionName, paymentPreview, printFrames, receiptText, receiptWhatsAppUrl, soundOn, withdrawLink } from "../src/lib/glass/glass";
let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log("ok -", name); };
const src = (p: string) => readFileSync(p, "utf8");

ok("maskFrm", () => {
  assert.equal(maskFrm("FRM-000047"), "FRM •••• •••• 0047");
  assert.equal(maskFrm(null), "FRM •••• •••• 0000");
  assert.equal(maskFrm("frm-12"), "FRM •••• •••• 0012");
});
ok("paymentPreview pay/receive/short", () => {
  assert.deepEqual(paymentPreview({ direction: "pay", amount: 30000, accountBalance: 401235 }), { amount: 30000, before: 401235, after: 371235, short: false });
  assert.equal(paymentPreview({ direction: "receive", amount: "500", accountBalance: 100 }).after, 600);
  assert.equal(paymentPreview({ direction: "pay", amount: 500, accountBalance: 100 }).short, true);
  assert.equal(paymentPreview({ direction: "pay", amount: -5, accountBalance: null }).after, null);
});
ok("optionName", () => assert.equal(optionName("Bank Alfalah — Rs 401,235"), "Bank Alfalah"));
ok("receipt text + wa.me only (no auto-send)", () => {
  const r = { kind: "payment" as const, no: "JE-1", date: "2026-10-20", from: "Bank Alfalah", to: "Yasir Ali (Diesel)", amount: 30000 };
  assert.match(receiptText(r), /Bank Alfalah se -> Yasir Ali \(Diesel\)/);
  assert.match(receiptText(r), /Rs 30,000/);
  assert.ok(receiptWhatsAppUrl(r).startsWith("https://wa.me/?text="));
  assert.ok(receiptWhatsAppUrl(r, "03226275476").startsWith("https://wa.me/923226275476?text="));
  assert.ok(withdrawLink("FRM-1").startsWith("https://wa.me/923226275476?text="));
});
ok("sound default OFF, reduced motion = one frame", () => {
  assert.equal(soundOn(null), false); assert.equal(soundOn("0"), false); assert.equal(soundOn("1"), true);
  assert.deepEqual(printFrames(true), [100]); assert.equal(printFrames(false).at(-1), 100);
});
ok("receipt component: no fetch/send, wa link via <a>, reduced-motion, sound persisted", () => {
  const s = src("src/components/glass/receipt-print.tsx");
  assert.ok(!/fetch\(|sendMessage|navigator\.share/.test(s));
  assert.match(s, /prefers-reduced-motion/);
  assert.match(s, /localStorage\.setItem\(SOUND_KEY/);
  assert.match(s, /href=\{receiptWhatsAppUrl/);
});
ok("wallet page: glass behind KISAN_WALLET_V2, old v2 + classic kept", () => {
  const s = src("src/app/portal/wallet/page.tsx");
  assert.match(s, /if \(showWalletV2\(process\.env, searchParams\?\.look\)\)/);
  assert.match(s, /look === "card"\) return <KisanWalletV2/);
  assert.match(s, /<KisanWalletGlass /);
  const g = src("src/components/portal/kisan-wallet/kisan-wallet-glass.tsx");
  for (const k of ["deposit", "withdraw", "qr", "statement"]) assert.ok(g.includes(`k: "${k}"`), k);
  assert.ok(!/fetch\(|insert\(|update\(/.test(g));
});
ok("admin wallet page: glass only behind flag, statement intact", () => {
  const s = src("src/app/admin/wallets/[farmerId]/page.tsx");
  assert.match(s, /kisanWalletV2Enabled\(\) \?/);
  assert.match(s, /<WalletStatementClient/);
});
ok("recovery modal: posting untouched, summary read-only", () => {
  const s = src("src/app/admin/finance/recovery/recovery-client.tsx");
  assert.equal((s.match(/fetch\("\/api\/recovery\/money"/g) ?? []).length, 1);
  assert.match(s, /<PaymentLiveSummary /);
  assert.match(s, /queueReceipt\(/);
  for (const name of ["amount", "paymentDate", "financeAccountId", "againstAccountCode", "purpose", "billReference", "destinationId", "proof", "notes"]) assert.ok(s.includes(`name="${name}"`), name);
  const p = src("src/components/glass/payment-live-summary.tsx");
  assert.ok(!/fetch\(|\.value\s*=[^=]|requestSubmit|submit\(/.test(p));
});
ok("pos + wallet deposit wired", () => {
  assert.match(src("src/components/pos/pos-client.tsx"), /<ReceiptPrint receipt=\{saleAnim\}/);
  assert.match(src("src/app/admin/wallets/wallet-adjustment-modal.tsx"), /direction === "credit"/);
});
console.log(`\n${n} glassy-ui tests passed`);
