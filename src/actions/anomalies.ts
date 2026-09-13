"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runDetectors, saveAnomalies, REVIEW_NOTE_MIN } from "@/lib/ledger/anomalies";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

const CAN_REVIEW = ["owner", "super_admin", "admin", "finance"];

/** Detector abhi chalayein -- cron ka intezar kiye baghair. */
export async function scanNow(_prev: ActionState): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const run = await runDetectors();
  const saved = await saveAnomalies(run.found);

  revalidatePath("/admin/anomalies");

  if (run.found.length === 0) {
    return {
      success: true,
      message:
        "Koi ghair-maamooli tarteeb nahi mili. Yaad rahe: is ka matlab ye bhi ho sakta hai ke abhi itna data nahi ke koi tarteeb bane.",
    };
  }
  return {
    success: true,
    message: `${run.found.length} baatein mili${saved < run.found.length ? ` (${saved} nayi)` : ""}.`,
  };
}

/**
 * Baat dekh kar band karna.
 *
 * Do alag nateeje hain, aur ye farq ahem hai:
 *
 *   "dekh li, wajah maqool thi"  -- tarteeb waqai thi, magar us ki
 *                                   jaiz wajah nikli.
 *   "dekh li, masla tha"         -- tarteeb thi aur wo waqai masla
 *                                   nikla.
 *
 * Dono ko "band" mein mila dena poori mehnat zaya kar deta hai: phir ye
 * kabhi maloom nahi ho sakta ke detector kaam ka hai ya sirf shor
 * macha raha hai.
 */
export async function reviewAnomaly(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const id = String(formData.get("anomaly_id") ?? "");
  const verdict = String(formData.get("verdict") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!id) return { error: "Kaunsi baat, wo saaf nahi." };
  if (verdict !== "reviewed" && verdict !== "confirmed") {
    return { error: "Faisla saaf nahi — “wajah maqool thi” ya “masla tha”." };
  }
  if (note.length < REVIEW_NOTE_MIN) {
    return {
      error: `Faisle ki wajah likhna zaroori hai — kam az kam ${REVIEW_NOTE_MIN} harf. "Dekh liya" likh dena aur kuch na dekhna, dono ek jaise nazar aate hain; wajah un mein farq daalti hai.`,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: me } = await service
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active || !CAN_REVIEW.includes(me.role)) {
    return { error: "In baaton par faisla sirf Malik, Admin aur Finance kar sakte hain." };
  }

  const { data: anomaly } = await service
    .from("anomaly_findings")
    .select("subject_label, detector")
    .eq("id", id)
    .maybeSingle();

  const { error } = await service
    .from("anomaly_findings")
    .update({
      status: verdict,
      review_note: note,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await logAudit({
    actionType: verdict === "confirmed" ? "approve" : "reject",
    module: "anomaly_review",
    recordId: id,
    recordLabel: anomaly?.subject_label,
    description: `${anomaly?.detector}: ${verdict === "confirmed" ? "masla tha" : "wajah maqool thi"} — ${note}`,
  });

  revalidatePath("/admin/anomalies");
  return {
    success: true,
    message:
      verdict === "confirmed"
        ? "Darj ho gaya ke ye waqai masla tha."
        : "Darj ho gaya ke wajah maqool thi. Agar tarteeb jari rahi to ye baat phir nikle gi.",
  };
}
