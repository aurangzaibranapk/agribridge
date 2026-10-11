import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { DEFAULT_RECOVERY_SETTINGS, blockMessage, computeBranchAging, isCreditBlocked, recoveryPolicyActive, pkDate, type BranchCreditTxn, type RecoverySettings } from "./aging";

export async function getRecoverySettings(): Promise<RecoverySettings> {
  const service = createServiceClient() as any;
  const { data, error } = await service.from("receivable_recovery_settings").select("*").eq("id", true).maybeSingle();
  if (error || !data) throw new Error("Udhaar policy verify nahi ho saki; naya udhaar band hai. Naqad bikri ho sakti hai.");
  return {
    effective_from: String(data.effective_from ?? DEFAULT_RECOVERY_SETTINGS.effective_from),
    reminder_interval_days: Number(data.reminder_interval_days ?? 7),
    due_days: Number(data.due_days ?? 30),
    reminder_day: Number(data.reminder_day ?? 15),
    final_notice_day: Number(data.final_notice_day ?? 30),
    block_overdue_credit: Boolean(data.block_overdue_credit),
    default_credit_limit: data.default_credit_limit == null ? null : Number(data.default_credit_limit),
    min_amount: Number(data.min_amount ?? 0.01),
    reminders_enabled: Boolean(data.reminders_enabled),
  };
}

/**
 * 30 din wali rok. Naqad bikri (khata 0) par kabhi nahi lagti.
 * Wapas: null = theek; warna Roman Urdu ghalti.
 * Override: sirf owner/super_admin/admin, wajah lazmi, credit_block_overrides mein darj.
 */
export async function checkOverdueCreditBlock(input: {
  customerId: string | null;
  khataAmount: number;
  context: string;
  overrideReason?: string | null;
}): Promise<string | null> {
  if (!input.customerId || !(Number(input.khataAmount) > 0)) return null;
  let settings: RecoverySettings;
  try { settings = await getRecoverySettings(); } catch (e) { return e instanceof Error ? e.message : "Udhaar policy verify nahi ho saki."; }
  if (!recoveryPolicyActive(settings, pkDate(new Date().toISOString()))) return null;
  if (!settings.block_overdue_credit && settings.default_credit_limit == null) return null;

  const service = createServiceClient() as any;
  const { data: cust, error: customerError } = await service
    .from("customers")
    .select("name, current_balance, credit_limit")
    .eq("id", input.customerId)
    .maybeSingle();
  if (customerError || !cust) return "Gahak ka khata verify nahi ho saka; naya udhaar band hai.";
  const name = cust.name;

  let msg: string | null = null;
  let overdue = 0;
  let oldestDays: number | null = null;

  const { data: rows, error } = await service.rpc("fn_customer_receivable_aging", {
    p_as_of: null,
    p_customer: input.customerId,
  });
  if (error) return "Purane baqaye ki jaanch nahi ho saki; naya udhaar band hai. Naqad bikri ho sakti hai.";
  const row = (rows ?? [])[0];
  if (row) {
    const aging = { balance: Number(row.balance), oldestDays: row.oldest_days == null ? null : Number(row.oldest_days) };
    if (isCreditBlocked(aging, settings)) {
      overdue = Number(row.bucket_30_plus ?? row.balance);
      oldestDays = aging.oldestDays;
      msg = blockMessage(name, overdue, aging.oldestDays ?? 0);
    }
  }

  // Aam hadd (setting): sirf un gahakon par jin ki apni hadd darj nahi.
  const ownLimit = cust?.credit_limit == null ? 0 : Number(cust.credit_limit);
  if (!msg && ownLimit <= 0 && settings.default_credit_limit != null && settings.default_credit_limit > 0) {
    const abTak = Number(cust?.current_balance ?? 0);
    if (abTak + Number(input.khataAmount) > settings.default_credit_limit) {
      msg = `"${name}" ki aam udhaar hadd Rs ${settings.default_credit_limit.toLocaleString("en-PK")} hai, pehle hi Rs ${Math.round(abTak).toLocaleString("en-PK")} baqi hai. Ye udhaar hadd se aage hai -- sirf Admin/Owner wajah likh kar ijazat de sakta hai.`;
    }
  }
  if (!msg) return null;

  const reason = (input.overrideReason ?? "").trim();
  if (!reason) return msg;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return msg;
  const { data: profile } = await service.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !UNRESTRICTED_ROLES.includes(profile.role)) {
    return msg + " (Override sirf Admin, Super Admin ya Owner kar sakta hai.)";
  }
  if (reason.length < 3) return "Override ki wajah saaf likhein.";
  // POS override is logged atomically by the database trigger with the sale.
  if (input.context === "pos") return null;
  const { error: logErr } = await service.from("credit_block_overrides").insert({
    customer_id: input.customerId,
    context: input.context,
    amount: Number(input.khataAmount),
    overdue_amount: overdue,
    oldest_days: oldestDays,
    reason,
    overridden_by: user.id,
    overridden_role: profile.role,
  });
  if (logErr) return "Override darj nahi ho saka, is liye udhaar rok diya gaya: " + logErr.message;
  return null;
}

/**
 * Wohi 30 din wali rok, branch (dealer/agri order) ke udhaar par.
 * Aging branch_credit_transactions se (computeBranchAging, FIFO).
 * Advance order par nahi lagti (paisa pehle aata hai).
 * Override: wohi -- Admin/Super Admin/Owner, wajah lazmi, credit_block_overrides (branch_id) mein darj.
 */
export async function checkOverdueBranchCreditBlock(input: {
  branchId: string | null;
  orderAmount: number;
  context: string;
  overrideReason?: string | null;
}): Promise<string | null> {
  if (!input.branchId || !(Number(input.orderAmount) > 0)) return null;
  let settings: RecoverySettings;
  try { settings = await getRecoverySettings(); } catch (e) { return e instanceof Error ? e.message : "Udhaar policy verify nahi ho saki."; }
  if (!recoveryPolicyActive(settings, pkDate(new Date().toISOString()))) return null;
  if (!settings.block_overdue_credit) return null;

  const service = createServiceClient() as any;
  const { data: br } = await service.from("branches").select("name").eq("id", input.branchId).maybeSingle();
  const name = br?.name ?? "Branch";
  const { data: txns, error: txnError } = await service
    .from("branch_credit_transactions")
    .select("transaction_type, amount, created_at")
    .eq("branch_id", input.branchId);
  if (txnError) return "Branch ka purana baqaya verify nahi ho saka; naya udhaar band hai.";
  const asOf = pkDate(new Date().toISOString());
  const aging = computeBranchAging((txns ?? []) as BranchCreditTxn[], asOf, settings.due_days);
  if (!isCreditBlocked(aging, settings)) return null;
  const overdue = aging.bucket30plus || aging.balance;
  const msg = blockMessage(name, overdue, aging.oldestDays ?? 0);

  const reason = (input.overrideReason ?? "").trim();
  if (!reason) return msg;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return msg;
  const { data: profile } = await service.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !UNRESTRICTED_ROLES.includes(profile.role)) {
    return msg + " (Override sirf Admin, Super Admin ya Owner kar sakta hai.)";
  }
  if (reason.length < 3) return "Override ki wajah saaf likhein.";
  const { error: logErr } = await service.from("credit_block_overrides").insert({
    customer_id: null,
    branch_id: input.branchId,
    context: input.context,
    amount: Number(input.orderAmount),
    overdue_amount: overdue,
    oldest_days: aging.oldestDays,
    reason,
    overridden_by: user.id,
    overridden_role: profile.role,
  });
  if (logErr) return "Override darj nahi ho saka, is liye udhaar rok diya gaya: " + logErr.message;
  return null;
}
