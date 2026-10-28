/**
 * Android app (TWA, Google Play) ki website wali shartein.
 *
 * 1. /.well-known/assetlinks.json -- isi se Android maanta hai ke app
 *    aur website ek hi maalik ki hain (warna app ke upar URL bar aata
 *    hai). Package id aur fingerprint ghalat ho to koi error nahi aata,
 *    bas app "browser" lagne lagti hai -- khamosh kharabi.
 * 2. Middleware / robots is file ko roken nahi.
 * 3. /account-deletion -- Play ki "Data deletion URL" shart. Bina login
 *    khulna chahiye, teeno zubaanon mein, aur khata na mitne ki baat
 *    saaf likhi ho.
 *
 * Chalana: node tests/twa-play-release.cjs
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log("ok -", name); };

const PACKAGE = "pk.alranatraders.agribridge";
const FP = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

ok("assetlinks.json valid hai, sahi package aur fingerprint", () => {
  const data = JSON.parse(read("public/.well-known/assetlinks.json"));
  assert(Array.isArray(data) && data.length >= 1, "array chahiye");
  const st = data.find((s) => s.target && s.target.package_name === PACKAGE);
  assert(st, "package statement nahi mila");
  assert.strictEqual(st.target.namespace, "android_app");
  assert.deepStrictEqual(st.relation, ["delegate_permission/common.handle_all_urls"]);
  const fps = st.target.sha256_cert_fingerprints;
  assert(Array.isArray(fps) && fps.length >= 1, "kam az kam ek fingerprint");
  for (const f of fps) assert(FP.test(f), `fingerprint ghalat shakl: ${f}`);
  assert.strictEqual(new Set(fps).size, fps.length, "fingerprint do baar");
});

ok("middleware /.well-known ko nahi rokta", () => {
  const mw = read("src/middleware.ts");
  // Middleware sirf /admin, /portal aur /api/bridge-ai par login maangta hai.
  assert(/if \(!pathname\.startsWith\("\/admin"\) && !pathname\.startsWith\("\/portal"\)/.test(mw), "middleware ka early-return badal gaya -- /.well-known check karein");
});

ok("robots /.well-known ya /account-deletion ko disallow nahi karta", () => {
  const r = read("src/app/robots.ts");
  assert(!/well-known/.test(r));
  assert(!/account-deletion/.test(r));
});

ok("release package public/ (dot folders samet) le jata hai", () => {
  const sh = read("scripts/package-cpanel.sh");
  assert(/for item in \.next public /.test(sh), "public release mein nahi");
  assert(/cp -R/.test(sh), "cp -R chahiye taake .well-known bhi jaye");
});

ok("account-deletion safha (site) mein hai, login ke bahar", () => {
  const p = "src/app/(site)/account-deletion/page.tsx";
  assert(fs.existsSync(path.join(root, p)));
  const s = read(p);
  assert(!/redirect\(|requireUser|getUser\(/.test(s), "safha login na maange");
  assert(/dark:/.test(s), "dark mode classes");
  assert(/dir=\{ur \? "rtl" : "ltr"\}/.test(s), "Urdu RTL");
});

ok("teeno zubaanon ka matan mukammal, khata rakhne ki baat saaf", () => {
  // TS file -- seedha parh kar sirf zaroori cheezein dekho (tsx ki zaroorat nahi).
  const s = read("src/lib/account-deletion-content.ts");
  for (const l of ["en:", "rm:", "ur:"]) assert(s.includes(`  ${l} {`), `${l} nahi`);
  assert(/Financial records/.test(s) && /Maali record/.test(s) && /مالی ریکارڈ/.test(s), "khata rakhne ki baat");
  // Footer ka number SHOP_PHONE_E164 (website-setting.ts) se aata hai -- wahi yahan bhi ho.
  const shop = read("src/lib/cms/website-setting.ts").match(/SHOP_PHONE_E164 = "([^"]+)"/)[1];
  assert(s.includes(`DELETION_FALLBACK_PHONE = "${shop}"`), "wahi number jo footer mein");
  assert(read("src/components/site/public-footer.tsx").includes("FALLBACK_PHONE = SHOP_PHONE_E164"), "footer ka number badla -- yahan bhi badlein");
  assert(/DELETION_FALLBACK_EMAIL = "info@alranatraders\.pk"/.test(s));
});

ok("whatsappDigits / deletionOrder ki mantiq", () => {
  const s = read("src/lib/account-deletion-content.ts");
  const fn = s.match(/export function whatsappDigits[\s\S]*?\n}\n/)[0]
    .replace("export ", "").replace("(phone: string): string", "(phone)").replace("let d", "let d");
  const whatsappDigits = new Function(`${fn}; return whatsappDigits;`)();
  assert.strictEqual(whatsappDigits("+92 333 1116727"), "923331116727");
  assert.strictEqual(whatsappDigits("0333-1116727"), "923331116727");
  assert.strictEqual(whatsappDigits(""), "923126513294"); // khali -> SHOP_PHONE_E164 (footer)
});

console.log(`\n${passed} passed`);
