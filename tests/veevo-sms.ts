// Veevo adapter. HTTP mock. Database nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildComplaintSms, createSmsDispatch } from "../src/lib/call-center/sms";
import { sendMilkSms } from "../src/lib/sms";
import { applyOutboxResult, drainSmsOutbox, type OutboxDb, type OutboxPatch } from "../src/lib/sms/outbox";
import { stageSmsBody } from "../src/lib/sms/stage-sms";
import { deliverFreeText, khataReminderText, recoveryChannelReady } from "../src/lib/sms/deliver";
import { getSmsProvider } from "../src/lib/broadcast/sms";
import { runBroadcastWorker, type WorkerDeps } from "../src/lib/broadcast/worker";
import {
  SMS_MAX_ATTEMPTS, nextSmsAttempt, sendVeevoSms, toVeevoReceiver, veevoCharset, veevoReady, VEEVO_SEND_URL,
} from "../src/lib/sms/veevo";

const logs: string[] = [];
const orig = console.info;
console.info = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };

const KEY = "veevo-test-key-not-real";
const env = { SMS_PROVIDER: "veevo", VEEVO_API_KEY: KEY, VEEVO_SENDER: "ALRANA" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let n = 0;
const jobs: [string, () => Promise<void> | void][] = [];
const ok = (name: string, fn: () => Promise<void> | void) => { jobs.push([name, fn]); };

ok("pakistan numbers become +92", () => {
  assert.equal(toVeevoReceiver("0300-1234567"), "+923001234567");
  assert.equal(toVeevoReceiver("923001234567"), "+923001234567");
  assert.equal(toVeevoReceiver("+923001234567"), "+923001234567");
  assert.equal(toVeevoReceiver("3001234567"), "+923001234567");
  assert.equal(toVeevoReceiver("123"), null);
});

ok("empty provider does not fetch and does not log the OTP", async () => {
  logs.length = 0;
  let called = false;
  const otp = "482913 — Al Rana Traders ke portal mein daakhil hone ka code.";
  const result = await sendMilkSms("03001234567", otp, {
    env: {},
    fetchImpl: async () => { called = true; return json({}); },
  });
  assert.equal(result.sent, false);
  assert.match(result.reason ?? "", /not configured/);
  assert.equal(called, false);
  assert.equal(logs.some((line) => line.includes("482913") || line.includes("03001234567") || line.includes(KEY)), false);
  assert.match(logs.join("\n"), /0300-\*+67/);
});

ok("veevo without a key stays unsent and does not fetch", async () => {
  let called = false;
  const result = await sendVeevoSms({
    to: "03001234567", text: "salam", env: { SMS_PROVIDER: "veevo" },
    fetchImpl: async () => { called = true; return json({}); },
  });
  assert.equal(veevoReady({ SMS_PROVIDER: "veevo" }), false);
  assert.equal(result.queued, true);
  assert.equal(result.sent, false);
  assert.equal(called, false);
});

ok("success posts JSON with key, sender, and Urdu text", async () => {
  logs.length = 0;
  let url = "";
  let body = "";
  const urdu = "آپ کی شکایت CMP-000123 درج ہو گئی";
  const result = await sendVeevoSms({
    to: "03001234567",
    text: urdu,
    env,
    fetchImpl: async (input, init) => {
      url = String(input);
      body = String(init?.body ?? "");
      return json({ STATUS: "SUCCESSFUL", MESSAGE_ID: "vt-1", ERROR_FILTER: "", RECEIVER_NUMBER: "+923001234567" });
    },
  });
  assert.equal(result.sent, true);
  assert.equal(result.messageId, "vt-1");
  assert.equal(url, VEEVO_SEND_URL);
  const parsed = JSON.parse(body);
  assert.equal(parsed.apikey, KEY);
  assert.equal(parsed.hash, KEY);
  assert.equal(parsed.receivernum, "+923001234567");
  assert.equal(parsed.sendernum, "ALRANA");
  assert.equal(parsed.textmessage, urdu);
  assert.deepEqual(veevoCharset(urdu), { unicode: true, firstSegment: 70, nextSegment: 67 });
  assert.deepEqual(veevoCharset("Hello"), { unicode: false, firstSegment: 160, nextSegment: 153 });
  const joined = logs.join("\n");
  assert.equal(joined.includes(KEY), false);
  assert.equal(joined.includes(urdu), false);
  assert.equal(joined.includes("03001234567"), false);
  assert.match(joined, /0300-\*+67/);
});

ok("only STATUS SUCCESSFUL is sent; ACCEPTED is not v3 success", async () => {
  const result = await sendVeevoSms({
    to: "03001234567", text: "ok", env,
    fetchImpl: async () => json({ STATUS: "ACCEPTED", MESSAGE_ID: "old-1", ERROR_FILTER: "" }),
  });
  assert.equal(result.sent, false);
  const official = await sendVeevoSms({
    to: "03001234567", text: "ok", env,
    fetchImpl: async () => json({
      STATUS: "SUCCESSFUL", MESSAGE_ID: "4d6a6b31", ERROR_FILTER: "", ERROR_CODE: "",
      COUNTRY_ISO: "PK", RECEIVER_NUMBER: "+923001234567",
    }),
  });
  assert.equal(official.sent, true);
  assert.equal(official.messageId, "4d6a6b31");
});

ok("voice OTP sender and over-800 text never hit the gateway", async () => {
  let called = 0;
  const voice = await sendVeevoSms({
    to: "03001234567", text: "1234", env: { ...env, VEEVO_SENDER: "VT-vOTP" },
    fetchImpl: async () => { called += 1; return json({}); },
  });
  assert.equal(voice.sent, false);
  assert.equal(voice.reason, "VOICE_OUT_OF_SCOPE");
  const long = await sendVeevoSms({
    to: "03001234567", text: "ا".repeat(801), env,
    fetchImpl: async () => { called += 1; return json({}); },
  });
  assert.equal(long.reason, "CONTENT_TOO_LONG");
  assert.equal(long.retryable, false);
  assert.equal(called, 0);
  const urdu = await sendVeevoSms({
    to: "03001234567", text: "ا".repeat(80), env,
    fetchImpl: async (_url, init) => {
      assert.equal(JSON.parse(String(init?.body)).textmessage, "ا".repeat(80));
      return json({ STATUS: "SUCCESSFUL", MESSAGE_ID: "u80", ERROR_FILTER: "" });
    },
  });
  assert.equal(urdu.sent, true);
});

ok("retry follows the doc try-again filters, not ERROR_CODE", async () => {
  const retry = await sendVeevoSms({
    to: "03001234567", text: "x", env,
    fetchImpl: async () => json({ STATUS: "ERROR", ERROR_FILTER: "AUTHETICATION_FAILED", ERROR_CODE: "VTWE-1" }),
  });
  assert.equal(retry.retryable, true);
  const route = await sendVeevoSms({
    to: "03001234567", text: "x", env,
    fetchImpl: async () => json({ STATUS: "ERROR", ERROR_FILTER: "SENDERID_ROUTING_FAILED", ERROR_CODE: "changed" }),
  });
  assert.equal(route.retryable, true);
  const carrier = await sendVeevoSms({
    to: "03001234567", text: "x", env,
    fetchImpl: async () => json({ STATUS: "ERROR", ERROR_FILTER: "CARRIER_ROUTING", ERROR_CODE: "VTWE-9" }),
  });
  assert.equal(carrier.retryable, false);
  const balance = await sendVeevoSms({
    to: "03001234567", text: "x", env,
    fetchImpl: async () => json({ STATUS: "ERROR", ERROR_FILTER: "INSUFFICIENT_BALANCE", ERROR_CODE: "VTWE-2" }),
  });
  assert.equal(balance.retryable, false);
  const http = await sendVeevoSms({
    to: "03001234567", text: "x", env,
    fetchImpl: async () => json({}, 500),
  });
  assert.equal(http.retryable, true);
  assert.equal(http.sent, false);
});

ok("invalid number does not call the gateway and does not retry", async () => {
  let called = false;
  const result = await sendVeevoSms({
    to: "12", text: "x", env, fetchImpl: async () => { called = true; return json({}); },
  });
  assert.equal(called, false);
  assert.equal(result.retryable, false);
  assert.equal(result.reason, "INVALID_NUMBER");
  const patch = applyOutboxResult(0, result, new Date("2026-10-20T00:00:00Z"));
  assert.equal(patch?.status, "failed");
});

ok("technical issue and HTTP 500 retry, then fail on the third", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const first = nextSmsAttempt(0, now);
  assert.equal(first.status, "queued");
  assert.equal(first.attempts, 1);
  assert.equal(first.nextAttemptAt, "2026-10-20T00:01:00.000Z");
  const second = nextSmsAttempt(1, now);
  assert.equal(second.nextAttemptAt, "2026-10-20T00:05:00.000Z");
  const third = nextSmsAttempt(2, now);
  assert.equal(third.status, "failed");
  assert.equal(third.attempts, SMS_MAX_ATTEMPTS);
  assert.equal(third.nextAttemptAt, null);
});

ok("drain leaves the queue alone when env is empty", async () => {
  let taken = false;
  const db: OutboxDb = {
    async take() { taken = true; return []; },
    async save() { throw new Error("no save"); },
  };
  const result = await drainSmsOutbox({ db, env: {} });
  assert.equal(result.skipped, true);
  assert.equal(taken, false);
});

ok("drain retries a 500 and then marks sent", async () => {
  const saved: OutboxPatch[] = [];
  const row = { id: "row-1", to_phone: "03001234567", body: "yaad دہانی", attempts: 0 };
  const db: OutboxDb = {
    async take() { return [{ ...row, attempts: saved.at(-1)?.attempts ?? 0 }]; },
    async save(_id, patch) { saved.push(patch); },
  };
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) return json({ STATUS: "ERROR", ERROR_FILTER: "TECHNICAL_ISSUE" }, 200);
    return json({ STATUS: "SUCCESSFUL", MESSAGE_ID: "vt-2" });
  };
  const now = new Date("2026-10-20T01:00:00Z");
  const first = await drainSmsOutbox({ db, env, fetchImpl, now, limit: 1 });
  assert.equal(first.retry, 1);
  assert.equal(saved[0].status, "queued");
  assert.equal(saved[0].attempts, 1);
  const second = await drainSmsOutbox({ db, env, fetchImpl, now, limit: 1 });
  assert.equal(second.sent, 1);
  assert.equal(saved[1].status, "sent");
  assert.equal(calls, 2);
});

ok("sender id error is final", async () => {
  const result = await sendVeevoSms({
    to: "03001234567", text: "x", env,
    fetchImpl: async () => json({ STATUS: "ERROR", ERROR_FILTER: "SENDER_ID_NOT FOUND" }),
  });
  assert.equal(result.retryable, false);
  assert.match(result.reason, /SENDER_ID_NOT_FOUND/);
});

ok("complaint dispatch uses veevo and the example gateway still hides the key from the body", async () => {
  const job = buildComplaintSms({
    complaintNumber: "CMP-000123", categoryLabel: "Khata", departmentLabel: "Accounts", slaHours: 24, toPhone: "03001234567",
  });
  let called = false;
  const idle = createSmsDispatch({ SMS_PROVIDER: "veevo" }, async () => { called = true; return json({}); });
  const held = await idle.send(job);
  assert.equal(held.sent, false);
  assert.equal(called, false);
  let posted = "";
  const live = createSmsDispatch(env, async (_url, init) => {
    posted = String(init?.body ?? "");
    return json({ STATUS: "SUCCESSFUL", MESSAGE_ID: "vt-3" });
  });
  assert.equal((await live.send(job)).sent, true);
  assert.match(posted, /textmessage/);
  assert.match(posted, /ALRANA/);
});

ok("stage text is Urdu-ready Roman and only the caller path is wired", () => {
  assert.match(stageSmsBody("CMP-000010", "in_progress"), /Kaam jari/);
  assert.match(stageSmsBody("CMP-000010", "in_progress"), /55%/);
  const route = fs.readFileSync("src/app/api/support/tickets/[id]/route.ts", "utf8");
  const stage = fs.readFileSync("src/lib/sms/stage-sms.ts", "utf8");
  const sql = fs.readFileSync("supabase/migrations/627_complaint_stages_grants.sql", "utf8");
  assert.match(route, /enqueueCallerStageSms/);
  assert.match(stage, /call_center/);
  assert.doesNotMatch(sql, /insert into public\.cc_sms_outbox/i);
});

ok("payment text prefers veevo and does not also call WhatsApp", async () => {
  let wa = 0;
  const via = await deliverFreeText({
    phone: "03001234567",
    message: khataReminderText(1500, "2026-10-25"),
    env,
    fetchImpl: async () => json({ STATUS: "SUCCESSFUL", MESSAGE_ID: "pay-1" }),
    sendWhatsapp: async () => { wa += 1; },
  });
  assert.equal(via.channel, "sms");
  assert.equal(via.ok, true);
  assert.equal(wa, 0);
  assert.match(khataReminderText(1500, null), /1,500/);
  assert.equal(recoveryChannelReady({}), "none");
  assert.equal(recoveryChannelReady({ WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_ACCESS_TOKEN: "2", WHATSAPP_RECOVERY_TEMPLATE: "3" }), "whatsapp");
  assert.equal(recoveryChannelReady({ ...env, WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_ACCESS_TOKEN: "2", WHATSAPP_RECOVERY_TEMPLATE: "3" }), "sms");
});

ok("broadcast veevo without a key stays queued and is not marked sent", async () => {
  const previousProvider = process.env.SMS_PROVIDER;
  const previousKey = process.env.VEEVO_API_KEY;
  delete process.env.VEEVO_API_KEY;
  process.env.SMS_PROVIDER = "veevo";
  const marks: string[] = [];
  const sms = getSmsProvider("veevo");
  const deps: WorkerDeps = {
    config: {
      enabled: true, ratePerSec: 100, dailyCap: 10, quietStartHour: 0, quietEndHour: 0, smsProvider: "veevo",
      rates: { marketing: 0, utility: 0, smsPerSegment: null, effective: "2026-10-01", currency: "USD" },
    },
    now: () => new Date("2026-10-20T06:00:00Z"),
    sentToday: async () => 0,
    claim: async () => [{ id: "r1", broadcast_id: "b1", phone: "923001234567", lang: "ur", vars: {}, channel: "sms" }],
    loadBroadcast: async () => ({
      id: "b1", channel: "sms", status: "sending", template_vars: [], sms_body: { ur: "اعلان" },
      approved_by: "owner", created_by: "staff", template: null,
    }),
    mark: async (_id, status) => { marks.push(status); },
    sendTemplate: async () => null,
    sendSms: async (to, text) => ({ ...(await sms.send(to, text)), provider: sms.name }),
    sleep: async () => {},
  };
  const result = await runBroadcastWorker(deps);
  assert.equal(result.skipped, 1);
  assert.equal(result.sent, 0);
  assert.deepEqual(marks, []);
  if (previousProvider === undefined) delete process.env.SMS_PROVIDER; else process.env.SMS_PROVIDER = previousProvider;
  if (previousKey === undefined) delete process.env.VEEVO_API_KEY; else process.env.VEEVO_API_KEY = previousKey;
});

ok("test button is owner/admin and secrets are not in source", () => {
  const action = fs.readFileSync("src/actions/sms-test.ts", "utf8");
  const screen = fs.readFileSync("src/components/call-center/screens.tsx", "utf8");
  const adapter = fs.readFileSync("src/lib/sms/veevo.ts", "utf8");
  assert.match(action, /"owner"/);
  assert.match(action, /"super_admin"/);
  assert.match(action, /"admin"/);
  assert.match(action, /Test SMS sirf Owner ya Admin/);
  assert.match(screen, /Test SMS/);
  assert.doesNotMatch(adapter, /apikey"\s*:\s*"[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(action + adapter, /hwaiuwxqldxsoukkfefn/);
  assert.equal(fs.readFileSync("src/lib/broadcast/sms/index.ts", "utf8").includes("fetch("), false);
});

async function main() {
  for (const [name, fn] of jobs) {
    await fn();
    n += 1;
    orig(`  ok  ${name}`);
  }
  console.info = orig;
  orig(`\nveevo-sms: ${n} checks pass`);
}
void main();
