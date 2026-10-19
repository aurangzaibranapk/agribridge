// Unit tests: password reset helpers + action wiring (live DB nahi).
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  sha256, newResetToken, normalizeEmail, identifierHash, rateLimitMessage, validateNewPassword,
  maskPhone, otpResultMessage, GENERIC_PHONE_SENT, GENERIC_EMAIL_SENT, OTP_VALID_MINUTES, GRANT_VALID_MINUTES,
} from "../src/lib/auth/password-reset";

assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
const a = newResetToken(), b = newResetToken();
assert.notEqual(a, b); assert.ok(a.length >= 43, "32 bytes base64url");
assert.match(a, /^[A-Za-z0-9_-]+$/);
assert.equal(normalizeEmail("  Owner@AlRanaTraders.pk "), "owner@alranatraders.pk");
assert.equal(normalizeEmail("bad"), null);
assert.equal(normalizeEmail(""), null);
assert.equal(identifierHash("email", "A@b.pk"), identifierHash("email", " a@b.pk"));
assert.notEqual(identifierHash("email", "3001234567"), identifierHash("whatsapp", "3001234567"));
assert.match(rateLimitMessage(45), /45 second/);
assert.match(rateLimitMessage(1800), /30 minute/);
assert.match(validateNewPassword("short", "short")!, /8/);
assert.match(validateNewPassword("longenough1", "longenough2")!, /ek jaise/);
assert.equal(validateNewPassword("longenough1", "longenough1"), null);
assert.match(validateNewPassword("x".repeat(80), "x".repeat(80))!, /72/);
assert.equal(maskPhone("0300 1234567"), "0300 ***4567");
assert.equal(otpResultMessage("ok"), null);
assert.equal(otpResultMessage("ghalat")!.keepCode, true);
assert.equal(otpResultMessage("band")!.keepCode, false);
assert.match(otpResultMessage("khatam")!.error, /5 minute/);
assert.equal(OTP_VALID_MINUTES, 5); assert.equal(GRANT_VALID_MINUTES, 10);
assert.match(GENERIC_PHONE_SENT, /^Agar ye number registered hai/);
assert.match(GENERIC_EMAIL_SENT, /^Agar ye email registered hai/);

// Wiring: enumeration-safe aur hash-only.
const otp = fs.readFileSync("src/actions/password-reset-otp.ts", "utf8");
assert.match(otp, /^"use server";/);
assert.doesNotMatch(otp, /export async function (auditReset|requestMeta)/, "helpers server action nahi hone chahiye");
// request: guard user lookup se PEHLE (rate limit sab ke liye ek jaisi)
assert.ok(otp.indexOf('"fn_password_reset_guard"') < otp.indexOf('"fn_password_reset_user_for_phone"'));
// request ka aakhri jawab userId ke bahar, hamesha GENERIC
const req = otp.slice(otp.indexOf("export async function requestPhoneResetOtp"), otp.indexOf("export async function verifyResetOtp"));
assert.match(req, /\n  return \{ step: "code", phone, masked: maskPhone\(phone\), message: GENERIC_PHONE_SENT \};\n\}/);
assert.doesNotMatch(req, /registered nahi|not found|nahi mila/i);
assert.match(otp, /p_hash: sha256\(grant\)/, "grant ka sirf hash");
assert.match(otp, /fn_password_reset_revoke_sessions/);
assert.match(otp, /"reset_done"/);
const email = fs.readFileSync("src/actions/password-reset.ts", "utf8");
assert.ok(email.indexOf('"fn_password_reset_guard"') < email.indexOf('"fn_password_reset_user_for_email"'));
assert.match(email, /return \{ success: true, message: GENERIC_EMAIL_SENT \};\n\}/);
assert.match(email, /p_hash: sha256\(token\)/);
assert.doesNotMatch(email, /listUsers/, "poori user list nahi parhni");
assert.doesNotMatch(email, /from\("password_reset_tokens"\)\.insert/, "khula token insert nahi");
const login = fs.readFileSync("src/app/login/login-form.tsx", "utf8");
assert.match(login, /Naya account \(OTP\)/);
assert.match(login, /Mobile number", "WhatsApp OTP", "Naam \/ password"/);
assert.match(login, /name="full_name"/, "naye user se naam poochha jaye");
console.log("PASS: password reset unit tests");
