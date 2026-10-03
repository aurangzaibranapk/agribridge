"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type OrganizationSignupState = { error?: string; success?: boolean };

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function submitOrganizationSignup(
  _prev: OrganizationSignupState,
  formData: FormData
): Promise<OrganizationSignupState> {
  // Simple honeypot for automated submissions. Real visitors never see or
  // fill this field; rejected requests never reach the database.
  if (clean(formData.get("website_url"))) return { success: true };

  const companyName = clean(formData.get("company_name"));
  const adminName = clean(formData.get("admin_name"));
  const adminEmail = clean(formData.get("admin_email")).toLowerCase();
  const adminPhone = clean(formData.get("admin_phone")) || null;
  const customDomain = clean(formData.get("custom_domain")).toLowerCase() || null;
  const subscriptionPlan = clean(formData.get("subscription_plan")) || "starter";

  if (companyName.length < 2) return { error: "Company name is required." };
  if (adminName.length < 2) return { error: "Your name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return { error: "Valid email is required." };
  if (customDomain && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(customDomain)) {
    return { error: "Custom domain format is invalid." };
  }
  if (!["starter", "business", "enterprise"].includes(subscriptionPlan)) return { error: "Invalid plan." };

  const service = createServiceClient();
  const { data: duplicate } = await service
    .from("organization_signup_requests")
    .select("id")
    .eq("admin_email", adminEmail)
    .eq("status", "pending")
    .maybeSingle();
  if (duplicate) return { error: "A request for this email is already pending." };

  const { error } = await service.from("organization_signup_requests").insert({
    company_name: companyName,
    admin_name: adminName,
    admin_email: adminEmail,
    admin_phone: adminPhone,
    custom_domain: customDomain,
    subscription_plan: subscriptionPlan,
  });
  if (error) return { error: "Request save nahi ho saki. Dobara try karein." };
  return { success: true };
}

async function requireSuperAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") return { supabase, user: null, error: "Only a Super Admin can review requests." };
  return { supabase, user, error: null };
}

export async function reviewOrganizationSignup(_prev: OrganizationSignupState, formData: FormData): Promise<OrganizationSignupState> {
  const auth = await requireSuperAdmin();
  if (auth.error || !auth.user) return { error: auth.error ?? "Not authorized." };
  const requestId = clean(formData.get("request_id"));
  const decision = clean(formData.get("decision"));
  if (!requestId || !["approve", "reject"].includes(decision)) return { error: "Invalid review request." };

  const service = createServiceClient();
  const { data: request, error: requestError } = await service
    .from("organization_signup_requests")
    .select("id, company_name, admin_name, admin_email, admin_phone, custom_domain, subscription_plan, status")
    .eq("id", requestId)
    .eq("status", "pending")
    .single();
  if (requestError || !request) return { error: "Request nahi mili ya pehle review ho chuki hai." };

  if (decision === "reject") {
    await service.from("organization_signup_requests").update({ status: "rejected", reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() }).eq("id", request.id);
    revalidatePath("/admin/platform/requests");
    return { success: true };
  }

  const slug = request.company_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `tenant-${request.id.slice(0, 8)}`;
  const { data: org, error: orgError } = await service.from("organizations").insert({
    name: request.company_name,
    brand_name: request.company_name,
    slug,
    custom_domain: request.custom_domain,
    subscription_plan: request.subscription_plan,
    subscription_status: "trial",
  }).select("id").single();
  if (orgError || !org) return { error: `Organization create nahi hui: ${orgError?.message ?? "unknown error"}` };

  const { error: branchError } = await service.from("branches").insert({ organization_id: org.id, name: "Main Branch", is_main_branch: true });
  if (branchError) return { error: `Main branch create nahi hui: ${branchError.message}` };
  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(request.admin_email, { data: { full_name: request.admin_name } });
  if (inviteError || !invited?.user) return { error: `Admin invite nahi bheja ja saka: ${inviteError?.message ?? "unknown error"}` };
  const { error: profileError } = await service.from("profiles").update({ role: "super_admin", organization_id: org.id, phone_number: request.admin_phone }).eq("id", invited.user.id);
  if (profileError) return { error: `Admin profile setup nahi hui: ${profileError.message}` };

  await service.from("organization_signup_requests").update({ status: "approved", reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() }).eq("id", request.id);
  revalidatePath("/admin/platform");
  revalidatePath("/admin/platform/requests");
  return { success: true };
}
