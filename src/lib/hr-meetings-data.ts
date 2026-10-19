import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { addDays, hasFullAccess, pktDate, pktToIso } from "@/lib/hr-meetings";

/** Meetings ka data -- hamesha user ke session (RLS 603) se. */
export interface MeetingRow {
  id: string; title: string; starts_at: string; duration_min: number; status: string; organizer_id: string;
  agenda: string | null; location: string | null; meet_url: string | null; minutes: string | null;
  reschedule_count: number; parent_meeting_id: string | null; series_id: string | null;
  organizer: { full_name: string | null } | null;
  hr_meeting_attendees: { profile_id: string; response: string; profiles: { full_name: string | null } | null }[];
}
export interface FlagRow { meeting_id: string; decisions: number; open_actions: number; overdue_actions: number; max_postponed: number; flag_no_decision: boolean; flag_rescheduled: boolean }
export interface ActionRow {
  id: string; meeting_id: string; title: string; owner_id: string; due_date: string; status: string; postponed_count: number;
  owner: { full_name: string | null } | null; hr_meetings: { title: string; organizer_id: string } | null;
}
export interface NotifRow { id: string; kind: string; title: string; meeting_id: string | null; read_at: string | null; created_at: string }

export const MEETING_SELECT =
  "id, title, starts_at, duration_min, status, organizer_id, agenda, location, meet_url, minutes, reschedule_count, parent_meeting_id, series_id, organizer:profiles!hr_meetings_organizer_id_fkey(full_name), hr_meeting_attendees(profile_id, response, profiles(full_name))";

export function meetingsDb(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}

export async function currentStaff(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).maybeSingle();
  if (!data) return null;
  return { id: data.id as string, name: (data.full_name as string) ?? "", role: data.role as string, full: hasFullAccess(data.role as string) };
}

export async function meetingsBetween(supabase: SupabaseClient, from: string, to: string): Promise<MeetingRow[]> {
  const { data } = await supabase.from("hr_meetings").select(MEETING_SELECT)
    .gte("starts_at", pktToIso(from, "00:00")).lt("starts_at", pktToIso(addDays(to, 1), "00:00"))
    .order("starts_at");
  return (data ?? []) as unknown as MeetingRow[];
}

export async function flagsFor(supabase: SupabaseClient, ids: string[]): Promise<Map<string, FlagRow>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from("v_hr_meeting_flags").select("*").in("meeting_id", ids);
  return new Map(((data ?? []) as FlagRow[]).map((f) => [f.meeting_id, f]));
}

export async function actionItems(supabase: SupabaseClient, opts: { ownerId?: string; meetingId?: string } = {}): Promise<ActionRow[]> {
  let q = supabase.from("hr_meeting_action_items")
    .select("id, meeting_id, title, owner_id, due_date, status, postponed_count, owner:profiles!hr_meeting_action_items_owner_id_fkey(full_name), hr_meetings(title, organizer_id)")
    .order("due_date");
  if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
  if (opts.meetingId) q = q.eq("meeting_id", opts.meetingId);
  const { data } = await q.limit(500);
  return (data ?? []) as unknown as ActionRow[];
}

export async function myNotifications(supabase: SupabaseClient, limit = 6): Promise<NotifRow[]> {
  const { data } = await supabase.from("hr_notifications").select("id, kind, title, meeting_id, read_at, created_at")
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as NotifRow[];
}

/** Purani meetings ka record -- unwan, agenda, rudaad ya faislon mein talash. */
export async function searchHistory(supabase: SupabaseClient, q: string, limit = 25): Promise<MeetingRow[]> {
  let query = supabase.from("hr_meetings").select(MEETING_SELECT).order("starts_at", { ascending: false }).limit(limit);
  const term = q.replace(/[%,()]/g, " ").trim();
  if (term) {
    const { data: dec } = await supabase.from("hr_meeting_decisions").select("meeting_id").ilike("body", `%${term}%`).limit(50);
    const ids = Array.from(new Set((dec ?? []).map((d: { meeting_id: string }) => d.meeting_id)));
    const ors = [`title.ilike.%${term}%`, `agenda.ilike.%${term}%`, `minutes.ilike.%${term}%`];
    if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
    query = query.or(ors.join(","));
  } else {
    query = query.lte("starts_at", new Date().toISOString());
  }
  const { data } = await query;
  return (data ?? []) as unknown as MeetingRow[];
}

export const todayPkt = () => pktDate(new Date());
