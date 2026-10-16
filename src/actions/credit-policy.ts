"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";

/** Aam udhaar rok (Settings › Udhaar Policy, 537). Sirf Admin/Owner. */
export async function updateCreditPolicy(formData: FormData): Promise<void> {
  const guard = await requireAction("system.receivable_reminders", "edit");
  if ("error" in guard) throw new Error(guard.error);
  if (!guard.caller.unrestricted) throw new Error("Sirf Admin/Owner udhaar policy badal sakta hai.");
  const days = Math.round(Number(formData.get("due_days")));
  if (!(days >= 1 && days <= 365)) throw new Error("Aam hadd 1 se 365 din.");
  const min = Number(String(formData.get("min_amount") ?? "0.01").replace(/,/g, ""));
  const effectiveFrom = String(formData.get("effective_from") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("Start date theek likhein.");
  const reasons = String(formData.get("override_reasons") ?? "")
    .split(/\r?\n/).map((r) => r.trim()).filter((r) => r.length >= 3).slice(0, 20);
  const service = createServiceClient() as any;
  const { error } = await service.from("receivable_recovery_settings").update({
    block_overdue_credit: formData.get("block_overdue_credit") === "on",
    due_days: days,
    min_amount: Number.isFinite(min) && min >= 0.01 ? min : 0.01,
    effective_from: effectiveFrom,
    ...(reasons.length ? { override_reasons: reasons } : {}),
    updated_at: new Date().toISOString(),
    updated_by: guard.caller.userId,
  }).eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings/credit-policy");
  revalidatePath("/admin/receivable-reminders");
}

/** Ek gahak ki hadd: aam / apni din / koi hadd nahi. DB function khud Admin jaanchta hai. */
export async function setCustomerOverduePolicy(formData: FormData): Promise<void> {
  const customerId = String(formData.get("customer_id") ?? "");
  const mode = String(formData.get("mode") ?? "global");
  const days = mode === "party" ? Math.round(Number(formData.get("days"))) : null;
  const until = String(formData.get("until") ?? "").trim() || null;
  const reason = String(formData.get("reason") ?? "").trim();
  if (mode === "party" && !(days! >= 1 && days! <= 365)) throw new Error("Din 1 se 365 likhein.");
  const supabase = createClient() as any;
  const { error } = await supabase.rpc("set_customer_overdue_policy", {
    p_customer: customerId, p_days: days, p_exempt: mode === "exempt", p_reason: reason || (mode === "global" ? "Aam setting par wapas" : ""), p_until: until,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/crm/${customerId}/credit`);
}
