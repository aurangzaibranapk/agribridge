// Owner (19 Oct 2026): alag "Fertilizer / Seed / Pesticide Credit" page band -- udhaar sirf season plans se.
const assert = require("assert");
const fs = require("fs");
const read = (p) => fs.readFileSync(p, "utf8");
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

assert.ok(!read("src/lib/portal/nav.ts").includes("/portal/services/fertilizer"));
pass("sidebar: 'Fertilizer (Khaad / Spray)' item hata");

const dash = read("src/app/portal/dashboard/page.tsx");
assert.ok(!dash.includes('href="/portal/services/fertilizer"'), "dashboard par koi link nahi");
assert.ok(!dash.includes('"/portal/services/fertilizer"'), "task link bhi nahi");
assert.ok(!dash.includes('L("pmd_q_fert")') && !dash.includes('L("pmd_kpi_fert")'), "quick action + stat card hata");
assert.ok(/MiniKpi href="\/portal\/campaigns"[\s\S]{0,300}pmd_kpi_booking/.test(dash), "us jagah Season plan card");
assert.ok(dash.includes('<Quick href="/portal/campaigns"'), "Season booking quick action maujood");
pass("dashboard: Fertilizer credit quick action + stat card -> Season plan card");

const page = read("src/app/portal/services/fertilizer/page.tsx");
assert.ok(page.includes('redirect("/portal/campaigns")'));
assert.ok(!page.includes("credit_requests") && !page.includes("CreditRequestForm"));
pass("/portal/services/fertilizer -> /portal/campaigns redirect");

for (const f of ["src/app/admin/credit-requests/page.tsx", "src/app/admin/credit-requests/credit-request-actions.tsx", "src/actions/credit-requests.ts"]) assert.ok(fs.existsSync(f), f);
const migs = fs.readdirSync("supabase/migrations").filter((f) => f >= "604");
for (const f of migs) assert.ok(!/drop\s+table[^;]*credit_requests|delete\s+from[^;]*credit_requests/i.test(read(`supabase/migrations/${f}`)), f);
pass("admin approval screens + credit_requests table/data untouched");

const dict = read("src/lib/i18n/dict/portal-munshi.ts");
assert.ok(/pmd_kpi_booking: \{ en: "[^"]+", rm: "[^"]+", ur: "[^"]+" \}/.test(dict) && /pmd_open_plans: \{ en: "[^"]+", rm: "[^"]+", ur: "[^"]+" \}/.test(dict));
pass("naye labels EN / Roman / Urdu");
console.log(`\nportal-no-fertilizer-credit: ${ok} passed`);
