"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";
import { validateStaffReply, WHATSAPP_REPLY_INTENT, WHATSAPP_REPLY_ROLES } from "@/lib/whatsapp/inbound-policy";

/**
 * Kisan ke WhatsApp ka jawab -- sirf staff ke "Confirm send" par (malik,
 * go-live 5). AI ka mashwara khud kabhi nahi jata. Webhook ke paas jawab
 * bhejne ka koi raasta nahi; ye wahid jagah hai, aur yahan bhi:
 *   - login + staff role (WHATSAPP_REPLY_ROLES) zaroori,
 *   - qatar abhi "pending" honi chahiye (dobara na jaye),
 *   - form mein confirm=yes (preview ke baad doosra click) zaroori.
 */
export interface ReplyActionState {
  error?: string;
  success?: boolean;
  notice?: string;
}

async function staffCaller(): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me || !me.is_active || !WHATSAPP_REPLY_ROLES.includes(me.role)) return { error: "Aapko is kaam ki ijazat nahi hai." };
  return { id: user.id };
}

export async function confirmSendWhatsAppReply(_prev: ReplyActionState, formData: FormData): Promise<ReplyActionState> {
  const caller = await staffCaller();
  if ("error" in caller) return { error: caller.error };
  const id = String(formData.get("request_id") ?? "");
  const text = String(formData.get("reply") ?? "").trim();
  if (!id) return { error: "Qatar nahi mili." };
  if (String(formData.get("confirm") ?? "") !== "yes") return { error: "Pehle preview dekh kar Confirm karein." };
  const bad = validateStaffReply(text);
  if (bad) return { error: bad };

  const svc = createServiceClient() as any;
  const { data: row } = await svc
    .from("farmer_ai_requests")
    .select("id, status, intent_type, details, farmers(whatsapp_number, phone_number)")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.intent_type !== WHATSAPP_REPLY_INTENT) return { error: "Qatar nahi mili." };
  if (row.status !== "pending") return { error: "Is ka jawab pehle hi ho chuka hai." };

  // Pehle qatar "approved" par taala (sirf pending se) -- do log ek sath
  // dabayen to paighaam do baar na jaye.
  const now = new Date().toISOString();
  const { data: locked } = await svc
    .from("farmer_ai_requests")
    .update({ status: "approved", expert_response: text, responded_by: caller.id, responded_at: now, reviewed_at: now })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (!locked || locked.length === 0) return { error: "Is ka jawab pehle hi ho chuka hai." };

  const f = Array.isArray(row.farmers) ? row.farmers[0] : row.farmers;
  const to = f?.whatsapp_number ?? row.details?.from_phone ?? f?.phone_number;
  try {
    if (!to) throw new Error("no number");
    await sendWhatsAppMessage(to, text);
  } catch {
    // Nahi gaya: wapas pending, taake koi dobara koshish kar sake.
    await svc.from("farmer_ai_requests").update({ status: "pending", expert_response: null, responded_by: null, responded_at: null, reviewed_at: null }).eq("id", id);
    return { error: "WhatsApp par nahi ja saka. Qatar pending hai -- dobara koshish karein ya kisan se khud raabta karein." };
  }
  revalidatePath("/admin/farmer-ai-requests");
  return { success: true, notice: "Jawab WhatsApp par bhej diya gaya." };
}

export async function dismissWhatsAppReply(_prev: ReplyActionState, formData: FormData): Promise<ReplyActionState> {
  const caller = await staffCaller();
  if ("error" in caller) return { error: caller.error };
  const id = String(formData.get("request_id") ?? "");
  if (!id) return { error: "Qatar nahi mili." };
  const svc = createServiceClient() as any;
  const now = new Date().toISOString();
  await svc
    .from("farmer_ai_requests")
    .update({ status: "rejected", responded_by: caller.id, responded_at: now, reviewed_at: now })
    .eq("id", id)
    .eq("intent_type", WHATSAPP_REPLY_INTENT)
    .eq("status", "pending");
  revalidatePath("/admin/farmer-ai-requests");
  return { success: true, notice: "Bina jawab band kar diya." };
}

/** Anjaan number ko qatar se hatana (farmer nahi banta, koi paighaam nahi). */
export async function dismissUnknownSender(_prev: ReplyActionState, formData: FormData): Promise<ReplyActionState> {
  const caller = await staffCaller();
  if ("error" in caller) return { error: caller.error };
  const key = String(formData.get("phone_key") ?? "");
  if (!key) return { error: "Number nahi mila." };
  const svc = createServiceClient() as any;
  await svc.from("whatsapp_onboarding").delete().eq("phone_key", key);
  revalidatePath("/admin/farmer-ai-requests");
  return { success: true };
}
