import { headers } from "next/headers";
import type { createServiceClient } from "@/lib/supabase/service";

type Service = ReturnType<typeof createServiceClient>;

/** IP aur browser -- rate limit aur audit ke liye. (Server action nahi; client se call nahi hota.) */
export async function requestMeta() {
  const h = headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return { ip, ua: h.get("user-agent") ?? "" };
}

/** Audit log (559). Code ya token kabhi nahi -- sirf hash. */
export async function auditReset(service: Service, event: string, channel: "email" | "whatsapp", idHash: string,
  meta: { ip: string; ua: string }, userId: string | null = null, detail: string | null = null) {
  await (service as any).rpc("fn_password_reset_log", {
    p_event: event, p_channel: channel, p_identifier_hash: idHash, p_user: userId,
    p_ip: meta.ip, p_user_agent: meta.ua, p_detail: detail,
  });
}
