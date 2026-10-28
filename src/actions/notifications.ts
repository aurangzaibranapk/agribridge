"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAllStaff, notifyAllBranches } from "@/lib/notifications";
import {
  isNotificationId,
  notificationIdsForOpen,
  type MarkReadResult,
  type NoticeRef,
} from "@/lib/notifications-read";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const HQ_ROLES = ["super_admin", "admin", "owner", "manager"];

export async function markNotificationRead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const notificationId = String(formData.get("notification_id") ?? "");
  const res = await markNotificationOpened({ id: notificationId });
  if (!res.ok) return { error: res.error };
  return { success: true };
}

/**
 * Kholne par sirf `notifications.is_read`. Pending qatarein, approve,
 * reject — kuch nahi. Ghalat RLS par error wapas aata hai, khamoshi se
 * "parh li" nahi likhte.
 */
export async function markNotificationOpened(input: { id?: string | null; href?: string | null }): Promise<MarkReadResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, updated: 0, ids: [], error: "Login zaroori hai." };

  const id = input.id?.trim() || null;
  if (id && !isNotificationId(id)) return { ok: false, updated: 0, ids: [], error: "Missing id." };

  const unread: NoticeRef[] = [];
  const page = 1000;
  for (let from = 0; from < 5000; from += page) {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, link_url, is_read")
      .eq("recipient_user_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .range(from, from + page - 1);
    if (error) return { ok: false, updated: 0, ids: [], error: error.message };
    const batch = (data ?? []) as NoticeRef[];
    unread.push(...batch);
    if (batch.length < page) break;
  }

  const ids = notificationIdsForOpen(unread, { id, href: input.href });
  if (!ids.length) return { ok: true, updated: 0, ids: [] };

  const updated: string[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", slice)
      .eq("recipient_user_id", user.id)
      .eq("is_read", false)
      .select("id");
    if (error) return { ok: false, updated: updated.length, ids: updated, error: error.message };
    updated.push(...(data ?? []).map((row) => row.id));
  }

  if (id && !updated.includes(id)) {
    const { data: row, error } = await supabase
      .from("notifications")
      .select("id, is_read")
      .eq("id", id)
      .eq("recipient_user_id", user.id)
      .maybeSingle();
    if (error) return { ok: false, updated: updated.length, ids: updated, error: error.message };
    if (row && !row.is_read) {
      return { ok: false, updated: updated.length, ids: updated, error: "Read save nahi hui." };
    }
  }

  revalidatePath("/admin/notifications");
  return { ok: true, updated: updated.length, ids: updated };
}

/** Sirf isi user ki unread notices. Pending ginti nahi badalti. */
export async function markAllNotificationsRead(): Promise<{ ok: true; remaining: number } | { ok: false; remaining: number; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, remaining: 0, error: "Login zaroori hai." };

  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("recipient_user_id", user.id).eq("is_read", false);
  if (error) return { ok: false, remaining: 0, error: error.message };

  const { count, error: countError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", user.id)
    .eq("is_read", false);
  if (countError) return { ok: false, remaining: 0, error: countError.message };

  revalidatePath("/admin/notifications");
  return { ok: true, remaining: count ?? 0 };
}

export async function sendBroadcast(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!HQ_ROLES.includes(profile?.role ?? "")) return { error: "Sirf Admin/Manager broadcast bhej sakte hain." };

  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const audience = String(formData.get("audience") ?? "");

  if (!title) return { error: "Title zaroori hai." };
  if (!message) return { error: "Message zaroori hai." };
  if (!audience) return { error: "Audience select karein." };

  if (audience === "all_staff") {
    await notifyAllStaff(title, message);
  } else if (audience === "all_branches") {
    await notifyAllBranches(title, message);
  } else {
    return { error: "Ghalat audience." };
  }

  revalidatePath("/admin/notifications");
  return { success: true };
}