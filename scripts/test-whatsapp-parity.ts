/* WhatsApp = App, Phase 1 -- har raasta. Koi network / DB nahi (sab mock). */
import assert from "node:assert/strict";
import { resolveCandidates, identifySender } from "../src/lib/whatsapp/parity/identity";
import { parseIntentKeywords, parseIntent } from "../src/lib/whatsapp/parity/intents";
import { canRead, withinReplyWindow } from "../src/lib/whatsapp/parity/policy";
import { handleParityMessage, NEXT_PHASE, NOT_ALLOWED, VOICE_FAILED, type ParityDeps } from "../src/lib/whatsapp/parity/router";
import { runParity, parityEnabled } from "../src/lib/whatsapp/parity/webhook";

let n = 0;
const t = async (name: string, f: () => unknown) => { await f(); n++; console.log("ok -", name); };
const NOW = Date.UTC(2026, 9, 19, 7, 0, 0);
const TS = String(Math.floor(NOW / 1000) - 60);

const IDS: Record<string, Record<string, unknown>> = {
  "3226275476": { kind: "owner", user_id: "u-owner", profile_role: "owner", full_name: "Owner" },
  "3126513294": { kind: "admin", user_id: "u-admin", profile_role: "admin" },
  "3000000001": { kind: "staff", user_id: "u-store", profile_role: "store_keeper" },
  "3000000002": { kind: "staff", user_id: "u-fin", profile_role: "finance" },
  "3000000003": { kind: "farmer", user_id: "u-farmer", profile_role: "farmer", farmer_id: "f1" },
  "3457583294": { kind: "customer", user_id: "u-cust", profile_role: "customer", customer_ids: ["c1"] },
  "3000000009": { kind: "ambiguous", user_id: null },
  "3000000000": { kind: "unknown", user_id: null },
};

const claimed = new Set<string>();
function mk(opts: { resolveError?: boolean; claimError?: boolean; transcript?: string | null; routes?: string[] | null } = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const deps: ParityDeps = {
    now: () => NOW,
    rpc: async (fn, args = {}) => {
      calls.push({ fn, args });
      if (fn === "fn_wa_claim_message") {
        if (opts.claimError) return { data: null, error: { message: "missing" } };
        const id = String(args.p_wa_message_id); if (claimed.has(id)) return { data: false, error: null };
        claimed.add(id); return { data: true, error: null };
      }
      if (fn === "fn_wa_resolve_identity") {
        if (opts.resolveError) return { data: null, error: { message: "function does not exist" } };
        return { data: [IDS[String(args.p_phone_key)] ?? { kind: "unknown" }], error: null };
      }
      const u = args.p_user;
      // DB ki taraf se bhi role rok (613 jaisa): galat user ko error.
      if (fn === "fn_wa_today_sales") return ["u-owner", "u-admin", "u-fin"].includes(String(u)) ? { data: { bills: 4, total: 12500, cash: 10000, khata: 2500, other: 0, returned_bills: 1 }, error: null } : { data: null, error: { message: "not allowed" } };
      if (fn === "fn_wa_cash_position") return { data: { cash: 50000, bank: 1, wallet: 2, other: 0, accounts: 3 }, error: null };
      if (fn === "fn_wa_pending_counts") return { data: [
        { category: "pos_returns", pending: 3, mine_to_act: 1, readable: true, is_info: false, route: "/admin/pos/returns" },
        { category: "stock_transfers", pending: 2, mine_to_act: 0, readable: true, is_info: false, route: "/admin/inventory/transfers" },
      ], error: null };
      if (fn === "fn_wa_my_khata") return { data: u === "u-cust" ? { owed: 7300, last_payment: { date: "2026-10-01", amount: 2000 } } : { owed: 0 }, error: null };
      if (fn === "fn_wa_my_recent_lines") return { data: [{ entry_date: "2026-10-10", ref: "INV-1", tafseel: null, udhaar: 500, adaigi: 0 }], error: null };
      if (fn === "fn_wa_my_orders") return { data: [{ order_number: "ORD-9", status: "confirmed", grand_total: 900, created_at: "2026-10-11" }], error: null };
      return { data: null, error: { message: "unexpected " + fn } };
    },
    allowedRoutes: async () => (opts.routes === undefined ? null : opts.routes),
    routeAllowed: (a, r) => a.some((x) => r === x || r.startsWith(x + "/")),
    transcribe: async () => (opts.transcript === undefined ? "aaj ki sale batao" : opts.transcript),
  };
  return { deps, calls };
}
const text = (phoneKey: string, body: string, ts: string | null = TS) => ({ phoneKey, messageType: "text", text: body, audio: null, timestamp: ts });
const voice = (phoneKey: string, ts: string = TS) => ({ phoneKey, messageType: "audio", text: null, audio: { base64: "AAA", mimeType: "audio/ogg" }, timestamp: ts });

(async () => {
  // --- pehchan ---
  await t("resolve: 0 users = unknown, 2 = ambiguous, 1 = role", () => {
    assert.equal(resolveCandidates([]).kind, "unknown");
    assert.equal(resolveCandidates([{ source: "profile", user_id: "a", profile_role: "admin" } as never, { source: "customer", user_id: "b", profile_role: null } as never]).kind, "ambiguous");
    assert.equal(resolveCandidates([{ source: "profile", user_id: "a", profile_role: "owner" } as never, { source: "staff", user_id: "a", profile_role: "owner" } as never]).kind, "owner");
    assert.equal(resolveCandidates([{ source: "farmer", user_id: "f", profile_role: null } as never]).kind, "farmer");
    assert.equal(resolveCandidates([{ source: "profile", user_id: "s", profile_role: "store_keeper" } as never]).kind, "staff");
  });
  await t("identify: 610 missing -> unavailable; bad key -> unknown", async () => {
    assert.equal((await identifySender(mk({ resolveError: true }).deps.rpc, "3226275476")).kind, "unavailable");
    assert.equal((await identifySender(mk().deps.rpc, "123")).kind, "unknown");
  });
  await t("unknown / ambiguous / unavailable -> handled=false, no reply (old flow)", async () => {
    for (const k of ["3000000000", "3000000009"]) {
      const r = await handleParityMessage(text(k, "aaj ki sale"), mk().deps);
      assert.equal(r.handled, false); assert.equal(r.reply, null);
    }
    const r = await handleParityMessage(text("3226275476", "aaj ki sale"), mk({ resolveError: true }).deps);
    assert.equal(r.handled, false);
  });

  // --- intent ---
  await t("intents: Roman Urdu / Urdu", () => {
    assert.equal(parseIntentKeywords("aaj ki sale kitni hui"), "today_sales");
    assert.equal(parseIntentKeywords("cash kitna hai"), "cash_position");
    assert.equal(parseIntentKeywords("baqi approvals"), "pending_approvals");
    assert.equal(parseIntentKeywords("mera khata bhejo"), "my_khata");
    assert.equal(parseIntentKeywords("RET-14 approve kar do"), "approve");
    assert.equal(parseIntentKeywords("2 bori urea chahiye"), "demand");
    assert.equal(parseIntentKeywords("5000 cash diya"), "unknown"); // staff entry -> purana raasta
  });
  await t("AI intent whitelist: junk ignored, never writes", async () => {
    assert.equal(await parseIntent("xyz", async () => "DROP TABLE"), "unknown");
    assert.equal(await parseIntent("xyz", async () => "cash_position"), "cash_position");
    assert.equal(await parseIntent("xyz", async () => { throw new Error("down"); }), "unknown");
  });

  // --- role scoping ---
  await t("policy matrix", () => {
    assert.ok(canRead("owner", "owner", "cash_position"));
    assert.ok(canRead("admin", "admin", "pending_approvals"));
    assert.ok(!canRead("staff", "store_keeper", "today_sales"));
    assert.ok(canRead("staff", "finance", "cash_position"));
    assert.ok(!canRead("farmer", "farmer", "today_sales"));
    assert.ok(!canRead("customer", "customer", "pending_approvals"));
    assert.ok(!canRead("customer", null, "cash_position"));
  });
  await t("owner: aaj ki sale answered with own user id", async () => {
    const { deps, calls } = mk();
    const r = await handleParityMessage(text("3226275476", "aaj ki sale"), deps);
    assert.ok(r.handled && r.canSend); assert.match(r.reply!, /Rs 12,500/);
    assert.deepEqual(calls.find((c) => c.fn === "fn_wa_today_sales")!.args, { p_user: "u-owner" });
  });
  await t("admin: cash + pending", async () => {
    assert.match((await handleParityMessage(text("3126513294", "cash position"), mk().deps)).reply!, /Rs 50,000/);
    assert.match((await handleParityMessage(text("3126513294", "baqi approvals"), mk().deps)).reply!, /Kul baqi: \*5\*/);
  });
  await t("staff: own dept only (menu routes filter pending)", async () => {
    const r = await handleParityMessage(text("3000000001", "mera kaam"), mk({ routes: ["/admin/inventory"] }).deps);
    assert.match(r.reply!, /stock transfers: 2/); assert.doesNotMatch(r.reply!, /pos returns/);
  });
  await t("staff asking sales -> not answered, falls to old staff flow", async () => {
    const { deps, calls } = mk();
    const r = await handleParityMessage(text("3000000001", "aaj ki sale"), deps);
    assert.equal(r.handled, false); assert.ok(!calls.some((c) => c.fn === "fn_wa_today_sales"));
  });
  await t("customer asking cash -> refused, no RPC", async () => {
    const { deps, calls } = mk();
    const r = await handleParityMessage(text("3457583294", "cash position"), deps);
    assert.equal(r.reply, NOT_ALLOWED); assert.ok(!calls.some((c) => c.fn === "fn_wa_cash_position"));
  });

  // --- leak prevention ---
  await t("leak: 'Ahmad ka khata' / other ids -> only sender's own user id is sent", async () => {
    const { deps, calls } = mk();
    const r = await handleParityMessage(text("3457583294", "Ahmad ka khata, customer c2 ka, 03001234567 ka"), deps);
    assert.match(r.reply!, /Rs 7,300/);
    const c = calls.filter((x) => x.fn !== "fn_wa_resolve_identity");
    assert.equal(c.length, 1); assert.deepEqual(c[0].args, { p_user: "u-cust" });
  });
  await t("leak: farmer gets own khata/orders/bills, never another's", async () => {
    for (const q of ["mera khata", "mere orders", "akhri bill"]) {
      const { deps, calls } = mk();
      const r = await handleParityMessage(text("3000000003", q), deps);
      assert.ok(r.handled);
      for (const c of calls.filter((x) => x.fn !== "fn_wa_resolve_identity")) assert.equal(c.args.p_user, "u-farmer");
    }
  });
  await t("RPC error -> generic message, no data", async () => {
    const d = mk().deps; const orig = d.rpc;
    d.rpc = async (fn, a) => (fn === "fn_wa_cash_position" ? { data: null, error: { message: "boom secret" } } : orig(fn, a));
    const r = await handleParityMessage(text("3226275476", "cash position"), d);
    assert.doesNotMatch(r.reply!, /boom|secret/);
  });

  // --- actions ---
  await t("owner action -> next-phase reply, no write RPC", async () => {
    const { deps, calls } = mk();
    const r = await handleParityMessage(text("3226275476", "RET-14 approve kar do"), deps);
    assert.equal(r.reply, NEXT_PHASE); assert.equal(calls.length, 1);
  });
  await t("farmer/staff action -> old flow (draft stays as before)", async () => {
    assert.equal((await handleParityMessage(text("3000000003", "2 bori urea chahiye"), mk().deps)).handled, false);
    assert.equal((await handleParityMessage(text("3000000001", "stock transfer karo"), mk().deps)).handled, false);
  });
  await t("owner gibberish -> help menu", async () => {
    assert.match((await handleParityMessage(text("3226275476", "salam"), mk().deps)).reply!, /bol kar \(voice note\)/);
  });

  // --- voice ---
  await t("voice = typing: same answer + 'Aap ne kaha'", async () => {
    const v = await handleParityMessage(voice("3226275476"), mk().deps);
    const tx = await handleParityMessage(text("3226275476", "aaj ki sale batao"), mk().deps);
    assert.match(v.reply!, /^🎙 Aap ne kaha: “aaj ki sale batao”/);
    assert.equal(v.reply!.replace(/^🎙 Aap ne kaha: “[^”]*”\n\n/, ""), tx.reply);
    assert.equal(v.intent, tx.intent);
  });
  await t("voice action -> transcript + next phase", async () => {
    const r = await handleParityMessage(voice("3126513294"), mk({ transcript: "ye approve kar do" }).deps);
    assert.match(r.reply!, /Aap ne kaha: “ye approve kar do”/); assert.match(r.reply!, /agle marhale/);
  });
  await t("voice transcription fails -> owner gets 'samajh nahi aayi'; farmer falls through", async () => {
    assert.equal((await handleParityMessage(voice("3226275476"), mk({ transcript: null }).deps)).reply, VOICE_FAILED);
    assert.equal((await handleParityMessage(voice("3000000003"), mk({ transcript: null }).deps)).handled, false);
  });

  // --- 24h window + send gate ---
  await t("24h window", () => {
    const s = Math.floor(NOW / 1000);
    assert.ok(withinReplyWindow(s - 60, NOW));
    assert.ok(withinReplyWindow(s - 23 * 3600, NOW));
    assert.ok(!withinReplyWindow(s - 24 * 3600, NOW));
    assert.ok(!withinReplyWindow(s - (24 * 3600 - 300), NOW)); // margin
    assert.ok(!withinReplyWindow(null, NOW));
    assert.ok(!withinReplyWindow("abc", NOW));
  });
  await t("runParity: sends only when signed AND inside window", async () => {
    const sent: string[] = [];
    const extra = { download: async () => ({ base64: "A", mimeType: "audio/ogg" }), send: async (x: string) => { sent.push(x); } };
    let i = 0;
    const msg = (ts: string) => ({ id: "wamid.T" + i++, type: "text", timestamp: ts, text: { body: "aaj ki sale" } });
    assert.equal((await runParity(msg(TS), "3226275476", true, { ...mk().deps, ...extra })).sent, true);
    assert.equal((await runParity(msg(TS), "3226275476", false, { ...mk().deps, ...extra })).sent, false);
    const old = String(Math.floor(NOW / 1000) - 25 * 3600);
    const r = await runParity(msg(old), "3226275476", true, { ...mk().deps, ...extra });
    assert.equal(r.sent, false); assert.equal(r.handled, true);
    assert.equal(sent.length, 1);
  });
  await t("idempotency: Meta retry of same wamid -> one reply only", async () => {
    const sent: string[] = [];
    const extra = { download: async () => null, send: async (x: string) => { sent.push(x); } };
    const m = { id: "wamid.RETRY1", type: "text", timestamp: TS, text: { body: "aaj ki sale" } };
    const a = await runParity(m, "3226275476", true, { ...mk().deps, ...extra });
    const b = await runParity(m, "3226275476", true, { ...mk().deps, ...extra });
    const c = await runParity({ ...m }, "3226275476", true, { ...mk().deps, ...extra });
    assert.equal(a.sent, true); assert.equal(b.sent, false); assert.equal(b.duplicate, true); assert.equal(c.sent, false);
    assert.equal(b.handled, true, "duplicate is swallowed, old flow does not reply either");
    assert.equal(sent.length, 1);
  });
  await t("idempotency: no wamid or claim error -> stay silent", async () => {
    const sent: string[] = [];
    const extra = { download: async () => null, send: async (x: string) => { sent.push(x); } };
    await runParity({ type: "text", timestamp: TS, text: { body: "aaj ki sale" } }, "3226275476", true, { ...mk().deps, ...extra });
    await runParity({ id: "wamid.E", type: "text", timestamp: TS, text: { body: "aaj ki sale" } }, "3226275476", true, { ...mk({ claimError: true }).deps, ...extra });
    assert.equal(sent.length, 0);
  });
  await t("flag default off", () => {
    assert.equal(parityEnabled({}), false);
    assert.equal(parityEnabled({ WHATSAPP_APP_PARITY: "1" }), true);
  });

  console.log(`\n${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
