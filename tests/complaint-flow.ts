import assert from "node:assert/strict";
import fs from "node:fs";
import { canAssignComplaints, canForwardComplaint, complaintDeskAccess } from "../src/lib/support/complaint-intake";
import { ATTACHMENT_MAX_BYTES, canSeeComplaintTicket, checkAttachment } from "../src/lib/support/attachments";
import { decideComplaintStage, managerForwardNote, stagePercent } from "../src/lib/support/complaint-stage";
import {
  AI_DISCONNECTED_LABEL,
  AI_SCREENSHOT_TTL_SECONDS,
  buildAiTicketBody,
  callbackAuthorized,
  postComplaintToAiAgent,
} from "../src/lib/support/ai-agent-webhook";

let n = 0;
const ok = (name: string, fn: () => void | Promise<void>) => jobs.push(async () => { await fn(); n++; console.log(`  ok  ${name}`); });
const jobs: Array<() => Promise<void>> = [];

ok("manager cannot assign until the owner grants it", () => {
  assert.equal(canAssignComplaints("manager"), false);
  assert.equal(canForwardComplaint({ role: "manager" }), false);
  assert.equal(canForwardComplaint({ role: "manager", managerGrant: false }), false);
  assert.equal(complaintDeskAccess("manager").showAssigneePicker, false);
  assert.equal(canForwardComplaint({ role: "manager", managerGrant: true }), true);
  assert.equal(complaintDeskAccess("manager", true).showDepartmentPicker, true);
  for (const role of ["owner", "super_admin", "admin"]) {
    assert.equal(canForwardComplaint({ role }), true);
  }
  assert.equal(canForwardComplaint({ role: "admin_assistant", managerGrant: true }), false);
  assert.equal(canForwardComplaint({ role: "sales_staff", managerGrant: true }), false);
});

ok("manager forward label names the manager", () => {
  assert.equal(managerForwardNote("Kamran Raza"), "Forwarded by Manager Kamran Raza");
});

ok("stage bar and maker-checker", () => {
  assert.equal(stagePercent("received"), 10);
  assert.equal(stagePercent("assigned"), 30);
  assert.equal(stagePercent("in_progress"), 55);
  assert.equal(stagePercent("review"), 80);
  assert.equal(stagePercent("completed"), 100);
  assert.equal(stagePercent("rejected"), 100);
  const base = { actorId: "fin", submitterId: "staff", actorRole: "finance", assigneeId: "fin", from: "assigned" };
  assert.equal(decideComplaintStage({ ...base, to: "in_progress" }).ok, true);
  assert.equal(decideComplaintStage({ ...base, to: "review" }).ok, false);
  assert.equal(decideComplaintStage({ ...base, to: "completed" }).ok, false);
  assert.equal(decideComplaintStage({ ...base, from: "review", to: "completed" }).ok, true);
  assert.equal(decideComplaintStage({ actorId: "staff", submitterId: "staff", actorRole: "admin", assigneeId: null, from: "review", to: "completed" }).ok, false);
  assert.equal(decideComplaintStage({ actorId: "admin", submitterId: "staff", actorRole: "admin", assigneeId: null, from: "assigned", to: "completed" }).ok, true);
  assert.equal(decideComplaintStage({ actorId: "ag", submitterId: "staff", actorRole: "call_center_agent", assigneeId: "ag", from: "assigned", to: "in_progress" }).ok, false);
  assert.equal(decideComplaintStage({ actorId: "other", submitterId: "staff", actorRole: "sales_staff", assigneeId: "fin", from: "assigned", to: "in_progress" }).ok, false);
});

ok("attachment type, size, count, and who can see it", () => {
  assert.equal(checkAttachment({ mime: "image/png", size: 100, existingCount: 0 }), null);
  assert.equal(checkAttachment({ mime: "image/jpg", name: "a.jpg", size: 100, existingCount: 0 }), null);
  assert.match(checkAttachment({ mime: "application/pdf", name: "a.pdf", size: 100, existingCount: 0 }) ?? "", /PNG/);
  assert.match(checkAttachment({ mime: "image/png", size: ATTACHMENT_MAX_BYTES + 1, existingCount: 0 }) ?? "", /8MB/);
  assert.match(checkAttachment({ mime: "image/png", size: 10, existingCount: 6 }) ?? "", /6/);
  assert.equal(canSeeComplaintTicket({ actorId: "other", actorRole: "sales_staff", reporterId: "staff", assigneeId: "fin" }), false);
  assert.equal(canSeeComplaintTicket({ actorId: "staff", actorRole: "sales_staff", reporterId: "staff", assigneeId: "fin" }), true);
  assert.equal(canSeeComplaintTicket({ actorId: "fin", actorRole: "finance", reporterId: "staff", assigneeId: "fin" }), true);
  assert.equal(canSeeComplaintTicket({ actorId: "admin", actorRole: "admin", reporterId: "staff", assigneeId: null }), true);
  assert.equal(canSeeComplaintTicket({ actorId: "mgr", actorRole: "manager", reporterId: "staff", assigneeId: null }), true);
});

ok("webhook stays quiet when the URL is empty and posts JSON when it is set", async () => {
  let called = false;
  const off = await postComplaintToAiAgent({
    payload: buildAiTicketBody({ id: "t1", title: "Rate", description: "Purani", category: "sales", screenshotUrls: [], link: "https://erp/t1" }),
    env: {},
    fetchImpl: async () => { called = true; return { ok: true, status: 200 }; },
  });
  assert.equal(off.ok, false);
  assert.equal(off.connected, false);
  assert.equal(off.message, AI_DISCONNECTED_LABEL);
  assert.equal(called, false);

  let header = "";
  let body = "";
  const on = await postComplaintToAiAgent({
    payload: buildAiTicketBody({
      id: "t1", title: "Rate", description: "Purani hai", category: "sales",
      screenshotUrls: ["https://signed.example/a"], link: "https://erp/t1",
    }),
    env: { AI_AGENT_WEBHOOK_URL: "https://ai.example/hook", AI_AGENT_WEBHOOK_SECRET: "sekret" },
    fetchImpl: async (_url, init) => { header = init.headers["x-agribridge-webhook-secret"]; body = init.body; return { ok: true, status: 200 }; },
  });
  assert.equal(on.ok, true);
  assert.equal(header, "sekret");
  const parsed = JSON.parse(body);
  assert.equal(parsed.id, "t1");
  assert.equal(parsed.title, "Rate");
  assert.equal(parsed.description, "Purani hai");
  assert.equal(parsed.category, "sales");
  assert.equal(parsed.screenshots[0].expiresIn, AI_SCREENSHOT_TTL_SECONDS);
  assert.equal(parsed.screenshots[0].url, "https://signed.example/a");
  assert.equal(JSON.stringify(parsed).includes("sekret"), false);
});

ok("callback rejects a missing secret, a wrong token, and an empty token", () => {
  assert.equal(callbackAuthorized("anything", ""), "unset");
  assert.equal(callbackAuthorized("anything", undefined), "unset");
  assert.equal(callbackAuthorized("", "expected"), "denied");
  assert.equal(callbackAuthorized(null, "expected"), "denied");
  assert.equal(callbackAuthorized("nope", "expected"), "denied");
  assert.equal(callbackAuthorized("expected", "expected"), "ok");
});

ok("screens name the grant, the manager forward, and the disconnected AI button", () => {
  const queue = fs.readFileSync("src/components/support/complaint-queue.tsx", "utf8");
  const grants = fs.readFileSync("src/components/support/manager-grants.tsx", "utf8");
  const hook = fs.readFileSync("src/lib/support/ai-agent-webhook.ts", "utf8");
  assert.match(grants, /Complaint assign kar sakta hai/);
  assert.match(hook, /AI agent connected nahi/);
  assert.match(queue, /AI_DISCONNECTED_LABEL/);
  assert.match(queue, /Aage bhejein/);
  const callback = fs.readFileSync("src/app/api/support/tickets/[id]/ai-callback/route.ts", "utf8");
  assert.match(callback, /x-agribridge-ai-token/);
  assert.match(callback, /503/);
  assert.match(callback, /AI_AGENT_CALLBACK_SECRET/);
  const send = fs.readFileSync("src/app/api/support/tickets/[id]/ai-send/route.ts", "utf8");
  assert.match(send, /AI_AGENT_WEBHOOK_URL/);
  assert.doesNotMatch(send, /sk-[A-Za-z0-9]{10,}/);
});

async function main() {
  for (const job of jobs) await job();
  console.log(`\ncomplaint-flow: ${n} checks pass`);
}
void main();
