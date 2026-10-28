import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { configuredSupportAgents, dispatchSupportTicket, BUILTIN_ASSISTANT_KEY } from "../src/lib/support/agent-dispatch";

let n = 0;
const t = async (name: string, fn: () => void | Promise<void>) => { await fn(); n++; console.log("ok", name); };

(async () => {
  for (const k of ["SUPPORT_AGENT_ROUTES", "SUPPORT_GITHUB_TOKEN", "SUPPORT_AGENT_REPOSITORY"]) delete process.env[k];
  await t("built-in listed with no env", () => {
    assert.deepEqual(configuredSupportAgents(), [{ key: "agribridge_assistant", label: "AgriBridge Assistant" }]);
  });
  await t("key fits DB agent_key regex", () => assert.match(BUILTIN_ASSISTANT_KEY, /^[a-z0-9_-]{2,60}$/));
  await t("dispatch makes no HTTP call", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error("fetch called"); }) as any;
    try {
      const r = await dispatchSupportTicket("agribridge_assistant", { ticketNo: 1, title: "x" }, "https://cb");
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.assignmentStatus, "queued");
        assert.equal(r.ticketStatus, "assigned");
        assert.match(r.message ?? "", /AgriBridge Assistant ko bhej di gayi/);
      }
    } finally { globalThis.fetch = orig; }
  });
  await t("env routes still listed, built-in not duplicated", () => {
    process.env.SUPPORT_AGENT_ROUTES = JSON.stringify([
      { key: "hook", label: "Hook", url: "https://example.com/h" },
      { key: "agribridge_assistant", label: "Dup", url: "https://example.com/d" },
    ]);
    const keys = configuredSupportAgents().map((a) => a.key);
    assert.deepEqual(keys, ["agribridge_assistant", "hook"]);
    delete process.env.SUPPORT_AGENT_ROUTES;
  });
  await t("unknown agent still rejected", async () => {
    const r = await dispatchSupportTicket("nope", {}, "https://cb");
    assert.equal(r.ok, false);
  });
  await t("desk no longer shows 'no agent connected' warning", () => {
    const src = readFileSync("src/components/support/support-desk.tsx", "utf8");
    assert.ok(!src.includes("Abhi koi AI agent connected nahi"));
  });
  await t("route persists ticketStatus", () => {
    const src = readFileSync("src/app/api/support/tickets/[id]/route.ts", "utf8");
    assert.ok(src.includes("status: dispatched.ticketStatus"));
  });
  console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
