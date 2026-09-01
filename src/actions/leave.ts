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
  const isHalfDay = formData.get("is_half_day") === "yes";

  if (!from) return { error: "Kis din se, wo tareekh chunein." };
  if (to < from) return { error: "Khatam hone ki tareekh shuru se pehle nahi ho sakti." };
  if (reason.length < 5) return { error: "Wajah likhein — kam az kam paanch harf. Ye wajah record par rehti hai." };
  if (isHalfDay && to !== from) {
    return { error: "Aadha din sirf ek hi din ka ho sakta hai. Do tareekhein ek rakhein." };
  }

  // Afsar ABHI tay hota hai. Baad mein reporting badal jaye to purani
  // darkhwast ka raasta nahi badalta -- warna wo darkhwast us bande ke
  // paas chali jati jis ne wo baat suni hi nahi thi.
  const { data: sd } = await supabase
    .from("staff_details")
    .select("reports_to")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("leave_requests").insert({
    profile_id: user.id,
    from_date: from,
    to_date: to,
    leave_type: type,
    reason,
    is_half_day: isHalfDay,
    manager_id: sd?.reports_to ?? null,
  });

  if (error) {
    if (error.message.includes("leave_no_overlap")) {
      return { error: "In dinon ki chhutti pehle se manzoor hai." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/hr/leave");
  revalidatePath("/admin/hr/attendance");
  return {
    success: true,
    notice: sd?.reports_to
      ? "Darkhwast apne afsar ko bhej di gayi. Un dinon ka calendar tab tak \u2018chhutti zer-e-ghaur\u2019 dikhayega — ghair hazir nahi."
      : "Darkhwast bhej di gayi. Aap ka koi afsar darj nahi, is liye ye HR ke paas jayegi.",
  };
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
  if (!["approved", "rejected", "sent_back"].includes(decision)) {
    return { error: "Manzoor, na-manzoor, ya wapas — koi ek chunein." };
  }

  // Comment ab TEENON par lazmi hai, sirf na-manzoori par nahi.
  //
  // Pehle sirf "nahi" ki wajah maangi jati thi, is khayal se ke "haan"
  // apne aap mein poora jawab hai. Hazri wale nizam ne wo khayal ghalat
  // sabit kar diya: manzoor shuda chhutti seedha hazri badal deti hai,
  // aur mahine ke aakhir mein sawal ye hota hai ke "ye din chhutti kyun
  // likha gaya" -- us waqt "manzoor ho gayi thi" koi jawab nahi hai.
  if (note.length < 5) {
    return { error: "Apna comment likhein — kam az kam paanch harf. Faisla bina comment ke darj nahi hota." };
  }

  const { data: row } = await supabase.from("leave_requests").select("profile_id, status").eq("id", id).maybeSingle();
  if (!row) return { error: "Darkhwast nahi mili." };
  if (row.profile_id === user.id) return { error: "Apni chhutti khud manzoor nahi ki ja sakti." };
  if (!["pending", "sent_back"].includes(row.status)) {
    return { error: `Is par pehle hi faisla ho chuka hai (${row.status}).` };
  }

  // Reporting ki hadd. Ye sawal database se poochha jata hai, code se
  // nahi -- poori zanjeer wahin hai, aur apni cheez khud manzoor karne
  // ki rok bhi usi function ke andar hai.
  const { data: canDecide } = await supabase.rpc("fn_hr_can_decide_for", { p_target: row.profile_id });
  if (canDecide !== true) {
    return { error: "Ye banda aap ki reporting team mein nahi. Is ki chhutti ka faisla us ka apna afsar ya HR karega." };
  }

  // Wapas bhejna FAISLA nahi hai: darkhwast zinda rehti hai, banda usay
  // theek kar ke dobara bhej sakta hai. Is liye decided_by yahan nahi
  // lagta -- warna record kehta ke faisla ho chuka hai.
  const sentBack = decision === "sent_back";

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: decision,
      manager_comment: note,
      decision_note: note,
      decided_by: sentBack ? null : user.id,
      decided_at: sentBack ? null : new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/hr/leave");
  revalidatePath("/admin/hr/attendance-log");
  revalidatePath("/admin/hr/attendance");
  return {
    success: true,
    notice:
      decision === "approved"
        ? "Manzoor ho gayi — un dinon ki hazri khud chhutti likhi ja chuki hai."
        : decision === "rejected"
          ? "Na-manzoor kar di gayi."
          : "Wapas bhej di gayi — banda theek kar ke dobara bhej sakta hai.",
  };
}
