"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
export interface ActionState {
  error?: string;
  success?: boolean;
}
export async function recordSupplierPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const supplierId = String(formData.get("supplier_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentDate = String(formData.get("payment_date") ?? new Date().toISOString().slice(0, 10));
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  if (!supplierId) return { error: "Missing supplier id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  let slipUrl: string | null = null;
  const slip = formData.get("slip");
  if (slip instanceof File && slip.size > 0) {
    const path = `${Date.now()}-slip-${slip.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("payment-slips").upload(path, slip);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("payment-slips").getPublicUrl(path);
      slipUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("supplier_payments").insert({
    supplier_id: supplierId,
    amount,
    payment_date: paymentDate,
    payment_method: paymentMethod,
    notes,
    slip_url: slipUrl,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  const { data: supplier } = await supabase.from("suppliers").select("current_payable").eq("id", supplierId).single();
  const newPayable = Math.max(0, Number(supplier?.current_payable ?? 0) - amount);
  await supabase.from("suppliers").update({ current_payable: newPayable }).eq("id", supplierId);
  revalidatePath(`/admin/suppliers/${supplierId}/statement`);
  revalidatePath("/admin/suppliers");
  return { success: true };
}