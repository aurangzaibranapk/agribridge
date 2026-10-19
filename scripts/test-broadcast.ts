// Broadcast (malik ki manzoori 19 Oct 2026): har raasta bina network / bina DB. npm run test:broadcast
import assert from "node:assert/strict";
import fs from "node:fs";
import { broadcastConfig, META_PK_RATES } from "../src/lib/broadcast/config";
import { planBatch, inQuietHours } from "../src/lib/broadcast/schedule";
import { runBroadcastWorker, type WorkerDeps, type QueuedRow, type BroadcastRow } from "../src/lib/broadcast/worker";
import { applyAudience, parseCsv, type Candidate } from "../src/lib/broadcast/audience";
import { renderText, smsSegments, normalizePkMobile, optKeyword, missingVars } from "../src/lib/broadcast/text";
import { estimateCost } from "../src/lib/broadcast/cost";
import { getSmsProvider, consoleSmsProvider } from "../src/lib/broadcast/sms";
import { readBroadcastEvents, recordBroadcastWebhook } from "../src/lib/broadcast/webhook";

let passed = 0;
const test = async (n: string, fn: () => void | Promise<void>) => { await fn(); passed++; console.log(`  ok  ${n}`); };
const read = (p: string) => fs.readFileSync(p, "utf8");
const ON = { BROADCAST_ENABLED: "true", BROADCAST_RATE_PER_SEC: "5", BROADCAST_DAILY_CAP: "100", BROADCAST_QUIET_HOURS: "21-08" };
const noon = new Date("2026-10-20T07:00:00Z"); // 12:00 PKT
const night = new Date("2026-10-20T17:30:00Z"); // 22:30 PKT

(async () => {
await test("kill switch: default OFF; only exact 'true' turns it on", () => {
  assert.equal(broadcastConfig({}).enabled, false);
  for (const v of ["1", "yes", "TRUE", "on", " true"]) assert.equal(broadcastConfig({ BROADCAST_ENABLED: v }).enabled, false, v);
  assert.equal(broadcastConfig({ BROADCAST_ENABLED: "true" }).enabled, true);
  assert.equal(planBatch(noon, broadcastConfig({}), 0).limit, 0);
});

const tplOk = { name: "general_notice", lang: "ur", meta_status: "APPROVED" };
const B = (o: Partial<BroadcastRow> = {}): BroadcastRow => ({ id: "b1", channel: "whatsapp", status: "sending", template_vars: ["naam"], sms_body: { rm: "Salam {naam}" }, approved_by: "owner", created_by: "mgr", template: tplOk, ...o });
const Q = (n: number, ch: "whatsapp" | "sms" = "whatsapp", b = "b1"): QueuedRow => ({ id: `r${n}`, broadcast_id: b, phone: `92300000000${n}`, lang: "rm", vars: { naam: `F${n}` }, channel: ch });
function deps(rows: QueuedRow[], bc: Record<string, BroadcastRow | null>, env: Record<string, string> = ON, now = noon) {
  const log = { claimed: [] as number[], wa: [] as any[], sms: [] as any[], marks: [] as any[], sleeps: 0, claimCalls: 0 };
  const d: WorkerDeps = {
    config: broadcastConfig(env), now: () => now, sentToday: async () => 0,
    claim: async (limit) => { log.claimCalls++; log.claimed.push(limit); return rows.slice(0, limit); },
    loadBroadcast: async (id) => bc[id] ?? null,
    mark: async (...a) => { log.marks.push(a); },
    sendTemplate: async (to, name, lang, params) => { log.wa.push({ to, name, lang, params }); return `wamid.${to}`; },
    sendSms: async (to, text) => { log.sms.push({ to, text }); return { id: "c1", status: "sent", provider: "console" }; },
    sleep: async () => { log.sleeps++; },
  };
  return { d, log };
}

await test("kill switch: worker never claims or sends when OFF", async () => {
  const { d, log } = deps([Q(1)], { b1: B() }, {});
  const r = await runBroadcastWorker(d);
  assert.equal(r.sent, 0); assert.match(r.reason!, /kill switch/);
  assert.equal(log.claimCalls, 0); assert.equal(log.wa.length + log.sms.length, 0);
  const route = read("src/app/api/broadcast/run/route.ts");
  assert.ok(route.indexOf("if (!cfg.enabled)") < route.indexOf("createServiceClient()"), "route returns before touching DB");
});

await test("rate limit + daily cap + quiet hours", async () => {
  const cfg = broadcastConfig(ON);
  assert.deepEqual(planBatch(noon, cfg, 0), { limit: 100, reason: null, delayMs: 200 }); // min(cap 100, 5/s*50s=250)
  assert.equal(planBatch(noon, cfg, 90).limit, 10);
  assert.equal(planBatch(noon, cfg, 100).reason, "daily cap reached");
  assert.equal(planBatch(noon, broadcastConfig({ ...ON, BROADCAST_DAILY_CAP: "100000" }), 0).limit, 250);
  assert.match(String(planBatch(night, cfg, 0).reason), /quiet hours/);
  assert.equal(inQuietHours(new Date("2026-10-20T02:59:00Z"), cfg), true);  // 07:59 PKT
  assert.equal(inQuietHours(new Date("2026-10-20T03:00:00Z"), cfg), false); // 08:00 PKT
  assert.equal(broadcastConfig({ BROADCAST_RATE_PER_SEC: "9999" }).ratePerSec, 80, "rate capped");
  const rows = Array.from({ length: 300 }, (_, i) => Q(i % 10));
  const { d, log } = deps(rows, { b1: B() });
  const r = await runBroadcastWorker(d);
  assert.equal(log.claimed[0], 100); assert.equal(r.sent, 100); assert.equal(log.sleeps, 100, "paced per message");
  const n = deps([Q(1)], { b1: B() }, ON, night); assert.equal((await runBroadcastWorker(n.d)).sent, 0); assert.equal(n.log.claimCalls, 0);
});

await test("template-only: WhatsApp goes only via approved template; free-text sender never used", async () => {
  const { d, log } = deps([Q(1), Q(2)], { b1: B() });
  await runBroadcastWorker(d);
  assert.deepEqual(log.wa[0], { to: "923000000001", name: "general_notice", lang: "ur", params: ["F1"] });
  for (const st of ["PENDING", "REJECTED", "PAUSED"]) {
    const x = deps([Q(1)], { b1: B({ template: { ...tplOk, meta_status: st } }) });
    const r = await runBroadcastWorker(x.d);
    assert.equal(x.log.wa.length, 0, st); assert.equal(r.failed, 1); assert.match(x.log.marks[0][4], /APPROVED/);
  }
  const x = deps([Q(1)], { b1: B({ template: null }) }); await runBroadcastWorker(x.d); assert.equal(x.log.wa.length, 0);
  for (const f of ["src/lib/broadcast/worker.ts", "src/app/api/broadcast/run/route.ts", "src/app/admin/broadcast/actions.ts", "src/lib/broadcast/webhook.ts"]) {
    assert.ok(!/sendWhatsAppMessage|sendWhatsAppDocument/.test(read(f)), `${f}: no free-text WhatsApp`);
  }
  assert.ok(!read("src/app/admin/broadcast/actions.ts").includes("whatsapp-client"), "actions cannot send at all");
});

await test("maker-checker (app side): unapproved / self-approved / wrong status rows are skipped", async () => {
  for (const b of [B({ approved_by: null }), B({ approved_by: "mgr" }), B({ status: "pending_approval" }), B({ status: "cancelled" }), null]) {
    const { d, log } = deps([Q(1)], { b1: b });
    const r = await runBroadcastWorker(d);
    assert.equal(r.skipped, 1); assert.equal(log.wa.length + log.sms.length + log.marks.length, 0);
  }
  const act = read("src/app/admin/broadcast/actions.ts");
  assert.ok(act.includes('rpc("broadcast_approve"') || act.includes('"broadcast_approve"'));
  assert.ok(!/approved_by\s*:/.test(act), "app never writes approved_by directly");
  const page = read("src/app/admin/broadcast/[id]/page.tsx");
  assert.ok(page.includes("isApprover && !isCreator"), "approve button hidden for creator");
});

await test("SMS: console provider only (log, sandbox); unknown provider refuses; text rendered", async () => {
  assert.equal(getSmsProvider("console"), consoleSmsProvider); assert.equal(consoleSmsProvider.sandbox, true);
  assert.throws(() => getSmsProvider("jazz"), /mojood nahi/);
  assert.ok(!/fetch\(/.test(read("src/lib/broadcast/sms/index.ts")), "console provider makes no network call");
  const { d, log } = deps([Q(3, "sms")], { b1: B({ channel: "sms", template: null }) });
  await runBroadcastWorker(d);
  assert.deepEqual(log.sms[0], { to: "923000000003", text: "Salam F3" });
  const fail = deps([Q(1)], { b1: B() }); fail.d.sendTemplate = async () => { throw new Error("131026 not on WhatsApp"); };
  const r = await runBroadcastWorker(fail.d); assert.equal(r.failed, 1); assert.equal(fail.log.marks[0][1], "failed");
});

const C: Candidate[] = [
  { type: "farmer", id: "f1", name: "Aslam", phone: "0300-1111111", village: "Kot Rana", campaignIds: ["gandum"], udhaarDays: 70, balance: 12000, dairy: true },
  { type: "farmer", id: "f2", name: "Bashir", phone: "+92 301 2222222", village: "Chak 45", campaignIds: ["munji"], udhaarDays: 10, balance: 500 },
  { type: "farmer", id: "f3", name: "NoPhone", phone: null, village: "Kot Rana" },
  { type: "customer", id: "c1", name: "Dukaan", phone: "03001111111", village: "Kot Rana", udhaarDays: 95, balance: 40000 }, // same phone as f1
  { type: "customer", id: "c2", name: "Hotel", phone: "03213333333", udhaarDays: null, balance: 0 },
  { type: "staff", id: "s1", name: "Kashif", phone: "03334444444", department: "sales" },
  { type: "staff", id: "s2", name: "Hina", phone: "03335555555", department: "hr" },
];
await test("audience scoping: role, village, season, udhaar, dairy, department, picked, CSV, dedupe", () => {
  const ids = (spec: any) => applyAudience(C, spec).recipients.map((r) => r.party_id ?? r.phone);
  assert.deepEqual(ids({ role: "farmers" }), ["f1", "f2"]);
  assert.equal(applyAudience(C, { role: "farmers" }).noNumber, 1);
  assert.deepEqual(ids({ role: "customers" }), ["c1", "c2"]);
  assert.deepEqual(ids({ role: "staff" }), ["s1", "s2"]);
  assert.deepEqual(ids({ role: "all" }), ["f1", "f2", "c2", "s1", "s2"], "same phone once");
  assert.equal(applyAudience(C, { role: "all" }).duplicates, 1);
  assert.deepEqual(ids({ role: "farmers", villages: ["kot rana"] }), ["f1"]);
  assert.deepEqual(ids({ role: "farmers", campaignIds: ["munji"] }), ["f2"]);
  assert.deepEqual(ids({ role: "customers", udhaarDays: 60 }), ["c1"]);
  assert.deepEqual(ids({ role: "all", udhaarDays: 60, udhaarMin: 20000 }), ["c1"]);
  assert.deepEqual(ids({ role: "farmers", dairyOnly: true }), ["f1"]);
  assert.deepEqual(ids({ role: "staff", departments: ["hr"] }), ["s2"]);
  assert.deepEqual(ids({ role: "farmers", departments: ["hr"] }), [], "department filter never leaks farmers");
  assert.deepEqual(ids({ role: "staff", pickedIds: ["f1", "s1"] }), ["s1"], "picked respects role");
  assert.deepEqual(ids({ role: "custom", pickedIds: ["f2"], csv: [{ name: "X", phone: "0345-6666666" }, { name: "bad", phone: "123" }] }), ["f2", "923456666666"]);
  assert.deepEqual(ids({ role: "custom" }), [], "custom without list = nobody");
  const r = applyAudience(C, { role: "farmers" }, "Gandum 2026").recipients[0];
  assert.deepEqual(r.vars, { naam: "Aslam", baqi_raqam: "Rs 12,000", gaon: "Kot Rana", season: "Gandum 2026" });
  assert.equal(r.phone, "923001111111");
  assert.deepEqual(parseCsv("name,phone\nAli,0300-1234567\nbad\n\"Zed\",3011234567"), [{ name: "Ali", phone: "0300-1234567" }, { name: "Zed", phone: "3011234567" }]);
});

await test("text: variables, missing vars, SMS segments (GSM-7 / Urdu), numbers, STOP words", () => {
  assert.equal(renderText("Salam {naam}, baqi {baqi_raqam} {x}", { naam: "Ali", baqi_raqam: "" }), "Salam Ali, baqi — {x}");
  assert.deepEqual(missingVars("{naam} {gaon} {gaon}", { naam: "A" }), ["gaon"]);
  assert.deepEqual(smsSegments("a".repeat(160)), { encoding: "GSM-7", chars: 160, segments: 1, perSegment: 160 });
  assert.equal(smsSegments("a".repeat(161)).segments, 2);
  assert.equal(smsSegments("€".repeat(80)).chars, 160);
  assert.deepEqual(smsSegments("س".repeat(70)), { encoding: "UCS-2", chars: 70, segments: 1, perSegment: 70 });
  assert.equal(smsSegments("س".repeat(71)).segments, 2);
  assert.equal(normalizePkMobile("0300-1234567"), "923001234567"); assert.equal(normalizePkMobile("00923001234567"), "923001234567");
  assert.equal(normalizePkMobile("042-111222333"), null); assert.equal(normalizePkMobile("12345"), null);
  for (const w of ["STOP", "stop.", "Band karo!", "بند", "unsubscribe"]) assert.equal(optKeyword(w), "stop", w);
  for (const w of ["START", "shuru"]) assert.equal(optKeyword(w), "start", w);
  assert.equal(optKeyword("stop the tractor"), null);
  const sql = read("supabase/migrations/598_messaging_optouts.sql");
  for (const w of ["'stop'", "'band karo'", "'بند'", "'start'"]) assert.ok(sql.includes(w), `DB keyword list has ${w}`);
});

await test("cost: Meta PK marketing $0.0473 / utility $0.0150 per delivered (1 Oct 2026); SMS rates TBD; env override", () => {
  assert.deepEqual(META_PK_RATES, { marketing: 0.0473, utility: 0.015, effective: "2026-10-01" });
  const cfg = broadcastConfig({});
  const m = estimateCost({ channel: "whatsapp", category: "MARKETING", recipients: 1000, smsSegments: 1 }, cfg);
  assert.equal(m.waUsd, 47.3); assert.equal(m.totalUsd, 47.3);
  assert.equal(estimateCost({ channel: "whatsapp", category: "UTILITY", recipients: 1000, smsSegments: 1 }, cfg).waUsd, 15);
  const s = estimateCost({ channel: "sms", category: null, recipients: 100, smsSegments: 2 }, cfg);
  assert.equal(s.smsUsd, null); assert.equal(s.totalUsd, null); assert.match(s.note, /provider rates TBD/); assert.equal(s.smsSegments, 200);
  assert.match(estimateCost({ channel: "both", category: "UTILITY", recipients: 10, smsSegments: 2 }, cfg).note, /fallback up to 20/);
  const c2 = broadcastConfig({ META_RATE_UTILITY_USD: "0.02", SMS_RATE_PER_SEGMENT_USD: "0.004" });
  assert.equal(estimateCost({ channel: "sms", category: null, recipients: 100, smsSegments: 1 }, c2).smsUsd, 0.4);
  assert.equal(estimateCost({ channel: "whatsapp", category: "UTILITY", recipients: 100, smsSegments: 1 }, c2).waUsd, 2);
});

await test("webhook: statuses + STOP recorded; other text ignored; wired only on signed requests", async () => {
  const body = { entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1", status: "delivered" }, { id: "wamid.2", status: "failed", errors: [{ title: "Undeliverable" }] }],
    messages: [{ from: "923001234567", type: "text", text: { body: "STOP" } }, { from: "923001234568", type: "text", text: { body: "rate kya hai?" } }] } }] }] };
  const ev = readBroadcastEvents(body);
  assert.equal(ev.statuses.length, 2); assert.deepEqual(ev.keywords, [{ phone: "923001234567", text: "STOP" }]);
  const calls: any[] = []; await recordBroadcastWebhook(async (fn, a) => { calls.push([fn, a]); return null; }, body);
  assert.deepEqual(calls.map((c) => c[0]), ["broadcast_status_update", "broadcast_status_update", "fn_messaging_keyword"]);
  assert.equal(readBroadcastEvents({}).statuses.length, 0);
  const route = read("src/app/api/webhooks/whatsapp/route.ts");
  assert.ok(/if \(sig === "valid"\) \{\s*\n\s*const svc = createServiceClient\(\);\s*\n\s*await import\("@\/lib\/broadcast\/webhook"\)/.test(route));
});

await test("wiring: sidebar, i18n EN/Roman/Urdu, migrations 589/594/597/598/599 only (not 610/613), env documented", () => {
  assert.ok(read("src/components/layout/nav-items.ts").includes('href: "/admin/broadcast"'));
  assert.ok(read("src/lib/access/icons.ts").includes("Megaphone"));
  const d = read("src/lib/i18n/dict/broadcast.ts");
  const keys = [...d.matchAll(/^\s*(bc_\w+):/gm)].map((m) => m[1]);
  assert.ok(keys.length >= 60);
  for (const k of keys) assert.match(d, new RegExp(`${k}: \\{ en: "[^"]+", rm: "[^"]+", ur: "[^"]+" \\}`), k);
  assert.ok(read("src/lib/i18n/translations.ts").includes("...broadcastDict"));
  const mine = fs.readdirSync("supabase/migrations").filter((f) => /broadcast|message_templates|messaging_optouts/.test(f));
  assert.deepEqual(mine.sort(), ["589_broadcasts.sql", "594_broadcast_recipients.sql", "597_message_templates.sql", "598_messaging_optouts.sql", "599_broadcast_audit_rls.sql"]);
  const env = read("docs/deploy/BROADCAST.md");
  for (const k of ["BROADCAST_ENABLED", "BROADCAST_CRON_SECRET", "BROADCAST_RATE_PER_SEC", "BROADCAST_DAILY_CAP", "BROADCAST_QUIET_HOURS", "SMS_PROVIDER", "META_RATE_MARKETING_USD", "META_RATE_UTILITY_USD"]) assert.ok(env.includes(k), k);
});

console.log(`\nbroadcast: ${passed} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
