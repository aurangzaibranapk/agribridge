// WhatsApp webhook (go-live 5): AI kisan ko khud jawab nahi deta, anjaan
// number se farmer nahi banta, signature ke qaide. Koi asli paighaam nahi
// jata -- WhatsApp, Supabase aur AI sab nakli (stub) hain.
// Chalayen: npm run test:whatsapp-inbound
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Module from "node:module";

let passed = 0;
const tests: [string, () => Promise<void> | void][] = [];
const test = (n: string, fn: () => Promise<void> | void) => tests.push([n, fn]);
const read = (p: string) => fs.readFileSync(p, "utf8");

// ---- stubs -----------------------------------------------------------------
const sent: { to: string; text: string }[] = [];
const db: Record<string, any[]> = {};
let staffReply: string | null = null;
let machineryReply: string | null = null;
let aiCalls = 0;
let aiThrows = false;
const ops: string[] = [];

function table(name: string) { return (db[name] ??= []); }
function qb(name: string) {
  const filters: ((r: any) => boolean)[] = [];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: any = null;
  const get = (r: any, k: string) => (k.includes("->>") ? r[k.split("->>")[0]]?.[k.split("->>")[1]] : r[k]);
  const run = () => {
    const rows = table(name).filter((r) => filters.every((f) => f(r)));
    if (op === "insert") { const arr = Array.isArray(payload) ? payload : [payload]; for (const p of arr) table(name).push({ id: crypto.randomUUID(), ...p }); ops.push(`insert:${name}`); return arr; }
    if (op === "update") { rows.forEach((r) => Object.assign(r, payload)); ops.push(`update:${name}`); return rows; }
    if (op === "delete") { db[name] = table(name).filter((r) => !rows.includes(r)); ops.push(`delete:${name}`); return rows; }
    return rows;
  };
  const b: any = {
    select: () => b, order: () => b, limit: () => b,
    insert: (p: any) => { op = "insert"; payload = p; return b; },
    update: (p: any) => { op = "update"; payload = p; return b; },
    delete: () => { op = "delete"; return b; },
    eq: (k: string, v: any) => { filters.push((r) => get(r, k) === v); return b; },
    neq: (k: string, v: any) => { filters.push((r) => get(r, k) !== v); return b; },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0] ?? null, error: null }),
    then: (res: any, rej: any) => Promise.resolve({ data: run(), error: null }).then(res, rej),
  };
  return b;
}
const stubs: Record<string, any> = {
  "@/lib/supabase/service": { createServiceClient: () => ({ from: qb }) },
  "@/lib/whatsapp-client": {
    sendWhatsAppMessage: async (to: string, text: string) => { sent.push({ to, text }); },
    downloadWhatsAppMedia: async () => ({ base64: "AAAA", mimeType: "audio/ogg" }),
    normalizeWhatsAppPhone: (p: string) => p,
  },
  "@/lib/staff-whatsapp-router": { handleStaffMessage: async () => staffReply },
  "@/lib/machinery-whatsapp-confirm": { handleMachineryConfirmation: async () => machineryReply },
  "@/lib/farmer-ai-processor": {
    processFarmerAiMessage: async (_c: any, _f: string, input: any) => {
      aiCalls++;
      if (aiThrows) throw new Error("gemini down");
      return { answer: `AI mashwara: ${input.text ?? "voice"}`, draftCreated: false };
    },
  },
};
const origLoad = (Module as any)._load;
(Module as any)._load = function (req: string, parent: any, isMain: boolean) {
  if (stubs[req]) return stubs[req];
  return origLoad.call(this, req, parent, isMain);
};
const origResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (req: string, ...rest: any[]) {
  if (req.startsWith("@/")) return origResolve.call(this, path.join(process.cwd(), "src", req.slice(2)), ...rest);
  return origResolve.call(this, req, ...rest);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const route = require("../src/app/api/webhooks/whatsapp/route");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const policy = require("../src/lib/whatsapp/inbound-policy");

const SECRET = "test-secret-only";
function payload(from: string, msg: any, id: string = crypto.randomUUID()) {
  return JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ profile: { name: "Test Name" } }], messages: [{ id, from, ...msg }] } }] }] });
}
async function post(body: string, opts: { secret?: string | null; sign?: "good" | "bad" | "none" } = {}) {
  if (opts.secret) process.env.WHATSAPP_APP_SECRET = opts.secret; else delete process.env.WHATSAPP_APP_SECRET;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.sign === "good") headers["x-hub-signature-256"] = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  if (opts.sign === "bad") headers["x-hub-signature-256"] = "sha256=" + "0".repeat(64);
  const req = new Request("https://example.test/api/webhooks/whatsapp", { method: "POST", body, headers });
  const res = await route.POST(req as any);
  return res.status as number;
}
function reset() { sent.length = 0; ops.length = 0; for (const k of Object.keys(db)) delete db[k]; staffReply = null; machineryReply = null; aiCalls = 0; aiThrows = false;
  table("farmers").push({ id: "f1", phone_key: "3001234567", is_deleted: false, whatsapp_number: null }); }
const origWarn = console.warn; const warns: string[] = []; console.warn = (...a: any[]) => { warns.push(a.join(" ")); };
const origErr = console.error; console.error = () => {};

// ---- signature -------------------------------------------------------------
test("signature: secret set + good = valid, bad/missing = invalid, no secret = unsigned", () => {
  const body = "{}";
  const good = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  assert.equal(policy.checkSignature(body, good, SECRET), "valid");
  assert.equal(policy.checkSignature(body, "sha256=" + "a".repeat(64), SECRET), "invalid");
  assert.equal(policy.checkSignature(body, null, SECRET), "invalid");
  assert.equal(policy.checkSignature(body, "sha1=abc", SECRET), "invalid");
  assert.equal(policy.checkSignature(body, null, undefined), "unsigned");
  assert.equal(policy.checkSignature(body, good, ""), "unsigned");
});

test("secret set: bad signature -> 401, nothing stored, nothing sent", async () => {
  reset();
  const s = await post(payload("923001234567", { type: "text", text: { body: "salam" } }), { secret: SECRET, sign: "bad" });
  assert.equal(s, 401); assert.equal(sent.length, 0); assert.equal(ops.length, 0); assert.equal(aiCalls, 0);
  const s2 = await post(payload("923001234567", { type: "text", text: { body: "salam" } }), { secret: SECRET, sign: "none" });
  assert.equal(s2, 401); assert.equal(sent.length, 0);
});

// ---- farmer: no auto reply ---------------------------------------------------
test("known farmer text (signed): pending draft with AI suggestion stored, NO message sent", async () => {
  reset();
  const s = await post(payload("923001234567", { type: "text", text: { body: "gandum ka rate?" } }, "wamid.1"), { secret: SECRET, sign: "good" });
  assert.equal(s, 200);
  assert.equal(sent.length, 0, "AI ka jawab kisan ko khud nahi jana chahiye");
  const rows = table("farmer_ai_requests");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].intent_type, "whatsapp_reply"); assert.equal(rows[0].status, "pending"); assert.equal(rows[0].farmer_id, "f1");
  assert.equal(rows[0].details.suggested_reply, "AI mashwara: gandum ka rate?");
  assert.equal(rows[0].details.inbound_text, "gandum ka rate?"); assert.equal(rows[0].details.signature, "valid");
});

test("known farmer voice note (unsigned): draft stored, warning logged, NO message sent", async () => {
  reset(); warns.length = 0;
  const s = await post(payload("03001234567", { type: "audio", audio: { id: "media1" } }), { secret: null });
  assert.equal(s, 200); assert.equal(sent.length, 0);
  const rows = table("farmer_ai_requests");
  assert.equal(rows.length, 1); assert.equal(rows[0].details.message_type, "audio"); assert.equal(rows[0].details.suggested_reply, "AI mashwara: voice");
  assert.equal(rows[0].details.signature, "unsigned");
  assert.ok(warns.some((w) => /WHATSAPP_APP_SECRET set nahi/.test(w)));
});

test("AI fails: row still stored for staff (no suggestion), nothing sent", async () => {
  reset(); aiThrows = true;
  await post(payload("923001234567", { type: "text", text: { body: "madad" } }), { secret: SECRET, sign: "good" });
  const rows = table("farmer_ai_requests");
  assert.equal(rows.length, 1); assert.equal(rows[0].details.suggested_reply, null); assert.match(rows[0].details.ai_error, /gemini down/);
  assert.equal(sent.length, 0);
});

test("same wa_message_id twice (Meta retry): one row only", async () => {
  reset();
  const body = payload("923001234567", { type: "text", text: { body: "hello" } }, "wamid.dup");
  await post(body, { secret: SECRET, sign: "good" });
  await post(body, { secret: SECRET, sign: "good" });
  assert.equal(table("farmer_ai_requests").length, 1); assert.equal(aiCalls, 1); assert.equal(sent.length, 0);
});

test("farmer image / other type: no reply, no draft", async () => {
  reset();
  await post(payload("923001234567", { type: "image", image: { id: "img" } }), { secret: SECRET, sign: "good" });
  assert.equal(sent.length, 0); assert.equal(table("farmer_ai_requests").length, 0);
});

// ---- unknown sender ----------------------------------------------------------
test("unknown number: NO farmer created, queued once in unknown-sender list, NO message", async () => {
  reset();
  await post(payload("923339998877", { type: "text", text: { body: "Ali" } }), { secret: SECRET, sign: "good" });
  await post(payload("923339998877", { type: "text", text: { body: "Jhang" } }), { secret: SECRET, sign: "good" });
  await post(payload("923339998877", { type: "audio", audio: { id: "m" } }), { secret: null });
  assert.equal(table("farmers").length, 1, "koi naya farmer nahi");
  assert.ok(!ops.includes("insert:farmers"));
  const q = table("whatsapp_onboarding");
  assert.equal(q.length, 1); assert.equal(q[0].phone_key, "3339998877"); assert.equal(q[0].full_name, "Test Name");
  assert.equal(sent.length, 0); assert.equal(aiCalls, 0); assert.equal(table("farmer_ai_requests").length, 0);
});

// ---- staff / machinery -------------------------------------------------------
test("staff reply: sent only when signed; unsigned = processed but not sent", async () => {
  reset(); staffReply = "Hazri lag gayi";
  await post(payload("923001112223", { type: "text", text: { body: "IN" } }), { secret: SECRET, sign: "good" });
  assert.deepEqual(sent, [{ to: "923001112223", text: "Hazri lag gayi" }]);
  reset(); staffReply = "Hazri lag gayi";
  await post(payload("923001112223", { type: "text", text: { body: "IN" } }), { secret: null });
  assert.equal(sent.length, 0);
  reset(); machineryReply = "Booking confirm";
  await post(payload("923001234567", { type: "text", text: { body: "CONFIRM" } }), { secret: null });
  assert.equal(sent.length, 0); assert.equal(table("farmer_ai_requests").length, 0);
});

// ---- source guards -----------------------------------------------------------
test("webhook source: no farmer insert, no onboarding greetings, single guarded send", () => {
  const src = read("src/app/api/webhooks/whatsapp/route.ts");
  assert.ok(!/from\("farmers"\)\s*\.insert/.test(src));
  assert.ok(!/khush aamdeed|registration mukammal/i.test(src));
  assert.equal((src.match(/sendWhatsAppMessage\(/g) ?? []).length, 1, "sirf replyToStaff ke andar");
  assert.ok(/canAutoReplyToStaff\(sig\)/.test(src));
  assert.equal(policy.AUTO_REPLY_TO_FARMERS, false);
});

test("admin confirm-send: role check, preview confirm=yes, pending lock, rollback on failure", () => {
  const a = read("src/actions/whatsapp-replies.ts");
  assert.ok(a.includes('String(formData.get("confirm") ?? "") !== "yes"'));
  assert.ok(a.includes("WHATSAPP_REPLY_ROLES.includes(me.role)"));
  assert.ok(/\.eq\("status", "pending"\)\s*\.select\("id"\)/.test(a), "atomic pending -> approved lock");
  assert.ok(a.includes('update({ status: "pending", expert_response: null'), "send fail -> back to pending");
  const page = read("src/app/admin/farmer-ai-requests/page.tsx");
  assert.ok(page.includes("WHATSAPP_REPLY_ROLES.includes(me.role)"));
  const card = read("src/app/admin/farmer-ai-requests/reply-card.tsx");
  assert.ok(card.includes('name="confirm" value="yes"') && card.includes("Preview") && card.includes("Copy"));
  assert.ok(policy.validateStaffReply("  ") && policy.validateStaffReply("x".repeat(4001)) && policy.validateStaffReply("theek") === null);
});

test("farmer portal: whatsapp_reply rows hidden and not approvable by farmer", () => {
  assert.ok(read("src/app/portal/ai-assistant/page.tsx").includes('.neq("intent_type", "whatsapp_reply")'));
  const fa = read("src/actions/farmer-ai.ts");
  assert.ok(fa.includes('request.intent_type === "whatsapp_reply"') && fa.includes('.neq("intent_type", "whatsapp_reply")'));
});

(async () => {
  for (const [n, fn] of tests) { await fn(); passed++; origWarn(`  ok  ${n}`); }
  console.warn = origWarn; console.error = origErr;
  console.log(`\nwhatsapp-inbound: ${passed} passed`);
})().catch((e) => { console.warn = origWarn; console.error = origErr; console.error(e); process.exit(1); });
