/** Security hardening migration guards.  npm run test:security-hardening */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`ok  ${name}`); }
const m546 = readFileSync("supabase/migrations/546_revoke_anon_secdef_functions.sql", "utf8");
const m547 = readFileSync("supabase/migrations/547_revoke_anon_select_views.sql", "utf8");
const body = (s: string) => s.split("\n").filter((l) => l.trim() && !l.startsWith("--"));

test("546/547 are privilege-only (no DML/DDL on data)", () => {
  for (const l of [...body(m546), ...body(m547)]) assert.match(l, /^(begin;|commit;|revoke |grant )/i, l);
});
test("546 never revokes from authenticated or service_role", () => {
  for (const l of body(m546).filter((x) => x.startsWith("revoke"))) assert.match(l, /from public, anon;$/);
  assert.equal(body(m546).filter((x) => x.startsWith("revoke")).length, body(m546).filter((x) => x.startsWith("grant")).length);
});
test("RLS policy helpers and pre-login callers are NOT in safe migration", () => {
  for (const f of ["fn_is_any_staff", "fn_is_admin_level", "current_dealer_id", "fn_score_visible", "fn_crop_profit_benchmarks", "fn_can_see_sale"])
    assert.ok(!new RegExp(`function public\\.${f}\\(`).test(m546), f);
});
test("anon RPCs called from pre-login code are not revoked", () => {
  const pre = ["src/app/login", "src/app/register", "src/app/forgot-password", "src/app/reset-password", "src/app/auth"];
  const names = new Set<string>();
  const walk = (d: string) => { try { for (const e of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else for (const m of readFileSync(p, "utf8").matchAll(/rpc\(\s*["'`](\w+)["'`]/g)) names.add(m[1]); } } catch {} };
  pre.forEach(walk);
  for (const f of names) assert.ok(!new RegExp(`function public\\.${f}\\(`).test(m546), f);
});
test("needs-review files stay out of supabase/migrations", () => {
  const live = readdirSync("supabase/migrations");
  for (const f of readdirSync("supabase/migrations-proposed")) assert.ok(!live.includes(f), f);
});
console.log(`\n${n} tests passed`);
