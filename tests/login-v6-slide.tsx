/* Login v6 sliding card: toggle, panels, mobile strip, reduced motion. Koi database nahi. */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SlideCard, SLIDE_CSS, slideBoxClass, toggleMode } from "../src/app/login/slide-card";
import { t6 } from "../src/app/login/v6-text";
import { readFileSync } from "node:fs";

const tr = (k: string) => t6("rm", k);
const render = (mode: "login" | "signup") => renderToStaticMarkup(
  <SlideCard mode={mode} onMode={() => {}} tr={tr} logo={<i />} login={<form id="L">login</form>} signup={<form id="S">signup</form>} />);

assert.equal(toggleMode("login"), "signup"); assert.equal(toggleMode("signup"), "login");
assert.equal(toggleMode(toggleMode("login")), "login");
assert.equal(slideBoxClass("login"), "ab-slide"); assert.equal(slideBoxClass("signup"), "ab-slide up");

const L = render("login"), S = render("signup");
assert.match(L, /class="ab-slide" data-mode="login"/);
assert.match(S, /class="ab-slide up" data-mode="signup"/);
// inactive form hidden from screen readers + keyboard
assert.match(L, /data-panel="login"[^>]*|aria-hidden="false"/);
assert.match(L, /class="ab-form ab-up" aria-hidden="true" inert=""/);
assert.match(S, /class="ab-form ab-in" aria-hidden="true" inert=""/);
assert.doesNotMatch(L, /class="ab-form ab-in" aria-hidden="true"/);
// both forms always mounted (state kept while sliding)
for (const h of [L, S]) { assert.match(h, /id="L"/); assert.match(h, /id="S"/); }
// green panel texts + pills, mobile strips
assert.ok(L.includes("Khush aamdeed!") && L.includes("Wapas aaye?") && L.includes("SIGN UP") && L.includes("LOGIN"));
assert.equal((L.match(/class="ab-mbn"/g) ?? []).length, 2, "mobile strip on both panels");
// motion spec: 0.7s slide, corners animate, mobile slide-up, reduced motion off
assert.match(SLIDE_CSS, /\.ab-ovw\{[^}]*transition:transform \.7s ease-in-out,border-radius \.7s ease-in-out/);
assert.match(SLIDE_CSS, /\.ab-slide\.up \.ab-ovw\{transform:translateX\(-100%\);border-radius:0 150px 110px 0\}/);
assert.match(SLIDE_CSS, /@keyframes ab-sl\{from\{opacity:0;transform:translateY\(40px\)\}/);
assert.match(SLIDE_CSS, /@media \(prefers-reduced-motion:reduce\)\{[^}]*transition:none!important;animation:none!important/);
// Urdu fully Urdu on the green panel
for (const k of ["slide_hi_title", "slide_hi_p", "slide_back_title", "slide_back_p", "pill_login", "pill_signup", "m_new", "m_have"]) assert.ok(!/[A-Za-z]{3,}/.test(t6("ur", k).replace("AgriBridge", "")), k);
// page wiring: v6 uses the slide card, footer kept, social icons + duplicate reset link kept
const ui = readFileSync("src/app/login/login-v6.tsx", "utf8");
assert.match(ui, /<SlideCard mode=\{step === "signup" \? "signup" : "login"\} onMode=\{\(m\) => go\(m\)\}/);
assert.match(ui, /<Footer tr=\{tr\} \/>/);
assert.match(ui, /fieldErr\.phone === "e_phone_taken" \? <ResetLink/);
assert.equal((ui.match(/<Social tr=\{tr\} onOAuth=\{onOAuth\} \/>/g) ?? []).length, 2, "icons on login and signup");
console.log("login-v6-slide: all assertions passed");
