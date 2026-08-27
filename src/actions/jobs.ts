"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
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
  const vacancyId = String(formData.get("vacancy_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!vacancyId || !fullName || !email) return { error: "Naam, email, aur vacancy zaroori hain." };

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

  const { data: application, error } = await serviceClient.from("job_applications").insert(payload).select("id").single();
  if (error) return { error: error.message };

  if (application) {
    await sendApplicationReceivedEmail(email, fullName, vacancy?.title ?? "Position", application.id);
    await logActivity(application.id, "application_received", "Application receive hui.");
  }

  return { success: true };
}

export async function markUnderReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const applicationId = String(formData.get("application_id") ?? "");
  if (!applicationId) return { error: "Missing application id." };

  const { error } = await supabase.from("job_applications").update({ status: "under_review" }).eq("id", applicationId);
  if (error) return { error: error.message };

  await logActivity(applicationId, "under_review", "Application review mein daali gayi.");

  revalidatePath("/admin/job-applications");
  return { success: true };
}

export async function markEligibility(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const applicationId = String(formData.get("application_id") ?? "");
  const isEligible = formData.get("is_eligible") === "true";
  if (!applicationId) return { error: "Missing application id." };

  const { error } = await supabase
    .from("job_applications")
    .update({ is_eligible: isEligible, status: isEligible ? "eligible" : "not_eligible" })
    .eq("id", applicationId);
  if (error) return { error: error.message };

  const { data: application } = await supabase
    .from("job_applications")
    .select("full_name, email, job_vacancies(title)")
    .eq("id", applicationId)
    .single();
  if (application) {
    const jobTitle = Array.isArray(application.job_vacancies) ? (application.job_vacancies[0] as any)?.title : (application.job_vacancies as any)?.title;
    await sendEligibilityEmail(application.email, application.full_name, jobTitle ?? "Position", isEligible);
  }

  await logActivity(applicationId, isEligible ? "shortlisted" : "rejected", isEligible ? "Shortlist kiya gaya." : "Screening ke baad reject kiya gaya.");

  revalidatePath("/admin/job-applications");
  return { success: true };
}

export async function scheduleInterview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const applicationId = String(formData.get("application_id") ?? "");
  const interviewDate = String(formData.get("interview_date") ?? "");
  const interviewMode = (formData.get("interview_mode") as string) || null;
  const interviewLocation = (formData.get("interview_location") as string) || null;
  if (!applicationId || !interviewDate) return { error: "Application aur date zaroori hain." };

  const { data: existing } = await supabase.from("job_applications").select("interview_date, status").eq("id", applicationId).single();
  const isReschedule = existing?.status === "interview_scheduled" && existing?.interview_date;

  const { error } = await supabase
    .from("job_applications")
    .update({ interview_date: interviewDate, status: "interview_scheduled", interview_mode: interviewMode, interview_location: interviewLocation })
    .eq("id", applicationId);
  if (error) return { error: error.message };

  const { data: application } = await supabase
    .from("job_applications")
    .select("full_name, email, job_vacancies(title)")
    .eq("id", applicationId)
    .single();
  if (application) {
    const jobTitle = Array.isArray(application.job_vacancies) ? (application.job_vacancies[0] as any)?.title : (application.job_vacancies as any)?.title;
    if (isReschedule) {
      await sendInterviewRescheduledEmail(application.email, application.full_name, jobTitle ?? "Position", interviewDate);
    } else {
      await sendInterviewInvitationEmail(application.email, application.full_name, jobTitle ?? "Position", interviewDate);
    }
  }

  await logActivity(
    applicationId,
    isReschedule ? "interview_rescheduled" : "interview_scheduled",
    isReschedule ? `Interview reschedule hua: ${interviewDate}` : `Interview schedule hua: ${interviewDate}${interviewMode ? ` (${interviewMode})` : ""}`
  );

  revalidatePath("/admin/job-applications");
  return { success: true };
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

  await supabase.from("job_applications").update({ status: "scored" }).eq("id", applicationId);

  const { data: application } = await supabase
    .from("job_applications")
    .select("full_name, email, job_vacancies(title)")
    .eq("id", applicationId)
    .single();
  if (application) {
    const jobTitle = Array.isArray(application.job_vacancies) ? (application.job_vacancies[0] as any)?.title : (application.job_vacancies as any)?.title;
    await sendInterviewResultEmail(application.email, application.full_name, jobTitle ?? "Position", recommendation === "hire");
  }

  await logActivity(applicationId, "interview_completed", `Interview complete hua - score: ${totalScore}, decision: ${recommendation}`);

  revalidatePath("/admin/job-applications");
  return { success: true };
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
        await sendJobOfferEmail(application.email, application.full_name, offer.offer_token, designation, {
          proposedSalary,
          branchName,
          offerMessage,
          expiryDate,
        });
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

  try {
    await sendJobOfferEmail(application.email, application.full_name, offer.offer_token, offer.designation, {
      proposedSalary: offer.proposed_salary,
      branchName,
      offerMessage: offer.offer_message,
      expiryDate: offer.expiry_date,
    });
  } catch (emailErr) {
    console.error("Resend offer email failed:", emailErr);
     return { error: `Email masla: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}` };
  }

  await logActivity(applicationId, "offer_resent", "Offer email dobara bheji gayi.");

  return { success: true };
}

export async function respondToOffer(token: string, accept: boolean): Promise<{ error?: string }> {
  const serviceClient = createServiceClient();

  const { data: offer } = await serviceClient
    .from("job_offers")
    .select("id, application_id")
    .eq("offer_token", token)
    .single();
  if (!offer) return { error: "Offer not found." };

  if (!accept) {
    await serviceClient.from("job_offers").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", offer.id);
    await serviceClient.from("job_applications").update({ status: "rejected" }).eq("id", offer.application_id);
    await logActivity(offer.application_id, "offer_declined", "Candidate ne offer decline kar di.");
    return {};
  }

  await serviceClient.from("job_offers").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", offer.id);
  await serviceClient.from("job_applications").update({ status: "accepted" }).eq("id", offer.application_id);
  await logActivity(offer.application_id, "offer_accepted", "Candidate ne offer accept kar li.");

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

  const { data: application } = await serviceClient
    .from("job_applications")
    .select("full_name, email, vacancy_id")
    .eq("id", applicationId)
    .single();
  if (!application) return { error: "Application not found." };

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

  const { data: org } = await serviceClient.from("organizations").select("id").limit(1).single();

  await serviceClient.from("profiles").upsert({
    id: authUser.user.id,
    full_name: application.full_name,
    role: "sales_staff",
    branch_id: latestOffer?.branch_id ?? null,
    organization_id: org?.id ?? null,
    is_active: true,
  });

  await serviceClient.from("staff_details").insert({
    profile_id: authUser.user.id,
    designation: latestOffer?.designation ?? null,
    basic_salary: latestOffer?.proposed_salary ?? null,
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

  await sendOfficialLoginEmail(officialEmail, application.full_name, officialEmail, password);
  await sendOfficialLoginEmail(application.email, application.full_name, officialEmail, password);

  await logActivity(applicationId, "joined", `Official login ban gaya: ${officialEmail}`);

  revalidatePath("/admin/job-applications");
  revalidatePath("/admin/job-vacancies");
  return { success: true };
}