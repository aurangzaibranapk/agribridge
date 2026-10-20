// Unit tests for src/lib/auth/login-v5.ts (pure helpers).
import assert from "node:assert/strict";
import {
  classifyIdentifier, loginStateFor, passwordProblem, passwordStrength, lockSecondsForLevel, maskPhoneKey, maskEmail,
  emailOtpKey, allowedChannels, defaultChannel, resetTokenChannel, redirectForRole, isMemberRole, isSyntheticEmail, identHash,
} from "../src/lib/auth/login-v5";

// identifier
assert.deepEqual(classifyIdentifier("0322 6275476"), { kind: "phone", value: "3226275476" });
assert.deepEqual(classifyIdentifier("+92-322-6275476"), { kind: "phone", value: "3226275476" });
assert.deepEqual(classifyIdentifier("3226275476"), { kind: "phone", value: "3226275476" });
assert.equal(classifyIdentifier("0422 1234567"), null, "landline is not a login mobile");
assert.equal(classifyIdentifier("12345"), null);
assert.deepEqual(classifyIdentifier("  Owner@AlRanaTraders.pk "), { kind: "email", value: "owner@alranatraders.pk" });
assert.equal(classifyIdentifier("bad@x"), null);
assert.deepEqual(classifyIdentifier("Kisan_01"), { kind: "username", value: "kisan_01" });
assert.equal(classifyIdentifier("a"), null);
assert.equal(classifyIdentifier(""), null);

// state (no role words)
assert.equal(loginStateFor(null), "new");
assert.equal(loginStateFor({ user_id: "u", has_password: true }), "password");
assert.equal(loginStateFor({ user_id: "u", has_password: false }), "first_time");

// password rules
assert.equal(passwordProblem("abc1", "abc1"), "e_pw_short");
assert.equal(passwordProblem("abcdefgh", "abcdefgh"), "e_pw_digit");
assert.equal(passwordProblem("03226275476", "03226275476", "3226275476"), "e_pw_phone");
assert.equal(passwordProblem("kisan2026x", "kisan2026y"), "e_pw_match");
assert.equal(passwordProblem("kisan2026x", "kisan2026x", "3226275476"), null);
assert.equal(passwordProblem("x".repeat(70) + "123", "x".repeat(70) + "123"), "e_pw_long");
assert.ok(passwordStrength("Kisan2026!x") >= 3);
assert.ok(passwordStrength("abc") <= 1);

// lockout schedule
assert.equal(lockSecondsForLevel(1), 900);
assert.equal(lockSecondsForLevel(2), 1800);
assert.equal(lockSecondsForLevel(20), 86400);

// masking
assert.equal(maskPhoneKey("3226275476"), "+92 322 ••• 5476");
assert.equal(maskEmail("owner@alranatraders.pk"), "ow•••@alranatraders.pk");
assert.match(emailOtpKey(" A@B.com "), /^e:[0-9a-f]{64}$/);
assert.equal(emailOtpKey("a@b.com"), emailOtpKey("A@B.COM "));
assert.notEqual(identHash({ kind: "phone", value: "1" }), identHash({ kind: "email", value: "1" }));

// channel picker
assert.deepEqual(allowedChannels("signup", { hasPhone: true, hasRealEmail: false }), ["whatsapp", "sms", "email"]);
assert.deepEqual(allowedChannels("signup", { hasPhone: false, hasRealEmail: false }), ["email"]);
assert.deepEqual(allowedChannels("reset", { hasPhone: true, hasRealEmail: false }), ["whatsapp", "sms"], "no email on file -> no email reset");
assert.deepEqual(allowedChannels("first_time", { hasPhone: true, hasRealEmail: true }), ["whatsapp", "sms", "email"]);
assert.deepEqual(allowedChannels("reset", { hasPhone: false, hasRealEmail: true }), ["email"]);
assert.equal(defaultChannel(["whatsapp", "sms", "email"]), "whatsapp");
assert.equal(defaultChannel(["email"]), "email");
assert.equal(defaultChannel([]), null);
assert.equal(resetTokenChannel("sms"), "whatsapp");
assert.equal(resetTokenChannel("email"), "email");

// redirects + member rule
assert.equal(redirectForRole("owner"), "/admin/portal");
assert.equal(redirectForRole("sales_staff"), "/admin/portal");
assert.equal(redirectForRole("farmer"), "/portal/dashboard");
assert.equal(redirectForRole("customer"), "/portal/c");
assert.equal(isMemberRole("farmer"), true);
assert.equal(isMemberRole("owner"), false);
assert.equal(isSyntheticEmail("3226275476@phone.agribridge.local"), true);
assert.equal(isSyntheticEmail("owner@alranatraders.pk"), false);
console.log("login-v5-lib: all assertions passed");
