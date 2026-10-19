// Admin sidebar tint token (19 Oct 2026): ek lafz badlo, dark navy wahi.  node tests/admin-tint.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const s = fs.readFileSync("src/lib/ui/admin-tint.ts", "utf8");
assert.match(s, /export const ADMIN_TINT: AdminTint = "(white|mint|sage|navy)";/);
for (const k of ["white", "mint", "sage", "navy"]) assert.ok(new RegExp(`\\n  ${k}: \\{[\\s\\S]*?aside: \`[^\`]*\\$\\{DARK_ASIDE\\}\``).test(s), `${k}: dark navy aside`);
assert.ok(s.includes('const DARK_ASIDE = "dark:border-white/10 dark:bg-[#0b1430]"'));
const sb = fs.readFileSync("src/components/layout/sidebar.tsx", "utf8");
assert.ok(sb.includes("TINT.aside") && sb.includes("TINT.hover") && sb.includes("TINT.legend"));
assert.ok(fs.readFileSync("src/components/layout/topbar.tsx", "utf8").includes("adminTint().header"));
console.log("admin-tint ok");
