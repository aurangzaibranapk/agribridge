"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ACTION_STATUSES, MEET_URL_RE, isValidDate, parseMeetingForm, pktToIso, seriesDates } from "@/lib/hr-meetings";

/**
 * HR Meetings ke kaam. Har cheez user ke apne session (RLS) se hoti hai:
 * staff sirf apni meetings, HR/Admin/Owner sab (603). Notifications sirf
 * app ke andar -- DB triggers (602) banate hain. Koi WhatsApp/email nahi.
 */
export interface MeetState { error?: string; success?: boolean; notice?: string }

// Naye tables abhi generated types mein nahi -- is liye untyped client.
function db(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}
async function me(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
function refresh(id?: string) {
  revalidatePath("/admin/hr/meetings");
  revalidatePath("/admin/hr/meetings/actions");
  revalidatePath("/admin/hr-dashboard");
  if (id) revalidatePath(`/admin/hr/meetings/${id}`);
}

export async function createMeeting(_p: MeetState, f: FormData): Promise<MeetState> {
  const supabase = db();
  const user = await me(supabase);
  if (!user) return { error: "Login karein." };
  const parsed = parseMeetingForm(f);
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value;
  const parent = String(f.get("parent_meeting_id") ?? "");
  const dates = seriesDates(v.date, v.repeat);
  const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
  const rows = dates.map((d) => ({
    title: v.title, starts_at: pktToIso(d, v.time), duration_min: v.duration_min, organizer_id: user.id,
    agenda: v.agenda, location: v.location, meet_url: v.meet_url, series_id: seriesId,
    parent_meeting_id: /^[0-9a-f-]{36}$/i.test(parent) ? parent : null,
  }));
  const { data: created, error } = await supabase.from("hr_meetings").insert(rows).select("id");
  if (error || !created?.length) return { error: error?.message ?? "Meeting nahi bani." };
  const att = created.flatMap((m: { id: string }) =>
    v.attendees.filter((p) => p !== user.id).map((p) => ({ meeting_id: m.id, profile_id: p })));
  if (att.length) {
    const { error: e2 } = await supabase.from("hr_meeting_attendees").insert(att);
    if (e2) return { error: `Meeting ban gayi magar staff shamil nahi hue: ${e2.message}` };
  }
  refresh();
  redirect(`/admin/hr/meetings/${created[0].id}`);
}

export async function updateMeeting(_p: MeetState, f: FormData): Promise<MeetState> {
  const supabase = db();
  if (!(await me(supabase))) return { error: "Login karein." };
  const id = String(f.get("id") ?? "");
  const patch: Record<string, unknown> = {};
  const date = String(f.get("date") ?? ""), time = String(f.get("time") ?? "");
  if (date || time) {
    if (!isValidDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "Nayi tareekh/waqt sahi nahi." };
    patch.starts_at = pktToIso(date, time);
  }
  if (f.has("meet_url")) {
    const u = String(f.get("meet_url") ?? "").trim();
    if (u && !MEET_URL_RE.test(u)) return { error: "Google Meet ka link https://meet.google.com/... hona chahiye." };
    patch.meet_url = u || null;
  }
  if (f.has("minutes")) patch.minutes = String(f.get("minutes") ?? "").trim() || null;
  const st = String(f.get("status") ?? "");
  if (st === "held" || st === "cancelled" || st === "scheduled") patch.status = st;
  if (!Object.keys(patch).length) return { error: "Kuch badla nahi." };
  const { data, error } = await supabase.from("hr_meetings").update(patch).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Ye meeting sirf organizer ya HR badal sakta hai." };
  refresh(id);
  return { success: true, notice: patch.starts_at ? "Waqt badal diya gaya. Shamil staff ko app mein bata diya." : "Mehfooz ho gaya." };
}

export async function addDecision(_p: MeetState, f: FormData): Promise<MeetState> {
  const supabase = db();
  if (!(await me(supabase))) return { error: "Login karein." };
  const meeting_id = String(f.get("meeting_id") ?? "");
  const body = String(f.get("body") ?? "").trim();
  if (body.length < 2) return { error: "Faisla likhein." };
  const { count } = await supabase.from("hr_meeting_decisions").select("id", { count: "exact", head: true }).eq("meeting_id", meeting_id);
  const { error } = await supabase.from("hr_meeting_decisions").insert({ meeting_id, body, seq: (count ?? 0) + 1 });
  if (error) return { error: error.message.includes("row-level") ? "Faisla sirf organizer ya HR likh sakta hai." : error.message };
  refresh(meeting_id);
  return { success: true };
}

export async function addActionItem(_p: MeetState, f: FormData): Promise<MeetState> {
  const supabase = db();
  if (!(await me(supabase))) return { error: "Login karein." };
  const meeting_id = String(f.get("meeting_id") ?? "");
  const title = String(f.get("title") ?? "").trim();
  const owner_id = String(f.get("owner_id") ?? "");
  const due_date = String(f.get("due_date") ?? "");
  if (title.length < 2) return { error: "Kaam likhein." };
  if (!/^[0-9a-f-]{36}$/i.test(owner_id)) return { error: "Zimmedar chunein." };
  if (!isValidDate(due_date)) return { error: "Aakhri tareekh chunein." };
  const { error } = await supabase.from("hr_meeting_action_items").insert({ meeting_id, title, owner_id, due_date });
  if (error) return { error: error.message.includes("row-level") ? "Kaam sirf organizer ya HR jor sakta hai." : error.message };
  refresh(meeting_id);
  return { success: true };
}

export async function updateActionItem(_p: MeetState, f: FormData): Promise<MeetState> {
  const supabase = db();
  if (!(await me(supabase))) return { error: "Login karein." };
  const id = String(f.get("id") ?? "");
  const patch: Record<string, unknown> = {};
  const status = String(f.get("status") ?? "");
  if (status) {
    if (!(ACTION_STATUSES as readonly string[]).includes(status)) return { error: "Status sahi nahi." };
    patch.status = status;
  }
  const due = String(f.get("due_date") ?? "");
  if (due) {
    if (!isValidDate(due)) return { error: "Tareekh sahi nahi." };
    patch.due_date = due;
  }
  if (!Object.keys(patch).length) return { error: "Kuch badla nahi." };
  const { data, error } = await supabase.from("hr_meeting_action_items").update(patch).eq("id", id).select("meeting_id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Ye kaam aap nahi badal sakte." };
  refresh(data[0].meeting_id as string);
  return { success: true };
}

export async function markNotificationsRead(): Promise<void> {
  const supabase = db();
  const user = await me(supabase);
  if (!user) return;
  await supabase.from("hr_notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", user.id).is("read_at", null);
  refresh();
}
