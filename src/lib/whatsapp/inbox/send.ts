import { sendCheck, DRAFT_KINDS, type DraftKind } from "./model";

/**
 * Bhejo ka asal raasta (server action isi ko chalata hai; test mock deps se).
 * Tarteeb: (1) insaan ne form par "Bhejo" dabaya (intent === "bhejo"),
 * (2) DB ticket (616 prepare_send: scope + 24h window + template),
 * (3) WhatsApp API, (4) nateeja DB mein (mark_sent). Koi auto-send nahi.
 */
type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
export interface SendDeps {
  rpc: Rpc;
  sendText: (phone: string, text: string) => Promise<string | null | void>;
  sendTemplate: (phone: string, metaName: string, lang: string, params: string[]) => Promise<string | null | void>;
}
export interface SendInput {
  intent: string | null; conversationId: string; text: string; aiDraft: string | null;
  templateKey: string | null; params: string[]; templateParamCount: number | null; lastInboundAt: string | null; now?: number;
}
export type SendResult = { ok: true; messageId: string } | { ok: false; error: string };

export async function bhejo(deps: SendDeps, i: SendInput): Promise<SendResult> {
  if (i.intent !== "bhejo") return { ok: false, error: "not_human" };
  const pre = sendCheck({ text: i.text, templateKey: i.templateKey, params: i.params, templateParamCount: i.templateParamCount, lastInboundAt: i.lastInboundAt, now: i.now });
  if (!pre.ok) return { ok: false, error: pre.reason };
  const { data, error } = await deps.rpc("fn_wa_inbox_prepare_send", {
    p_conv: i.conversationId, p_text: pre.mode === "text" ? i.text.trim() : null,
    p_template_key: pre.mode === "template" ? i.templateKey : null, p_params: pre.mode === "template" ? i.params : null,
    p_ai_draft: i.aiDraft,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "prepare_failed" };
  const t = data as { message_id: string; phone_key: string; kind: "text" | "template"; meta_name: string | null; language_code: string | null; params: string[] };
  const phone = "92" + t.phone_key;
  let wamid: string | null = null;
  try {
    wamid = (t.kind === "template"
      ? await deps.sendTemplate(phone, t.meta_name!, t.language_code ?? "ur", t.params ?? [])
      : await deps.sendText(phone, i.text.trim())) || null;
  } catch (e) {
    await deps.rpc("fn_wa_inbox_mark_sent", { p_message: t.message_id, p_ok: false, p_wa_message_id: null, p_error: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: "send_failed" };
  }
  await deps.rpc("fn_wa_inbox_mark_sent", { p_message: t.message_id, p_ok: true, p_wa_message_id: wamid, p_error: null });
  return { ok: true, messageId: t.message_id };
}

export function parseDraftPayload(kind: string, f: Record<string, string>): { kind: DraftKind; payload: Record<string, string> } | null {
  if (!(DRAFT_KINDS as readonly string[]).includes(kind)) return null;
  const pick = (k: string) => (f[k] ?? "").toString().trim().slice(0, 500);
  if (kind === "order") return { kind, payload: { items: pick("items"), amount: pick("amount"), note: pick("note") } };
  if (kind === "payment") return { kind, payload: { amount: pick("amount"), note: pick("note") } };
  return { kind: "demand", payload: { product_name: pick("product_name"), quantity: pick("quantity"), unit: pick("unit"), needed_by: pick("needed_by"), note: pick("note") } };
}
