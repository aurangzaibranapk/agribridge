// Mobile API (/api/mobile/*) ke pehre. Chalayein: npm run test:mobile-app
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBearer, validateFarmerAiBody, MAX_AI_MESSAGE } from "../src/lib/mobile/bearer";

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n += 1; console.log("  ok -", name); };
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";

ok("parseBearer sirf JWT shakal", () => {
  assert.equal(parseBearer(`Bearer ${JWT}`), JWT);
  assert.equal(parseBearer(`bearer ${JWT}`), JWT);
  assert.equal(parseBearer(null), null);
  assert.equal(parseBearer(""), null);
  assert.equal(parseBearer("Bearer "), null);
  assert.equal(parseBearer(`Basic ${JWT}`), null);
  assert.equal(parseBearer("Bearer not-a-jwt"), null);
  assert.equal(parseBearer(`Bearer ${JWT} extra`), null);
  assert.equal(parseBearer(`Bearer ${"a".repeat(9000)}.b.c`), null);
});

ok("farmer-ai body ki jaanch", () => {
  assert.equal(validateFarmerAiBody(null).ok, false);
  assert.equal(validateFarmerAiBody([]).ok, false);
  assert.equal(validateFarmerAiBody({}).ok, false);
  assert.equal(validateFarmerAiBody({ message: "   " }).ok, false);
  const v = validateFarmerAiBody({ message: " gandum ko khaad kab? " });
  assert.ok(v.ok && v.value.text === "gandum ko khaad kab?" && v.value.audioMimeType === "audio/webm");
  assert.equal(validateFarmerAiBody({ message: "x".repeat(MAX_AI_MESSAGE + 1) }).ok, false);
  assert.equal(validateFarmerAiBody({ audio: "abc$%" }).ok, false);
  assert.equal(validateFarmerAiBody({ audio: "QUJD", audioMimeType: "application/pdf" }).ok, false);
  const a = validateFarmerAiBody({ audio: "QUJD", audioMimeType: "audio/AAC" });
  assert.ok(a.ok && a.value.audioBase64 === "QUJD" && a.value.audioMimeType === "audio/aac");
});

ok("route: bearer, RLS client, koi service key nahi", () => {
  const src = readFileSync("src/app/api/mobile/farmer-ai/route.ts", "utf8");
  assert.match(src, /parseBearer\(request\.headers\.get\("authorization"\)\)/);
  assert.match(src, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(src, /SERVICE_ROLE|createServiceClient|service\.ts/);
  assert.match(src, /auth\.getUser\(token\)/);
});

ok("middleware /api/mobile ko cookie login par redirect nahi karta", () => {
  const mw = readFileSync("src/middleware.ts", "utf8");
  assert.match(mw, /if \(!pathname\.startsWith\("\/admin"\) && !pathname\.startsWith\("\/portal"\) && !isBridgeAiApi\) return response;/);
});

ok("Flutter app sirf maujood RPC bulati hai (583-588 + 565-577)", () => {
  const repo = readFileSync("mobile/lib/core/data/mobile_repository.dart", "utf8");
  const rpcs = [...repo.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]);
  const migrations = ["583_mobile_devices_account_deletion", "584_mobile_service_requests", "585_mobile_catalog_dashboard",
    "586_mobile_my_summary", "587_mobile_farmer_grain_machinery", "588_mobile_order_request", "565_portal_own_khata",
    "567_dairy_milk_yields", "571_dairy_reminders", "572_customer_portal_read", "573_customer_portal_requests"]
    .map((f) => readFileSync(`supabase/migrations/${f}.sql`, "utf8")).join("\n");
  assert.ok(rpcs.length >= 15, "rpc list");
  for (const r of rpcs) assert.match(migrations, new RegExp(`function public\\.${r}\\(`), `${r} kisi migration mein nahi`);
  assert.doesNotMatch(repo, /account_deletion_requests|from\('mobile_devices'\)/, "purane testing tables nahi");
  assert.doesNotMatch(repo, /'Credit'/, "mobile se khata order nahi");
});

console.log(`mobile API: ${n} ok`);
