"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function saveStaffDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Staff member select karein." };

  const payload = {
    profile_id: profileId,
    designation: (formData.get("designation") as string) || null,
    cnic: (formData.get("cnic") as string) || null,
    phone: (formData.get("phone") as string) || null,
    address: (formData.get("address") as string) || null,
    hire_date: (formData.get("hire_date") as string) || null,
    basic_salary: formData.get("basic_salary") ? Number(formData.get("basic_salary")) : null,
    bank_account: (formData.get("bank_account") as string) || null,
  };

  const { error } = await supabase.from("staff_details").upsert(payload, { onConflict: "profile_id" });
  if (error) return { error: error.message };

  revalidatePath("/admin/hr");
  return { success: true };
}

export async function markAttendance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const profileId = String(formData.get("profile_id") ?? "");
  const date = String(formData.get("attendance_date") ?? "");
  const status = String(formData.get("status") ?? "present");
  if (!profileId || !date) return { error: "Staff aur date zaroori hain." };

  const { error } = await supabase.from("attendance_records").upsert(
    {
      profile_id: profileId,
      attendance_date: date,
      status,
      check_in: (formData.get("check_in") as string) || null,
      check_out: (formData.get("check_out") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
    { onConflict: "profile_id,attendance_date" }
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/hr");
  return { success: true };
}

export async function recordSalaryPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const profileId = String(formData.get("profile_id") ?? "");
  const payMonth = Number(formData.get("pay_month") ?? 0);
  const payYear = Number(formData.get("pay_year") ?? 0);
  const basicSalary = Number(formData.get("basic_salary") ?? 0);
  const bonus = Number(formData.get("bonus") ?? 0);
  const deductions = Number(formData.get("deductions") ?? 0);
  const advanceDeduction = Number(formData.get("advance_deduction") ?? 0);

  if (!profileId || !payMonth || !payYear) return { error: "Staff, month aur year zaroori hain." };

  const netSalary = basicSalary + bonus - deductions - advanceDeduction;

  const { error } = await supabase.from("salary_payments").upsert(
    {
      profile_id: profileId,
      pay_month: payMonth,
      pay_year: payYear,
      basic_salary: basicSalary,
      bonus,
      deductions,
      advance_deduction: advanceDeduction,
      net_salary: netSalary,
      notes: (formData.get("notes") as string) || null,
    },
    { onConflict: "profile_id,pay_month,pay_year" }
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/hr");
  return { success: true };
}

export async function markSalaryPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const paymentId = String(formData.get("payment_id") ?? "");
  if (!paymentId) return { error: "Missing payment id." };

  const { error } = await supabase
    .from("salary_payments")
    .update({ status: "paid", paid_date: new Date().toISOString().split("T")[0] })
    .eq("id", paymentId);
  if (error) return { error: error.message };

  revalidatePath("/admin/hr");
  return { success: true };
}

export async function selfCheckIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();
  const lat = formData.get("lat") ? Number(formData.get("lat")) : null;
  const lng = formData.get("lng") ? Number(formData.get("lng")) : null;

  const { error } = await supabase.from("attendance_records").upsert(
    {
      profile_id: user.id,
      attendance_date: today,
      status: "present",
      check_in_at: now,
      check_in_lat: lat,
      check_in_lng: lng,
    },
    { onConflict: "profile_id,attendance_date" }
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/my-attendance");
  return { success: true };
}

// When check-out completes a full day (check-in + check-out both
// present), the day's wage (basic_salary / 30) is credited straight
// into the staff member's Khata - same pattern as farmer milk credit,
// so they can spend it (e.g. Grocery) or it becomes Salary Due at
// month-end.
export async function selfCheckOut(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();
  const lat = formData.get("lat") ? Number(formData.get("lat")) : null;
  const lng = formData.get("lng") ? Number(formData.get("lng")) : null;

  const { error } = await supabase
    .from("attendance_records")
    .update({ check_out_at: now, check_out_lat: lat, check_out_lng: lng })
    .eq("profile_id", user.id)
    .eq("attendance_date", today);
  if (error) return { error: error.message };

  const { data: staffDetails } = await supabase.from("staff_details").select("basic_salary").eq("profile_id", user.id).single();
  const basicSalary = Number(staffDetails?.basic_salary ?? 0);
  if (basicSalary > 0) {
    const dailyWage = Math.round((basicSalary / 30) * 100) / 100;
    await supabase.from("staff_credit_ledger").insert({
      profile_id: user.id,
      ledger_type: "credit",
      source_type: "daily_wage",
      amount: dailyWage,
      notes: `Daily wage - ${today}`,
      created_by: user.id,
    });
  }

  revalidatePath("/admin/my-attendance");
  revalidatePath("/admin/staff-khata");
  return { success: true };
}

export async function inviteStaffMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const serviceClient = createServiceClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "sales_staff");
  const branchId = (formData.get("branch_id") as string) || null;
  const designation = (formData.get("designation") as string) || null;
  const basicSalary = formData.get("basic_salary") ? Number(formData.get("basic_salary")) : null;

  if (!fullName) return { error: "Naam zaroori hai." };
  if (!email) return { error: "Email zaroori hai." };

  const { data: org } = await serviceClient.from("organizations").select("id").limit(1).single();

  const randomPassword = Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-6).toUpperCase() + "!1";

  const { data: authUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (createError) return { error: createError.message };
  if (!authUser.user) return { error: "Account create nahi ho saka." };

  const { error: profileError } = await serviceClient.from("profiles").upsert({
    id: authUser.user.id,
    full_name: fullName,
    role,
    branch_id: branchId,
    organization_id: org?.id ?? null,
    is_active: true,
  });
  if (profileError) return { error: profileError.message };

  if (designation || basicSalary) {
    await serviceClient.from("staff_details").insert({
      profile_id: authUser.user.id,
      designation,
      basic_salary: basicSalary,
    });
  }

  const { sendOfficialLoginEmail } = await import("@/lib/email");
  await sendOfficialLoginEmail(email, fullName, email, randomPassword);

  revalidatePath("/admin/hr");
  revalidatePath("/admin/users");
  return { success: true };
}

export async function bulkDeactivateStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const idsRaw = String(formData.get("ids") ?? "");
  const ids = idsRaw.split(",").filter(Boolean);
  if (ids.length === 0) return { error: "Koi Staff select nahi hui." };

  const { error } = await supabase.from("profiles").update({ is_active: false }).in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/admin/hr");
  return { success: true };
}