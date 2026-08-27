"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Onboards a brand-new client organization: creates the tenant row, a
// default "Main Branch", and invites their first user as super_admin
// (scoped to only their new organization - not Al Rana Traders' data).
// Restricted to super_admin only (checked below) since anyone who could
// call this could otherwise create unlimited free tenants.
export async function onboardNewOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user: callingUser },
  } = await supabase.auth.getUser();
  if (!callingUser) return { error: "Not authenticated." };

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", callingUser.id).single();
  if (callerProfile?.role !== "super_admin") {
    return { error: "Only a Super Admin can onboard a new client organization." };
  }

  const orgName = String(formData.get("org_name") ?? "").trim();
  const adminEmail = String(formData.get("admin_email") ?? "").trim();
  const adminName = String(formData.get("admin_name") ?? "").trim();
  const adminPhone = (formData.get("admin_phone") as string) || null;

  if (!orgName) return { error: "Company name is required." };
  if (!adminEmail || !adminEmail.includes("@")) return { error: "A valid admin email is required." };
  if (!adminName) return { error: "Admin full name is required." };

  const slug = slugify(orgName);

  const { data: org, error: orgError } = await serviceClient
    .from("organizations")
    .insert({ name: orgName, slug })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: `Failed to create organization: ${orgError?.message}` };
  }

  const { error: branchError } = await serviceClient.from("branches").insert({
    organization_id: org.id,
    name: "Main Branch",
    is_main_branch: true,
  });

  if (branchError) {
    return { error: `Failed to create default branch: ${branchError.message}` };
  }

  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(adminEmail, {
    data: { full_name: adminName },
  });

  if (inviteError || !invited?.user) {
    return { error: `Failed to invite admin: ${inviteError?.message ?? "unknown error"}` };
  }

  // fn_handle_new_user() defaults every non-first signup to sales_staff -
  // override that here so this person is a full super_admin of their
  // OWN organization only (their profile.organization_id makes this
  // scoping automatic everywhere else in the schema).
  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({
      role: "super_admin",
      organization_id: org.id,
      phone_number: adminPhone,
    })
    .eq("id", invited.user.id);

  if (profileError) {
    return { error: `Organization created, but failed to set up admin profile: ${profileError.message}` };
  }

  revalidatePath("/admin/platform");
  return { success: true };
}
export async function toggleOrganizationActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const {
    data: { user: callingUser },
  } = await supabase.auth.getUser();
  if (!callingUser) return { error: "Not authenticated." };

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", callingUser.id).single();
  if (callerProfile?.role !== "super_admin") {
    return { error: "Only a Super Admin can change an organization's status." };
  }

  const orgId = String(formData.get("org_id") ?? "");
  const newStatus = formData.get("is_active") === "true";

  if (!orgId) return { error: "Missing organization id." };

  const { error } = await supabase.from("organizations").update({ is_active: newStatus }).eq("id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/admin/platform");
  return { success: true };
}
export async function deleteOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const {
    data: { user: callingUser },
  } = await supabase.auth.getUser();
  if (!callingUser) return { error: "Not authenticated." };

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", callingUser.id).single();
  if (callerProfile?.role !== "super_admin") {
    return { error: "Only a Super Admin can delete an organization." };
  }

  const orgId = String(formData.get("org_id") ?? "");
  const orgSlug = String(formData.get("org_slug") ?? "");

  if (!orgId) return { error: "Missing organization id." };
  if (orgSlug === "al-rana-traders") {
    return { error: "Cannot delete the main Al Rana Traders organization." };
  }

  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/admin/platform");
  return { success: true };
}