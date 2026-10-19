// Portal one-screen + Livestock -> Dairy + map fix (malik ki manzoori, 19 Oct 2026).
// Chalayen: npm run test:portal-one-screen
import assert from "node:assert/strict";
import fs from "node:fs";
import { summarizeLivestock, dairyLitersPerDay } from "../src/lib/portal/munshi-dashboard";
import { parseMilkSale, MILK_SALE_COLUMNS } from "../src/lib/portal/milk-sale";
import { tileConfig, tileUrl, OSM_TILE_URL, OSM_ATTRIBUTION_URL, TILE_REFERRER_POLICY } from "../src/lib/maps/tiles";
import { PORTAL_NAV_GROUPS } from "../src/lib/portal/nav";

let passed = 0;
const test = (n: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${n}`); };
const read = (p: string) => fs.readFileSync(p, "utf8");
const fd = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });

const PROFILE = { has_livestock: true, cow_count: 10, buffalo_count: 0, calves_count: 0, milking_animal_count: 10, meat_animal_count: 6, milk_liters_per_day: 60 };

test("herd: dairy records preferred when present (sold/dead ignored)", () => {
  const l = summarizeLivestock(PROFILE, [
    { species: "cow", status: "milking" }, { species: "cow", status: "milking" }, { species: "buffalo", status: "dry" },
    { species: "cow", status: "calf" }, { species: "cow", status: "sold" }, { species: "buffalo", status: "dead" },
  ], 21.5);
  assert.equal(l.source, "dairy");
  assert.equal(l.total, 4); assert.equal(l.cows, 2); assert.equal(l.buffalo, 1); assert.equal(l.calves, 1);
  assert.equal(l.milking, 2); assert.equal(l.dry, 1);
  assert.equal(l.litersSource, "dairy"); assert.equal(l.litersPerDay, 21.5);
});

test("herd: no dairy records -> profile counts as before (FRM-000003 not converted)", () => {
  const l = summarizeLivestock(PROFILE, [], 0);
  assert.equal(l.source, "profile"); assert.equal(l.total, 10); assert.equal(l.milking, 10);
  assert.equal(l.litersSource, "profile"); assert.equal(l.litersPerDay, 60);
  const only = summarizeLivestock(PROFILE, [{ species: "cow", status: "sold" }]);
  assert.equal(only.source, "profile");
});

test("dairyLitersPerDay = total / distinct days, skips empty rows", () => {
  assert.equal(dairyLitersPerDay([]), 0);
  assert.equal(dairyLitersPerDay([
    { yield_date: "2026-10-01", liters: 10 }, { yield_date: "2026-10-01", liters: "5" },
    { yield_date: "2026-10-02T06:00:00Z", liters: 15 }, { yield_date: null, liters: 99 }, { yield_date: "2026-10-03", liters: 0 },
  ]), 15);
});

test("parseMilkSale: same 4 farmers columns, validation in Roman Urdu", () => {
  assert.deepEqual([...MILK_SALE_COLUMNS], ["milk_buyer_name", "milk_sale_rate", "milk_liters_per_day", "milk_advance_loan_amount"]);
  const ok = parseMilkSale(fd({ milk_buyer_name: " Nestle ", milk_sale_rate: "1,40", milk_liters_per_day: "60", milk_advance_loan_amount: "" }));
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.value, { milk_buyer_name: "Nestle", milk_sale_rate: 140, milk_liters_per_day: 60, milk_advance_loan_amount: null });
  assert.equal(parseMilkSale(fd({ milk_sale_rate: "-5" })).ok, false);
  assert.equal(parseMilkSale(fd({ milk_liters_per_day: "abc" })).ok, false);
  const long = parseMilkSale(fd({ milk_buyer_name: "x".repeat(200) }));
  assert.ok(long.ok && long.value.milk_buyer_name!.length === 120, "buyer name capped at 120");
});

test("updateMilkSale writes only the 4 columns, own row only, no migration", () => {
  const a = read("src/actions/farmer-profile.ts");
  const fn = a.slice(a.indexOf("export async function updateMilkSale"));
  assert.ok(/\.update\(parsed\.value\)/.test(fn) || /\.update\(/.test(fn));
  assert.ok(fn.includes('.eq("user_id", user.id)'));
  assert.ok(!fs.readdirSync("supabase/migrations").some((f) => /livestock|milk_sale|one_screen/i.test(f) && f > "604"));
});

test("map: OSM with Referer (no no-referrer), attribution link, env-configurable, no Esri", () => {
  const pin = read("src/components/maps/pin-map.tsx");
  assert.ok(!pin.includes("no-referrer"), "OSM blocks tiles without Referer");
  assert.ok(pin.includes("TILE_REFERRER_POLICY") && TILE_REFERRER_POLICY === "strict-origin-when-cross-origin");
  assert.ok(/<a[^>]+href=\{TILES\.attributionUrl\}/.test(pin) || pin.includes("attributionUrl"));
  assert.ok(!/arcgis|esri/i.test(pin + read("src/lib/maps/tiles.ts").replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")));
  const d = tileConfig({});
  assert.equal(d.template, OSM_TILE_URL); assert.equal(d.attributionUrl, OSM_ATTRIBUTION_URL);
  const c = tileConfig({ NEXT_PUBLIC_MAP_TILE_URL: "https://{s}.tiles.example.com/{z}/{x}/{y}.png", NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: "© Ex" });
  assert.equal(c.attribution, "© Ex");
  assert.match(tileUrl(c.template, 5, 3, 7), /^https:\/\/[abc]\.tiles\.example\.com\/5\/3\/7\.png$/);
  assert.equal(tileConfig({ NEXT_PUBLIC_MAP_TILE_URL: "http://insecure/{z}/{x}/{y}.png" }).template, OSM_TILE_URL);
  assert.equal(tileConfig({ NEXT_PUBLIC_MAP_TILE_URL: "https://x.com/tile.png" }).template, OSM_TILE_URL);
});

test("Livestock -> Dairy: sidebar item gone, old URL redirects, panels on Dairy, no deletes", () => {
  const hrefs = PORTAL_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
  assert.ok(!hrefs.includes("/portal/services/livestock"));
  assert.ok(hrefs.includes("/portal/dairy"));
  assert.ok(read("src/app/portal/services/livestock/page.tsx").includes('redirect("/portal/dairy")'));
  const dairy = read("src/app/portal/dairy/page.tsx");
  assert.ok(dairy.includes("<MilkSalePanel") && dairy.includes("<LivestockLoanPanel"));
  assert.ok(dairy.includes('from("livestock_loans")') && dairy.includes("milk_advance_loan_amount"));
  const panels = read("src/components/portal/dairy/livestock-panels.tsx");
  assert.ok(panels.includes("submitLivestockLoan") && panels.includes("updateMilkSale"));
  for (const f of ["src/app/portal/services/livestock/livestock-form.tsx", "src/app/portal/services/livestock/livestock-details-form.tsx"]) {
    if (fs.existsSync(f)) assert.ok(true);
  }
  const migs = fs.readdirSync("supabase/migrations").filter((f) => f > "604");
  for (const f of migs) assert.ok(!/drop\s+table[^;]*livestock_loans|delete\s+from[^;]*(livestock_loans|farmers)/i.test(read(`supabase/migrations/${f}`)), f);
  const dash = read("src/app/portal/dashboard/page.tsx");
  assert.ok(!dash.includes('"/portal/services/livestock"'), "dashboard links point to Dairy");
});

test("one-screen CSS: fit screen = >=1024 wide AND >=640 tall; rules scoped to it", () => {
  const tw = read("tailwind.config.ts");
  assert.ok(tw.includes('fit: { raw: "(min-width: 1024px) and (min-height: 640px)" }'));
  const css = read("src/app/globals.css");
  const i = css.indexOf("@media (min-width: 1024px) and (min-height: 640px)");
  assert.ok(i > 0);
  for (const cls of [".pf-shell", ".pf-main", ".pf-fit", ".pf-grow", ".pf-panel", ".pf-body", ".pf-sticky"]) {
    assert.ok(css.indexOf(cls, i) > i, `${cls} inside fit media query`);
    // Query ke bahar sirf CSS variable (--pf-bg) ki ijazat -- mobile layout ko kuch nahi chhoota.
    for (const line of css.slice(0, i).split("\n").filter((l) => l.includes(cls))) assert.match(line, /\{\s*--pf-bg:[^;]+;\s*\}\s*$/, `${cls} outside fit query: ${line}`);
  }
  for (const f of ["src/app/portal/layout.tsx", "src/components/portal/customer/customer-shell.tsx"]) {
    const s = read(f);
    assert.ok(s.includes("pf-shell") && s.includes("pf-main"), f);
  }
  for (const f of ["src/app/portal/dashboard/page.tsx", "src/app/portal/wallet/page.tsx", "src/app/portal/c/orders/page.tsx", "src/app/portal/demand/demand-client.tsx", "src/app/portal/dairy/page.tsx", "src/app/portal/campaigns/page.tsx"]) {
    assert.ok(read(f).includes("pf-fit"), f);
  }
});

test("i18n: new labels EN / Roman / Urdu", () => {
  const dy = read("src/lib/i18n/dict/portal-dairy.ts");
  for (const k of ["dy_ms_title", "dy_ms_save", "dy_ln_title", "dy_ln_send", "dy_moved_note"]) {
    assert.match(dy, new RegExp(`${k}: \\{ en: "[^"]+", rm: "[^"]+", ur: "[^"]+" \\}`), k);
  }
  const m = read("src/lib/i18n/dict/portal-munshi.ts");
  for (const k of ["pmd_from_dairy", "pmd_per_day_dairy"]) assert.match(m, new RegExp(`${k}: \\{ en: "[^"]+", rm: "[^"]+", ur: "[^"]+" \\}`), k);
});

// v0.5.8 (owner feedback): baqi portal safhe bhi poori chaurai + ek screen.
const OS2_FILES = [
  "c/payments/page.tsx", "dairy/hisaab/page.tsx", "dairy/breeding/page.tsx", "dairy/health/page.tsx", "farms/page.tsx",
  "crops/page.tsx", "harvest/page.tsx", "services/machinery/page.tsx", "profile/page.tsx",
  "wallet/statement/page.tsx", "dairy/animals/page.tsx", "dairy/animals/new/page.tsx", "dairy/animals/[id]/page.tsx",
  "dairy/milk/page.tsx", "dairy/alerts/page.tsx", "dairy/hisaab/expense/page.tsx", "dairy/hisaab/income/page.tsx",
  "dairy/breeding/new/page.tsx", "dairy/breeding/animal/[id]/page.tsx", "ai-assistant/ai-assistant-client.tsx",
  "marketplace/page.tsx", "orders/page.tsx", "sell-produce/page.tsx", "c/page.tsx", "c/khata/page.tsx", "c/khata/print/page.tsx", "c/profile/page.tsx",
].map((f) => `src/app/portal/${f}`);

test("v0.5.8: every portal page is pf-fit and full width (no max-w-7xl/5xl/4xl/2xl page wrapper)", () => {
  for (const f of [...OS2_FILES, "src/app/portal/dashboard/page.tsx", "src/app/portal/wallet/page.tsx", "src/app/portal/c/orders/page.tsx", "src/app/portal/demand/demand-client.tsx", "src/app/portal/dairy/page.tsx", "src/app/portal/campaigns/page.tsx"]) {
    const s = read(f);
    assert.ok(s.includes("pf-fit"), `${f}: pf-fit`);
    assert.ok(s.includes("max-w-[1760px]"), `${f}: full width wrapper`);
    assert.ok(!/mx-auto (w-full )?max-w-(7xl|6xl|5xl|4xl|3xl|2xl)/.test(s), `${f}: no narrow centred wrapper`);
  }
});

test("v0.5.8: pf: variant (compact only inside portal pf-fit) + sr-only fix scoped to fit query", () => {
  const tw = read("tailwind.config.ts");
  assert.ok(tw.includes('addVariant("pf", "@media (min-width: 1024px) and (min-height: 640px) { .pf-fit & }")'));
  const css = read("src/app/globals.css");
  const i = css.indexOf("@media (min-width: 1024px) and (min-height: 640px)");
  const j = css.indexOf("position: relative", i);
  assert.ok(j > i, "position:relative inside fit query");
  const bp = read("src/components/portal/breeding/breed-parts.tsx");
  assert.ok(bp.includes("pf:") && !/\bfit:/.test(bp), "shared breeding parts use pf: (admin unchanged)");
});

test("v0.5.8: test hooks on new panels", () => {
  assert.ok(read("src/app/portal/farms/page.tsx").includes('data-testid="farms-map"'));
  assert.ok(read("src/app/portal/services/machinery/page.tsx").includes('data-testid="machinery-bookings"'));
  const pf = read("src/app/portal/profile/page.tsx") + read("src/app/portal/profile/farmer-profile-form.tsx");
  for (const id of ["profile-identity", "profile-form", "profile-sections"]) assert.ok(pf.includes(`data-testid="${id}"`), id);
});

test("v0.5.8: os2 labels EN / Roman / Urdu, dict registered; no new migration", () => {
  const d = read("src/lib/i18n/dict/portal-onescreen2.ts");
  const keys = [...d.matchAll(/^\s*(os2_\w+):/gm)].map((m) => m[1]);
  assert.ok(keys.length >= 20, `os2 keys ${keys.length}`);
  for (const k of keys) assert.match(d, new RegExp(`${k}: \\{ en: "[^"]+", rm: "[^"]+", ur: "[^"]+" \\}`), k);
  assert.ok(read("src/lib/i18n/translations.ts").includes("portalOneScreen2Dict"));
  assert.ok(!fs.readdirSync("supabase/migrations").some((f) => /one_screen|onescreen|os2/i.test(f)));
});

console.log(`\nportal-one-screen: ${passed} passed`);
