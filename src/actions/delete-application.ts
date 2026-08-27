"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// Deletes a test/unwanted Job Application. If it was "joined" (has a
// created_profile_id), the REAL Supabase Auth account + profile +
// staff_details are also removed - not just the application record -
// otherwise a "ghost" login would remain usable.
export async function deleteApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const applicationId = String(formData.get("application_id") ?? "");
  if (!applicationId) return { error: "Missing application id." };

  const { data: application } = await supabase
    .from("job_applications")
    .select("full_name, created_profile_id, vacancy_id")
    .eq("id", applicationId)
    .single();
  if (!application) return { error: "Application not found." };

  if (application.created_profile_id) {
    await serviceClient.from("staff_details").delete().eq("profile_id", application.created_profile_id);
    await serviceClient.from("profiles").delete().eq("id", application.created_profile_id);
    await serviceClient.auth.admin.deleteUser(application.created_profile_id);
  }

  await supabase.from("job_offers").delete().eq("application_id", applicationId);
  await supabase.from("interview_scores").delete().eq("application_id", applicationId);
  await supabase.from("application_activity_log").delete().eq("application_id", applicationId);

  const { error } = await supabase.from("job_applications").delete().eq("id", applicationId);
  if (error) return { error: error.message };

  if (application.vacancy_id && application.created_profile_id) {
    const { data: vacancy } = await supabase.from("job_vacancies").select("seats_filled").eq("id", application.vacancy_id).single();
    if (vacancy && (vacancy.seats_filled ?? 0) > 0) {
      await supabase.from("job_vacancies").update({ seats_filled: vacancy.seats_filled - 1 }).eq("id", application.vacancy_id);
    }
  }

  await logAudit({ actionType: "delete", module: "job_applications", recordId: applicationId, recordLabel: application.full_name, description: "Job application delete hui (test/unwanted)." });

  revalidatePath("/admin/job-applications");
  return { success: true };
}