"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { notifyBranch } from "@/lib/notifications";
import { COMMENT_MAX, COMMENT_MIN, uploadManagerMedia, type SubmissionStatus } from "@/lib/whatsapp-submissions";
import { partyDefinition, isBillCategory, type PartyType } from "@/lib/bill-cash";
import { nextExpenseNumber } from "@/lib/expense-number";

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
    .select("id, submission_number, status, branch_id, original_amount, kind, staff_profile_id, raw_text, ai_summary")
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

  // ==========================================================
  // Bill aur cash — accounts mein jane se pehle ki sharaait.
  // ==========================================================
  const FINANCIAL_KINDS = ["expense", "cash_paid", "cash_received"];
  const isFinancial = FINANCIAL_KINDS.includes(submission.kind);
  const postAmount = correctedAmount ?? submission.original_amount;

  const partyType = String(formData.get("party_type") ?? "").trim() as PartyType | "";
  const partyName = String(formData.get("party_name") ?? "").trim();
  const billCategory = String(formData.get("bill_category") ?? "").trim();
  const accountId = String(formData.get("finance_account_id") ?? "").trim();

  if (decision === "approved" && isFinancial) {
    if (postAmount == null || !(postAmount > 0)) {
      return { error: "Raqam khali hai — approve karne se pehle sahi raqam likhein." };
    }

    if (submission.kind === "expense") {
      if (!isBillCategory(billCategory)) return { error: "Bill ki qism chunein." };
    } else {
      // YE SAB SE AHEM ROK HAI. Cash bahar jane ka matlab khud-ba-khud
      // kharcha nahi hota — supplier ki adaigi aur staff ka advance bhi
      // isi tarah nazar aate hain. Ye farq sirf manager jaanta hai, is
      // liye us se poocha jata hai; andaza nahi lagaya jata.
      const party = partyDefinition(submission.kind, partyType);
      if (!party) return { error: "Batayein ke ye kis qism ka len-den hai — ye khud se tay nahi kiya ja sakta." };
      if (partyName.length < 2) return { error: "Doosre fareeq ka naam likhein — kis ko diya ya kis se mila." };
      if (!accountId) return { error: "Khata chunein (Cash in Hand ya bank)." };
    }
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
      party_type: partyType || null,
      party_name: partyName || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    // Do manager ek sath faisla na kar dein — sirf pending hi badlegi.
    .eq("status", "pending");

  if (error) return { error: error.message };

  // Approve ho gaya — ab accounts mein jayega. Posting yahan hoti hai,
  // approve hone ke BAAD, taake koi entry manager ke comment ke baghair
  // na ban sake. Post na ho paye to submission wapas pending par chali
  // jati hai: adhoori halat — approve ho chuki magar accounts mein nahi —
  // sab se buri soorat hoti hai, kyunke wo kisi report mein nazar nahi
  // aati.
  if (decision === "approved" && isFinancial && postAmount != null) {
    const posted = await postToAccounts({
      kind: submission.kind,
      submissionId,
      submissionNumber: submission.submission_number,
      branchId: submission.branch_id,
      staffProfileId: submission.staff_profile_id,
      managerId: user.id,
      amount: postAmount,
      comment,
      billCategory,
      partyType: partyType as PartyType,
      partyName,
      accountId,
    });

    if ("error" in posted) {
      await service
        .from("whatsapp_submissions")
        .update({ status: "pending", manager_profile_id: null, manager_comment: null, reviewed_at: null })
        .eq("id", submissionId);
      return { error: `Accounts mein nahi ja saka: ${posted.error}. Faisla wapas pending kar diya gaya hai.` };
    }

    await service
      .from("whatsapp_submissions")
      .update({
        posted_reference_type: posted.referenceType,
        posted_reference_id: posted.referenceId,
        posted_at: new Date().toISOString(),
      })
      .eq("id", submissionId);
  }

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

interface PostInput {
  kind: string;
  submissionId: string;
  submissionNumber: string;
  branchId: string | null;
  staffProfileId: string;
  managerId: string;
  amount: number;
  comment: string;
  billCategory: string;
  partyType: PartyType;
  partyName: string;
  accountId: string;
}

type PostResult = { referenceType: string; referenceId: string } | { error: string };

/**
 * WhatsApp se aayi hui entry ko purane khaton mein daalta hai.
 *
 * Jaan boojh kar koi naya "WhatsApp expenses" table nahi banaya gaya.
 * Bill wahi jagah jata hai jahan haath se dala hua bill jata hai
 * (company_expense_requests), aur cash wahi jagah jahan baqi cash jata
 * hai (finance_transactions). Agar hum alag table banate to har report
 * do jagah se jorni parti, aur ek na ek din koi ek jagah dekhna bhool
 * jata.
 */
async function postToAccounts(input: PostInput): Promise<PostResult> {
  const service = createServiceClient();
  const trace = `WhatsApp saboot ${input.submissionNumber}`;

  if (input.kind === "expense") {
    const expenseNumber = await nextExpenseNumber();
    const { data, error } = await service
      .from("company_expense_requests")
      .insert({
        expense_number: expenseNumber,
        category: input.billCategory,
        amount: input.amount,
        description: `${input.comment} — ${trace}`,
        branch_id: input.branchId,
        requested_by: input.staffProfileId,
        // Manager pehle hi comment ke sath faisla de chuka hai; dobara
        // approve karwana sirf ek khali qadam hota.
        status: "approved",
        approved_by: input.managerId,
        approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    return { referenceType: "company_expense_requests", referenceId: data.id };
  }

  const party = partyDefinition(input.kind, input.partyType);
  if (!party) return { error: "Len-den ki qism sahi nahi hai." };

  // party.financeType hi wo jagah hai jahan "cash gaya" aur "kharcha
  // hua" ka farq pakka hota hai. Supplier ki adaigi aur staff ka advance
  // transfer_out jate hain, expense nahi — warna nafa asal se kam nazar
  // aata.
  const { data, error } = await service
    .from("finance_transactions")
    .insert({
      account_id: input.accountId,
      transaction_type: party.financeType,
      amount: input.amount,
      category: input.partyType,
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: `${party.label}: ${input.partyName} — ${input.comment} (${trace})`,
      created_by: input.managerId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { referenceType: "finance_transactions", referenceId: data.id };
}
