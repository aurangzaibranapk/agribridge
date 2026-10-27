"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { applyInputError, readApplyFields, staffGenderOrNull } from "@/lib/jobs/apply-input";
import { dispatchNotice, redactSecrets, type CandidateDispatch } from "@/lib/jobs/candidate-message";
import { interviewDay, isDuplicateInterviewSchedule } from "@/lib/jobs/status-guard";
import { t } from "@/lib/i18n/translations";
import {
  sendApplicationReceivedEmail,
  sendEligibilityEmail,
  sendInterviewInvitationEmail,
  sendInterviewRescheduledEmail,
  sendInterviewResultEmail,
  sendJobOfferEmail,
  sendOfficialLoginEmail,
} from "@/lib/email";

export interface ActionState {
  error?: string;
  success?: boolean;
  /** Email na gayi ho to safha ye note dikhata hai. Status phir bhi save hota hai. */
  notice?: string;
}

async function actorId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function saveCandidateMessage(
  applicationId: string,
  mail: CandidateDispatch,
  triggeredBy: string | null,
  secrets?: Array<string | null | undefined>,
) {
  const service = createServiceClient();
  const { error } = await service.from("job_application_messages").insert({
    application_id: applicationId,
    channel: mail.channel,
    to_address: mail.to,
    subject: mail.subject,
    body: redactSecrets(mail.body, secrets ?? []),
    link_url: mail.linkUrl,
    attachment_name: mail.attachmentName,
    status: mail.status,
    error: mail.error,
    triggered_by: triggeredBy,
  });
  if (error) console.error("job_application_messages:", error.message);
}

async function logActivity(applicationId: string, eventType: string, description: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("application_activity_log").insert({
    application_id: applicationId,
    event_type: eventType,
    event_description: description,
    created_by: user?.id ?? null,
  });
}

export async function createVacancy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Job title zaroori hai." };

  const seatsTotal = Number(formData.get("seats_total") ?? 1);

  const { error } = await supabase.from("job_vacancies").insert({
    title,
    designation: (formData.get("designation") as string) || null,
    branch_id: (formData.get("branch_id") as string) || null,
    description: (formData.get("description") as string) || null,
    requirements: (formData.get("requirements") as string) || null,
    seats_total: seatsTotal > 0 ? seatsTotal : 1,
    seats_filled: 0,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/job-vacancies");
  revalidatePath("/careers");
  return { success: true };
}

export async function toggleVacancyOpen(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const vacancyId = String(formData.get("vacancy_id") ?? "");
  const isOpen = formData.get("is_open") === "true";
  const { error } = await supabase.from("job_vacancies").update({ is_open: !isOpen }).eq("id", vacancyId);
  if (error) return { error: error.message };
  revalidatePath("/admin/job-vacancies");
  revalidatePath("/careers");
  return { success: true };
}

export async function deleteVacancy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const vacancyId = String(formData.get("vacancy_id") ?? "");
  if (!vacancyId) return { error: "Missing vacancy id." };

  const { count } = await supabase.from("job_applications").select("id", { count: "exact", head: true }).eq("vacancy_id", vacancyId);
  if (count && count > 0) {
    return { error: `Is vacancy par ${count} application(s) aa chuki hain - isay Close karein, Delete nahi kar sakte.` };
  }

  const { data: vacancy } = await supabase.from("job_vacancies").select("title").eq("id", vacancyId).single();

  const { error } = await supabase.from("job_vacancies").delete().eq("id", vacancyId);
  if (error) return { error: error.message };

  await logAudit({ actionType: "delete", module: "job_vacancies", recordId: vacancyId, recordLabel: vacancy?.title, description: "Job vacancy delete hui (koi application nahi thi)." });

  revalidatePath("/admin/job-vacancies");
  revalidatePath("/careers");
  return { success: true };
}

async function uploadJobDoc(serviceClient: ReturnType<typeof createServiceClient>, applicantEmail: string, fieldName: string, file: File): Promise<string | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${applicantEmail.replace(/[^a-zA-Z0-9]/g, "_")}/${fieldName}-${Date.now()}-${safeName}`;
  const { error } = await serviceClient.storage.from("job-applications").upload(path, file);
  if (error) return null;
  const { data } = serviceClient.storage.from("job-applications").getPublicUrl(path);
  return data.publicUrl;
}

export async function applyToVacancy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const serviceClient = createServiceClient();
  const fields = readApplyFields(formData);
  const invalid = applyInputError(fields);
  if (invalid) return { error: invalid };
  const { vacancyId, fullName, email, gender, lang } = fields;

  const { data: vacancy } = await serviceClient.from("job_vacancies").select("title").eq("id", vacancyId).single();

  const payload: Record<string, unknown> = {
    vacancy_id: vacancyId,
    full_name: fullName,
    email,
    phone: (formData.get("phone") as string) || null,
    message: (formData.get("message") as string) || null,
    experience: (formData.get("experience") as string) || null,
    qualification: (formData.get("qualification") as string) || null,
    address: (formData.get("address") as string) || null,
    cnic: (formData.get("cnic") as string) || null,
    expected_salary: formData.get("expected_salary") ? Number(formData.get("expected_salary")) : null,
    gender,
  };

  const fileFields: Array<[string, string]> = [
    ["cnic_front_image", "cnic_image_url"],
    ["cnic_back_image", "cnic_back_image_url"],
    ["certificate", "certificate_url"],
    ["experience_certificate", "experience_certificate_url"],
    ["cv", "cv_url"],
  ];

  for (const [fieldName, columnName] of fileFields) {
    const file = formData.get(fieldName);
    if (file instanceof File && file.size > 0) {
      const url = await uploadJobDoc(serviceClient, email, fieldName, file);
      if (url) payload[columnName] = url;
    }
  }

  const { data: application, error } = await (serviceClient as any).from("job_applications").insert(payload).select("id").single();
  if (error) return { error: t("sp_apply_failed", lang) };

  if (application) {
    const mail = await sendApplicationReceivedEmail(email, fullName, vacancy?.title ?? "Position", application.id);
    await saveCandidateMessage(application.id, mail, null);
    await logActivity(application.id, "application_received", "Application receive hui.");
  }

  return { success: true };
}

export async function markUnderReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const applicationId = String(formData.get("application_id") ?? "");
  if (!applicationId) return { error: "Missing application id." };

  const { data: changed, error } = await supabase
    .from("job_applications")
    .update({ status: "under_review" })
    .eq("id", applicationId)
    .neq("status", "under_review")
    .select("id");
  if (error) return { error: error.message };
  if (!changed?.length) {
    revalidatePath("/admin/job-applications");
    return { success: true };
  }

  await logActivity(applicationId, "under_review", "Application review mein daali gayi.");

  revalidatePath("/admin/job-applications");
  return { success: true };
}

export async function markEligibility(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const applicationId = String(formData.get("application_id") ?? "");
  const isEligible = formData.get("is_eligible") === "true";
  if (!applicationId) return { error: "Missing application id." };

  const target = isEligible ? "eligible" : "not_eligible";
  const { data: changed, error } = await supabase
    .from("job_applications")
    .update({ is_eligible: isEligible, status: target })
    .eq("id", applicationId)
    .neq("status", target)
    .select("id");
  if (error) return { error: error.message };
  if (!changed?.length) {
    revalidatePath("/admin/job-applications");
    return { success: true };
  }

  const { data: application } = await supabase
    .from("job_applications")
    .select("full_name, email, job_vacancies(title)")
    .eq("id", applicationId)
    .single();
  let notice: string | undefined;
  if (application) {
    const jobTitle = Array.isArray(application.job_vacancies) ? (application.job_vacancies[0] as any)?.title : (application.job_vacancies as any)?.title;
    const mail = await sendEligibilityEmail(application.email, application.full_name, jobTitle ?? "Position", isEligible);
    await saveCandidateMessage(applicationId, mail, await actorId());
    notice = dispatchNotice(mail);
  }

  await logActivity(applicationId, isEligible ? "shortlisted" : "rejected", isEligible ? "Shortlist kiya gaya." : "Screening ke baad reject kiya gaya.");

  revalidatePath("/admin/job-applications");
  return notice ? { success: true, notice } : { success: true };
}

export async function scheduleInterview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const applicationId = String(formData.get("application_id") ?? "");
  const interviewDate = String(formData.get("interview_date") ?? "");
  const interviewMode = (formData.get("interview_mode") as string) || null;
  const interviewLocation = (formData.get("interview_location") as string) || null;
  if (!applicationId || !interviewDate) return { error: "Application aur date zaroori hain." };

  const { data: existing } = await supabase.from("job_applications").select("interview_date, status").eq("id", applicationId).maybeSingle();
  if (isDuplicateInterviewSchedule(existing, interviewDate)) {
    revalidatePath("/admin/job-applications");
    return { success: true };
  }
  const isReschedule = existing?.status === "interview_scheduled" && existing?.interview_date;
  const day = interviewDay(interviewDate);

  let update = supabase
    .from("job_applications")
    .update({ interview_date: interviewDate, status: "interview_scheduled", interview_mode: interviewMode, interview_location: interviewLocation })
    .eq("id", applicationId);
  if (day) update = update.or(`status.neq.interview_scheduled,interview_date.is.null,interview_date.neq.${day}`);
  const { data: changed, error } = await update.select("id");
  if (error) return { error: error.message };
  if (!changed?.length) {
    revalidatePath("/admin/job-applications");
    return { success: true };
  }

  const { data: application } = await supabase
    .from("job_applications")
    .select("full_name, email, job_vacancies(title)")
    .eq("id", applicationId)
    .single();
  let notice: string | undefined;
  if (application) {
    const jobTitle = Array.isArray(application.job_vacancies) ? (application.job_vacancies[0] as any)?.title : (application.job_vacancies as any)?.title;
    const mail = isReschedule
      ? await sendInterviewRescheduledEmail(application.email, application.full_name, jobTitle ?? "Position", interviewDate, interviewLocation)
      : await sendInterviewInvitationEmail(application.email, application.full_name, jobTitle ?? "Position", interviewDate, interviewLocation);
    await saveCandidateMessage(applicationId, mail, await actorId());
    notice = dispatchNotice(mail);
  }

  await logActivity(
    applicationId,
    isReschedule ? "interview_rescheduled" : "interview_scheduled",
    isReschedule ? `Interview reschedule hua: ${interviewDate}` : `Interview schedule hua: ${interviewDate}${interviewMode ? ` (${interviewMode})` : ""}`
  );

  revalidatePath("/admin/job-applications");
  return notice ? { success: true, notice } : { success: true };
}

export async function saveInterviewScore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const applicationId = String(formData.get("application_id") ?? "");
  if (!applicationId) return { error: "Missing application id." };

  const questionScores: { question: string; score: number }[] = [];
  for (let i = 1; i <= 10; i++) {
    const q = formData.get(`q${i}`);
    const s = formData.get(`s${i}`);
    if (q && s) questionScores.push({ question: String(q), score: Number(s) });
  }
  const questionTotal = questionScores.reduce((sum, q) => sum + q.score, 0);

  const behavior = Number(formData.get("behavior_score") ?? 0);
  const attitude = Number(formData.get("attitude_score") ?? 0);
  const communication = Number(formData.get("communication_score") ?? 0);
  const cleanliness = Number(formData.get("cleanliness_score") ?? 0);
  const totalScore = questionTotal + behavior + attitude + communication + cleanliness;
  const recommendation = String(formData.get("recommendation") ?? "reject");

  const { error } = await supabase.from("interview_scores").upsert(
    {
      application_id: applicationId,
      question_scores: questionScores,
      behavior_score: behavior,
      attitude_score: attitude,
      communication_score: communication,
      cleanliness_score: cleanliness,
      total_score: totalScore,
      recommendation,
      notes: (formData.get("notes") as string) || null,
      interviewer_id: user?.id ?? null,
    },
    { onConflict: "application_id" }
  );
  if (error) return { error: error.message };

  const { data: flipped, error: statusError } = await supabase
    .from("job_applications")
    .update({ status: "scored" })
    .eq("id", applicationId)
    .neq("status", "scored")
    .select("id");
  if (statusError) return { error: statusError.message };

  if (!flipped?.length) {
    revalidatePath("/admin/job-applications");
    return { success: true };
  }

  const { data: application } = await supabase
    .from("job_applications")
    .select("full_name, email, job_vacancies(title)")
    .eq("id", applicationId)
    .single();
  let notice: string | undefined;
  if (application) {
    const jobTitle = Array.isArray(application.job_vacancies) ? (application.job_vacancies[0] as any)?.title : (application.job_vacancies as any)?.title;
    const mail = await sendInterviewResultEmail(application.email, application.full_name, jobTitle ?? "Position", recommendation === "hire");
    await saveCandidateMessage(applicationId, mail, user?.id ?? null);
    notice = dispatchNotice(mail);
  }

  await logActivity(applicationId, "interview_completed", `Interview complete hua - score: ${totalScore}, decision: ${recommendation}`);

  revalidatePath("/admin/job-applications");
  return notice ? { success: true, notice } : { success: true };
}

export async function sendJobOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const applicationId = String(formData.get("application_id") ?? "");
  const designation = String(formData.get("designation") ?? "").trim();
  const proposedSalary = formData.get("proposed_salary") ? Number(formData.get("proposed_salary")) : null;
  const branchId = (formData.get("branch_id") as string) || null;
  const offerMessage = (formData.get("offer_message") as string) || null;
  const expiryDate = (formData.get("expiry_date") as string) || null;
  if (!applicationId || !designation) return { error: "Application aur designation zaroori hain." };

  const { data: current } = await supabase.from("job_applications").select("status").eq("id", applicationId).maybeSingle();
  if (current?.status === "offered") {
    revalidatePath("/admin/job-applications");
    return { success: true };
  }

  const { data: offer, error } = await supabase
    .from("job_offers")
    .insert({
      application_id: applicationId,
      designation,
      proposed_salary: proposedSalary,
      branch_id: branchId,
      offer_message: offerMessage,
      expiry_date: expiryDate,
    })
    .select("offer_token")
    .single();
  if (error) return { error: error.message };

  await supabase.from("job_applications").update({ status: "offered" }).eq("id", applicationId);

  let emailWarning: string | undefined;
  if (offer) {
    try {
      const { data: application } = await supabase.from("job_applications").select("full_name, email").eq("id", applicationId).single();
      let branchName: string | null = null;
      if (branchId) {
        const { data: branch } = await supabase.from("branches").select("name").eq("id", branchId).single();
        branchName = branch?.name ?? null;
      }
      if (application) {
        const mail = await sendJobOfferEmail(application.email, application.full_name, offer.offer_token, designation, {
          proposedSalary,
          branchName,
          offerMessage,
          expiryDate,
        });
        await saveCandidateMessage(applicationId, mail, await actorId());
        emailWarning = dispatchNotice(mail);
      }
    } catch (emailErr) {
      console.error("Offer email failed (offer record was still saved):", emailErr);
      emailWarning = "Offer save ho gayi hai, lekin email bhejne mein masla hua - candidate ko link manually bhej dein.";
    }
  }

  await logActivity(applicationId, "offer_sent", `Offer bheji gayi: ${designation}${expiryDate ? ` (deadline: ${expiryDate})` : ""}`);

  revalidatePath("/admin/job-applications");
  return emailWarning ? { success: true, error: emailWarning } : { success: true };
}

// Standalone resend - re-sends the EXISTING offer (same token/link,
// no duplicate offer record) in case the first email attempt failed
// or the candidate simply lost it.
export async function resendJobOfferEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const applicationId = String(formData.get("application_id") ?? "");
  if (!applicationId) return { error: "Missing application id." };

  const { data: offer } = await supabase
    .from("job_offers")
    .select("offer_token, designation, proposed_salary, branch_id, offer_message, expiry_date")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!offer) return { error: "Is application ke liye koi offer nahi mili." };

  const { data: application } = await supabase.from("job_applications").select("full_name, email").eq("id", applicationId).single();
  if (!application) return { error: "Application not found." };

  let branchName: string | null = null;
  if (offer.branch_id) {
    const { data: branch } = await supabase.from("branches").select("name").eq("id", offer.branch_id).single();
    branchName = branch?.name ?? null;
  }

  let notice: string | undefined;
  try {
    const mail = await sendJobOfferEmail(application.email, application.full_name, offer.offer_token, offer.designation, {
      proposedSalary: offer.proposed_salary,
      branchName,
      offerMessage: offer.offer_message,
      expiryDate: offer.expiry_date,
    });
    await saveCandidateMessage(applicationId, mail, await actorId());
    notice = dispatchNotice(mail);
  } catch (emailErr) {
    console.error("Resend offer email failed:", emailErr);
    return { error: `Email masla: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}` };
  }

  await logActivity(applicationId, "offer_resent", "Offer email dobara bheji gayi.");

  return notice ? { success: true, notice } : { success: true };
}

export async function respondToOffer(token: string, accept: boolean): Promise<{ error?: string }> {
  const serviceClient = createServiceClient();

  const { data: offer } = await serviceClient
    .from("job_offers")
    .select("id, application_id")
    .eq("offer_token", token)
    .single();
  if (!offer) return { error: "Offer not found." };

  const next = accept ? "accepted" : "rejected";
  const { data: changed } = await serviceClient
    .from("job_applications")
    .update({ status: next })
    .eq("id", offer.application_id)
    .neq("status", next)
    .select("id");
  if (!changed?.length) return {};

  await serviceClient.from("job_offers").update({ status: accept ? "accepted" : "rejected", responded_at: new Date().toISOString() }).eq("id", offer.id);
  await logActivity(offer.application_id, accept ? "offer_accepted" : "offer_declined", accept ? "Candidate ne offer accept kar li." : "Candidate ne offer decline kar di.");

  return {};
}

export async function createOfficialLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const serviceClient = createServiceClient();
  const applicationId = String(formData.get("application_id") ?? "");
  const officialEmail = String(formData.get("official_email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!applicationId) return { error: "Missing application id." };
  if (!officialEmail) return { error: "Official email zaroori hai." };
  if (!password || password.length < 6) return { error: "Password kam az kam 6 characters ka hona chahiye." };

  const loaded = await serviceClient
    .from("job_applications")
    .select("full_name, email, vacancy_id, gender, status, created_profile_id")
    .eq("id", applicationId)
    .single();
  let application = loaded.data;
  if (loaded.error && /gender/i.test(loaded.error.message)) {
    const again = await serviceClient
      .from("job_applications")
      .select("full_name, email, vacancy_id, status, created_profile_id")
      .eq("id", applicationId)
      .single();
    if (again.error || !again.data) return { error: again.error?.message ?? "Application not found." };
    application = { ...again.data, gender: null };
  } else if (loaded.error || !application) {
    return { error: loaded.error?.message ?? "Application not found." };
  }
  if (application.status === "joined" || application.created_profile_id) {
    return { success: true };
  }

  const { data: latestOffer } = await serviceClient
    .from("job_offers")
    .select("designation, branch_id, proposed_salary")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: authUser, error: createError } = await serviceClient.auth.admin.createUser({
    email: officialEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: application.full_name, role: "sales_staff" },
  });
  if (createError) return { error: createError.message };
  if (!authUser.user) return { error: "Account create nahi ho saka." };

  const { data: org } = latestOffer?.branch_id
    ? await serviceClient.from("branches").select("organization_id").eq("id", latestOffer.branch_id).single()
    : { data: null };
  if (!org?.organization_id) return { error: "Is staff ke liye organization/branch assign nahi hai." };

  await (serviceClient as any).from("profiles").upsert({
    id: authUser.user.id,
    full_name: application.full_name,
    role: "sales_staff",
    branch_id: latestOffer?.branch_id ?? null,
    organization_id: org.organization_id,
    is_active: true,
  });

  const hiredGender = staffGenderOrNull(application.gender);
  await serviceClient.from("staff_details").insert({
    profile_id: authUser.user.id,
    designation: latestOffer?.designation ?? null,
    basic_salary: latestOffer?.proposed_salary ?? null,
    ...(hiredGender ? { gender: hiredGender } : {}),
  });

  await serviceClient.from("job_applications").update({ status: "joined", created_profile_id: authUser.user.id }).eq("id", applicationId);

  if (application.vacancy_id) {
    const { data: vacancy } = await serviceClient.from("job_vacancies").select("seats_total, seats_filled").eq("id", application.vacancy_id).single();
    if (vacancy) {
      const newFilled = (vacancy.seats_filled ?? 0) + 1;
      const updates: Record<string, unknown> = { seats_filled: newFilled };
      if (newFilled >= (vacancy.seats_total ?? 1)) updates.is_open = false;
      await serviceClient.from("job_vacancies").update(updates).eq("id", application.vacancy_id);
    }
  }

  const who = await actorId();
  const loginToOfficial = await sendOfficialLoginEmail(officialEmail, application.full_name, officialEmail, password);
  const loginToPersonal = await sendOfficialLoginEmail(application.email, application.full_name, officialEmail, password);
  await saveCandidateMessage(applicationId, { ...loginToOfficial, body: redactSecrets(loginToOfficial.body, [password]) }, who);
  if (application.email.trim().toLowerCase() !== officialEmail) {
    await saveCandidateMessage(applicationId, { ...loginToPersonal, body: redactSecrets(loginToPersonal.body, [password]) }, who);
  }

  await logActivity(applicationId, "joined", `Official login ban gaya: ${officialEmail}`);

  revalidatePath("/admin/job-applications");
  revalidatePath("/admin/job-vacancies");
  const notice = dispatchNotice(loginToOfficial) ?? (application.email.trim().toLowerCase() !== officialEmail ? dispatchNotice(loginToPersonal) : undefined);
  return notice ? { success: true, notice } : { success: true };
}
