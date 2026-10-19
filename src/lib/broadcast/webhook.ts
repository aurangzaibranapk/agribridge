/**
 * WhatsApp webhook ka broadcast hissa (sirf signed paighaam par chalaya jata hai):
 *  - statuses[] (sent/delivered/read/failed) -> broadcast_status_update
 *  - inbound "STOP" / "band karo" / "START" -> fn_messaging_keyword
 * Koi jawab nahi bhejta. Kuch bhi ghalat ho to chup-chap wapas (purana raasta chalta rahe).
 */
import { normalizePkMobile, optKeyword } from "./text";

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>;

export function readBroadcastEvents(body: any): { statuses: { id: string; status: string; error: string | null }[]; keywords: { phone: string; text: string }[] } {
  const statuses: { id: string; status: string; error: string | null }[] = [];
  const keywords: { phone: string; text: string }[] = [];
  for (const entry of body?.entry ?? []) for (const ch of entry?.changes ?? []) {
    const v = ch?.value ?? {};
    for (const s of v.statuses ?? []) if (s?.id && s?.status) statuses.push({ id: String(s.id), status: String(s.status), error: s.errors?.[0]?.title ?? null });
    for (const m of v.messages ?? []) {
      const text = m?.type === "text" ? m?.text?.body : m?.type === "button" ? m?.button?.text : null;
      const phone = normalizePkMobile(m?.from);
      if (phone && text && optKeyword(text)) keywords.push({ phone, text: String(text) });
    }
  }
  return { statuses, keywords };
}

export async function recordBroadcastWebhook(rpc: Rpc, body: unknown): Promise<{ statuses: number; keywords: number }> {
  const ev = readBroadcastEvents(body);
  for (const s of ev.statuses) await rpc("broadcast_status_update", { p_msg_id: s.id, p_status: s.status, p_error: s.error });
  for (const k of ev.keywords) await rpc("fn_messaging_keyword", { p_phone: k.phone, p_text: k.text, p_source: "whatsapp" });
  return { statuses: ev.statuses.length, keywords: ev.keywords.length };
}
