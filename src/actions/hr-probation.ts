"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export interface ProbState {
  error?: string;
  success?: boolean;
  notice?: string;
}

const HR_ROLES = ["hr", "admin", "owner", "super_admin"];

const paths = () => {
  revalidatePath("/admin/hr/probation");
  revalidatePath("/admin/hr/team");
  revalidatePath("/admin/hr/settings");
  revalidatePath("/admin/hr/leave");
  revalidatePath("/admin/hr");
};

async function hrOnly() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, ok: false };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, ok: !!me?.is_active && HR_ROLES.includes(me.role) };
}

/** Tareekh + mahine se aakhri din. Mahine ka hisaab din se nahi hota. */
function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 January + 1 mahina = 28/29 February, 3 March nahi.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().split("T")[0];
}

// =====================================================================
// 1) Aazmaish shuru karna
// =====================================================================
/**
 * Naya banda aazmaish par.
 *
 * Aazmaish ka aakhri din YAHIN likh diya jata hai, har dafa hisaab
 * laga kar nahi nikala jata. Wajah: usool badal sakta hai (3 mahine se
 * 4 ho jaye), aur us din us bande se jo waada hua tha wo badalna nahi
 * chahiye. Jo tareekh us waqt tay hui, wohi record par rehti hai.
 */
export async function startProbation(_prev: ProbState, formData: FormData): Promise<ProbState> {
  const { supabase, user, ok } = await hrOnly();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Aazmaishi muddat sirf HR ya Admin rakh sakte hain." };

  const profileId = String(formData.get("profile_id") ?? "");
  const startDate = String(formData.get("probation_start_date") ?? "");
  if (!profileId) return { error: "Kaun sa mulazim, wo chunein." };
  if (!startDate) return { error: "Aazmaish kis din se shuru hui, wo tareekh chunein." };

  const { data: pol } = await supabase
    .from("hr_leave_policy")
    .select("probation_months, probation_max_total_months")
    .eq("id", true)
    .maybeSingle();

  const months = Number(formData.get("probation_months") ?? pol?.probation_months ?? 3);
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    return { error: "Aazmaishi muddat 1 se 24 mahine ke darmiyan honi chahiye." };
  }
  if (pol && months > pol.probation_max_total_months) {
    return { error: `Aazmaish ${pol.probation_max_total_months} mahine se zyada nahi ho sakti.` };
  }

  const { data: before } = await supabase
    .from("staff_details")
    .select("employment_status, confirmed_at, probation_start_date, probation_end_date")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!before) return { error: "Is bande ka staff record nahi mila. Pehle HR mein us ki tafseel bharein." };

  // Pakka hue bande ko wapas aazmaish par daalna chup chaap us ki
  // saalana chhutti khatam kar deta hai. Ye ho sakta hai, magar soch
  // kar -- is liye alag nishan maanga jata hai.
  if (before.employment_status === "confirmed" && formData.get("force_back") !== "yes") {
    return {
      error:
        "Ye banda pehle se pakka hai. Wapas aazmaish par daalne se us ki saalana chhutti khatam ho jayegi — form par nishan laga kar hi ye ho sakta hai.",
    };
  }

  const endDate = addMonths(startDate, months);

  const { error } = await supabase
    .from("staff_details")
    .update({
      employment_status: "probation",
      probation_start_date: startDate,
      probation_end_date: endDate,
      confirmed_at: null,
      confirmed_by: null,
    })
    .eq("profile_id", profileId);

  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "hr",
    recordId: profileId,
    recordLabel: "Aazmaishi muddat",
    description: `Aazmaish shuru: ${startDate} se ${endDate} tak (${months} mahine)`,
    changes: {
      employment_status: { pehle: before.employment_status, ab: "probation" },
      probation_end_date: { pehle: before.probation_end_date, ab: endDate },
    },
  });

  paths();
  return { success: true, notice: `Aazmaish ${endDate} tak. Us se pehle faisla karna hoga.` };
}

// =====================================================================
// 2) Aazmaish par faisla
// =====================================================================
/**
 * Teen raaste: muddat baRhayein, pakka karein, ya alag karein.
 *
 * Chautha raasta -- "kuch na karein" -- jaan boojh kar nahi hai. Us
 * soorat mein banda AAZMAISH PAR HI REHTA HAI aur board par "faisla
 * baqi" likha aata hai. Khud ba khud pakka ho jana wo raasta hai jis
 * mein bhoolna manzoori ban jata hai.
 */
export async function decideProbation(_prev: ProbState, formData: FormData): Promise<ProbState> {
  const { supabase, user, ok } = await hrOnly();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Aazmaish par faisla sirf HR ya Admin kar sakte hain." };

  const profileId = String(formData.get("profile_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  if (!profileId) return { error: "Kaun sa mulazim, wo saaf nahi." };
  if (!["extend", "confirm", "end"].includes(decision)) {
    return { error: "MuddatbaRhayein, pakka karein, ya alag karein — koi ek chunein." };
  }
  if (comment.length < 5) {
    return { error: "Apna comment likhein — kam az kam paanch harf. Ye faisla saal baad bhi poochha ja sakta hai." };
  }
  if (profileId === user.id) {
    return { error: "Apne aap par ye faisla nahi kiya ja sakta." };
  }

  const { data: sd } = await supabase
    .from("staff_details")
    .select("employment_status, probation_start_date, probation_end_date, hire_date")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!sd) return { error: "Is bande ka staff record nahi mila." };
  if (sd.employment_status !== "probation") {
    return { error: `Ye banda aazmaish par nahi hai (${sd.employment_status}).` };
  }

  const { data: pol } = await supabase
    .from("hr_leave_policy")
    .select("probation_max_total_months")
    .eq("id", true)
    .maybeSingle();

  const startDate = sd.probation_start_date ?? sd.hire_date;
  const oldEnd = sd.probation_end_date;
  const today = new Date().toISOString().split("T")[0];

  let newEnd: string | null = oldEnd;
  const update: Record<string, unknown> = {};
  let extendMonths: number | null = null;

  if (decision === "extend") {
    extendMonths = Number(formData.get("extend_months") ?? 0);
    if (!Number.isInteger(extendMonths) || extendMonths < 1 || extendMonths > 12) {
      return { error: "Kitne mahine baRhani hai — 1 se 12 ke darmiyan chunein." };
    }
    if (!oldEnd) return { error: "Aazmaish ki aakhri tareekh darj nahi. Pehle wo rakhein." };

    newEnd = addMonths(oldEnd, extendMonths);

    // Hamesha ke liye baRhne ka raasta band. Bina is hadd ke banda
    // saalon aazmaish par reh kar chhutti se mehroom rehta.
    if (startDate && pol) {
      const limit = addMonths(startDate, pol.probation_max_total_months);
      if (newEnd > limit) {
        return {
          error: `Kul aazmaish ${pol.probation_max_total_months} mahine se zyada nahi ho sakti (${limit} tak). Ab pakka karein ya alag karein.`,
        };
      }
    }
    update.probation_end_date = newEnd;
  }

  if (decision === "confirm") {
    const from = String(formData.get("confirmed_at") ?? "") || today;
    update.employment_status = "confirmed";
    update.confirmed_at = from;
    update.confirmed_by = user.id;
    newEnd = oldEnd;
  }

  if (decision === "end") {
    const exitDate = String(formData.get("exit_date") ?? "") || today;
    update.employment_status = "ended";
    update.exit_date = exitDate;
    update.exit_reason = comment;
    update.is_active = false;
  }

  const { error: updErr } = await supabase.from("staff_details").update(update).eq("profile_id", profileId);
  if (updErr) return { error: updErr.message };

  // Faisla pehle lagta hai, qatar baad mein -- magar qatar na banne par
  // faisla wapas nahi hota. Is liye qatar ki nakami saaf batai jati hai
  // taake HR usay dobara likh sake, na ke chup chaap guzar jaye.
  const { error: revErr } = await supabase.from("staff_probation_reviews").insert({
    profile_id: profileId,
    decision,
    extend_months: extendMonths,
    comment,
    old_end_date: oldEnd,
    new_end_date: newEnd,
    reviewed_by: user.id,
  });

  await logAudit({
    actionType: "update",
    module: "hr",
    recordId: profileId,
    recordLabel: "Aazmaish ka faisla",
    description:
      decision === "confirm"
        ? "Pakka kar diya gaya"
        : decision === "extend"
          ? `Muddat ${extendMonths} mahine baRha di`
          : "Alag kar diya gaya",
    changes: {
      faisla: { pehle: "probation", ab: decision },
      aakhri_tareekh: { pehle: oldEnd, ab: newEnd },
      comment: { pehle: null, ab: comment },
    },
  });

  paths();

  if (revErr) {
    return {
      success: true,
      notice: `Faisla lag gaya, magar us ki qatar mehfooz nahi hui: ${revErr.message}. HR ko batayein.`,
    };
  }

  return {
    success: true,
    notice:
      decision === "confirm"
        ? "Pakka ho gaya. Saalana chhutti isi tareekh se shuru hoti hai."
        : decision === "extend"
          ? `Muddat ${newEnd} tak baRha di gayi.`
          : "Alag kar diya gaya.",
  };
}

// =====================================================================
// 3) Chhutti ka usool
// =====================================================================
export async function saveLeavePolicy(_prev: ProbState, formData: FormData): Promise<ProbState> {
  const { supabase, user, ok } = await hrOnly();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Ye usool sirf HR ya Admin badal sakte hain." };

  const annual = Number(formData.get("annual_leave_days") ?? 20);
  const probMonths = Number(formData.get("probation_months") ?? 3);
  const probMax = Number(formData.get("probation_max_total_months") ?? 6);
  const carry = Number(formData.get("carry_forward_days") ?? 0);

  if (!Number.isInteger(annual) || annual < 0 || annual > 60) {
    return { error: "Saalana chhutti 0 se 60 din ke darmiyan honi chahiye." };
  }
  if (!Number.isInteger(probMonths) || probMonths < 0 || probMonths > 24) {
    return { error: "Aazmaishi muddat 0 se 24 mahine ke darmiyan honi chahiye." };
  }
  if (probMax < probMonths) {
    return { error: "Kul hadd aazmaishi muddat se kam nahi ho sakti." };
  }
  if (!Number.isInteger(carry) || carry < 0 || carry > 60) {
    return { error: "Aage le jane wali chhutti 0 se 60 din ke darmiyan honi chahiye." };
  }

  const payload = {
    annual_leave_days: annual,
    probation_months: probMonths,
    probation_max_total_months: probMax,
    probation_paid_leave: formData.get("probation_paid_leave") === "yes",
    prorate_first_year: formData.get("prorate_first_year") === "yes",
    carry_forward_days: carry,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const { error } = await supabase.from("hr_leave_policy").update(payload).eq("id", true);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "hr",
    recordId: "leave-policy",
    recordLabel: "Chhutti ka usool",
    description: "Saalana chhutti / aazmaishi muddat ka usool badla",
    changes: {
      saalana_chhutti: { pehle: null, ab: annual },
      aazmaishi_muddat: { pehle: null, ab: probMonths },
      aazmaish_par_chhutti: { pehle: null, ab: payload.probation_paid_leave },
    },
  });

  paths();
  return { success: true, notice: "Usool mehfooz ho gaya. Naye adad agli darkhwast se lagenge." };
}
