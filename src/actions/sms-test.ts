"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { maskPhone } from "@/lib/call-center/rules";
import { sendVeevoSms, toVeevoReceiver, veevoEnv, veevoReady } from "@/lib/sms/veevo";

export interface SmsTestState {
  error?: string;
  ok?: string;
}

const ADMIN = new Set(["owner", "super_admin", "admin"]);

/** Owner / Admin ek number par ek test SMS. Khali provider: queue, jhoot sent nahi. */
export async function sendTestSms(_prev: SmsTestState, formData: FormData): Promise<SmsTestState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active, organization_id").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ADMIN.has(String(me.role))) return { error: "Test SMS sirf Owner ya Admin bhejta hai." };

  const phone = String(formData.get("phone") ?? "").trim();
  const text = String(formData.get("message") ?? "").trim().slice(0, 480) || "Al Rana Traders: yeh test SMS hai.";
  if (!toVeevoReceiver(phone)) return { error: "Mobile 03xxxxxxxxx ki surat mein likhein." };

  const env = veevoEnv();
  const service = createServiceClient() as unknown as {
    from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
  };
  const masked = maskPhone(phone);
  if (!veevoReady(env)) {
    const queued = await service.from("cc_sms_outbox").insert({
      organization_id: me.organization_id ?? null,
      complaint_id: null,
      to_phone: phone,
      body: text,
      channel: "sms",
      status: "queued",
    });
    if (queued.error) return { error: "Queue mein nahi gaya. Provider set nahi." };
    revalidatePath("/admin/call-center/agents");
    return { ok: `Test SMS queue mein hai (${masked}). Provider abhi set nahi.` };
  }

  const result = await sendVeevoSms({ to: phone, text, env });
  const status = result.sent ? "sent" : result.retryable ? "queued" : "failed";
  await service.from("cc_sms_outbox").insert({
    organization_id: me.organization_id ?? null,
    complaint_id: null,
    to_phone: phone,
    body: text,
    channel: "sms",
    status,
    provider: "veevo",
    last_error: result.sent ? null : result.reason,
    sent_at: result.sent ? new Date().toISOString() : null,
  });
  revalidatePath("/admin/call-center/agents");
  if (result.sent) return { ok: `Test SMS chala gaya (${masked}).` };
  if (result.retryable) return { error: `Abhi nahi gaya (${result.reason}). Queue dobara koshish karegi. ${masked}` };
  return { error: `Nahi gaya: ${result.reason}. ${masked}` };
}
