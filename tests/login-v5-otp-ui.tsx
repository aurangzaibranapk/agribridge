/* Glassy OTP — box input, paste, error, verified, channel switch. Koi database nahi. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OtpGlassy, OTP_MOTION_CSS } from "../src/app/login/otp-glassy";
import { tx } from "../src/app/login/v5-text";
import {
  applyOtpBackspace, applyOtpInput, attemptsRemaining, emptyOtpDigits, formatCountdown, otherChannels, OTP_LENGTH,
} from "../src/lib/auth/otp-ui";

let n = 0;
const t = (name: string, f: () => void) => { f(); n++; console.log("ok -", name); };

const base = emptyOtpDigits();

t("single digit advances and does not submit", () => {
  const r = applyOtpInput(base, 0, "4");
  assert.deepEqual(r.digits, ["4", "", "", "", "", ""]);
  assert.equal(r.focus, 1);
  assert.equal(r.submit, null);
});

t("sixth digit submits the code", () => {
  const digits = ["4", "8", "2", "9", "1", ""];
  const r = applyOtpInput(digits, 5, "5");
  assert.equal(r.submit, "482915");
  assert.equal(r.focus, 5);
});

t("typing over a filled box keeps the new digit only", () => {
  const r = applyOtpInput(["4", "", "", "", "", ""], 0, "48");
  assert.deepEqual(r.digits, ["8", "", "", "", "", ""]);
  assert.equal(r.focus, 1);
  assert.equal(r.submit, null);
});

t("paste of the full code fills every box and submits", () => {
  const r = applyOtpInput(base, 3, "4 8 2-9a15");
  assert.deepEqual(r.digits, ["4", "8", "2", "9", "1", "5"]);
  assert.equal(r.submit, "482915");
  assert.equal(r.focus, OTP_LENGTH - 1);
});

t("short paste strips non-digits and does not submit", () => {
  const r = applyOtpInput(["9", "9", "9", "9", "9", "9"], 0, "12ab3");
  assert.deepEqual(r.digits, ["1", "2", "3", "", "", ""]);
  assert.equal(r.submit, null);
  assert.equal(r.focus, 3);
});

t("backspace clears the current digit", () => {
  const r = applyOtpBackspace(["4", "8", "", "", "", ""], 1);
  assert.deepEqual(r.digits, ["4", "", "", "", "", ""]);
  assert.equal(r.focus, 1);
  assert.equal(r.submit, null);
});

t("backspace on an empty box clears the previous digit", () => {
  const r = applyOtpBackspace(["4", "8", "", "", "", ""], 2);
  assert.deepEqual(r.digits, ["4", "", "", "", "", ""]);
  assert.equal(r.focus, 1);
});

t("backspace on the first empty box stays put", () => {
  const r = applyOtpBackspace(base, 0);
  assert.deepEqual(r.digits, base);
  assert.equal(r.focus, 0);
});

t("attempts left after a wrong code", () => {
  assert.equal(attemptsRemaining(0), 3);
  assert.equal(attemptsRemaining(1), 2);
  assert.equal(attemptsRemaining(3), 0);
  assert.equal(attemptsRemaining(9), 0);
});

t("other channels for the switch link", () => {
  assert.deepEqual(otherChannels(["whatsapp", "sms", "email"], "sms"), ["whatsapp", "email"]);
  assert.deepEqual(otherChannels(["sms"], "sms"), []);
});

t("countdown format", () => {
  assert.equal(formatCountdown(42), "0:42");
  assert.equal(formatCountdown(18), "0:18");
  assert.equal(formatCountdown(75), "1:15");
  assert.equal(formatCountdown(-3), "0:00");
});

const noop = () => {};
function view(over: Partial<React.ComponentProps<typeof OtpGlassy>> = {}) {
  return renderToStaticMarkup(
    <OtpGlassy
      lang="rm"
      sentTo="0322-*****76"
      channel="sms"
      channels={["whatsapp", "sms", "email"]}
      digits={emptyOtpDigits()}
      focus={0}
      busy={false}
      resendLeft={42}
      fails={0}
      errorKey={null}
      verified={false}
      shake={0}
      onDigit={noop}
      onBackspace={noop}
      onFocus={noop}
      onVerify={noop}
      onResend={noop}
      onSwitchChannel={noop}
      onBack={noop}
      onContinue={noop}
      {...over}
    />,
  );
}

t("empty state: six numeric boxes, one-time-code, disabled verify", () => {
  const h = view();
  assert.equal((h.match(/inputMode="numeric"|inputmode="numeric"/g) ?? []).length, 6);
  assert.equal((h.match(/autoComplete="one-time-code"|autocomplete="one-time-code"/g) ?? []).length, 1);
  assert.equal((h.match(/autoComplete="off"|autocomplete="off"/g) ?? []).length, 5);
  assert.match(h, /data-state="empty"/);
  assert.match(h, /data-box="current"/);
  assert.match(h, new RegExp(tx("rm", "otp_enter")));
  assert.match(h, new RegExp(tx("en", "otp_enter")));
  assert.match(h, new RegExp(tx("ur", "otp_enter")));
  assert.match(h, new RegExp(tx("rm", "otp_heading")));
  assert.match(h, new RegExp(tx("ur", "otp_heading")));
  assert.match(h, /disabled=""/);
  assert.match(h, /Verify · Tasdeeq karein/);
  assert.match(h, /0:42/);
});

t("typing state: filled boxes glow, digits left in EN and Roman and Urdu", () => {
  const h = view({ digits: ["4", "8", "2", "", "", ""], focus: 3 });
  assert.match(h, /data-state="partial"/);
  assert.equal((h.match(/data-box="filled"/g) ?? []).length, 3);
  assert.match(h, /data-box="current"/);
  assert.match(h, /3 hindse baqi/);
  assert.match(h, /3 digits left/);
  assert.match(h, /3 ہندسے باقی/);
  assert.match(h, /value="4"/);
  assert.match(h, /value="8"/);
  assert.match(h, /value="2"/);
});

t("wrong code: red boxes, shake, attempts left", () => {
  const h = view({ digits: ["4", "8", "2", "9", "1", "5"], focus: 5, fails: 1, errorKey: "e_code_wrong", shake: 2, resendLeft: 18 });
  assert.match(h, /data-state="error"/);
  assert.equal((h.match(/data-box="error"/g) ?? []).length, 6);
  assert.match(h, /otp-shake/);
  assert.match(h, /role="alert"/);
  assert.match(h, /Ghalat code — dobara likhein/);
  assert.match(h, /Wrong code/);
  assert.match(h, /2 koshishein baqi/);
  assert.match(h, /2 کوششیں باقی/);
  assert.match(h, /0:18/);
  const verify = h.match(/<button[^>]*data-action="verify"[^>]*>/)?.[0] ?? "";
  assert.doesNotMatch(verify, /\sdisabled(=|\s|>)/);
  const resend = h.match(/<button[^>]*data-action="resend"[^>]*>/)?.[0] ?? "";
  assert.match(resend, /\sdisabled(=|\s|>)/);
});

t("locked code uses the existing lock copy, not a fresh try count", () => {
  const h = view({ digits: ["1", "1", "1", "1", "1", "1"], fails: 3, errorKey: "e_code_locked" });
  assert.match(h, new RegExp(tx("en", "e_code_locked").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(h, /Teen dafa ghalat code/);
});

t("verified state: check draws, continue to set password, boxes gone", () => {
  const h = view({ verified: true, digits: ["4", "8", "2", "9", "1", "5"] });
  assert.match(h, /data-state="verified"/);
  assert.match(h, /otp-draw/);
  assert.match(h, /otp-pop/);
  assert.match(h, /Tasdeeq ho gayi!/);
  assert.match(h, /تصدیق ہو گئی!/);
  assert.match(h, /Verified/);
  assert.match(h, /0322-\*\*\*\*\*76/);
  assert.match(h, /Aagay chalein · Continue/);
  assert.match(h, /data-action="continue"/);
  assert.equal((h.match(/inputMode="numeric"|inputmode="numeric"/g) ?? []).length, 0);
});

t("channel switch link names the other ways", () => {
  const h = view();
  assert.match(h, /data-action="switch-channel"/);
  assert.match(h, /Doosre tareeqay se mangwayein/);
  assert.match(h, /دوسرے طریقے سے منگوائیں/);
  assert.match(h, /WhatsApp \/ Email/);
  assert.match(h, /data-others="whatsapp\/email"/);
  assert.match(h, /SMS 0322-/); // current channel stays on the sent chip
});

t("reduced motion kills shake, caret, pop and the check draw", () => {
  assert.match(OTP_MOTION_CSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(OTP_MOTION_CSS, /\.otp-caret, \.otp-shake, \.otp-pop, \.otp-draw \{ animation: none !important \}/);
  assert.match(view(), /prefers-reduced-motion: reduce/);
});

t("i18n keys exist in EN, Roman and Urdu", () => {
  for (const key of ["otp_kicker", "otp_heading", "otp_enter", "otp_left", "otp_wrong", "otp_tries", "otp_miss", "otp_switch", "otp_ok_heading", "otp_ok_p", "otp_go", "otp_back"]) {
    for (const lang of ["en", "rm", "ur"] as const) assert.ok(tx(lang, key, { n: 2 }).length > 0, `${lang} ${key}`);
  }
});

t("login v5 still verifies through v5VerifyCode and channel switch returns to pick", () => {
  const src = readFileSync("src/app/login/login-v5.tsx", "utf8");
  assert.match(src, /v5VerifyCode\(purpose, identifier, channel, code/);
  assert.match(src, /function switchChannel\(\) \{[^}]*setStep\("pick"\)/);
  assert.match(src, /onSwitchChannel=\{switchChannel\}/);
  assert.match(src, /applyOtpInput/);
  assert.match(src, /applyOtpBackspace/);
  const page = readFileSync("src/app/login/page.tsx", "utf8");
  assert.match(page, /if \(process\.env\.LOGIN_V5 === "0"\) return <LegacyLoginPage \/>/);
  assert.match(page, /NODE_ENV !== "production"/);
});

t("OTP server path is untouched", () => {
  const flow = readFileSync("src/lib/auth/login-v5-flow.ts", "utf8");
  assert.match(flow, /VERDICT_ERROR/);
  assert.doesNotMatch(flow, /otp-glassy|otp-ui/);
  const act = readFileSync("src/actions/login-v5.ts", "utf8");
  assert.match(act, /fn_verify_farmer_otp/);
  assert.doesNotMatch(act, /otp-glassy|attemptsRemaining/);
});

console.log(`\n${n} glassy-otp tests passed`);
