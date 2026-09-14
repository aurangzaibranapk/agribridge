"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Malik ke WhatsApp paigham ka jawab likhna -- ye jawab ABHI khud
 * WhatsApp par wapas nahi jata (feature_help mein saaf likha hai), yahan
 * padhna hota hai. Status "responded" ban jata hai.
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
  const { data: cmd } = await service.from("owner_whatsapp_commands").select("message").eq("id", id).maybeSingle();

  const { error } = await service
    .from("owner_whatsapp_commands")
    .update({ status: "responded", response_text: response, responded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "owner_commands",
    recordId: id,
    recordLabel: cmd?.message?.slice(0, 80),
    description: `Jawab likha: ${response}`,
  });

  revalidatePath("/admin/owner-commands");
  return { success: true, message: "Jawab darj ho gaya." };
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
