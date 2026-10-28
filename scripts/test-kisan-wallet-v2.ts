/* Kisan Wallet v2: flag, data mapping, QR token, scan auth, own-data, QR encoder. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildWalletV2, cardNumber, formatMobile, kisanWalletV2Enabled, lastEntries, memberSince, seasonPlan, showWalletV2 } from "../src/lib/portal/kisan-wallet";
import { signKisanQr, verifyKisanQr, kisanQrSecret } from "../src/lib/portal/kisan-qr";
import { kisanScanDecision } from "../src/lib/portal/kisan-scan";
import { encodeQr } from "../src/lib/qr/qr-encode";
let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log("ok -", name); };

ok("flag off by default / parity", () => {
  assert.equal(kisanWalletV2Enabled({}), false);
  assert.equal(showWalletV2({}, undefined), false);
  assert.equal(showWalletV2({ KISAN_WALLET_V2: "0" }, undefined), false);
  assert.equal(showWalletV2({ KISAN_WALLET_V2: "1" }, undefined), true);
  assert.equal(showWalletV2({ KISAN_WALLET_V2: "true" }, "classic"), false);
});
ok("flag-off page source: v2 only behind guard, old JSX intact", () => {
  const src = readFileSync("src/app/portal/wallet/page.tsx", "utf8");
  assert.match(src, /if \(showWalletV2\(process\.env, searchParams\?\.look\)\)/);
  assert.match(src, /\{v2Flag && \(/);
  for (const s of ["loadKhata(range.from, range.to)", "StatementTable", "id=\"adaigi\"", "WalletView"]) assert.ok(src.includes(s), s);
});
ok("data mapping", () => {
  assert.equal(cardNumber("FRM-000003"), "**** **** **** 0003");
  assert.equal(cardNumber(null), "**** **** **** 0000");
  assert.equal(memberSince("2025-03-14T10:00:00Z"), "03/25");
  assert.deepEqual(formatMobile("923457583294"), { plain: "0345 7583294", masked: "0345 ••• ••94" });
  assert.equal(formatMobile(""), null);
  const rows = [
    { entry_date: null, ref: null, category: "purana", kind: "opening", tafseel: "Opening", udhaar: 0, adaigi: 0, baqaya: 100, is_opening: true },
    { entry_date: "2026-10-01", ref: "A", category: "khaad", kind: "udhaar", tafseel: "DAP", udhaar: 9000, adaigi: 0, baqaya: 0, is_opening: false },
    { entry_date: "2026-10-05", ref: "B", category: "adaigi", kind: "adaigi", tafseel: "Cash", udhaar: 0, adaigi: 5000, baqaya: 0, is_opening: false },
    { entry_date: "2026-10-03", ref: "C", category: "gandum", kind: "adaigi", tafseel: "Gandum", udhaar: 0, adaigi: 2000, baqaya: 0, is_opening: false },
    { entry_date: "2026-09-01", ref: "D", category: "beej", kind: "udhaar", tafseel: "Beej", udhaar: 1, adaigi: 0, baqaya: 0, is_opening: false },
  ];
  const le = lastEntries(rows);
  assert.deepEqual(le.map((e) => e.ref), ["B", "C", "A"]);
  assert.equal(le[0].direction, "adaigi"); assert.equal(le[2].direction, "udhaar");
  assert.equal(seasonPlan([{ acres: 5, status: "cancelled", created_at: "2026-10-02", campaign: { crop: "maize" } }, { acres: "12", status: "confirmed", created_at: "2026-10-01", campaign: { crop: "wheat" } }])?.label, "Wheat");
  assert.equal(seasonPlan([]), null);
  assert.equal(seasonPlan([{ acres: 3, status: "x", campaign: null }]), null);
  const d = buildWalletV2({ farmer: { id: "f", full_name: "Aurangzaib", farmer_code: "FRM-000003", credit_limit: "50000", created_at: "2025-01-01", whatsapp_number: null, phone_number: "03457583294", profile_photo_url: null, member_photo_url: "m.jpg" }, totalBaqi: 20000, summaryOwed: 999, rows, bookings: [] });
  assert.equal(d.baqaya, 20000); assert.equal(d.creditLimit, 50000); assert.equal(d.gunjaish, 30000); assert.equal(d.usedPct, 40);
  assert.equal(d.photo, "m.jpg"); assert.equal(d.nameCaps, "AURANGZAIB"); assert.equal(d.plan, null);
  const d2 = buildWalletV2({ farmer: { id: "f", full_name: null, farmer_code: "FRM-1", credit_limit: null }, totalBaqi: null, summaryOwed: -500, rows: [] });
  assert.equal(d2.baqaya, -500); assert.equal(d2.creditLimit, null); assert.equal(d2.gunjaish, null); assert.equal(d2.initials, "F");
});
const S = "test-secret-0123456789abcdef", FID = "0f8fad5b-d9cb-469f-a165-70867728950e";
ok("QR token sign/verify/expiry/tamper, no balance", () => {
  const tok = signKisanQr(FID, S, 1000, 600);
  assert.deepEqual(verifyKisanQr(tok, S, 1500), { ok: true, farmerId: FID, exp: 1600 });
  assert.equal(verifyKisanQr(tok, S, 1601).ok, false);
  assert.deepEqual(verifyKisanQr(tok, S, 1601), { ok: false, reason: "expired" });
  assert.deepEqual(verifyKisanQr(tok, "other-secret-0123456789", 1500), { ok: false, reason: "bad_signature" });
  const p = tok.split("."); p[2] = (9999999).toString(36);
  assert.deepEqual(verifyKisanQr(p.join("."), S, 1500), { ok: false, reason: "bad_signature" });
  assert.equal(verifyKisanQr("junk", S).ok, false);
  assert.equal(tok.split(".").length, 4); assert.ok(!/baq|bal|rs/i.test(tok.split(".")[0]));
  assert.throws(() => signKisanQr("not-a-uuid", S));
  assert.equal(kisanQrSecret({}), null); assert.equal(kisanQrSecret({ KISAN_QR_SECRET: "short" }), null);
});
ok("scan requires staff login", () => {
  const tok = signKisanQr(FID, S);
  assert.deepEqual(kisanScanDecision({ auth: { error: "x", status: 401 }, token: tok, secret: S, verify: verifyKisanQr }), { kind: "login" });
  assert.equal(kisanScanDecision({ auth: { error: "x", status: 403 }, token: tok, secret: S, verify: verifyKisanQr }).kind, "error");
  assert.equal(kisanScanDecision({ auth: { caller: { role: "sales_staff" } }, token: tok, secret: null, verify: verifyKisanQr }).kind, "error");
  assert.deepEqual(kisanScanDecision({ auth: { caller: { role: "sales_staff" } }, token: tok, secret: S, verify: verifyKisanQr }), { kind: "open", href: `/admin/farmers/${FID}/statement` });
  const scan = readFileSync("src/app/admin/kisan-scan/page.tsx", "utf8");
  assert.ok(scan.indexOf("requireStaff()") < scan.indexOf("redirect(d.href)"));
});
ok("own data only: loader uses session client + own farmer id, no service role, no writes", () => {
  const src = readFileSync("src/lib/portal/kisan-wallet-load.ts", "utf8");
  assert.ok(!/service|SERVICE_ROLE|admin-client/i.test(src.replace(/service client istemal nahi/, "")));
  assert.ok(!/\.(insert|update|upsert|delete)\(/.test(src));
  assert.equal((src.match(/\.eq\("(id|farmer_id)", farmerId\)/g) ?? []).length, 3);
  assert.ok(src.includes("loadKhata(null, null)")); // fn_my_khata_* = auth.uid()
  const page = readFileSync("src/app/portal/wallet/page.tsx", "utf8");
  assert.ok(page.indexOf('eq("user_id", user.id)') < page.indexOf("loadKisanWalletV2(farmer.id)"));
  assert.ok(page.indexOf("checkFarmerVerification") < page.indexOf("loadKisanWalletV2(farmer.id)"));
});
ok("QR encoder known vector + capacity", () => {
  const q = encodeQr("hello", 0);
  const h = createHash("sha256").update(q.modules.map((r) => r.map((b) => (b ? 1 : 0)).join("")).join("\n")).digest("hex");
  assert.equal(h, "52a7aa67e7296ede539d6be86579c7180e3b6d417445712ae8bd314c1818458a");
  const url = `https://alranatraders.pk/admin/kisan-scan?t=${signKisanQr(FID, S)}`;
  assert.ok(encodeQr(url).version <= 10);
});
console.log(`${n} kisan-wallet-v2 tests passed`);
