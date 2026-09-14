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

export type ConfirmationDecision = "confirmed" | "dismissed";

/**
 * Tasdeeq ka daayra (Stage 3, migration 400).
 *
 * Claude Code session ne pehle koi tajweez likh kar WhatsApp par bhej di
 * ho (status "responded") -- agar malik ka AGLA paigham "haan"/"nahi"
 * jaisa lage, to ye us purani tajweez ko "confirmed"/"dismissed" kar
 * deta hai, taake agli baar safha khud bata de ke amal ab karna hai.
 * Amal (asal fix) phir bhi HAMESHA insaan (Claude Code session) khud
 * karta hai -- ye function khud kuch execute nahi karta.
 *
 * Wapsi mein null ka matlab: koi tajweez intezar mein nahi thi -- ye
 * paigham ek NAYA, alag command hai (purana rawaiya chalega).
 */
export async function resolvePendingConfirmation(fromPhone: string, decision: ConfirmationDecision): Promise<boolean> {
  const service = createServiceClient();
  const { data: pending } = await service
    .from("owner_whatsapp_commands")
    .select("id")
    .eq("from_phone", fromPhone)
    .eq("status", "responded")
    .order("responded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pending) return false;

  await service
    .from("owner_whatsapp_commands")
    .update({ status: decision, confirmed_at: new Date().toISOString() })
    .eq("id", pending.id);

  return true;
}
