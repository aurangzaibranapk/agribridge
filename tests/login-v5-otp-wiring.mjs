// Login v5 must reuse main's WhatsApp OTP path: sendFarmerOtp (src/lib/farmers/otp.ts),
// which reads the existing WHATSAPP_OTP_TEMPLATE / WHATSAPP_OTP_TEMPLATE_LANG. No new env.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import assert from "node:assert/strict";
const act = readFileSync("src/actions/login-v5.ts", "utf8");
assert.match(act, /import \{ sendFarmerOtp \} from "@\/lib\/farmers\/otp"/, "v5 imports main's sender");
assert.equal((act.match(/sendFarmerOtp\(/g) || []).length, 1, "single phone-OTP call site (signup, first_time, reset all share it)");
assert.doesNotMatch(act, /sendWhatsAppTemplate|whatsapp-client/, "no second WhatsApp sender");
const files = ["src/actions/login-v5.ts"];
const walk = (d) => { for (const f of readdirSync(d)) { const p = d + "/" + f; statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) && files.push(p); } };
walk("src/app/login"); files.push("src/lib/auth/login-v5.ts", "src/lib/auth/login-v5-flow.ts", "src/lib/auth/email-otp.ts");
for (const f of files) { const s = readFileSync(f, "utf8"); assert.doesNotMatch(s, /process\.env\.WHATSAPP/, f + " must not read WhatsApp env itself"); }
// Login v6 (malik, 20 Oct): otp.ts mein sirf additive `opts` (digits / only). whatsapp-client bilkul nahi badla;
// otp.ts ka purana default (6 hindse, WhatsApp -> SMS fallback) waisa hi.
try { const d = execSync("git diff --name-only origin/main -- src/lib/whatsapp-client.ts", { encoding: "utf8" }).trim(); assert.equal(d, "", "WhatsApp template code unchanged vs main"); } catch (e) { if (e.code === "ERR_ASSERTION") throw e; }
{ const o = readFileSync("src/lib/farmers/otp.ts", "utf8");
  assert.match(o, /process\.env\.WHATSAPP_OTP_TEMPLATE/, "same template env");
  assert.match(o, /prefer === "sms" \? \[trySms, tryWhatsapp\] : \[tryWhatsapp, trySms\]/, "old fallback order kept for old callers");
  assert.match(o, /otpDigits\(opts\.digits \?\? 6\)/, "default stays 6 digits"); }
const flow = readFileSync("src/lib/auth/login-v5-flow.ts", "utf8");
assert.match(flow, /d\.sendPhoneOtp\(t\.phoneKey!, t\.channel === "sms" \? "sms" : "whatsapp"\)/, "WhatsApp default, one path for all purposes");
console.log("login-v5-otp-wiring: all assertions passed");
