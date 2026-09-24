"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export interface AttState {
  error?: string;
  success?: boolean;
  notice?: string;
}

type AttStatus = "present" | "absent" | "leave" | "half_day";
const STATUSES: AttStatus[] = ["present", "absent", "leave", "half_day"];
const isStatus = (v: string): v is AttStatus => (STATUSES as string[]).includes(v);

const HR_ROLES = ["hr", "admin", "owner", "super_admin"];
const MANAGER_ROLES = [...HR_ROLES, "manager"];

const paths = () => {
  revalidatePath("/admin/hr/attendance");
  revalidatePath("/admin/hr/attendance-log");
  revalidatePath("/admin/hr/corrections");
  revalidatePath("/admin/hr/leave");
  revalidatePath("/admin/hr/team");
  revalidatePath("/admin/my-attendance");
};

/** Kaun poochh raha hai. Bina is ke koi action aage nahi baRhta. */
async function whoAmI() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as string | null };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_active) return { supabase, user, role: null as string | null };
  return { supabase, user, role: me.role as string };
}

/**
 * Band mahina.
 *
 * Ye ek hi jagah se poochha jata hai. Agar har action apna apna hisaab
 * lagaye to ek din koi action puchhna bhool jayega -- aur wohi action
 * band mahine ki hazri badal dega, jis par tankhwah ban chuki hai.
 */
async function monthLocked(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  date: string
): Promise<boolean> {
  const d = new Date(date + "T00:00:00Z");
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;

  const { data: prof } = await supabase
    .from("profiles")
    .select("branch_id")
    .eq("id", profileId)
    .maybeSingle();
  const { data: sd } = await supabase
    .from("staff_details")
    .select("branch_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  const branchId = sd?.branch_id ?? prof?.branch_id ?? null;

  const { data: locks } = await supabase
    .from("attendance_month_locks")
    .select("branch_id")
    .eq("lock_year", year)
    .eq("lock_month", month)
    .is("reopened_at", null);

  if (!locks) return false;
  return locks.some((l) => l.branch_id === null || l.branch_id === branchId);
}

// =====================================================================
// 1) Reporting -- kaun kis ko report karta hai
// =====================================================================
export async function saveReportingLine(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user, role } = await whoAmI();
  if (!user) return { error: "Login karein." };
  if (!role || !HR_ROLES.includes(role)) {
    return { error: "Reporting sirf HR ya Admin badal sakte hain." };
  }

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Kaun sa mulazim, wo chunein." };

  const reportsTo = (formData.get("reports_to") as string) || null;
  if (reportsTo && reportsTo === profileId) {
    return { error: "Koi apna afsar khud nahi ho sakta." };
  }

  const payload = {
    profile_id: profileId,
    reports_to: reportsTo,
    department_key: (formData.get("department_key") as string) || null,
    branch_id: (formData.get("branch_id") as string) || null,
    designation: (formData.get("designation") as string) || null,
    employment_type: String(formData.get("employment_type") ?? "permanent"),
  };

  const { data: before } = await supabase
    .from("staff_details")
    .select("reports_to, department_key, branch_id, designation, employment_type")
    .eq("profile_id", profileId)
    .maybeSingle();

  const { error } = await supabase
    .from("staff_details")
    .upsert(payload, { onConflict: "profile_id" });

  if (error) {
    if (error.message.includes("gol chakkar")) {
      return { error: "Reporting mein gol chakkar ban raha hai — ye banda ghoom kar khud apna afsar ban jata hai." };
    }
    return { error: error.message };
  }

  await logAudit({
    actionType: "update",
    module: "hr",
    recordId: profileId,
    recordLabel: "Reporting line",
    description: "Mulazim ki reporting/department badli gayi",
    changes: {
      reports_to: { pehle: before?.reports_to ?? null, ab: payload.reports_to },
      department_key: { pehle: before?.department_key ?? null, ab: payload.department_key },
      branch_id: { pehle: before?.branch_id ?? null, ab: payload.branch_id },
      designation: { pehle: before?.designation ?? null, ab: payload.designation },
      employment_type: { pehle: before?.employment_type ?? null, ab: payload.employment_type },
    },
  });

  paths();
  return { success: true, notice: "Reporting mehfooz ho gayi." };
}

// =====================================================================
// 2) Kaam ka waqt aur hafte ki chhutti
// =====================================================================
export async function saveWorkSchedule(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user, role } = await whoAmI();
  if (!user) return { error: "Login karein." };
  if (!role || !HR_ROLES.includes(role)) {
    return { error: "Kaam ka waqt sirf HR ya Admin badal sakte hain." };
  }

  const branchId = (formData.get("branch_id") as string) || null;
  const offDays = formData
    .getAll("weekly_off_days")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  const shiftStart = String(formData.get("shift_start") ?? "09:00");
  const shiftEnd = String(formData.get("shift_end") ?? "17:00");
  if (shiftEnd <= shiftStart) return { error: "Chhutti ka waqt aane ke waqt se pehle nahi ho sakta." };

  const grace = Number(formData.get("late_grace_minutes") ?? 15);
  const halfDayMax = Number(formData.get("half_day_max_minutes") ?? 300);
  if (!Number.isFinite(grace) || grace < 0 || grace > 240) {
    return { error: "Der ki chhoot 0 se 240 minute ke darmiyan honi chahiye." };
  }

  // Poore hafte ki chhutti = koi kaam ka din nahi. Ye chup chaap manzoor
  // kar lena har report ko sifar par le jata hai.
  if (offDays.length >= 7) {
    return { error: "Saaton din chhutti nahi ho sakti — kam az kam ek din kaam ka rakhein." };
  }

  const existingQuery = supabase
    .from("hr_work_schedules")
    .select("id")
    .eq("is_active", true);
  const { data: existing } = branchId
    ? await existingQuery.eq("branch_id", branchId).maybeSingle()
    : await existingQuery.is("branch_id", null).maybeSingle();

  const payload = {
    branch_id: branchId,
    weekly_off_days: offDays.length ? offDays : [0],
    shift_start: shiftStart,
    shift_end: shiftEnd,
    late_grace_minutes: grace,
    half_day_max_minutes: halfDayMax,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase.from("hr_work_schedules").update(payload).eq("id", existing.id)
    : await supabase.from("hr_work_schedules").insert(payload);

  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "hr",
    recordId: existing?.id ?? branchId ?? "company",
    recordLabel: "Kaam ka waqt",
    description: branchId ? "Branch ka kaam ka waqt badla" : "Company ka kaam ka waqt badla",
    changes: {
      weekly_off_days: { pehle: null, ab: payload.weekly_off_days },
      shift: { pehle: null, ab: `${payload.shift_start} - ${payload.shift_end}` },
      late_grace_minutes: { pehle: null, ab: payload.late_grace_minutes },
    },
  });

  paths();
  return { success: true, notice: "Kaam ka waqt mehfooz ho gaya." };
}

// =====================================================================
// 3) Chhutti ke din
// =====================================================================
export async function saveHoliday(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user, role } = await whoAmI();
  if (!user) return { error: "Login karein." };
  if (!role || !HR_ROLES.includes(role)) {
    return { error: "Chhutti ka elaan sirf HR ya Admin kar sakte hain." };
  }

  const date = String(formData.get("holiday_date") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!date) return { error: "Tareekh chunein." };
  if (name.length < 2) return { error: "Chhutti ka naam likhein." };

  const { error } = await supabase.from("hr_holidays").insert({
    holiday_date: date,
    name,
    branch_id: (formData.get("branch_id") as string) || null,
    is_paid: formData.get("is_paid") !== "no",
    notes: (formData.get("notes") as string) || null,
    created_by: user.id,
  });

  if (error) {
    if (error.message.includes("idx_holiday_unique")) {
      return { error: "Is din ki chhutti pehle se darj hai." };
    }
    return { error: error.message };
  }

  await logAudit({
    actionType: "create",
    module: "hr",
    recordId: date,
    recordLabel: name,
    description: `Chhutti ka elaan: ${date} — ${name}`,
  });

  paths();
  return { success: true, notice: "Chhutti darj ho gayi." };
}

export async function removeHoliday(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user, role } = await whoAmI();
  if (!user) return { error: "Login karein." };
  if (!role || !HR_ROLES.includes(role)) {
    return { error: "Ye sirf HR ya Admin kar sakte hain." };
  }

  const id = String(formData.get("holiday_id") ?? "");
  if (!id) return { error: "Kaun si chhutti, wo saaf nahi." };

  const { data: row } = await supabase
    .from("hr_holidays")
    .select("holiday_date, name")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Chhutti nahi mili." };

  const { error } = await supabase.from("hr_holidays").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "delete",
    module: "hr",
    recordId: id,
    recordLabel: row.name,
    description: `Chhutti hatai gayi: ${row.holiday_date} — ${row.name}`,
  });

  paths();
  return { success: true, notice: "Chhutti hata di gayi." };
}

// =====================================================================
// 4) Hazri theek karwane ki darkhwast
// =====================================================================
/**
 * Banda khud darkhwast deta hai.
 *
 * Yahan record ko HAATH NAHI LAGTA. Sirf darkhwast banti hai, aur us ke
 * sath us waqt ka record bhi mehfooz ho jata hai (original_snapshot) --
 * taake baad mein ye sawal ka jawab mil sake ke "badla kya gaya tha".
 */
export async function requestAttendanceCorrection(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user } = await whoAmI();
  if (!user) return { error: "Login karein." };

  const date = String(formData.get("attendance_date") ?? "");
  const status = String(formData.get("requested_status") ?? "present");
  if (!isStatus(status)) return { error: "Hazri ka darja theek nahi." };
  const reason = String(formData.get("reason") ?? "").trim();
  const checkIn = (formData.get("requested_check_in") as string) || null;
  const checkOut = (formData.get("requested_check_out") as string) || null;

  if (!date) return { error: "Kis din ki hazri, wo tareekh chunein." };
  if (reason.length < 5) {
    return { error: "Wajah likhein — kam az kam paanch harf. Ye wajah hamesha record par rehti hai." };
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    return { error: "Jane ka waqt aane ke waqt se pehle nahi ho sakta." };
  }

  const today = new Date().toISOString().split("T")[0];
  if (date > today) return { error: "Aane wale din ki hazri theek nahi karwai ja sakti." };

  if (await monthLocked(supabase, user.id, date)) {
    return {
      error:
        "Us mahine ka hisaab band ho chuka hai. HR se kehin ke pehle mahina kholein — us ke baghair tabdeeli tankhwah se mel nahi khayegi.",
    };
  }

  const { data: current } = await supabase
    .from("attendance_records")
    .select("status, check_in, check_out, check_in_at, check_out_at, source, notes")
    .eq("profile_id", user.id)
    .eq("attendance_date", date)
    .maybeSingle();

  // Afsar kaun hai, ye ABHI tay hota hai. Baad mein reporting badal jaye
  // to purani darkhwast ka raasta nahi badalta.
  const { data: sd } = await supabase
    .from("staff_details")
    .select("reports_to")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("attendance_corrections").insert({
    profile_id: user.id,
    attendance_date: date,
    requested_status: status,
    requested_check_in: checkIn,
    requested_check_out: checkOut,
    reason,
    original_snapshot: current ?? null,
    manager_id: sd?.reports_to ?? null,
  });

  if (error) {
    if (error.message.includes("idx_corr_one_open")) {
      return { error: "Is din ki ek darkhwast pehle se zer-e-ghaur hai." };
    }
    return { error: error.message };
  }

  paths();
  return {
    success: true,
    notice: sd?.reports_to
      ? "Darkhwast apne afsar ko bhej di gayi."
      : "Darkhwast bhej di gayi. Aap ka koi afsar darj nahi, is liye ye HR ke paas jayegi.",
  };
}

/**
 * Afsar ka faisla.
 *
 * Teen raaste: manzoor, na-manzoor, ya wapas bhej dein. Teenon par
 * COMMENT LAZMI hai -- ye spec ka saaf hukm hai, aur wajah wohi hai jo
 * chhutti wale safhe par thi: bina wajah ka faisla baad mein kisi ke
 * kaam nahi aata.
 *
 * Manzoori par hazri BADALTI hai -- magar chupke se nahi. Record par
 * source = 'correction' lagta hai aur wajah likhi jati hai, aur database
 * ka trigger purani qeemat attendance_audit mein rakh deta hai.
 */
export async function decideAttendanceCorrection(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user, role } = await whoAmI();
  if (!user) return { error: "Login karein." };
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Hazri par faisla sirf afsar, HR ya Admin kar sakte hain." };
  }

  const id = String(formData.get("correction_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("manager_comment") ?? "").trim();

  if (!id) return { error: "Kaun si darkhwast, wo saaf nahi." };
  if (!["approved", "rejected", "sent_back"].includes(decision)) {
    return { error: "Manzoor, na-manzoor, ya wapas — koi ek chunein." };
  }
  if (comment.length < 5) {
    return { error: "Apna comment likhein — kam az kam paanch harf. Faisla bina comment ke darj nahi hota." };
  }

  const { data: row } = await supabase
    .from("attendance_corrections")
    .select("id, profile_id, attendance_date, requested_status, requested_check_in, requested_check_out, status, reason")
    .eq("id", id)
    .maybeSingle();

  if (!row) return { error: "Darkhwast nahi mili — ya us par nazar ka haq nahi." };
  if (row.profile_id === user.id) {
    return { error: "Apni darkhwast khud manzoor nahi ki ja sakti." };
  }
  if (!["pending", "sent_back"].includes(row.status)) {
    return { error: `Is par pehle hi faisla ho chuka hai (${row.status}).` };
  }

  // Ye sawal database se poochha jata hai, code se nahi -- kyunke wahan
  // poori reporting ki zanjeer maujood hai.
  const { data: canDecide } = await supabase.rpc("fn_hr_can_decide_for", { p_target: row.profile_id });
  if (canDecide !== true) {
    return { error: "Ye banda aap ki reporting team mein nahi. Is ka faisla us ka apna afsar ya HR karega." };
  }

  if (await monthLocked(supabase, row.profile_id, row.attendance_date)) {
    return { error: "Us mahine ka hisaab band ho chuka hai. Pehle mahina kholna paRega." };
  }

  const now = new Date().toISOString();

  if (decision !== "approved") {
    const { error } = await supabase
      .from("attendance_corrections")
      .update({
        status: decision,
        manager_comment: comment,
        decided_by: user.id,
        decided_at: now,
      })
      .eq("id", id);
    if (error) return { error: error.message };

    await logAudit({
      actionType: "update",
      module: "hr",
      recordId: id,
      recordLabel: `Hazri darkhwast ${row.attendance_date}`,
      description: decision === "rejected" ? "Darkhwast na-manzoor" : "Darkhwast wapas bheji gayi",
      changes: { faisla: { pehle: row.status, ab: decision }, comment: { pehle: null, ab: comment } },
    });

    paths();
    return {
      success: true,
      notice: decision === "rejected" ? "Na-manzoor kar di gayi." : "Wapas bhej di gayi — banda dobara bhej sakta hai.",
    };
  }

  // Manzoori: pehle hazri badlein, phir darkhwast band karein. Ulta
  // karne par darkhwast "manzoor" dikhti rehti hai jab ke hazri par
  // kuch hua hi nahi.
  const record = {
    profile_id: row.profile_id,
    attendance_date: row.attendance_date,
    status: row.requested_status,
    check_in: row.requested_check_in,
    check_out: row.requested_check_out,
    source: "correction",
    last_changed_by: user.id,
    last_change_reason: `Darkhwast manzoor: ${row.reason} | Afsar: ${comment}`,
  };

  const { error: attErr } = await supabase
    .from("attendance_records")
    .upsert(record, { onConflict: "profile_id,attendance_date" });

  if (attErr) return { error: `Hazri update nahi hui, is liye darkhwast bhi khuli hai: ${attErr.message}` };

  const { error } = await supabase
    .from("attendance_corrections")
    .update({
      status: "approved",
      manager_comment: comment,
      decided_by: user.id,
      decided_at: now,
      applied_at: now,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "hr",
    recordId: id,
    recordLabel: `Hazri darkhwast ${row.attendance_date}`,
    description: "Darkhwast manzoor — hazri badal di gayi",
    changes: {
      status: { pehle: null, ab: record.status },
      check_in: { pehle: null, ab: record.check_in },
      check_out: { pehle: null, ab: record.check_out },
      comment: { pehle: null, ab: comment },
    },
  });

  paths();
  return { success: true, notice: "Manzoor — us din ki hazri badal di gayi, aur purani qeemat record par mehfooz hai." };
}

export async function cancelAttendanceCorrection(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user } = await whoAmI();
  if (!user) return { error: "Login karein." };

  const id = String(formData.get("correction_id") ?? "");
  if (!id) return { error: "Kaun si darkhwast, wo saaf nahi." };

  const { data: row } = await supabase
    .from("attendance_corrections")
    .select("profile_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Darkhwast nahi mili." };
  if (row.profile_id !== user.id) return { error: "Sirf apni darkhwast wapas li ja sakti hai." };
  if (!["pending", "sent_back"].includes(row.status)) {
    return { error: "Is par faisla ho chuka hai — ab wapas nahi li ja sakti." };
  }

  const { error } = await supabase
    .from("attendance_corrections")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) return { error: error.message };

  paths();
  return { success: true, notice: "Darkhwast wapas le li gayi." };
}

// =====================================================================
// 5) Afsar khud hazri lagaye
// =====================================================================
/**
 * Spec: "manager attendance manually bhi set kar sakta hai, magar
 * reason mandatory."
 *
 * Is liye yahan wajah ke baghair koi raasta nahi. Aur wo wajah record
 * par baithti hai (last_change_reason), sirf audit table mein nahi --
 * taake safha kholne wale ko bhi nazar aaye ke ye din haath se lagaya
 * gaya tha.
 */
export async function managerSetAttendance(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user, role } = await whoAmI();
  if (!user) return { error: "Login karein." };
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Hazri sirf afsar, HR ya Admin laga sakte hain." };
  }

  const profileId = String(formData.get("profile_id") ?? "");
  const date = String(formData.get("attendance_date") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!profileId || !date) return { error: "Mulazim aur tareekh dono zaroori hain." };
  if (!isStatus(status)) return { error: "Hazri ka darja theek nahi." };
  if (reason.length < 5) {
    return { error: "Wajah likhein — kam az kam paanch harf. Haath se lagayi hazri bina wajah ke darj nahi hoti." };
  }
  if (profileId === user.id && !HR_ROLES.includes(role)) {
    return { error: "Apni hazri khud nahi lagai ja sakti. Darkhwast dein — faisla aap ka afsar karega." };
  }

  const today = new Date().toISOString().split("T")[0];
  if (date > today) return { error: "Aane wale din ki hazri abhi nahi lagti." };

  const { data: canDecide } = await supabase.rpc("fn_hr_can_decide_for", { p_target: profileId });
  if (canDecide !== true) {
    return { error: "Ye banda aap ki reporting team mein nahi — is ki hazri aap nahi laga sakte." };
  }

  if (await monthLocked(supabase, profileId, date)) {
    return { error: "Us mahine ka hisaab band ho chuka hai. Pehle mahina kholna paRega." };
  }

  const checkIn = (formData.get("check_in") as string) || null;
  const checkOut = (formData.get("check_out") as string) || null;
  if (checkIn && checkOut && checkOut <= checkIn) {
    return { error: "Jane ka waqt aane ke waqt se pehle nahi ho sakta." };
  }

  const { data: before } = await supabase
    .from("attendance_records")
    .select("status, check_in, check_out, source")
    .eq("profile_id", profileId)
    .eq("attendance_date", date)
    .maybeSingle();

  const { error } = await supabase.from("attendance_records").upsert(
    {
      profile_id: profileId,
      attendance_date: date,
      status,
      check_in: checkIn,
      check_out: checkOut,
      source: "correction",
      last_changed_by: user.id,
      last_change_reason: reason,
    },
    { onConflict: "profile_id,attendance_date" }
  );

  if (error) return { error: error.message };

  await logAudit({
    actionType: before ? "update" : "create",
    module: "hr",
    recordId: `${profileId}:${date}`,
    recordLabel: `Hazri ${date}`,
    description: "Hazri haath se lagai gayi",
    changes: {
      status: { pehle: before?.status ?? null, ab: status },
      check_in: { pehle: before?.check_in ?? null, ab: checkIn },
      check_out: { pehle: before?.check_out ?? null, ab: checkOut },
      wajah: { pehle: null, ab: reason },
    },
  });

  paths();
  return {
    success: true,
    notice: before
      ? "Hazri badal di gayi — purani qeemat record par mehfooz hai."
      : "Hazri lagai gayi.",
  };
}

// =====================================================================
// 6) Mahina band karna aur kholna
// =====================================================================
export async function lockAttendanceMonth(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user, role } = await whoAmI();
  if (!user) return { error: "Login karein." };
  if (!role || !HR_ROLES.includes(role)) {
    return { error: "Mahina band karna sirf HR ya Admin ka kaam hai." };
  }

  const year = Number(formData.get("lock_year") ?? 0);
  const month = Number(formData.get("lock_month") ?? 0);
  const branchId = (formData.get("branch_id") as string) || null;

  if (!year || !month || month < 1 || month > 12) return { error: "Mahina aur saal theek se chunein." };

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = new Date(Date.UTC(year, month, 0)).toISOString().split("T")[0];

  // Khuli darkhwastein rehte hue mahina band karna wohi cheez chhupa
  // deta hai jis ke liye ye taala banaya tha.
  const { count: openCorr } = await supabase
    .from("attendance_corrections")
    .select("id", { count: "exact", head: true })
    .gte("attendance_date", from)
    .lte("attendance_date", to)
    .in("status", ["pending", "sent_back"]);

  const { count: openLeave } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .lte("from_date", to)
    .gte("to_date", from)
    .in("status", ["pending", "sent_back"]);

  const open = (openCorr ?? 0) + (openLeave ?? 0);
  if (open > 0 && formData.get("force") !== "yes") {
    return {
      error: `${open} darkhwastein abhi zer-e-ghaur hain. Pehle un par faisla karein — warna tankhwah adhoori hazri par banegi.`,
    };
  }

  const { error } = await supabase.from("attendance_month_locks").insert({
    branch_id: branchId,
    lock_year: year,
    lock_month: month,
    locked_by: user.id,
    note: (formData.get("note") as string) || null,
  });

  if (error) {
    if (error.message.includes("idx_month_lock_open")) {
      return { error: "Ye mahina pehle se band hai." };
    }
    return { error: error.message };
  }

  await logAudit({
    actionType: "update",
    module: "hr",
    recordId: `${year}-${month}`,
    recordLabel: `Hazri ka mahina ${month}/${year}`,
    description: "Mahina band kiya gaya — ab tankhwah is par ban sakti hai",
  });

  paths();
  revalidatePath("/admin/hr");
  return { success: true, notice: `${month}/${year} band ho gaya. Ab tankhwah is hazri par ban sakti hai.` };
}

export async function reopenAttendanceMonth(_prev: AttState, formData: FormData): Promise<AttState> {
  const { supabase, user, role } = await whoAmI();
  if (!user) return { error: "Login karein." };
  if (!role || !HR_ROLES.includes(role)) {
    return { error: "Mahina kholna sirf HR ya Admin ka kaam hai." };
  }

  const id = String(formData.get("lock_id") ?? "");
  const reason = String(formData.get("reopen_reason") ?? "").trim();

  if (!id) return { error: "Kaun sa mahina, wo saaf nahi." };
  if (reason.length < 5) {
    return { error: "Kholne ki wajah likhein — kam az kam paanch harf. Band mahina bila wajah nahi khulta." };
  }

  const { data: row } = await supabase
    .from("attendance_month_locks")
    .select("lock_year, lock_month, reopened_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Mahina nahi mila." };
  if (row.reopened_at) return { error: "Ye mahina pehle hi khula hua hai." };

  const { error } = await supabase
    .from("attendance_month_locks")
    .update({
      reopened_at: new Date().toISOString(),
      reopened_by: user.id,
      reopen_reason: reason,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "hr",
    recordId: id,
    recordLabel: `Hazri ka mahina ${row.lock_month}/${row.lock_year}`,
    description: "Band mahina dobara khola gaya",
    changes: { kholne_ki_wajah: { pehle: null, ab: reason } },
  });

  paths();
  revalidatePath("/admin/hr");
  return { success: true, notice: "Mahina khul gaya. Wajah record par mehfooz hai." };
}

// =====================================================================
// 7) Tankhwah ke form ke liye: us mahine ki hazri
// =====================================================================
/**
 * Ye rok nahi, DIKHAWA hai -- aur us ki apni wajah hai.
 *
 * Rok pehle se recordSalaryPayment mein hai: band mahine ke baghair
 * tankhwah nahi banti. Magar rok tab lagti hai jab banda form bhar
 * chuka hota hai. Us waqt tak wo apne zehen mein adad tay kar chuka
 * hota hai, aur rok sirf ek rukawat lagti hai.
 *
 * Is liye adad form par PEHLE dikhte hain: 22 din hazir, 3 din record
 * hi nahi, 2 darkhwastein khuli. Us ke baad jo tankhwah likhi jayegi,
 * wo dekh kar likhi jayegi.
 *
 * NULL ka matlab "parha nahi ja saka" hai -- sifar nahi.
 */
export async function fetchAttendanceMonth(
  profileId: string,
  year: number,
  month: number
): Promise<{
  workingDays: number;
  presentDays: number;
  halfDays: number;
  paidLeave: number;
  unpaidLeave: number;
  absentDays: number;
  missingDays: number;
  lateCount: number;
  workedMinutes: number;
  openItems: number;
  isFinalized: boolean;
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (!profileId || !year || month < 1 || month > 12) return null;

  const { data, error } = await supabase.rpc("fn_attendance_month_summary", {
    p_profile: profileId,
    p_year: year,
    p_month: month,
  });

  const r = data?.[0];
  if (error || !r) return null;

  return {
    workingDays: r.working_days,
    presentDays: r.present_days,
    halfDays: r.half_days,
    paidLeave: r.paid_leave_days,
    unpaidLeave: r.unpaid_leave_days,
    absentDays: r.absent_days,
    missingDays: r.missing_days,
    lateCount: r.late_count,
    workedMinutes: r.worked_minutes_total,
    openItems: r.open_items,
    isFinalized: r.is_finalized,
  };
}
