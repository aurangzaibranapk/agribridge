"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const STAFF_ROLES = [
  "owner", "super_admin", "admin", "manager", "sales_staff", "finance",
  "warehouse", "admin_assistant", "hr", "procurement", "milk_collection", "machinery", "ai_assistant",
];

export async function sendBroadcastMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const message = String(formData.get("message") ?? "").trim();

  let attachmentUrl: string | null = null;
  let attachmentType: string | null = null;
  const attachment = formData.get("attachment");
  if (attachment instanceof File && attachment.size > 0) {
    const path = `${user.id}/${Date.now()}-${attachment.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("staff-messages").upload(path, attachment);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("staff-messages").getPublicUrl(path);
      attachmentUrl = data.publicUrl;
      attachmentType = attachment.type.startsWith("image/") ? "image" : "file";
    }
  }

  if (!message && !attachmentUrl) return { error: "Message ya file chahiye." };

  const { data: recipients } = await serviceClient
    .from("profiles")
    .select("id")
    .in("role", STAFF_ROLES)
    .eq("is_active", true)
    .neq("id", user.id);

  if (recipients && recipients.length > 0) {
    const rows = recipients.map((r) => ({
      sender_id: user.id,
      recipient_id: r.id,
      message: message || null,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    }));
    await serviceClient.from("staff_messages").insert(rows);
  }

  revalidatePath("/admin/messages");
  return { success: true };
}