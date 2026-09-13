import { createServiceClient } from "@/lib/supabase/service";

/**
 * WhatsApp se aane wale saboot (bill, meter photo, cash slip) yahan
 * darj hote hain.
 *
 * Usool: asal saboot kabhi nahi badla jata. Teen alag khane hain —
 *   raw_*        : jo staff ne bheja (kabhi overwrite nahi hota)
 *   ai_*         : AI ne us se kya samjha
 *   corrected_*  : manager ne kya theek kiya
 * Is tarah baad mein poora silsila saaf nazar aata hai. Agar hum AI ka
 * natija asal ke upar likh dete, to jhagre ke waqt koi saboot hi na
 * bachta.
 *
 * Aur sab kuch "pending" par rukta hai — manager ki comment ke baghair
 * koi transaction accounts mein nahi jati. Ye rok database mein bhi lagi
 * hui hai (chk_manager_comment_required), sirf yahan nahi.
 */

export const SUBMISSION_BUCKET = "whatsapp-submissions";

/** Comment ki hadd — DB ka khana varchar(255) hai, dono ek jaise rahen. */
export const COMMENT_MAX = 255;
export const COMMENT_MIN = 5;

export type SubmissionKind =
  | "meter_opening"
  | "meter_closing"
  | "fuel"
  | "expense"
  | "cash_paid"
  | "cash_received"
  | "other";

export type SubmissionStatus = "pending" | "approved" | "rejected" | "sent_back";

export const KIND_LABEL: Record<SubmissionKind, string> = {
  meter_opening: "Subah ka Meter",
  meter_closing: "Shaam ka Meter",
  fuel: "Petrol / Diesel",
  expense: "Kharcha / Bill",
  cash_paid: "Cash Diya",
  cash_received: "Cash Mila",
  other: "Deegar",
};

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "Manager ke intezar mein",
  approved: "Approve ho gaya",
  rejected: "Reject hua",
  sent_back: "Wapas bheja gaya",
};

async function nextSubmissionNumber(): Promise<string> {
  const service = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await service
    .from("whatsapp_submission_counters")
    .select("last_number")
    .eq("year", year)
    .maybeSingle();
  const next = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await service.from("whatsapp_submission_counters").update({ last_number: next }).eq("year", year);
  } else {
    await service.from("whatsapp_submission_counters").insert({ year, last_number: next });
  }

  return `WA-${year}-${String(next).padStart(5, "0")}`;
}

export interface NewSubmission {
  staffProfileId: string;
  branchId: string | null;
  whatsappNumber: string;
  kind: SubmissionKind;
  rawText: string | null;
  /** WhatsApp se utari hui file — base64 mein. */
  media?: { base64: string; mimeType: string } | null;
  aiExtracted?: Record<string, unknown> | null;
  aiSummary?: string | null;
  originalAmount?: number | null;
  flags?: string[];
}

export interface SubmissionResult {
  id: string;
  submissionNumber: string;
}

/**
 * Naya saboot darj karta hai. Hamesha "pending" par — yahan se koi
 * transaction nahi banti.
 */
export async function recordSubmission(input: NewSubmission): Promise<SubmissionResult | { error: string }> {
  const service = createServiceClient();
  const submissionNumber = await nextSubmissionNumber();

  // Photo pehle chadhate hain. Na chadhe to bhi submission banti hai —
  // saboot ki photo kho jana bura hai, magar poori entry kho dena us se
  // zyada bura.
  let mediaPath: string | null = null;
  if (input.media) {
    const ext = input.media.mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
    const path = `${input.branchId ?? "no-branch"}/${submissionNumber}.${ext}`;
    const bytes = Buffer.from(input.media.base64, "base64");
    const { error } = await service.storage
      .from(SUBMISSION_BUCKET)
      .upload(path, bytes, { contentType: input.media.mimeType, upsert: false });
    if (!error) mediaPath = path;
  }

  const { data, error } = await service
    .from("whatsapp_submissions")
    .insert({
      submission_number: submissionNumber,
      staff_profile_id: input.staffProfileId,
      branch_id: input.branchId,
      whatsapp_number: input.whatsappNumber,
      kind: input.kind,
      raw_text: input.rawText,
      media_path: mediaPath,
      media_mime: input.media?.mimeType ?? null,
      ai_extracted: (input.aiExtracted ?? null) as never,
      ai_summary: input.aiSummary ?? null,
      original_amount: input.originalAmount ?? null,
      flags: (input.flags ?? []) as never,
      status: "pending",
    })
    .select("id, submission_number")
    .single();

  if (error) return { error: error.message };
  return { id: data.id, submissionNumber: data.submission_number };
}

/**
 * Private bucket ki file dekhne ka arzi link. Bucket jaan boojh kar
 * private hai (baqi buckets public hain) kyunke ismein bills aur cash
 * ke saboot hain — link kisi ke haath lag jaye to bhi kuch der baad
 * bekar ho jata hai.
 */
export async function signedMediaUrl(path: string | null, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const service = createServiceClient();
  const { data } = await service.storage.from(SUBMISSION_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/** Manager ki bheji hui tasveerein (comment ke sath). */
export async function uploadManagerMedia(
  submissionNumber: string,
  files: File[]
): Promise<string[]> {
  const service = createServiceClient();
  const paths: string[] = [];

  for (const [index, file] of files.entries()) {
    if (!file || file.size === 0) continue;
    const ext = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
    const path = `manager-review/${submissionNumber}-${index + 1}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await service.storage
      .from(SUBMISSION_BUCKET)
      .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
    if (!error) paths.push(path);
  }

  return paths;
}
