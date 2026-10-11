"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";

/** Configure the real daily job without asking staff to paste shell commands. */
export async function configureRecoverySchedule(): Promise<void> {
  const guard = await requireAction("system.receivable_reminders", "edit");
  if ("error" in guard) throw new Error(guard.error);
  if (!guard.caller.unrestricted) throw new Error("Sirf Admin/Owner daily schedule chalu kar sakta hai.");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("ktskwawkslaznkjjacni.supabase.co")) {
    throw new Error("Testing se live recovery messages schedule nahi kiye ja sakte.");
  }
  if (!process.env.CRON_SECRET || !process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_RECOVERY_TEMPLATE) {
    throw new Error("Server par CRON_SECRET, WhatsApp credentials aur approved recovery template set karein.");
  }
  const service = createServiceClient() as any;
  const { error } = await service.rpc("configure_receivable_reminder_cron", { p_secret: process.env.CRON_SECRET });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/receivable-reminders");
}

/** Wasooli settings (migration 523). Form action -- ghalti par kuch nahi badalta. */
export async function updateRecoverySettings(formData: FormData): Promise<void> {
  const guard = await requireAction("system.receivable_reminders", "edit");
  if ("error" in guard) throw new Error(guard.error);
  if (!guard.caller.unrestricted) throw new Error("Sirf Admin/Owner recovery policy badal sakta hai.");
  const num = (k: string, d: number) => {
    const v = Number(String(formData.get(k) ?? "").replace(/,/g, ""));
    return Number.isFinite(v) && v >= 0 ? v : d;
  };
  const effectiveFrom = String(formData.get("effective_from") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || Number.isNaN(Date.parse(effectiveFrom))) throw new Error("Start date theek likhein.");
  const limitRaw = String(formData.get("default_credit_limit") ?? "").replace(/,/g, "").trim();
  const limit = limitRaw === "" ? null : Number(limitRaw);
  const service = createServiceClient() as any;
  const { error } = await service
    .from("receivable_recovery_settings")
    .update({
      effective_from: effectiveFrom,
      reminder_interval_days: Math.max(1, Math.min(365, Math.round(num("reminder_interval_days", 7)))),
      reminders_enabled: formData.get("reminders_enabled") === "on",
      block_overdue_credit: formData.get("block_overdue_credit") === "on",
      due_days: Math.max(1, Math.round(num("due_days", 30))),
      reminder_day: Math.max(1, Math.round(num("reminder_day", 15))),
      final_notice_day: Math.max(1, Math.round(num("final_notice_day", 30))),
      min_amount: Math.max(0.01, num("min_amount", 0.01)),
      default_credit_limit: limit != null && Number.isFinite(limit) && limit >= 0 ? limit : null,
      updated_at: new Date().toISOString(),
      updated_by: guard.caller.userId,
    })
    .eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/receivable-reminders");
}

/** Ek gahak ki yaad-dihani: pause / chalu / X din tak skip. */
export async function setReminderPref(formData: FormData): Promise<void> {
  const guard = await requireAction("system.receivable_reminders", "edit");
  if ("error" in guard) throw new Error(guard.error);
  if (!guard.caller.unrestricted) throw new Error("Sirf Admin/Owner recovery policy badal sakta hai.");
  const customerId = String(formData.get("customer_id") ?? "");
  const op = String(formData.get("op") ?? "");
  if (!customerId) throw new Error("Gahak nahi chuna.");
  const row: Record<string, unknown> = {
    customer_id: customerId,
    updated_at: new Date().toISOString(),
    updated_by: guard.caller.userId,
  };
  if (op === "pause") row.paused = true;
  else if (op === "resume") { row.paused = false; row.skip_until = null; }
  else if (op === "skip7") row.skip_until = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  else throw new Error("Na-maloom amal.");
  const service = createServiceClient() as any;
  const { error } = await service.from("receivable_reminder_prefs").upsert(row, { onConflict: "customer_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/receivable-reminders");
}
