"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { notifyBranch } from "@/lib/notifications";
import { COMMENT_MAX, COMMENT_MIN, uploadManagerMedia, type SubmissionStatus } from "@/lib/whatsapp-submissions";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const MANAGER_ROLES = ["owner", "super_admin", "admin", "manager"];

/**
 * Manager ka faisla. Teen soortein hain — Approve, Reject, Wapas Bhejo —
 * aur teenon mein comment LAZMI hai.
 *
 * Comment ki rok teen jagah lagi hui hai, jaan boojh kar:
 *   1. Form mein (staff ko foran nazar aaye)
 *   2. Yahan server par (form bypass ho jaye tab bhi)
 *   3. Database mein (chk_manager_comment_required — koi bhi raasta ho)
 * Paise ke faisle par ek hi rok kaafi nahi hoti.
 */
export async function reviewSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const submissionId = String(formData.get("submission_id") ?? "");
  const decision = String(formData.get("decision") ?? "") as SubmissionStatus;
  const comment = String(formData.get("manager_comment") ?? "").trim();
  const correctedRaw = String(formData.get("corrected_amount") ?? "").trim();

  if (!submissionId) return { error: "Missing submission id." };
  if (!["approved", "rejected", "sent_back"].includes(decision)) {
    return { error: "Faisla sahi nahi hai." };
  }

  if (!comment) return { error: "Comment likhna zaroori hai — bina wajah likhe faisla nahi ho sakta." };
  if (comment.length < COMMENT_MIN) return { error: `Comment kam az kam ${COMMENT_MIN} haroof ka hona chahiye.` };
  if (comment.length > COMMENT_MAX) return { error: `Comment zyada se zyada ${COMMENT_MAX} haroof ka ho sakta hai.` };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !MANAGER_ROLES.includes(profile.role)) {
    return { error: "Sirf Manager ya Admin ye faisla kar sakta hai." };
  }

  const { data: submission } = await service
    .from("whatsapp_submissions")
    .select("id, submission_number, status, branch_id, original_amount, kind")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) return { error: "Submission nahi mili." };
  if (submission.status !== "pending") return { error: "Is par faisla pehle hi ho chuka hai." };

  // Branch manager sirf apni branch ka faisla kare. Admin darje ke log
  // sab dekh sakte hain.
  const isAdminLevel = ["owner", "super_admin", "admin"].includes(profile.role);
  if (!isAdminLevel && profile.branch_id && submission.branch_id && profile.branch_id !== submission.branch_id) {
    return { error: "Ye submission aapki branch ki nahi hai." };
  }

  // Manager raqam theek kar sakta hai. Asal raqam original_amount mein
  // waise hi rehti hai — corrected alag khane mein jata hai, taake
  // farq baad mein nazar aaye.
  let correctedAmount: number | null = null;
  if (correctedRaw) {
    const value = Number(correctedRaw);
    if (!Number.isFinite(value) || value < 0) return { error: "Theek ki hui raqam sahi nahi hai." };
    correctedAmount = value;
  }

  const managerFiles = formData.getAll("manager_media").filter((f): f is File => f instanceof File && f.size > 0);
  const managerPaths = managerFiles.length ? await uploadManagerMedia(submission.submission_number, managerFiles) : [];

  const { error } = await service
    .from("whatsapp_submissions")
    .update({
      status: decision,
      manager_profile_id: user.id,
      manager_comment: comment,
      manager_media_paths: managerPaths.length ? managerPaths : null,
      corrected_amount: correctedAmount,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    // Do manager ek sath faisla na kar dein — sirf pending hi badlegi.
    .eq("status", "pending");

  if (error) return { error: error.message };

  const decisionLabel = decision === "approved" ? "Approve" : decision === "rejected" ? "Reject" : "Wapas bheja";
  await logAudit({
    actionType: decision === "approved" ? "approve" : "reject",
    module: "whatsapp_submissions",
    recordId: submissionId,
    recordLabel: submission.submission_number,
    description: `${decisionLabel}: ${comment}${correctedAmount != null ? ` (raqam theek ki: Rs ${correctedAmount.toLocaleString()})` : ""}`,
  });

  if (submission.branch_id) {
    await notifyBranch(
      submission.branch_id,
      `Submission ${decisionLabel}`,
      `${submission.submission_number} — ${comment}`,
      `/admin/submissions/${submissionId}`
    );
  }

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  return { success: true };
}
