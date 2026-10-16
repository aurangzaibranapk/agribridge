import assert from "node:assert/strict";
import { parseSupportAgentRoutes, buildLlmRequest, extractLlmText } from "../src/lib/support/agent-dispatch";

let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok", name); };
const json = JSON.stringify([
  { key: "chatgpt", label: "ChatGPT", type: "openai" },
  { key: "grok", label: "Grok", type: "xai" },
  { key: "claude", label: "Claude", type: "anthropic" },
  { key: "agribridge-assistant", label: "AgriBridge Assistant", type: "github", labels: ["support"] },
  { key: "hook", label: "Hook", url: "https://example.com/h" },
  { key: "bad", label: "Bad", type: "weird" },
]);
t("no keys -> only webhook", () => assert.deepEqual(parseSupportAgentRoutes(json, {}).map(r => r.key), ["hook"]));
t("all keys -> all listed", () => {
  const r = parseSupportAgentRoutes(json, { OPENAI_API_KEY: "a", XAI_API_KEY: "b", ANTHROPIC_API_KEY: "c", SUPPORT_GITHUB_TOKEN: "g", SUPPORT_AGENT_REPOSITORY: "o/r" });
  assert.deepEqual(r.map(x => x.key), ["chatgpt", "grok", "claude", "agribridge-assistant", "hook"]);
  assert.equal(r[1].url, "https://api.x.ai/v1/chat/completions");
  assert.deepEqual(r[3].labels, ["support"]);
});
t("per-route token enables", () => assert.equal(parseSupportAgentRoutes(JSON.stringify([{ key: "c2", label: "C", type: "anthropic", token: "x" }]), {}).length, 1));
t("http url rejected", () => assert.equal(parseSupportAgentRoutes(JSON.stringify([{ key: "h", label: "H", url: "http://x" }]), {}).length, 0));
t("bad json", () => assert.deepEqual(parseSupportAgentRoutes("{", {}), []));
const ticket = { ticketNo: 7, title: "Farmer error", description: "RLS", screenshotUrl: "https://s/x.png" };
t("openai request with image", () => {
  const b: any = buildLlmRequest({ type: "openai" }, ticket, {});
  assert.equal(b.model, "gpt-4o");
  assert.equal(b.messages[0].content[1].image_url.url, "https://s/x.png");
});
t("model env override", () => assert.equal((buildLlmRequest({ type: "xai" }, ticket, { XAI_SUPPORT_MODEL: "grok-x" }) as any).model, "grok-x"));
t("anthropic image block", () => {
  const b: any = buildLlmRequest({ type: "anthropic" }, ticket, {});
  assert.equal(b.messages[0].content[0].type, "image");
  assert.ok(b.messages[0].content[1].text.includes("Farmer error"));
});
t("no screenshot -> text only", () => assert.equal((buildLlmRequest({ type: "openai" }, { title: "x" }, {}) as any).messages[0].content.length, 1));
t("extract openai", () => assert.equal(extractLlmText("openai", { choices: [{ message: { content: " hi " } }] }), "hi"));
t("extract anthropic", () => assert.equal(extractLlmText("anthropic", { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }), "a\nb"));
t("extract empty", () => assert.equal(extractLlmText("xai", {}), ""));
console.log(`${n}/${n} passed`);
