// Login ke baad "reading 'get'" wali kharabi (17 Oct) ke pehre.
// Chalayein: npm run test:login-crash
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeInternalRoute, routeAfterLogin, goAfterLogin, OFFLINE_ROUTE_KEY } from "../src/lib/navigation/after-login";
import { aarziNetworkKharabi, nayaSafhaUrl, wapsiKaRaasta, poraSafhaDobara } from "../src/lib/errors/recover";
import { getRoleRedirectPath } from "../src/lib/utils/roles";

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n += 1; console.log("  ok -", name); };

ok("safeInternalRoute sirf andar ke raaste", () => {
  assert.equal(safeInternalRoute("/portal/dashboard"), "/portal/dashboard");
  assert.equal(safeInternalRoute("/admin/pos?x=1"), "/admin/pos?x=1");
  assert.equal(safeInternalRoute("https://evil.example"), "/");
  assert.equal(safeInternalRoute("//evil.example"), "/");
  assert.equal(safeInternalRoute("/\\evil.example"), "/");
  assert.equal(safeInternalRoute("/login"), "/");
  assert.equal(safeInternalRoute("/login?redirectTo=/x"), "/");
  assert.equal(safeInternalRoute(null, "/portal/dashboard"), "/portal/dashboard");
  assert.equal(safeInternalRoute("", "/x"), "/x");
});

ok("routeAfterLogin: redirectTo jeetta hai, warna role ka ghar", () => {
  assert.equal(routeAfterLogin(null, getRoleRedirectPath("farmer")), "/portal/dashboard");
  assert.equal(routeAfterLogin("/portal/crops", "/portal/dashboard"), "/portal/crops");
  assert.equal(routeAfterLogin("/login", "/admin/portal"), "/admin/portal");
  assert.equal(routeAfterLogin("https://evil.example", "/portal/dashboard"), "/portal/dashboard");
  assert.equal(routeAfterLogin(undefined, undefined), "/");
});

ok("goAfterLogin poora safha kholta hai aur manzil yaad rakhta hai", () => {
  const stored: Record<string, string> = {};
  const went: string[] = [];
  goAfterLogin("/portal/dashboard", { localStorage: { setItem: (k, v) => { stored[k] = v; } }, location: { assign: (u) => went.push(u) } });
  assert.deepEqual(went, ["/portal/dashboard"]);
  assert.equal(stored[OFFLINE_ROUTE_KEY], "/portal/dashboard");
  // localStorage band ho tab bhi jana nahi rukta
  const went2: string[] = [];
  goAfterLogin("//evil", { localStorage: { setItem: () => { throw new Error("private"); } }, location: { assign: (u) => went2.push(u) } });
  assert.deepEqual(went2, ["/"]);
});

ok("aarziNetworkKharabi har browser ke alfaz pehchanta hai", () => {
  for (const m of ["network error", "Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed", "Failed to fetch RSC payload for /portal"]) {
    assert.equal(aarziNetworkKharabi(new TypeError(m)), true, m);
  }
  for (const m of ["Cannot read properties of null (reading 'get')", "Cannot read properties of undefined (reading 'success')", ""]) {
    assert.equal(aarziNetworkKharabi(new TypeError(m)), false, m);
  }
  assert.equal(aarziNetworkKharabi(null), false);
});

ok("nayaSafhaUrl wohi raasta + _r nishan", () => {
  assert.equal(nayaSafhaUrl("https://alranatraders.pk/login?a=1", 5), "https://alranatraders.pk/login?a=1&_r=5");
  const replaced: string[] = [];
  poraSafhaDobara({ location: { href: "https://x.pk/portal/dashboard", replace: (u) => replaced.push(u) } });
  assert.match(replaced[0], /^https:\/\/x\.pk\/portal\/dashboard\?_r=\d+$/);
});

ok("wapsiKaRaasta kisan ko /admin nahi bhejta", () => {
  assert.equal(wapsiKaRaasta("/portal/dashboard").href, "/portal/dashboard");
  assert.equal(wapsiKaRaasta("/vendor/x").href, "/vendor");
  assert.equal(wapsiKaRaasta("/admin/pos").href, "/admin/my-work");
  assert.equal(wapsiKaRaasta("/login").href, "/");
  assert.equal(wapsiKaRaasta(null).href, "/");
});

ok("login-form mein router.push + router.refresh ka joRa khatam", () => {
  const src = readFileSync("src/app/login/login-form.tsx", "utf8");
  assert.equal(/router\.(push|refresh)\(/.test(src), false);
  assert.ok((src.match(/goAfterLogin\(/g) ?? []).length >= 7);
});

ok("global-error reset() istemal nahi karta, wapsi ka link role ke mutabiq", () => {
  const src = readFileSync("src/app/global-error.tsx", "utf8");
  assert.equal(/onClick=\{reset\}/.test(src), false);
  assert.ok(src.includes("poraSafhaDobara()"));
  assert.equal(src.includes('href="/admin/my-work"'), false);
  const stale = readFileSync("src/lib/errors/stale-build.ts", "utf8");
  assert.ok(stale.includes("aarziNetworkKharabi(error)"));
});

console.log(`\n${n} tests pass`);
