"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";

/**
 * Reminder templates aur Promise-to-Pay ka status -- do chhote server
 * actions, Khata Recovery module ke.
 *
 * Yahan `requireAction` isi liye lagaya gaya hai: Server Action us page
 * ke raaste hi POST hoti hai jahan se bulai gayi, is liye admin
 * middleware ka "view" wala rok pehle se lagta hai -- magar wo sirf
 * DEKHNE ki ijazat check karta hai. Template badalna ya promise ka
 * status update karna "edit" hai, aur us ke liye alag se poochhna
 * zaroori hai, warna jis banda ko sirf Recovery dekhne ki ijazat hai wo
 * bhi template mita sakta hai.
 */

export async function saveReminderTemplate(form: FormData) {
  const guard = await requireAction("finance.recovery", "edit");
  if ("error" in guard) return;

  const supabase = createClient();
  const id = String(form.get("id") || "");
  const templateName = String(form.get("name") || "").trim();
  const messageBody = String(form.get("body") || "").trim();
  if (!templateName || !messageBody) return;

  const row = {
    template_name: templateName,
    language: String(form.get("language") || "roman_urdu"),
    channel: String(form.get("channel") || "whatsapp"),
    reminder_stage: String(form.get("stage") || "friendly"),
    message_body: messageBody,
    is_active: form.get("active") === "on",
    created_by: guard.caller.userId,
  };

  if (id) {
    await supabase.from("reminder_templates").update(row).eq("id", id);
  } else {
    await supabase.from("reminder_templates").insert(row);
  }
  revalidatePath("/admin/finance/recovery/templates");
}

const PROMISE_STATUSES = [
  "open",
  "fulfilled",
  "partially_fulfilled",
  "broken_promise",
  "rescheduled",
  "cancelled",
] as const;

export async function updatePromiseStatus(form: FormData) {
  const guard = await requireAction("finance.recovery", "edit");
  if ("error" in guard) return;

  const supabase = createClient();
  const id = String(form.get("id") || "");
  const status = String(form.get("status") || "");
  if (!id || !PROMISE_STATUSES.includes(status as (typeof PROMISE_STATUSES)[number])) return;

  const update: { status: string; updated_at: string; fulfilled_amount?: number } = {
    status,
    updated_at: new Date().toISOString(),
  };
  // Poora wapas mila to fulfilled_amount bhi wahi vaada wali raqam ho
  // jati hai -- warna "Fulfilled" likha hoga magar amount khaali rahega.
  if (status === "fulfilled") update.fulfilled_amount = Number(form.get("promisedAmount") || 0);

  await supabase.from("payment_promises").update(update).eq("id", id);
  revalidatePath("/admin/finance/recovery/promises");
}
