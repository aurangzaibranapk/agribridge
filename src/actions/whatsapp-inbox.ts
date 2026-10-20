"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp-client";
import { inboxEnabled } from "@/lib/whatsapp/inbox/flag";
import { bhejo, parseDraftPayload } from "@/lib/whatsapp/inbox/send";

/**
 * WhatsApp Inbox ke server actions. Har ek user ke apne session (auth.uid)
 * se DB functions chalata hai -- scope, maker-checker aur 24h window DB
 * mein (614-617). Flag band ho to kuch nahi.
 */
type R = { ok: boolean; error?: string; info?: Record<string, unknown> };
const PATH = "/admin/whatsapp-inbox";

async function rpcAsUser() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("login");
  return async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(fn as never, args as never);
    return { data: data as unknown, error: error ? { message: error.message } : null };
  };
}

export async function sendInboxReply(formData: FormData): Promise<R> {
  if (!inboxEnabled()) return { ok: false, error: "off" };
  const rpc = await rpcAsUser();
  const params = formData.getAll("param").map((p) => String(p));
  const res = await bhejo(
    {
      rpc,
      // 619: mark_sent sirf service_role; bhejne wale ki shart DB ticket (sent_by) se.
      markRpc: async (fn, args) => {
        const { data, error } = await createServiceClient().rpc(fn as never, args as never);
        return { data: data as unknown, error: error ? { message: error.message } : null };
      },
      sendText: async (phone, text) => { await sendWhatsAppMessage(phone, text); return null; },
      sendTemplate: async (phone, name, lang, p) => { await sendWhatsAppTemplate(phone, name, lang, p); return null; },
    },
    {
      intent: String(formData.get("intent") ?? ""),
      conversationId: String(formData.get("conversation_id") ?? ""),
      text: String(formData.get("text") ?? ""),
      aiDraft: (formData.get("ai_draft") as string) || null,
      templateKey: (formData.get("template_key") as string) || null,
      params,
      templateParamCount: formData.get("template_param_count") ? Number(formData.get("template_param_count")) : null,
      lastInboundAt: (formData.get("last_inbound_at") as string) || null,
    },
  );
  revalidatePath(PATH);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function openConversation(conversationId: string): Promise<R> {
  if (!inboxEnabled()) return { ok: false, error: "off" };
  const { error } = await (await rpcAsUser())("fn_wa_inbox_open", { p_conv: conversationId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function assignConversation(formData: FormData): Promise<R> {
  if (!inboxEnabled()) return { ok: false, error: "off" };
  const { error } = await (await rpcAsUser())("fn_wa_inbox_assign", {
    p_conv: String(formData.get("conversation_id")),
    p_to: (formData.get("to_profile_id") as string) || null,
    p_department: (formData.get("department_key") as string) || null,
    p_reason: (formData.get("reason") as string) || null,
    p_transfer: formData.get("mode") === "transfer",
  });
  revalidatePath(PATH);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function createInboxDraft(formData: FormData): Promise<R> {
  if (!inboxEnabled()) return { ok: false, error: "off" };
  const fields: Record<string, string> = {};
  formData.forEach((v, k) => { if (typeof v === "string") fields[k] = v; });
  const parsed = parseDraftPayload(String(formData.get("kind")), fields);
  if (!parsed) return { ok: false, error: "kind" };
  const { data, error } = await (await rpcAsUser())("fn_wa_inbox_create_draft", {
    p_conv: String(formData.get("conversation_id")), p_kind: parsed.kind, p_payload: parsed.payload,
  });
  revalidatePath(PATH);
  return error ? { ok: false, error: error.message } : { ok: true, info: data as Record<string, unknown> };
}

export async function linkInboxNumber(formData: FormData): Promise<R> {
  if (!inboxEnabled()) return { ok: false, error: "off" };
  const { error } = await (await rpcAsUser())("fn_wa_inbox_link", {
    p_conv: String(formData.get("conversation_id")), p_party: String(formData.get("party")), p_party_id: String(formData.get("party_id")),
  });
  revalidatePath(PATH);
  return error ? { ok: false, error: error.message } : { ok: true };
}
