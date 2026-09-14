"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { logAudit } from "@/lib/audit";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Malik ke WhatsApp paigham ka jawab likhna -- aur wahi jawab seedha
 * WhatsApp par bhi bhej dena (`sendWhatsAppMessage`, wahi raasta jo
 * hazri/milk ke jawab bhejta hai).
 *
 * Meta ka qaida: saada matn sirf 24 ghante ke andar jata hai (jab se
 * bande ne khud aakhri baar likha). Malik ne abhi-abhi likha hoga is
 * liye aam tor par andar hi rahega -- magar agar bohat dair ho chuki ho
 * to WhatsApp bhejna nakaam ho sakta hai. Us soorat mein bhi jawab yahan
 * DARJ ho jata hai (status "responded") -- sirf WhatsApp tak nahi
 * pahuncha, ye baat jawab mein saaf likh di jati hai.
 */
export async function respondOwnerCommand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAction("system.owner_commands", "edit");
  if ("error" in guard) return { error: guard.error };

  const id = String(formData.get("command_id") ?? "");
  const response = String(formData.get("response_text") ?? "").trim();
  if (!id) return { error: "Kaunsa paigham, wo saaf nahi." };
  if (response.length < 5) return { error: "Jawab likhna zaroori hai -- kam az kam 5 harf." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const service = createServiceClient();
  const { data: cmd } = await service
    .from("owner_whatsapp_commands")
    .select("message, from_phone")
    .eq("id", id)
    .maybeSingle();

  const { error } = await service
    .from("owner_whatsapp_commands")
    .update({ status: "responded", response_text: response, responded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  let whatsappNote = "";
  if (cmd?.from_phone) {
    try {
      await sendWhatsAppMessage(cmd.from_phone, response);
    } catch (e) {
      whatsappNote = ` (WhatsApp par nahi bheja ja saka: ${e instanceof Error ? e.message : "wajah maloom nahi"})`;
    }
  } else {
    whatsappNote = " (number maloom nahi tha, is liye WhatsApp par nahi bheja ja saka)";
  }

  await logAudit({
    actionType: "update",
    module: "owner_commands",
    recordId: id,
    recordLabel: cmd?.message?.slice(0, 80),
    description: `Jawab likha: ${response}${whatsappNote}`,
  });

  revalidatePath("/admin/owner-commands");
  return {
    success: true,
    message: whatsappNote ? `Jawab darj ho gaya${whatsappNote}.` : "Jawab darj ho gaya aur WhatsApp par bhej diya.",
  };
}

/** Kaam ho jane par band karna. */
export async function markOwnerCommandDone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAction("system.owner_commands", "edit");
  if ("error" in guard) return { error: guard.error };

  const id = String(formData.get("command_id") ?? "");
  if (!id) return { error: "Kaunsa paigham, wo saaf nahi." };

  const service = createServiceClient();
  const { data: cmd } = await service.from("owner_whatsapp_commands").select("message").eq("id", id).maybeSingle();

  const { error } = await service
    .from("owner_whatsapp_commands")
    .update({ status: "done", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "approve",
    module: "owner_commands",
    recordId: id,
    recordLabel: cmd?.message?.slice(0, 80),
    description: "Kaam ho gaya mark kiya",
  });

  revalidatePath("/admin/owner-commands");
  return { success: true, message: "Ho gaya mark kar diya." };
}
