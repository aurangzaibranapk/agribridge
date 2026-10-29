import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const required = [
  "apps/mobile/App.tsx",
  "apps/mobile/app.config.ts",
  "apps/mobile/src/auth-screens.tsx",
  "apps/mobile/src/roles/admin.tsx",
  "apps/mobile/src/roles/admin-workspace.tsx",
  "apps/mobile/src/roles/farmer.tsx",
  "apps/mobile/src/roles/farmer-approved.tsx",
  "apps/mobile/src/roles/mca.tsx",
  "apps/mobile/src/roles/mca-approved.tsx",
  "apps/mobile/src/roles/mco.tsx",
  "apps/mobile/src/roles/mco-approved.tsx",
  "apps/mobile/src/roles/vet.tsx",
  "apps/mobile/src/roles/vet-approved.tsx",
  "apps/mobile/src/roles/staff.tsx",
  "apps/mobile/src/roles/staff-workspace.tsx",
  "apps/mobile/src/roles/internal-hr.tsx",
  "apps/mobile/src/roles/dealer.tsx",
  "apps/mobile/src/roles/supplier.tsx",
  "apps/mobile/src/roles/merchant-approved.tsx",
  "src/lib/mobile/live-read.ts",
  "src/lib/mobile/digital-munshi.ts",
  "src/lib/mobile/nav.ts",
  "src/lib/mobile/roles.ts",
  "supabase/migrations/20261029103000_merchant_mobile_profile.sql",
  "supabase/migrations/20261029103000_merchant_mobile_profile.rollback.sql",
  ".github/workflows/mobile-sideload-test.yml",
];
for (let index = 1; index <= 10; index += 1) required.push(`apps/mobile/assets/farmers/farmer-${String(index).padStart(2, "0")}.jpg`);
for (const name of ["buffalo", "holstein", "sahiwal"]) required.push(`apps/mobile/assets/animals/${name}.jpg`);

const missing = required.filter((file) => !existsSync(file));
if (missing.length) throw new Error(`Required mobile files missing:\n${missing.join("\n")}`);

const untracked = required.filter((file) => {
  try { execFileSync("git", ["ls-files", "--error-unmatch", "--", file], { stdio: "ignore" }); return false; }
  catch { return true; }
});
if (untracked.length) throw new Error(`Required mobile files are not Git-tracked:\n${untracked.join("\n")}`);

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const forbidden = tracked.filter((file) => /(^|\/)(dist(?:-\d+-test(?:-final)?)?|build-\d+-download|node_modules|android\/app\/build)(\/|$)/.test(file) || /\.apk$|\.aab$|\.zip$/i.test(file));
if (forbidden.length) throw new Error(`Generated build files must not be committed:\n${forbidden.join("\n")}`);

const approved = [
  "apps/mobile/src/roles/admin-workspace.tsx",
  "apps/mobile/src/roles/farmer-approved.tsx",
  "apps/mobile/src/roles/merchant-approved.tsx",
  "apps/mobile/src/roles/vet-approved.tsx",
].map((file) => readFileSync(file, "utf8")).join("\n");
for (const [label, pattern] of [
  ["no-op Apply button", /onApply=\{\(\) => undefined\}/],
  ["unfinished Vet request", /Submit integration TEST/],
  ["dead Merchant help button", /<Pressable style=\{s\.help\}>/],
  ["dead Vet action button", /<Pressable style=\{s\.secondary\}>/],
]) {
  if (pattern.test(approved)) throw new Error(`Approved mobile screen still contains ${label}.`);
}

const testWorkflow = readFileSync(".github/workflows/mobile-sideload-test.yml", "utf8");
if (!/node scripts\/check-mobile-integrity\.mjs/.test(testWorkflow)) throw new Error("TEST APK workflow does not run the mobile integrity guard.");
console.log(`mobile integrity ok: ${required.length} required files tracked; ${tracked.length} repository files checked`);
