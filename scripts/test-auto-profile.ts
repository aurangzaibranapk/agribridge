// Login hai magar profile nahi (17 Oct) -- app ki taraf ke pehre.
// Chalayein: npm run test:auto-profile
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadOrHealProfile, ensureProfileFor } from "../src/lib/auth/ensure-profile";
import { removeLoginSafely } from "../src/lib/auth/remove-login";

let n = 0;
const ok = async (name: string, fn: () => Promise<void> | void) => { await fn(); n += 1; console.log("  ok -", name); };

function fakeClient(opts: { profile?: { role: string; is_active: boolean } | null; heal?: string | null; rpcError?: boolean; rpcThrows?: boolean }) {
  let profile = opts.profile ?? null;
  const calls: string[] = [];
  return {
    calls,
    from() {
      return { select() { return { eq() { return { maybeSingle: async () => ({ data: profile }) }; } }; } };
    },
    async rpc(fn: string, args?: Record<string, unknown>) {
      calls.push(fn + (args ? JSON.stringify(args) : ""));
      if (opts.rpcThrows) throw new Error("boom");
      if (opts.rpcError) return { data: null, error: { message: "function does not exist" } };
      if (opts.heal) profile = { role: opts.heal, is_active: true };
      return { data: opts.heal ?? null, error: null };
    },
  };
}

async function main() {
await ok("profile maujood ho to rpc nahi chalta", async () => {
  const c = fakeClient({ profile: { role: "owner", is_active: true } });
  assert.deepEqual(await loadOrHealProfile(c, "u1"), { role: "owner", is_active: true });
  assert.equal(c.calls.length, 0);
});
await ok("profile gum: fn_ensure_my_profile se ban kar wapas aati hai", async () => {
  const c = fakeClient({ profile: null, heal: "farmer" });
  assert.deepEqual(await loadOrHealProfile(c, "u1"), { role: "farmer", is_active: true });
  assert.deepEqual(c.calls, ["fn_ensure_my_profile"]);
});
await ok("juRa record nahi / migration live nahi / rpc toota -> null (purana paighaam)", async () => {
  assert.equal(await loadOrHealProfile(fakeClient({ profile: null, heal: null }), "u1"), null);
  assert.equal(await loadOrHealProfile(fakeClient({ profile: null, rpcError: true }), "u1"), null);
  assert.equal(await loadOrHealProfile(fakeClient({ profile: null, rpcThrows: true }), "u1"), null);
});
await ok("ensureProfileFor service rpc ko user id deta hai, ghalti par null", async () => {
  const c = fakeClient({ heal: "farmer" });
  assert.equal(await ensureProfileFor(c, "abc"), "farmer");
  assert.deepEqual(c.calls, ['fn_ensure_profile{"p_user":"abc"}']);
  assert.equal(await ensureProfileFor(fakeClient({ rpcError: true }), "abc"), null);
});

await ok("removeLoginSafely: ghalti LAUTAYE to bhi pakarta hai (supabase-js phenkta nahi)", async () => {
  const good = { auth: { admin: { deleteUser: async () => ({ error: null }) } } };
  assert.deepEqual(await removeLoginSafely(good, "u1"), { removed: true });
  const fk = { auth: { admin: { deleteUser: async () => ({ error: { message: "Database error deleting user" } }) } } };
  assert.deepEqual(await removeLoginSafely(fk, "u1"), { removed: false, error: "Database error deleting user" });
  const boom = { auth: { admin: { deleteUser: async () => { throw new Error("net"); } } } };
  assert.deepEqual(await removeLoginSafely(boom, "u1"), { removed: false, error: "net" });
  assert.equal((await removeLoginSafely(good, "")).removed, false);
});

const src = (p: string) => readFileSync(p, "utf8");
await ok("deleteStaff: profile pehle nahi mitti, auth ghalti nigli nahi jati", () => {
  const s = src("src/actions/users.ts");
  const body = s.slice(s.indexOf("export async function deleteStaff"));
  const fnBody = body.slice(0, body.indexOf("\nexport ", 10) > 0 ? body.indexOf("\nexport ", 10) : undefined);
  assert.equal(/from\("profiles"\)\.delete\(\)/.test(fnBody), false);
  assert.equal(/deleteUser\([^)]*\)\.catch/.test(fnBody), false);
  assert.ok(fnBody.includes("removeLoginSafely(serviceClient, userId)"));
  assert.ok(fnBody.indexOf("removeLoginSafely") < fnBody.indexOf('status: "suspended"'));
});
await ok("deleteApplication: pehle login, fail par suspend aur application baqi", () => {
  const s = src("src/actions/delete-application.ts");
  assert.equal(/from\("profiles"\)\.delete\(\)/.test(s), false);
  assert.equal(/from\("staff_details"\)\.delete\(\)/.test(s), false);
  const i = s.indexOf("removeLoginSafely(serviceClient, application.created_profile_id)");
  assert.ok(i > 0);
  assert.ok(i < s.indexOf('from("job_applications").delete()'));
  assert.ok(s.includes('status: "suspended"'));
});
await ok("har login raasta profile yaqeeni karta hai", () => {
  assert.ok(src("src/actions/farmer-auth.ts").includes("loadOrHealProfile(supabase, data.user.id)"));
  assert.ok(src("src/actions/farmer-auth.ts").includes("ensureProfileFor(service, userId)"));
  assert.ok(src("src/actions/farmer-signup.ts").includes("ensureProfileFor(service, made.user.id)"));
  assert.ok(src("src/actions/registration.ts").includes("ensureProfileFor(serviceClient, createData.user.id)"));
  const lf = src("src/app/login/login-form.tsx");
  assert.equal((lf.match(/loadOrHealProfile\(supabase, data\.user\.id\)/g) ?? []).length, 2);
  assert.equal(/from\("profiles"\)/.test(lf), false);
});
await ok("migration 560 aur backfill alag; backfill migrations folder mein nahi", () => {
  const m = src("supabase/migrations/560_auto_profile_self_heal.sql");
  assert.ok(m.includes("fn_ensure_my_profile"));
  assert.ok(m.includes("on conflict (id) do nothing"));
  const b = src("supabase/backfills/560_orphan_profiles_backfill.sql");
  assert.ok(b.includes("LIVE PAR ABHI NAHI CHALANA"));
  assert.ok(!readFileSync("package.json", "utf8").includes("backfills/560"));
});

console.log(`\n${n} tests pass`);
}

main().catch((e) => { console.error(e); process.exit(1); });
