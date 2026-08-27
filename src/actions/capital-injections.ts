"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function recordCapitalInjection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const sourceType = String(formData.get("source_type") ?? "");
  const sourceName = (formData.get("source_name") as string) || null;
  const amount = Number(formData.get("amount") ?? 0);
  const injectionDate = String(formData.get("injection_date") ?? new Date().toISOString().slice(0, 10));
  const notes = (formData.get("notes") as string) || null;

  if (!sourceType) return { error: "Source Type select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  let documentUrl: string | null = null;
  const doc = formData.get("document");
  if (doc instanceof File && doc.size > 0) {
    const path = `${Date.now()}-${doc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("expense-documents").upload(path, doc);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("expense-documents").getPublicUrl(path);
      documentUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("capital_injections").insert({
    source_type: sourceType,
    source_name: sourceName,
    amount,
    injection_date: injectionDate,
    document_url: documentUrl,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/master-dashboard");
  return { success: true };
}