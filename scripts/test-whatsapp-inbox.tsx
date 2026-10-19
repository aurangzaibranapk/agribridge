/* WhatsApp Chat Inbox -- TS tests (koi network / DB nahi; sab mock). */
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as M from "../src/lib/whatsapp/inbox/model";
import { bhejo, parseDraftPayload } from "../src/lib/whatsapp/inbox/send";
import { mirrorInbound } from "../src/lib/whatsapp/inbox/ingest";
import { inboxEnabled, inboxPreviewAllowed } from "../src/lib/whatsapp/inbox/flag";
import { InboxShell } from "../src/components/whatsapp-inbox/inbox-shell";
import * as F from "../src/lib/whatsapp/inbox/fixtures";

let n = 0;
const t = async (name: string, f: () => unknown) => { await f(); n++; console.log("ok -", name); };
const NOW = F.SAMPLE_NOW;
const iso = (minAgo: number) => new Date(NOW - minAgo * 60000).toISOString();

(async () => {
  await t("flags default off; preview never in production", () => {
    assert.equal(inboxEnabled({}), false); assert.equal(inboxEnabled({ WHATSAPP_INBOX: "1" }), true);
    assert.equal(inboxPreviewAllowed({ NODE_ENV: "production", WHATSAPP_INBOX_PREVIEW: "1" }), false);
    assert.equal(inboxPreviewAllowed({ NODE_ENV: "development" }), false);
    assert.equal(inboxPreviewAllowed({ NODE_ENV: "development", WHATSAPP_INBOX_PREVIEW: "1" }), true);
  });
  await t("filters + counts", () => {
    const c = M.filterCounts(F.SAMPLE_CONVS, "me");
    assert.deepEqual(c, { all: 8, farmer: 2, customer: 3, staff: 1, unknown: 2, unread: 3, mine: 2 });
    assert.equal(M.parseFilter("hack"), "all");
    assert.equal(M.applyFilter(F.SAMPLE_CONVS, "mine", null).length, 0);
  });
  await t("24h window + pending badges", () => {
    assert.equal(M.windowState(iso(60), NOW).open, true);
    assert.equal(M.windowState(iso(24 * 60 - 5), NOW).open, false, "10 min margin");
    assert.equal(M.windowState(null, NOW).open, false);
    assert.deepEqual(M.hoursMinutes(M.windowState(iso(60), NOW).msLeft), { h: 22, m: 50 });
    assert.equal(M.pendingText("rm", iso(6 * 60), NOW), "Pending 6 ghante se");
    assert.equal(M.pendingText("rm", iso(50 * 60), NOW), "Pending 2 din se");
    assert.equal(M.pendingText("ur", iso(30), NOW), "زیرِ التوا 30 منٹ سے");
    assert.equal(M.pendingText("en", null, NOW), null);
    assert.equal(M.pendingUrgent(iso(7 * 60), NOW), true); assert.equal(M.pendingUrgent(iso(30), NOW), false);
  });
  await t("sendCheck: empty / window closed / template params", () => {
    assert.deepEqual(M.sendCheck({ text: " ", templateKey: null, params: [], templateParamCount: null, lastInboundAt: iso(5), now: NOW }), { ok: false, reason: "empty" });
    assert.deepEqual(M.sendCheck({ text: "hi", templateKey: null, params: [], templateParamCount: null, lastInboundAt: iso(25 * 60), now: NOW }), { ok: false, reason: "window_closed" });
    assert.deepEqual(M.sendCheck({ text: "", templateKey: "follow_up", params: [], templateParamCount: 1, lastInboundAt: iso(25 * 60), now: NOW }), { ok: false, reason: "template_params" });
    assert.deepEqual(M.sendCheck({ text: "", templateKey: "follow_up", params: ["Ali"], templateParamCount: 1, lastInboundAt: iso(25 * 60), now: NOW }), { ok: true, mode: "template" });
  });
  await t("quick action rules", () => {
    assert.equal(M.draftAllowed("order", "unknown", false), false);
    assert.equal(M.draftAllowed("demand", "customer", false), false);
    assert.equal(M.draftAllowed("demand", "farmer", true), true);
    assert.equal(M.canLink("farmer", false), false); assert.equal(M.canLink("unknown", false), true); assert.equal(M.canLink("farmer", true), true);
    assert.equal(parseDraftPayload("delete", {}), null);
    assert.deepEqual(parseDraftPayload("payment", { amount: " 15000 ", note: "x", evil: "1" })!.payload, { amount: "15000", note: "x" });
  });

  // --- Bhejo
  const mkSend = (o: { prepErr?: boolean; sendThrows?: boolean } = {}) => {
    const calls: { fn: string; args: Record<string, unknown> }[] = []; const sent: string[] = [];
    return {
      calls, sent, deps: {
        rpc: async (fn: string, args: Record<string, unknown>) => {
          calls.push({ fn, args });
          if (fn === "fn_wa_inbox_prepare_send") return o.prepErr ? { data: null, error: { message: "wa inbox: ijazat nahi" } }
            : { data: { message_id: "q1", phone_key: "3000000431", kind: args.p_template_key ? "template" : "text", meta_name: "follow_up_ur", language_code: "ur", params: args.p_params ?? [] }, error: null };
          return { data: null, error: null };
        },
        sendText: async (_p: string, x: string) => { if (o.sendThrows) throw new Error("meta down"); sent.push("T:" + x); },
        sendTemplate: async (_p: string, name: string) => { sent.push("P:" + name); },
      },
    };
  };
  const base = { conversationId: "c1", text: "Walaikum assalam", aiDraft: "draft", templateKey: null, params: [], templateParamCount: null, lastInboundAt: iso(5), now: NOW };
  await t("bhejo: needs human intent; nothing sent otherwise", async () => {
    const s = mkSend(); assert.deepEqual(await bhejo(s.deps, { ...base, intent: null }), { ok: false, error: "not_human" });
    assert.equal(s.calls.length, 0); assert.equal(s.sent.length, 0);
  });
  await t("bhejo: ticket -> send -> mark sent", async () => {
    const s = mkSend(); const r = await bhejo(s.deps, { ...base, intent: "bhejo" });
    assert.equal(r.ok, true); assert.deepEqual(s.sent, ["T:Walaikum assalam"]);
    assert.deepEqual(s.calls.map((c) => c.fn), ["fn_wa_inbox_prepare_send", "fn_wa_inbox_mark_sent"]);
    assert.equal(s.calls[0].args.p_ai_draft, "draft"); assert.equal(s.calls[1].args.p_ok, true);
  });
  await t("bhejo: window closed -> text refused before any call; template goes", async () => {
    const s = mkSend(); assert.equal((await bhejo(s.deps, { ...base, intent: "bhejo", lastInboundAt: iso(30 * 60) })).ok, false); assert.equal(s.calls.length, 0);
    const r = await bhejo(s.deps, { ...base, intent: "bhejo", lastInboundAt: iso(30 * 60), templateKey: "follow_up", params: ["Aslam"], templateParamCount: 1 });
    assert.equal(r.ok, true); assert.deepEqual(s.sent, ["P:follow_up_ur"]); assert.equal(s.calls[0].args.p_text, null);
  });
  await t("bhejo: DB refusal (scope) -> nothing sent; API failure -> marked failed", async () => {
    const s = mkSend({ prepErr: true }); const r = await bhejo(s.deps, { ...base, intent: "bhejo" });
    assert.deepEqual(r, { ok: false, error: "wa inbox: ijazat nahi" }); assert.equal(s.sent.length, 0);
    const f = mkSend({ sendThrows: true }); assert.deepEqual(await bhejo(f.deps, { ...base, intent: "bhejo" }), { ok: false, error: "send_failed" });
    assert.equal(f.calls[1].args.p_ok, false); assert.match(String(f.calls[1].args.p_error), /meta down/);
  });

  // --- webhook mirror
  const mkIn = (o: { dup?: boolean; err?: boolean } = {}) => {
    const log: string[] = []; let args: Record<string, unknown> = {};
    return {
      log, get args() { return args; }, deps: {
        rpc: async (_fn: string, a: Record<string, unknown>) => { args = a; return o.err ? { data: null, error: { message: "missing fn" } } : { data: o.dup ? null : "msg-1", error: null }; },
        download: async () => ({ base64: "QUFB", mimeType: "audio/ogg" }),
        upload: async (p: string) => { log.push("up:" + p); return true; },
        setMediaPath: async (_i: string, p: string) => { log.push("set:" + p); },
        conversationOf: async () => "conv-9",
        transcribe: async () => "10 bori urea chahiye",
        draftReply: async (x: string) => "Draft for: " + x,
      },
    };
  };
  await t("mirror: voice -> transcript + AI draft stored, media under conversation folder", async () => {
    const s = mkIn(); const r = await mirrorInbound(s.deps, { id: "wamid.1", type: "audio", audio: { id: "A" }, timestamp: "1760890000" }, "3000000431", "+923000000431", "Aslam");
    assert.equal(r.stored, true); assert.equal(s.args.p_transcript, "10 bori urea chahiye"); assert.equal(s.args.p_ai_draft, "Draft for: 10 bori urea chahiye");
    assert.equal(s.args.p_msg_type, "audio"); assert.equal(s.args.p_wa_message_id, "wamid.1"); assert.deepEqual(s.log, ["up:conv-9/msg-1.ogg", "set:conv-9/msg-1.ogg"]);
  });
  await t("mirror: duplicate wamid -> no upload; rpc error / bad phone -> silent", async () => {
    const d = mkIn({ dup: true }); assert.equal((await mirrorInbound(d.deps, { id: "w", type: "audio", audio: { id: "A" } }, "3000000431", "", null)).reason, "duplicate"); assert.equal(d.log.length, 0);
    assert.equal((await mirrorInbound(mkIn({ err: true }).deps, { type: "text", text: { body: "x" } }, "3000000431", "", null)).stored, false);
    assert.equal((await mirrorInbound(mkIn().deps, { type: "text" }, "12", "", null)).reason, "bad_phone");
    const tx = mkIn(); await mirrorInbound(tx.deps, { type: "text", text: { body: "DAP ka rate?" } }, "3011111882", "", null);
    assert.equal(tx.args.p_body, "DAP ka rate?"); assert.equal(tx.args.p_transcript, null);
  });

  // --- UI render (wohi component jo page chalata hai)
  const P = (o: Partial<React.ComponentProps<typeof InboxShell>> = {}) => renderToStaticMarkup(
    <InboxShell lang="rm" filter="all" search="" counts={M.filterCounts(F.SAMPLE_CONVS, "me")} conversations={F.SAMPLE_CONVS}
      selected={F.SAMPLE_CONVS[0]} messages={F.SAMPLE_MESSAGES.c1} party={F.SAMPLE_PARTY} templates={F.SAMPLE_TEMPLATES}
      staff={F.SAMPLE_STAFF} isAdmin={false} now={NOW} basePath="/admin/whatsapp-inbox" {...o} />);
  await t("UI: list badges, voice transcript, AI draft prefilled, Bhejo, 360", () => {
    const h = P();
    assert.match(h, /Naya/); assert.match(h, /Pending 6 ghante se/); assert.match(h, /paas: Anwar/); assert.match(h, /Anjaan numbers/);
    assert.match(h, /Aap ne kaha:<\/b> “Mujhe 10 bori urea/); assert.match(h, /Walaikum assalam Aslam sahab/);
    assert.match(h, /Bhejo ➤/); assert.match(h, /Kuch khud nahi jata/); assert.match(h, /name="intent" value="bhejo"/);
    assert.match(h, /Rs 38,200/); assert.match(h, /Rabi 2026/); assert.match(h, /broken/);
    assert.match(h, /Order draft/); assert.match(h, /Demand draft/); assert.doesNotMatch(h, /Number jorein/, "known farmer, not admin -> no link");
  });
  await t("UI: closed window -> textarea disabled + templates", () => {
    const h = P({ selected: F.SAMPLE_CONVS[3], messages: F.SAMPLE_MESSAGES.c4 });
    assert.match(h, /24 ghante guzar gaye/); assert.match(h, /<textarea[^>]*disabled/); assert.match(h, /Follow-up \(Urdu\)/);
  });
  await t("UI: unknown number -> link shown, no drafts, unlinked 360", () => {
    const h = P({ selected: F.SAMPLE_CONVS[2], messages: [], party: null });
    assert.match(h, /Number jorein/); assert.doesNotMatch(h, /Order draft/); assert.match(h, /Kisi party se nahi jura/);
  });
  await t("UI: Urdu RTL + mobile sheet", () => {
    const h = P({ lang: "ur", initialSheet: true });
    assert.match(h, /dir="rtl"/); assert.match(h, /واٹس ایپ اِن باکس/); assert.match(h, /بھیجو/); assert.match(h, /data-testid="sheet"/);
  });

  // --- source guards
  await t("source: only bhejo() sends; webhook mirror never sends; page gated by flag", () => {
    const act = fs.readFileSync("src/actions/whatsapp-inbox.ts", "utf8");
    assert.equal((act.match(/sendWhatsAppMessage\(/g) ?? []).length, 1); assert.ok(act.indexOf("sendWhatsAppMessage(") > act.indexOf("await bhejo("));
    for (const f of ["src/lib/whatsapp/inbox/ingest.ts", "src/lib/whatsapp/inbox/ai.ts", "src/lib/whatsapp/inbox/model.ts"])
      assert.doesNotMatch(fs.readFileSync(f, "utf8"), /sendWhatsApp|send\(/);
    assert.match(fs.readFileSync("src/app/admin/whatsapp-inbox/page.tsx", "utf8"), /if \(!inboxEnabled\(\)\)/);
    assert.match(fs.readFileSync("src/app/dev/wa-inbox-preview/page.tsx", "utf8"), /if \(!inboxPreviewAllowed\(\)\) notFound\(\)/);
    const route = fs.readFileSync("src/app/api/webhooks/whatsapp/route.ts", "utf8");
    assert.equal((route.match(/sendWhatsAppMessage\(/g) ?? []).length, 1); assert.match(route, /if \(inboxEnabled\(\)\)/);
    for (const fn of ["sendInboxReply", "openConversation", "assignConversation", "createInboxDraft", "linkInboxNumber"])
      assert.match(act, new RegExp(`export async function ${fn}[\\s\\S]*?if \\(!inboxEnabled\\(\\)\\)`));
  });
  console.log(`\n${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
