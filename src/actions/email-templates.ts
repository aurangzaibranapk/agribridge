"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function saveEmailTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const templateKey = String(formData.get("template_key") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("body_html") ?? "").trim();
  if (!templateKey) return { error: "Missing template key." };
  if (!subject || !bodyHtml) return { error: "Subject aur body zaroori hain." };

  const { error } = await supabase.from("email_templates").upsert(
    {
      template_key: templateKey,
      template_name: String(formData.get("template_name") ?? templateKey),
      subject,
      body_html: bodyHtml,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "template_key" }
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/email-templates");
  return { success: true };
}