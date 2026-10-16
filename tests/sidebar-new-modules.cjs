// Naye 6+1 modules: fallback (code) menu aur migrations dono mein maujood hon.
const fs = require("fs"); const assert = require("assert");
const nav = fs.readFileSync("src/components/layout/nav-items.ts", "utf8");
const groupOf = (href) => { const i = nav.indexOf(`href: "${href}"`); assert(i > 0, "fallback missing " + href); const m = [...nav.slice(0, i).matchAll(/label: "([^"]+)",\n\s+items:/g)]; return m[m.length - 1][1]; };
const want = { "/admin/demand-center": "Purchases", "/admin/business-360/owner": "Business", "/admin/intelligence": "Reports", "/admin/intelligence/products": "Reports", "/admin/staff-achievement/performance": "Administration", "/admin/support-center": "Administration", "/admin/my-work/support-dashboard": "Administration" };
for (const [h, g] of Object.entries(want)) assert.strictEqual(groupOf(h), g, h);
const sql = fs.readFileSync("supabase/migrations/533_sidebar_new_modules.sql", "utf8") + fs.readFileSync("supabase/migrations/534_support_dashboard_sidebar.sql", "utf8");
for (const k of ["demand-center", "business-360.owner", "intelligence.party", "intelligence.products", "staff-achievement.performance", "support.center", "support.dashboard"]) assert(sql.includes(`'${k}'`), "migration missing " + k);
assert(!/\b(update|delete|drop|alter)\b/i.test(sql.replace(/--.*$/gm, "")), "migrations must be additive");
console.log("sidebar-new-modules: ok");
