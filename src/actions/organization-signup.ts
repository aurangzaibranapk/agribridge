"use server";

import { createServiceClient } from "@/lib/supabase/service";

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

