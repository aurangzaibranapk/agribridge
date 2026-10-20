// Call center rules + SMS queue. Database ke baghair.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CATEGORY_ROUTE, assertSmsChannel, formatAgentCode, formatComplaintNumber, isCallCenterRole,
  maskPhone, mayResolve, slaTone,
} from "../src/lib/call-center/rules";
import { buildComplaintSms, createSmsDispatch } from "../src/lib/call-center/sms";

let n = 0;
const jobs: [string, () => void | Promise<void>][] = [];
const ok = (name: string, fn: () => void | Promise<void>) => { jobs.push([name, fn]); };

ok("mask 03221234576", () => assert.equal(maskPhone("0322-1234576"), "0322-*****76"));
ok("mask short", () => assert.equal(maskPhone("123"), "****"));
ok("CMP and AGT padding", () => {
  assert.equal(formatComplaintNumber(1), "CMP-000001");
  assert.equal(formatComplaintNumber(123), "CMP-000123");
  assert.equal(formatAgentCode(3), "AGT-0003");
});
ok("khata ghalat -> accounts high 24h", () => {
  assert.deepEqual(CATEGORY_ROUTE.khata_ghalat, { department: "accounts", priority: "high", slaHours: 24 });
  assert.equal(CATEGORY_ROUTE.doodh.department, "dairy");
  assert.equal(CATEGORY_ROUTE.delivery.department, "logistics");
});
ok("sms only", () => {
  assert.doesNotThrow(() => assertSmsChannel("sms"));
  assert.throws(() => assertSmsChannel("whatsapp"), /WhatsApp/);
});
ok("maker cannot resolve", () => {
  assert.equal(mayResolve({ actorId: "a", createdBy: "a", actorRoles: ["finance"], department: "accounts" }), false);
});
ok("agent cannot resolve even with finance extra", () => {
  assert.equal(mayResolve({ actorId: "b", createdBy: "a", actorRoles: ["call_center_agent", "finance"], department: "accounts" }), false);
});
ok("accounts finance can resolve someone else's", () => {
  assert.equal(mayResolve({ actorId: "b", createdBy: "a", actorRoles: ["finance"], department: "accounts" }), true);
});
ok("sales cannot close accounts", () => {
  assert.equal(mayResolve({ actorId: "b", createdBy: "a", actorRoles: ["sales_staff"], department: "accounts" }), false);
});
ok("call center role detect", () => {
  assert.equal(isCallCenterRole("call_center_agent"), true);
  assert.equal(isCallCenterRole("finance", ["call_center_agent"]), true);
  assert.equal(isCallCenterRole("finance"), false);
});
ok("sla colours", () => {
  const start = "2026-10-20T00:00:00Z";
  const due = "2026-10-21T00:00:00Z";
  assert.equal(slaTone("open", start, due, new Date("2026-10-20T01:00:00Z")), "on_time");
  assert.equal(slaTone("open", start, due, new Date("2026-10-20T20:00:00Z")), "near");
  assert.equal(slaTone("open", start, due, new Date("2026-10-22T00:00:00Z")), "late");
  assert.equal(slaTone("resolved", start, due, new Date("2026-10-22T00:00:00Z")), "none");
});
ok("sms body is sms and provider-less stays unsent", async () => {
  const job = buildComplaintSms({
    complaintNumber: "CMP-000123",
    categoryLabel: "Khata ghalat",
    departmentLabel: "Accounts",
    slaHours: 24,
    toPhone: "03221234576",
  });
  assert.equal(job.channel, "sms");
  assert.match(job.body, /CMP-000123/);
  let called = false;
  const dispatch = createSmsDispatch({}, async () => { called = true; return new Response("no"); });
  const result = await dispatch.send(job);
  assert.equal(result.sent, false);
  assert.match(result.reason, /not configured/);
  assert.equal(called, false);
});
ok("configured sender posts SMS and still refuses whatsapp", async () => {
  let body = "";
  const dispatch = createSmsDispatch(
    { SMS_PROVIDER: "example", SMS_API_URL: "https://sms.example/send", SMS_API_KEY: "secret-from-env" },
    async (_url, init) => {
      body = String(init && "body" in (init ?? {}) ? init.body : "");
      return new Response("ok", { status: 200 });
    }
  );
  const job = buildComplaintSms({
    complaintNumber: "CMP-000001", categoryLabel: "Doodh", departmentLabel: "Dairy", slaHours: 24, toPhone: "03001234567",
  });
  const result = await dispatch.send(job);
  assert.equal(result.sent, true);
  assert.match(body, /03001234567/);
  assert.doesNotMatch(body, /secret-from-env/);
  await assert.rejects(dispatch.send({ ...job, channel: "whatsapp" as "sms" }), /WhatsApp/);
});

const sql = fs.readFileSync("supabase/migrations/625_call_center.sql", "utf8");
ok("sql route matches TS for khata ghalat", () => {
  assert.match(sql, /when 'khata_ghalat' then 'accounts'/);
  assert.match(sql, /when 'khata_ghalat' then 24/);
  assert.match(sql, /when 'doodh' then 'dairy'/);
});
ok("actions do not send WhatsApp or email invites", () => {
  const actions = fs.readFileSync("src/actions/call-center.ts", "utf8");
  assert.match(actions, /^"use server";/);
  assert.doesNotMatch(actions, /whatsapp|sendMail|nodemailer|sendOfficial|invite/i);
});
ok("agent is staff for /admin but not for money APIs", () => {
  const roles = fs.readFileSync("src/lib/utils/roles.ts", "utf8");
  const api = fs.readFileSync("src/lib/api-auth.ts", "utf8");
  assert.match(roles, /"call_center_agent"/);
  const list = api.slice(api.indexOf("const STAFF_ROLES"), api.indexOf("];", api.indexOf("const STAFF_ROLES")));
  assert.doesNotMatch(list, /"call_center_agent"/);
});
ok("journal door blocks the role", () => {
  assert.match(fs.readFileSync("src/lib/ledger/post.ts", "utf8"), /callCenterWriteBlock/);
});

async function main() {
  for (const [name, fn] of jobs) {
    await fn();
    n++;
    console.log(`  ok  ${name}`);
  }
  console.log(`\ncall-center-lib: ${n} checks pass`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
