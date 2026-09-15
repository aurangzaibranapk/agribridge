"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runChecks, saveRun, NOTE_MIN } from "@/lib/ledger/daily-reconcile";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}


/** Haath se jaanch chalana -- cron ka intezar kiye baghair. */
export async function runReconciliationNow(_prev: ActionState): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const run = await runChecks();
  const saved = await saveRun(run, "manual");

  if ("error" in saved) return { error: saved.error };

  revalidatePath("/admin/reconciliation");
  return { success: true, message: run.summary };
}

/**
 * Nikli hui baat band karna.
 *
 * Wajah lazmi hai. Bina wajah ke band karna aur nazar andaz karna --
 * dono ka anjaam ek hai, magar pehla record mein "hal ho gaya" likh deta
 * hai. Wo is se bura hai ke kuch na kiya jaye, kyunki jhooti tasalli
 * agle sawal ko rok deti hai.
 *
 * Band karne se masla khatam nahi hota. Agli jaanch mein wo phir nikle
 * ga -- kyunki jaanch haalat dekhti hai, record nahi.
 */
export async function resolveFinding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const findingId = String(formData.get("finding_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!findingId) return { error: "Kaunsi baat band karni hai, wo saaf nahi." };
  if (note.length < NOTE_MIN) {
    return { error: `Band karne ki wajah likhna zaroori hai — kam az kam ${NOTE_MIN} harf.` };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { error } = await service
    .from("reconciliation_findings")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_note: note,
    })
    .eq("id", findingId);

  if (error) return { error: error.message };

  revalidatePath("/admin/reconciliation");
  return {
    success: true,
    message: "Band ho gayi. Agar haalat abhi bhi wahi hai to agli jaanch mein ye phir nikle gi — jaanch record nahi, haalat dekhti hai.",
  };
}
