"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function getRoleContext(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";
  return { isUnrestricted };
}

export async function saveSupplier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Supplier name is required." };

  let cnicDocUrl: string | null = null;
  const cnicDoc = formData.get("cnic_document");
  if (cnicDoc instanceof File && cnicDoc.size > 0) {
    const path = `${Date.now()}-cnic-${cnicDoc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("supplier-documents").upload(path, cnicDoc);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("supplier-documents").getPublicUrl(path);
      cnicDocUrl = data.publicUrl;
    }
  }

  let ntnDocUrl: string | null = null;
  const ntnDoc = formData.get("ntn_document");
  if (ntnDoc instanceof File && ntnDoc.size > 0) {
    const path = `${Date.now()}-ntn-${ntnDoc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("supplier-documents").upload(path, ntnDoc);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("supplier-documents").getPublicUrl(path);
      ntnDocUrl = data.publicUrl;
    }
  }

  const payload = {
    name,
    company_name: (formData.get("company_name") as string) || null,
    contact_person: (formData.get("contact_person") as string) || null,
    phone_number: (formData.get("phone_number") as string) || null,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    credit_limit: formData.get("credit_limit") ? Number(formData.get("credit_limit")) : 0,
    cnic_number: (formData.get("cnic_number") as string) || null,
    cnic_document_url: cnicDocUrl,
    ntn_number: (formData.get("ntn_number") as string) || null,
    ntn_document_url: ntnDocUrl,
    tax_status: (formData.get("tax_status") as string) || "non_filer",
    bank_name: (formData.get("bank_name") as string) || null,
    bank_account_title: (formData.get("bank_account_title") as string) || null,
    bank_account_number: (formData.get("bank_account_number") as string) || null,
    bank_iban: (formData.get("bank_iban") as string) || null,
  };
  const { data: supplier, error } = await supabase.from("suppliers").insert(payload).select("id").single();
  if (error) return { error: error.message };

  await logAudit({ actionType: "create", module: "suppliers", recordId: supplier?.id, recordLabel: name, description: "Naya supplier add hua." });

  revalidatePath("/admin/suppliers");
  return { success: true };
}

export async function updateSupplier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
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

  const cnicDoc = formData.get("cnic_document");
  if (cnicDoc instanceof File && cnicDoc.size > 0) {
    const path = `${Date.now()}-cnic-${cnicDoc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("supplier-documents").upload(path, cnicDoc);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("supplier-documents").getPublicUrl(path);
      updates.cnic_document_url = data.publicUrl;
    }
  }

  const ntnDoc = formData.get("ntn_document");
  if (ntnDoc instanceof File && ntnDoc.size > 0) {
    const path = `${Date.now()}-ntn-${ntnDoc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("supplier-documents").upload(path, ntnDoc);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("supplier-documents").getPublicUrl(path);
      updates.ntn_document_url = data.publicUrl;
    }
  }

  const { error } = await supabase.from("suppliers").update(updates).eq("id", id);
  if (error) return { error: error.message };

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