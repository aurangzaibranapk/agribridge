"use server";
import { revalidatePath } from "next/cache";
import { failed, postSalaryPaid } from "@/lib/ledger/rules";
import { createClient } from "@/lib/supabase/server";
import { postStaffLedger } from "@/lib/ledger/rules";
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

/**
 * Hazri lagana -- ab yahan se nahi.
 *
 * Pehle ye seedha upsert karta tha: agar us din ka record maujood tha
 * to naya usay MITA kar aage baRh jata tha. Kaun tha, kya tha, kis ne
 * badla, kyun -- kisi ka jawab nahi bachta tha.
 *
 * Ab wo kaam managerSetAttendance (hr-attendance.ts) karta hai, jahan
 * wajah lazmi hai, reporting ki hadd lagti hai, band mahina roka jata
 * hai, aur purani qeemat attendance_audit mein reh jati hai.
 *
 * Ye function jaan boojh kar chhoRa gaya hai magar khali nahi: agar
 * kahin purana form bacha ho to wo chup chaap hazri na badal de, balke
 * saaf keh de ke ab raasta kaun sa hai.
 */
export async function markAttendance(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  return {
    error:
      "Hazri ab yahan se nahi lagti. Attendance Calendar kholein — wahan din par click kar ke, wajah likh kar hazri lagti hai, aur purani qeemat record par mehfooz rehti hai.",
  };
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

  // ---------------------------------------------------------------
  // Hazri band hui ya nahi -- ye poochhna LAZMI hai
  // ---------------------------------------------------------------
  // Spec ka saaf hukm: payroll sirf mukammal hazri par bane, aur agar
  // koi darkhwast abhi zer-e-ghaur ho to pehle us par khabardar kare.
  //
  // Ye rok "block" nahi, "poochh kar aage" hai: kabhi kabhi tankhwah
  // waqt par deni paRti hai. Magar us soorat mein wo faisla SOCH KAR
  // hota hai, ittefaqan nahi -- aur form par nishan reh jata hai.
  const { data: monthRows, error: monthErr } = await supabase.rpc("fn_attendance_month_summary", {
    p_profile: profileId,
    p_year: payYear,
    p_month: payMonth,
  });

  const m = monthRows?.[0] ?? null;

  if (monthErr || !m) {
    // "Parha nahi ja saka" ko "sab theek hai" nahi samjha jata.
    return {
      error:
        "Is mahine ki hazri parhi nahi ja saki, is liye tankhwah nahi banai. Hazri Calendar kholein aur dobara koshish karein.",
    };
  }

  if ((!m.is_finalized || m.open_items > 0) && formData.get("ack_unfinalized") !== "yes") {
    const bits: string[] = [];
    if (!m.is_finalized) bits.push("ye mahina abhi band nahi hua");
    if (m.open_items > 0) bits.push(`${m.open_items} darkhwastein abhi zer-e-ghaur hain`);
    return {
      error: `Hazri mukammal nahi: ${bits.join(", ")}. Pehle mahina band karein — ya form par "hazri adhoori hai, phir bhi banayein" par nishan lagayein.`,
    };
  }

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

/**
 * Tankhwah dena.
 *
 * Pehle ye sirf ek nishan lagata tha: status = 'paid'. Paisa nikalta
 * tha aur na cash book ko pata chalta tha, na ledger ko -- yani mahine
 * ki sab se baRi nikasi kisi kitab mein nahi aati thi. postSalaryPaid()
 * rules.ts mein maujood tha magar usay koi bulata hi nahi tha.
 *
 * Ab kis khate se nikla, ye poochhna zaroori hai. Bina us ke ye maloom
 * hi nahi hota ke paisa naqad diya gaya ya bank se -- aur raat ki ginti
 * mein farq nikal aata hai jis ki wajah nahi milti.
 */
export async function markSalaryPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const paymentId = String(formData.get("payment_id") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  if (!paymentId) return { error: "Kaun si tankhwah, wo saaf nahi." };
  if (!accountId) return { error: "Kis khate se di ja rahi hai, wo chunein." };

  const { data: row } = await supabase
    .from("salary_payments")
    .select("id, profile_id, net_salary, advance_deduction, status, pay_month, pay_year")
    .eq("id", paymentId)
    .maybeSingle();
  if (!row) return { error: "Ye tankhwah nahi mili." };
  if (row.status === "paid") return { error: "Ye tankhwah pehle hi di ja chuki hai." };

  const net = Number(row.net_salary);
  const advance = Number(row.advance_deduction ?? 0);

  // Cash book ki qatar pehle. Balance us par trigger khud hilata hai
  // (127) -- yahan se nahi.
  const { data: txn, error: txnError } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: accountId,
      transaction_type: "expense",
      category: "Salary",
      amount: net,
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: `Tankhwah ${row.pay_month}/${row.pay_year}`,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (txnError) return { error: `Cash book mein darj nahi hui: ${txnError.message}` };

  const posted = await postSalaryPaid({
    profileId: row.profile_id,
    gross: net + advance,
    advanceAdjusted: advance,
    accountId,
    description: `Tankhwah ${row.pay_month}/${row.pay_year}`,
    ctx: { createdBy: user?.id ?? null, claims: [{ table: "finance_transactions", rowId: txn.id }] },
  });

  // Ledger mein na ja sake to qatar bhi hata di jati hai. Yahan ye theek
  // hai (POS ke ulat, jahan maal gahak ke haath mein ja chuka hota hai):
  // is lamhe tak kuch hua nahi, sirf likha ja raha tha.
  if (failed(posted)) {
    await supabase.from("finance_transactions").delete().eq("id", txn.id);
    return { error: `Ledger mein nahi gayi, is liye tankhwah darj nahi ki: ${posted.error}` };
  }

  const { error } = await supabase
    .from("salary_payments")
    .update({ status: "paid", paid_date: new Date().toISOString().split("T")[0] })
    .eq("id", paymentId);
  if (error) return { error: error.message };

  revalidatePath("/admin/hr");
  revalidatePath("/admin/finance");
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

  // Upsert JAAN BOOJH KAR nahi. Agar us din ka record pehle se hai --
  // manzoor shuda chhutti, ya afsar ki lagayi hazri -- to upsert usay
  // chup chaap "present" bana deta tha. Ab record maujood ho to check-in
  // rukta hai aur wajah batata hai.
  const { data: already } = await supabase
    .from("attendance_records")
    .select("status, check_in_at, source")
    .eq("profile_id", user.id)
    .eq("attendance_date", today)
    .maybeSingle();

  if (already) {
    if (already.check_in_at) return { error: "Aaj ka check-in pehle ho chuka hai." };
    if (already.source === "leave") {
      return { error: "Aaj aap ki manzoor shuda chhutti hai. Aaye hain to HR ko batayein — wohi is din ko badal sakte hain." };
    }
    return { error: `Aaj ka record pehle se maujood hai (${already.status}). Badalne ke liye darkhwast dein.` };
  }

  const { error } = await supabase.from("attendance_records").insert({
    profile_id: user.id,
    attendance_date: today,
    status: "present",
    source: "web",
    check_in_at: now,
    check_in_lat: lat,
    check_in_lng: lng,
  });
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

  // .eq("check_out_at", null) ki jagah .is(...) -- aur ye shart hi wo
  // cheez hai jo dobara check-out par dobara dihari chaRhne se rokti
  // hai. Bina is ke button do dafa dabana do din ki dihari bana deta
  // tha, aur wo farq kisi kitab mein nazar nahi aata tha.
  const { data: updated, error } = await supabase
    .from("attendance_records")
    .update({ check_out_at: now, check_out_lat: lat, check_out_lng: lng })
    .eq("profile_id", user.id)
    .eq("attendance_date", today)
    .is("check_out_at", null)
    .select("id");
  if (error) return { error: error.message };

  if (!updated || updated.length === 0) {
    return { error: "Aaj ka check-out pehle ho chuka hai — ya aaj ka check-in hi nahi hua." };
  }

  const { data: staffDetails } = await supabase.from("staff_details").select("basic_salary").eq("profile_id", user.id).single();
  const basicSalary = Number(staffDetails?.basic_salary ?? 0);
  if (basicSalary > 0) {
    const dailyWage = Math.round((basicSalary / 30) * 100) / 100;
    const { data: wageRow } = await supabase
      .from("staff_credit_ledger")
      .insert({
        profile_id: user.id,
        ledger_type: "credit",
        source_type: "daily_wage",
        amount: dailyWage,
        notes: `Daily wage - ${today}`,
        created_by: user.id,
      })
      .select("id")
      .single();

    // Dihari us din kharcha ban jati hai jis din kaam hua, na ke jis din
    // paisa diya gaya. Sirf dene par likhein to mahine ke beech mein ye
    // nazar nahi aata ke kitni tankhwah ban chuki hai.
    if (wageRow?.id) {
      await postStaffLedger({
        profileId: user.id,
        amount: dailyWage,
        ledgerType: "credit",
        sourceType: "daily_wage",
        description: `Dihari — ${today}`,
        ctx: { createdBy: user.id, claims: [{ table: "staff_credit_ledger", rowId: wageRow.id }] },
      });
    }
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