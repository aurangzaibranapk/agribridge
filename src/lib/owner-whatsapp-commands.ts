import { createServiceClient } from "@/lib/supabase/service";

/**
 * Malik ka WhatsApp par likha hua hidayat -- Command Center Stage 2 ka
 * pehla qadam (migration 397).
 *
 * Yahan sirf DARJ hota hai ke malik ne kya kaha aur kab. Koi cheez khud
 * theek nahi hoti -- fix hamesha alag se, Claude Code session ki taraf
 * se, malik ki tasdeeq ke sath. /admin/owner-commands is fehrist ko
 * dikhata hai.
 */
export async function recordOwnerCommand(fromPhone: string, profileId: string, message: string): Promise<void> {
  const service = createServiceClient();
  await service.from("owner_whatsapp_commands").insert({
    from_phone: fromPhone,
    profile_id: profileId,
    message,
    status: "received",
  });
}
