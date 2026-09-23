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

/** Watchdog abhi chalayein -- roz ke scan ka intezar kiye baghair. */
export async function scanDataHealthNow(_prev: ActionState): Promise<ActionState> {
  const guard = await requireAction("system.data_health", "view");
  if ("error" in guard) return { error: guard.error };

  const service = createServiceClient();
  const { data, error } = await service.rpc("fn_data_health_scan");
  if (error) return { error: error.message };

  const insertedCount = Array.isArray(data) ? (data[0]?.inserted_count ?? 0) : 0;

  revalidatePath("/admin/data-health");
  if (insertedCount === 0) {
    return { success: true, message: "Koi nayi cheez nahi mili. Pehle se khule masle neeche hain." };
  }
  return { success: true, message: `${insertedCount} nayi cheez mili.` };
}

/**
 * Masla dekh kar band karna -- teen mumkin faisle:
 *
 *   "Claude ko bhej do check karne"  -- staff ise ab investigate karwana
 *                                       chahta hai (status: sent_to_claude)
 *   "Theek hai, chhoड़ do"            -- dekh liya, masla nahi (dismissed)
 *   "Theek ho gaya"                  -- fix ho chuka, band karo (resolved)
 *
 * Har soorat mein wajah likhna zaroori hai -- warna "dekh liya" aur
 * "kabhi dekha hi nahi" ek jaisi qatarein reh jatin.
 */
export async function resolveDataHealthFinding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAction("system.data_health", "edit");
  if ("error" in guard) return { error: guard.error };

  const id = String(formData.get("finding_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!id) return { error: "Kaunsa masla, wo saaf nahi." };
  if (!["sent_to_claude", "dismissed", "resolved"].includes(status)) {
    return { error: "Faisla saaf nahi." };
  }
  if (note.length < 5) {
    return { error: "Wajah likhna zaroori hai -- kam az kam 5 harf." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const service = createServiceClient();
  const { data: finding } = await service
    .from("data_health_findings")
    .select("title, department")
    .eq("id", id)
    .maybeSingle();

  const { error } = await service
    .from("data_health_findings")
    .update({
      status,
      resolution_note: note,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: status === "resolved" ? "approve" : status === "dismissed" ? "reject" : "update",
    module: "data_health",
    recordId: id,
    recordLabel: finding?.title,
    description: `${finding?.department ?? ""}: ${status} -- ${note}`,
  });

  revalidatePath("/admin/data-health");
  const messages: Record<string, string> = {
    sent_to_claude: "Claude ke liye bhej diya -- agli Claude Code session mein ye masla utha kar theek karwa lein.",
    dismissed: "Chhoड़ diya, wajah darj ho gayi.",
    resolved: "Theek ho gaya mark kar diya.",
  };
  return { success: true, message: messages[status] };
}
