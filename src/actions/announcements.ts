"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function createAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (!["super_admin", "admin", "owner"].includes(profile?.role ?? "")) return { error: "Sirf Admin Announcement bana sakta hai." };

  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const ctaType = String(formData.get("cta_type") ?? "none");
  const ctaLabel = (formData.get("cta_label") as string) || null;
  const ctaUrl = (formData.get("cta_url") as string) || null;

  if (!title) return { error: "Title likhein." };
  if (!message) return { error: "Message likhein." };
  if (!["none", "vote", "link"].includes(ctaType)) return { error: "CTA Type sahi select karein." };

  const { error } = await supabase.from("announcements").insert({
    title,
    message,
    cta_type: ctaType,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    is_active: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/announcements");
  return { success: true };
}

export async function deactivateAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("announcements").update({ is_active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/announcements");
  return { success: true };
}

export async function getActiveAnnouncementForFarmer(farmerId: string) {
  const supabase = createClient();
  const { data: activeAnnouncements } = await supabase
    .from("announcements")
    .select("id, title, message, cta_type, cta_label, cta_url")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!activeAnnouncements || activeAnnouncements.length === 0) return null;

  const { data: dismissals } = await supabase
    .from("announcement_dismissals")
    .select("announcement_id")
    .eq("farmer_id", farmerId)
    .in("announcement_id", activeAnnouncements.map((a) => a.id));

  const dismissedIds = new Set((dismissals ?? []).map((d) => d.announcement_id));
  return activeAnnouncements.find((a) => !dismissedIds.has(a.id)) ?? null;
}

export async function dismissAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const announcementId = String(formData.get("announcement_id") ?? "");
  const farmerId = String(formData.get("farmer_id") ?? "");
  const vote = (formData.get("vote") as string) || null;
  if (!announcementId || !farmerId) return { error: "Missing data." };

  const { error } = await supabase.from("announcement_dismissals").insert({
    announcement_id: announcementId,
    farmer_id: farmerId,
    vote: vote && ["yes", "no"].includes(vote) ? vote : null,
  });
  if (error) return { error: error.message };

  return { success: true };
}