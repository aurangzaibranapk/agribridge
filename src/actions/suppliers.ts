"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function uploadSupplierDocument(file: FormDataEntryValue | null, prefix: "cnic" | "ntn") {
  if (!(file instanceof File) || file.size === 0) return { url: null as string | null };

  // Creating/updating a supplier must not depend on the service-role key.
  // Some CloudLinux deployments intentionally expose only the authenticated
  // Supabase session.  The elevated client is needed only when a document is
  // actually uploaded, so build it lazily and return a useful message when
  // that optional server configuration is missing.
  let serviceClient: ReturnType<typeof createServiceClient>;
  try {
    serviceClient = createServiceClient();
  } catch {
    return { url: null, error: "Document upload configuration missing hai. Supplier ko document ke baghair save karein ya server service key set karein." };
  }

  const path = `${Date.now()}-${prefix}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const { error } = await serviceClient.storage.from("supplier-documents").upload(path, file);
  if (error) return { url: null, error: `Document upload nahi hua: ${error.message}` };
  const { data } = serviceClient.storage.from("supplier-documents").getPublicUrl(path);
  return { url: data.publicUrl };
}

async function getRoleContext(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,organization_id,branch_id,is_active")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";
  return { user, profile, isUnrestricted };
}

export async function saveSupplier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const context = await getRoleContext(supabase);
  if (!context.user) return { error: "Session expire ho gayi hai. Dobara login karein." };
  if (!context.profile?.is_active) return { error: "Aap ka account active nahi hai." };
  if (!context.isUnrestricted) return { error: "Sirf Admin/Owner naya supplier bana sakta hai." };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Supplier name is required." };

  const cnicUpload = await uploadSupplierDocument(formData.get("cnic_document"), "cnic");
  if (cnicUpload.error) return { error: cnicUpload.error };
  const ntnUpload = await uploadSupplierDocument(formData.get("ntn_document"), "ntn");
  if (ntnUpload.error) return { error: ntnUpload.error };

  const payload = {
    organization_id: context.profile.organization_id,
    branch_id: context.profile.branch_id || null,
    name,
    company_name: (formData.get("company_name") as string) || null,
    contact_person: (formData.get("contact_person") as string) || null,
    phone_number: (formData.get("phone_number") as string) || null,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    credit_limit: formData.get("credit_limit") ? Number(formData.get("credit_limit")) : 0,
    cnic_number: (formData.get("cnic_number") as string) || null,
    cnic_document_url: cnicUpload.url,
    ntn_number: (formData.get("ntn_number") as string) || null,
    ntn_document_url: ntnUpload.url,
    tax_status: (formData.get("tax_status") as string) || "non_filer",
    bank_name: (formData.get("bank_name") as string) || null,
    bank_account_title: (formData.get("bank_account_title") as string) || null,
    bank_account_number: (formData.get("bank_account_number") as string) || null,
    bank_iban: (formData.get("bank_iban") as string) || null,
  };
  // Use the signed-in Admin/Owner session. The suppliers RLS policy validates
  // both the tenant and role, while avoiding an unnecessary service-key
  // dependency on cPanel.
  const { data: supplier, error } = await supabase.from("suppliers").insert(payload).select("id").single();
  if (error) return { error: `Supplier save nahi hua: ${error.message}` };

  await logAudit({ actionType: "create", module: "suppliers", recordId: supplier?.id, recordLabel: name, description: "Naya supplier add hua." });

  revalidatePath("/admin/suppliers");
  return { success: true };
}

export async function updateSupplier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const context = await getRoleContext(supabase);
  if (!context.user) return { error: "Session expire ho gayi hai. Dobara login karein." };
  if (!context.profile?.is_active) return { error: "Aap ka account active nahi hai." };
  if (!context.isUnrestricted) return { error: "Sirf Admin/Owner supplier update kar sakta hai." };
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { error: "Missing supplier id." };
  if (!name) return { error: "Supplier name is required." };

  const updates: Record<string, unknown> = {
    name,
    company_name: (formData.get("company_name") as string) || null,
    contact_person: (formData.get("contact_person") as string) || null,
    phone_number: (formData.get("phone_number") as string) || null,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    credit_limit: formData.get("credit_limit") ? Number(formData.get("credit_limit")) : 0,
    cnic_number: (formData.get("cnic_number") as string) || null,
    ntn_number: (formData.get("ntn_number") as string) || null,
    tax_status: (formData.get("tax_status") as string) || "non_filer",
    bank_name: (formData.get("bank_name") as string) || null,
    bank_account_title: (formData.get("bank_account_title") as string) || null,
    bank_account_number: (formData.get("bank_account_number") as string) || null,
    bank_iban: (formData.get("bank_iban") as string) || null,
  };

  const cnicUpload = await uploadSupplierDocument(formData.get("cnic_document"), "cnic");
  if (cnicUpload.error) return { error: cnicUpload.error };
  if (cnicUpload.url) updates.cnic_document_url = cnicUpload.url;

  const ntnUpload = await uploadSupplierDocument(formData.get("ntn_document"), "ntn");
  if (ntnUpload.error) return { error: ntnUpload.error };
  if (ntnUpload.url) updates.ntn_document_url = ntnUpload.url;

  const { error } = await supabase
    .from("suppliers")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", context.profile.organization_id);
  if (error) return { error: `Supplier update nahi hua: ${error.message}` };

  await logAudit({ actionType: "update", module: "suppliers", recordId: id, recordLabel: name, description: "Supplier update hua." });

  revalidatePath("/admin/suppliers");
  return { success: true };
}

export async function updateSupplierStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return { error: "Missing supplier id." };
  if (!["active", "inactive", "suspended"].includes(status)) return { error: "Invalid status." };

  const { error } = await supabase
    .from("suppliers")
    .update({ status, is_active: status === "active" })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ actionType: "update", module: "suppliers", recordId: id, description: `Supplier status: ${status}` });

  revalidatePath("/admin/suppliers");
  return { success: true };
}

export async function deleteSupplier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { isUnrestricted } = await getRoleContext(supabase);
  if (!isUnrestricted) return { error: "Sirf Admin/Owner supplier delete kar sakta hai." };

  const id = String(formData.get("id"));
  const { data: supplier } = await supabase.from("suppliers").select("name").eq("id", id).single();

  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ actionType: "delete", module: "suppliers", recordId: id, recordLabel: supplier?.name, description: "Supplier delete hua." });

  revalidatePath("/admin/suppliers");
  return { success: true };
}
