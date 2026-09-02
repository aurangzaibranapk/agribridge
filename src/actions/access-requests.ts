"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decideAccessRequest } from "@/lib/access/access-requests";

export interface AccessState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function decideAccess(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id || (decision !== "approved" && decision !== "rejected")) return { error: "Faisla saaf nahi." };
  const res = await decideAccessRequest(id, user.id, decision, note);
  revalidatePath("/admin/access-requests");
  revalidatePath("/admin/my-access");
  revalidatePath("/admin", "layout");
  return res.ok ? { success: true, message: res.message } : { error: res.message };
}

export async function cancelMyAccessRequest(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const id = String(formData.get("id") ?? "");
  const service = createServiceClient();
  const { data: req } = await service.from("access_requests").select("requested_by, status").eq("id", id).maybeSingle();
  if (!req || req.requested_by !== user.id) return { error: "Ye darkhwast aap ki nahi." };
  if (req.status !== "pending") return { error: "Is par faisla ho chuka." };
  await service.from("access_requests").update({ status: "cancelled", decided_at: new Date().toISOString() }).eq("id", id);
  await service.from("access_request_events").insert({ request_id: id, actor_id: user.id, event: "cancelled" });
  revalidatePath("/admin/my-access");
  revalidatePath("/admin/access-requests");
  return { success: true, message: "Wapas le li." };
}
