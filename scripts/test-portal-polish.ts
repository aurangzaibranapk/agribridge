/**
 * Portal polish (Phase 6) -- menu ka ek qaida, breadcrumb, tab bar, drawer, empty/loading/error,
 * mobile tables, logical (RTL) classes, Urdu font, a11y aur migration 581 ki wiring.
 * Chalayein: npm run test:portal-polish   (581 ka asal SQL test: tests/portal-polish-sql.mjs)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PORTAL_NAV_GROUPS, CUSTOMER_NAV_GROUPS, NAV_ALIASES, activeHref, activeGroup, breadcrumb, hrefsOf, isNavActive, nextFocusIndex, portalTabs, activeTab,
} from "../src/lib/portal/nav";
import { errorRef } from "../src/lib/portal/error-ref";
import { portalPolishDict } from "../src/lib/i18n/dict/portal-polish";

let passed = 0;
const test = (n: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${n}`); };
const read = (p: string) => fs.readFileSync(p, "utf8");
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

const FARMER = hrefsOf(PORTAL_NAV_GROUPS);
const CUST = hrefsOf(CUSTOMER_NAV_GROUPS);
// Phase 5 tak ki seedhi fehrist -- ek bhi raasta gum na ho.
const OLD18 = ["/portal/dashboard", "/portal/profile", "/portal/wallet", "/portal/c/orders", "/portal/c/payments", "/portal/farms", "/portal/demand", "/portal/campaigns", "/portal/dairy", "/portal/dairy/hisaab", "/portal/dairy/breeding", "/portal/dairy/health", "/portal/services/livestock", "/portal/crops", "/portal/services/machinery", "/portal/harvest", "/portal/ai-assistant"];

test("5 groups in mockup order, every phase-5 link kept, no duplicates", () => {
  assert.deepEqual(PORTAL_NAV_GROUPS.map((g) => g.key), ["hisaab", "dairy", "kheti", "services", "account"]);
  assert.deepEqual([...FARMER].sort(), [...OLD18].sort());
  assert.ok(!FARMER.includes("/portal/services/fertilizer"), "khaad-udhaar page sidebar se hata (19 Oct 2026): udhaar sirf season plan se");
  assert.equal(new Set(FARMER).size, FARMER.length);
  assert.deepEqual(CUSTOMER_NAV_GROUPS.map((g) => g.key), ["hisaab", "account"]);
  assert.deepEqual(CUST, ["/portal/c", "/portal/c/khata", "/portal/c/orders", "/portal/c/payments", "/portal/c/profile"]);
  for (const g of [...PORTAL_NAV_GROUPS, ...CUSTOMER_NAV_GROUPS]) assert.ok(g.items.length > 0);
});

test("one active rule: dairy sub-pages light the right item (desktop = drawer = tab bar)", () => {
  const want: Record<string, string> = {
    "/portal/dairy": "/portal/dairy",
    "/portal/dairy/animals": "/portal/dairy",
    "/portal/dairy/animals/12": "/portal/dairy",
    "/portal/dairy/animals/new": "/portal/dairy",
    "/portal/dairy/milk": "/portal/dairy",
    "/portal/dairy/alerts": "/portal/dairy/breeding",
    "/portal/dairy/breeding": "/portal/dairy/breeding",
    "/portal/dairy/breeding/new": "/portal/dairy/breeding",
    "/portal/dairy/breeding/animal/7": "/portal/dairy/breeding",
    "/portal/dairy/health": "/portal/dairy/health",
    "/portal/dairy/health/new": "/portal/dairy/health",
    "/portal/dairy/hisaab": "/portal/dairy/hisaab",
    "/portal/dairy/hisaab/expense": "/portal/dairy/hisaab",
    "/portal/dairy/hisaab/income": "/portal/dairy/hisaab",
    "/portal/dashboard": "/portal/dashboard",
    "/portal/c/orders": "/portal/c/orders",
    "/portal/c/khata": "/portal/wallet",
    "/portal/services/machinery": "/portal/services/machinery",
    "/portal/dairy/hisaab/": "/portal/dairy/hisaab",
    "/portal/dairy/alerts?x=1": "/portal/dairy/breeding",
  };
  for (const [p, h] of Object.entries(want)) {
    assert.equal(activeHref(p), h, p);
    assert.equal(FARMER.filter((x) => isNavActive(p, x)).length, 1, `exactly one lit on ${p}`);
  }
  assert.equal(activeHref("/portal/marketplace"), null);
  assert.equal(activeHref("/portal/dairyx"), null, "segment boundary");
  // customer: /portal/c sirf apne safhe par (har /portal/c/* par nahi)
  assert.equal(activeHref("/portal/c", CUST), "/portal/c");
  assert.equal(activeHref("/portal/c/khata", CUST), "/portal/c/khata", "alias never overrides a real item");
  assert.equal(activeHref("/portal/c/khata/export", CUST), "/portal/c/khata");
  assert.equal(activeHref("/portal/c/profile", CUST), "/portal/c/profile");
  for (const to of Object.values(NAV_ALIASES)) assert.ok(FARMER.includes(to), `alias target ${to}`);
});

test("every real portal page lights at most one item", () => {
  const pages = walk("src/app/portal").filter((f) => f.endsWith("page.tsx")).map((f) => "/" + path.dirname(f).replace(/^src\/app\//, "").replace(/\[[^\]]+\]/g, "x"));
  assert.ok(pages.length > 30, `pages ${pages.length}`);
  for (const p of pages) {
    assert.ok(FARMER.filter((x) => isNavActive(p, x)).length <= 1, p);
    if (p.startsWith("/portal/dairy")) assert.ok(activeHref(p), `dairy page ${p} must light something`);
  }
});

test("breadcrumb: Portal › Dairy › Breeding", () => {
  assert.deepEqual(breadcrumb("/portal/dairy/breeding").map((c) => c.k), ["ph6_crumb_portal", "ph6_grp_dairy", "nav_dairy_breeding"]);
  assert.deepEqual(breadcrumb("/portal/dairy/alerts").map((c) => c.k), ["ph6_crumb_portal", "ph6_grp_dairy", "nav_dairy_breeding"]);
  assert.deepEqual(breadcrumb("/portal/dairy").map((c) => c.k), ["ph6_crumb_portal", "ph6_grp_dairy", "nav_dairy"]);
  assert.equal(breadcrumb("/portal/dairy")[1].href, null, "group crumb not a link to the same page");
  assert.deepEqual(breadcrumb("/portal/c/profile", CUSTOMER_NAV_GROUPS).map((c) => c.k), ["ph6_crumb_portal", "ph6_grp_account", "pc_nav_profile"]);
  assert.equal(breadcrumb("/portal/dairy/health")[1].href, "/portal/dairy");
  assert.equal(breadcrumb("/portal/dairy/health").at(-1)!.href, null, "last crumb is the current page");
  assert.deepEqual(breadcrumb("/portal/dashboard").map((c) => c.k), ["ph6_crumb_portal"]);
  assert.deepEqual(breadcrumb("/portal/c/payments", CUSTOMER_NAV_GROUPS).map((c) => c.k), ["ph6_crumb_portal", "ph6_grp_hisaab", "pc_nav_pay"]);
  assert.equal(activeGroup("/portal/dairy/animals/3"), "dairy");
});

test("bottom tab bar: Home · Khata · Dairy · Bills · More; Dairy hides without animals", () => {
  assert.deepEqual(portalTabs("farmer", true).map((t) => t.key), ["home", "khata", "dairy", "bills", "more"]);
  assert.deepEqual(portalTabs("farmer", false).map((t) => t.key), ["home", "khata", "bills", "more"]);
  assert.deepEqual(portalTabs("customer", false).map((t) => t.key), ["home", "khata", "bills", "pay", "more"]);
  assert.equal(activeTab("/portal/dairy/health", "farmer", true), "dairy");
  assert.equal(activeTab("/portal/dairy/alerts", "farmer", true), "dairy");
  assert.equal(activeTab("/portal/dashboard", "farmer", true), "home");
  assert.equal(activeTab("/portal/c/khata", "farmer", true), "khata");
  assert.equal(activeTab("/portal/farms", "farmer", true), "more");
  assert.equal(activeTab("/portal/dairy", "farmer", false), "more", "no dairy tab -> More");
  assert.equal(activeTab("/portal/c", "customer", false), "home");
  assert.equal(activeTab("/portal/c/profile", "customer", false), "more");
  for (const t of [...portalTabs("farmer", true), ...portalTabs("customer", false)]) if (t.href) assert.ok([...FARMER, ...CUST].includes(t.href), t.href);
});

test("drawer focus trap wraps both ways", () => {
  assert.equal(nextFocusIndex(0, 3, false), 1);
  assert.equal(nextFocusIndex(2, 3, false), 0);
  assert.equal(nextFocusIndex(0, 3, true), 2);
  assert.equal(nextFocusIndex(-1, 3, false), 0);
  assert.equal(nextFocusIndex(-1, 3, true), 2);
  assert.equal(nextFocusIndex(0, 0, false), -1);
});

test("drawer is a real dialog: Esc, focus trap, scroll lock; same rule as sidebar", () => {
  const d = read("src/components/portal/use-drawer.ts");
  for (const s of ['"Escape"', '"Tab"', 'document.body.style.overflow = "hidden"', "before?.focus", "nextFocusIndex"]) assert.ok(d.includes(s), s);
  const m = read("src/components/portal/mobile-sidebar.tsx");
  for (const s of ['role="dialog"', 'aria-modal="true"', "aria-expanded", "useDrawer", "NavList", "start-0", "OPEN_MENU_EVENT"]) assert.ok(m.includes(s), s);
  assert.ok(!/pathname === item\.href/.test(m), "old exact-match rule gone");
  const nl = read("src/components/portal/nav-list.tsx");
  assert.ok(nl.includes("activeHref(pathname") && nl.includes('aria-current={on ? "page" : undefined}') && nl.includes("before:bg-amber-400") && nl.includes("min-h-[44px]"));
  assert.ok(read("src/components/portal/customer/customer-sidebar.tsx").includes("CUSTOMER_NAV_GROUPS"));
  assert.ok(read("src/components/portal/sidebar.tsx").includes("PORTAL_NAV_GROUPS"));
});

test("real Log out, separate from Back to website", () => {
  const lo = read("src/components/portal/portal-logout.tsx");
  assert.ok(lo.includes("auth.signOut()") && lo.includes('router.push("/login")') && lo.includes("ph6_logout"));
  const nl = read("src/components/portal/nav-list.tsx");
  assert.ok(nl.includes("<PortalLogout") && nl.includes("back_to_website") && nl.includes("<Globe"));
  for (const f of ["src/components/portal/sidebar.tsx", "src/components/portal/mobile-sidebar.tsx", "src/components/portal/customer/customer-sidebar.tsx"]) {
    const s = read(f);
    assert.ok(s.includes("NavFooter"), `${f} uses NavFooter`);
    assert.ok(!s.includes("<LogOut"), `${f}: Back-to-website no longer wears the logout icon`);
  }
});

test("loading.tsx + error.tsx for the 5 portal/admin routes", () => {
  for (const d of ["src/app/portal", "src/app/portal/c", "src/app/portal/dairy", "src/app/admin/customer-portal", "src/app/admin/dairy"]) {
    assert.ok(read(`${d}/loading.tsx`).includes("PortalLoading"), d);
    const e = read(`${d}/error.tsx`);
    assert.ok(e.startsWith('"use client"') && e.includes("PortalError") && e.includes("reset={reset}"), d);
  }
  const rs = read("src/components/portal/route-states.tsx");
  assert.ok(rs.includes("motion-reduce:animate-none") && rs.includes('role="alert"') && rs.includes("errorRef(error)") && rs.includes("ph6_err_body"));
  assert.ok(!/error\.message\}/.test(rs.replace(/message: `\[\$\{ref\}\] \$\{error\.message/, "")), "no technical text on screen");
});

test("error reference code is short and stable", () => {
  assert.match(errorRef({ digest: "123456789" }), /^ERR-[0-9A-F]{4}$/);
  assert.equal(errorRef({ digest: "abc" }), errorRef({ digest: "abc" }));
  assert.notEqual(errorRef({ digest: "abc" }), errorRef({ digest: "abd" }));
  assert.equal(errorRef(null), "ERR-0000");
});

test("empty states on the 3 pages", () => {
  const es = read("src/components/portal/empty-state.tsx");
  assert.ok(es.includes('role="status"') && !es.includes("use client"));
  const want: Record<string, string[]> = {
    "src/app/portal/c/profile/page.tsx": ["ph6_es_changes_t", 'id="pc-change"'],
    "src/app/portal/dairy/hisaab/page.tsx": ["ph6_es_income_t", "S.income_total === 0", "/portal/dairy/hisaab/income"],
    "src/app/admin/dairy/page.tsx": ["ph6_es_adm_dairy_t", "rows.length === 0", "ph6_es_clear"],
  };
  for (const [f, keys] of Object.entries(want)) { const s = read(f); assert.ok(s.includes("<EmptyState"), f); for (const k of keys) assert.ok(s.includes(k), `${f}: ${k}`); }
});

test("mobile tables become cards under 640px", () => {
  for (const f of ["src/app/admin/dairy/[farmerId]/page.tsx", "src/app/portal/dairy/hisaab/page.tsx", "src/app/portal/dairy/breeding/page.tsx", "src/app/portal/dairy/animals/[id]/page.tsx", "src/components/portal/expense-statement.tsx", "src/app/admin/dairy/page.tsx"]) {
    const s = read(f);
    assert.ok(s.includes("<ResponsiveTable"), f);
    assert.ok(!/<table\b/.test(s), `${f}: no bare <table>`);
  }
  const css = read("src/app/globals.css");
  assert.ok(css.includes("@media (max-width: 639px)") && css.includes("table.rt-cards td[data-label]::before") && css.includes("content: attr(data-label)"));
  const rt = read("src/components/portal/responsive-table.tsx");
  assert.ok(rt.includes('setAttribute("data-label"') && rt.includes("MutationObserver"));
});

test("RTL: no physical spacing/position classes left in portal code", () => {
  const dirs = ["src/components/portal", "src/app/portal", "src/app/admin/dairy", "src/app/admin/customer-portal"];
  const bad = /(?<=[\s"'`:{])-?(ml|mr|pl|pr)-(\d|\[|px\b|auto\b)|(?<=[\s"'`:{])-?(left|right)-(\d|\[|px\b|full\b|auto\b)|\btext-(left|right)\b|\bborder-(l|r)-\d|\bfloat-(left|right)\b|borderLeftColor/;
  const hits: string[] = [];
  for (const d of dirs) for (const f of walk(d).filter((x) => /\.tsx?$/.test(x))) read(f).split("\n").forEach((l, i) => { if (bad.test(l)) hits.push(`${f}:${i + 1}`); });
  assert.deepEqual(hits, []);
  const lay = read("src/app/portal/layout.tsx");
  assert.ok(lay.includes("ms-auto") && lay.includes("text-end") && lay.includes('dir="ltr"'));
  assert.ok(read("src/components/portal/dairy/pl-parts.tsx").includes('dir="ltr" className={`ltr-iso'), "Money stays LTR");
  assert.ok(read("src/app/globals.css").includes("unicode-bidi: isolate"));
});

test("Urdu font: self-hosted subset, lazy (no preload), only for ur", () => {
  const f = read("src/components/portal/urdu-font.ts");
  assert.equal((f.match(/^  preload: false,$/gm) ?? []).length, 2);
  assert.ok(f.includes('lang === "ur"') && f.includes("next/font/local") && !f.includes("next/font/google"));
  let total = 0;
  for (const w of ["NotoNastaliqUrdu-ur-subset.woff2", "NotoNaskhArabic-ur-subset.woff2"]) {
    const b = fs.readFileSync(`src/app/fonts/urdu/${w}`);
    assert.equal(b.subarray(0, 4).toString("latin1"), "wOF2", w);
    total += b.length;
  }
  assert.ok(total < 260 * 1024, `fonts ${total} bytes`);
  assert.ok(read("src/app/fonts/urdu/OFL.txt").includes("SIL Open Font License"));
  for (const f2 of ["src/app/portal/layout.tsx", "src/components/portal/customer/customer-shell.tsx"]) assert.ok(read(f2).includes("portalShellClass(lang)"), f2);
  assert.ok(!read("src/app/layout.tsx").includes("urdu"), "root layout untouched");
});

test("a11y: skip link, focus ring, labelled icon buttons, chart summary", () => {
  assert.ok(read("src/components/portal/skip-link.tsx").includes('href="#portal-main"'));
  for (const f of ["src/app/portal/layout.tsx", "src/components/portal/customer/customer-shell.tsx"]) { const s = read(f); assert.ok(s.includes("<SkipLink") && s.includes('id="portal-main"'), f); }
  const css = read("src/app/globals.css");
  assert.ok(css.includes(".portal-shell :focus-visible") && css.includes('theme("colors.amber.400")'));
  for (const [f, k] of [["src/app/portal/crops/crop-expense-panel.tsx", "ph6_a_close"], ["src/app/portal/crops/edit-crop-modal.tsx", "ph6_a_close"], ["src/app/portal/sell-produce/sell-produce-client.tsx", "ph6_a_close"], ["src/app/portal/crops/crops-table.tsx", "ph6_a_delete"], ["src/app/portal/farms/delete-farm-button.tsx", "ph6_a_delete"], ["src/app/portal/ai-assistant/ai-assistant-client.tsx", "ph6_a_reject"]] as const) assert.ok(read(f).includes(k), f);
  assert.ok(read("src/components/portal/dairy/pl-parts.tsx").includes("aria-label={chartSummary(groups, names)}"));
  assert.ok(read("src/components/portal/language-toggle.tsx").includes("aria-pressed"));
});

test("dictionary: every ph6 key has en / rm / ur", () => {
  for (const [k, v] of Object.entries(portalPolishDict)) {
    assert.ok(/^(na_)?ph6_/.test(k), k);
    for (const l of ["en", "rm", "ur"] as const) assert.ok((v as Record<string, string>)[l]?.trim(), `${k}.${l}`);
  }
  const used = new Set<string>();
  for (const f of walk("src").filter((x) => /\.tsx?$/.test(x) && !x.includes("dict/portal-polish"))) for (const m of read(f).matchAll(/\b(?:na_)?ph6_[a-z0-9_]+/g)) used.add(m[0]);
  for (const k of used) assert.ok(k in portalPolishDict, `missing ${k}`);
  for (const g of [...PORTAL_NAV_GROUPS, ...CUSTOMER_NAV_GROUPS]) assert.ok(g.k in portalPolishDict, g.k);
});

test("migration 581: additive sidebar rows, no grants, no messages", () => {
  const sql = read("supabase/migrations/581_sidebar_portal_dairy.sql");
  const code = sql.replace(/--.*$/gm, "");
  assert.ok(!/\b(update|delete|drop|alter|truncate|grant)\b/i.test(code), "additive only");
  assert.equal((code.match(/insert into/gi) ?? []).length, (code.match(/on conflict \([^)]+\) do nothing/gi) ?? []).length);
  for (const r of ["/admin/customer-portal", "/admin/dairy", "/admin/dairy/breeding"]) assert.ok(code.includes(`'${r}'`), r);
  assert.ok(!/user_feature_permissions|role_feature_permissions|whatsapp|notification/i.test(code));
  assert.ok(read("src/lib/access/icons.ts").includes("HeartPulse,"));
  const os = read("src/app/admin/portal/page.tsx");
  for (const r of ['route: "/admin/customer-portal"', 'route: "/admin/dairy"', 'route: "/admin/dairy/breeding"', 'route: "/admin/customer-portal?f=on"']) assert.ok(os.includes(r), `OS Portal tile ${r}`);
  // Admin badge counts alag design (admin_badges_20261019) -- yahan nahi banaye.
  assert.ok(!read("src/lib/access/needs-attention.ts").includes("ph6"));
});

console.log(`\nportal-polish: ${passed} passed`);
