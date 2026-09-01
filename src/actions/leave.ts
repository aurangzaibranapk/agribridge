"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface LeaveState {
  error?: string;
  success?: boolean;
  notice?: string;
}

const DECIDERS = ["hr", "manager", "admin", "owner", "super_admin"];

/**
 * Chhutti maangna.
 *
 * Har banda apni chhutti khud maangta hai -- kisi aur ke naam par nahi.
 * Ye rok database mein bhi hai (RLS) aur yahan bhi: do jagah rok lagana
 * fuzool nahi, kyunke agar kal koi naya raasta bane to us par bhi wahi
 * qanoon lag jaye.
 */
export async function requestLeave(_prev: LeaveState, formData: FormData): Promise<LeaveState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const from = String(formData.get("from_date") ?? "");
  const to = String(formData.get("to_date") ?? "") || from;
  const type = String(formData.get("leave_type") ?? "casual");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!from) return { error: "Kis din se, wo tareekh chunein." };
  if (to < from) return { error: "Khatam hone ki tareekh shuru se pehle nahi ho sakti." };
  if (reason.length < 5) return { error: "Wajah likhein — kam az kam paanch harf. Ye wajah record par rehti hai." };

  const { error } = await supabase.from("leave_requests").insert({
    profile_id: user.id,
    from_date: from,
    to_date: to,
    leave_type: type,
    reason,
  });

  if (error) {
    if (error.message.includes("leave_no_overlap")) {
      return { error: "In dinon ki chhutti pehle se manzoor hai." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/hr/leave");
  return { success: true, notice: "Darkhwast bhej di gayi. Manzoori ka intezar karein." };
}

/**
 * Chhutti par faisla.
 *
 * Apni chhutti koi khud manzoor nahi kar sakta -- ye rok yahan bhi hai
 * aur database mein bhi. Ye wo qism ki ghalti hai jo khud nazar nahi
 * aati: record mein sab kuch theek lagta hai, aur manzoori dene wala
 * wohi hota hai jise chhutti chahiye thi.
 *
 * Manzoori hazri tak khud pahunchti hai (134 ka trigger) -- yahan wo
 * kaam dobara nahi kiya jata.
 */
export async function decideLeave(_prev: LeaveState, formData: FormData): Promise<LeaveState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !DECIDERS.includes(me.role)) {
    return { error: "Chhutti par faisla sirf HR aur manager kar sakte hain." };
  }

  const id = String(formData.get("leave_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("decision_note") ?? "").trim();

  if (!id) return { error: "Kaun si darkhwast, wo saaf nahi." };
  if (decision !== "approved" && decision !== "rejected") return { error: "Manzoor ya na-manzoor — koi ek chunein." };

  const { data: row } = await supabase.from("leave_requests").select("profile_id, status").eq("id", id).maybeSingle();
  if (!row) return { error: "Darkhwast nahi mili." };
  if (row.profile_id === user.id) return { error: "Apni chhutti khud manzoor nahi ki ja sakti." };
  if (row.status !== "pending") return { error: `Is par pehle hi faisla ho chuka hai (${row.status}).` };

  // Na-manzoori ki wajah lazmi hai. Manzoori ki nahi -- "haan" ka jawab
  // apne aap mein poora hota hai, "nahi" ka nahi.
  if (decision === "rejected" && note.length < 5) {
    return { error: "Na-manzoor karne ki wajah likhein — kam az kam paanch harf." };
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_note: note || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/hr/leave");
  revalidatePath("/admin/hr/attendance-log");
  return {
    success: true,
    notice:
      decision === "approved"
        ? "Manzoor ho gayi — un dinon ki hazri khud chhutti likhi ja chuki hai."
        : "Na-manzoor kar di gayi.",
  };
}
