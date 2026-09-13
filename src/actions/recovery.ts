"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveReminderTemplate(form: FormData) {
  const db=createClient() as any;
  const {data:{user}}=await db.auth.getUser(); if(!user) return;
  const id=String(form.get("id")||"");
  const row={template_name:String(form.get("name")||""),language:String(form.get("language")||"roman_urdu"),channel:String(form.get("channel")||"whatsapp"),reminder_stage:String(form.get("stage")||"friendly"),message_body:String(form.get("body")||""),is_active:form.get("active")==="on",created_by:user.id};
  if(!row.template_name||!row.message_body) return;
  if(id) await db.from("reminder_templates").update(row).eq("id",id); else await db.from("reminder_templates").insert(row);
  revalidatePath("/admin/finance/recovery/templates");
}

export async function updatePromiseStatus(form: FormData) {
  const db=createClient() as any;
  const id=String(form.get("id")||""); const status=String(form.get("status")||"");
  if(!id||!["open","fulfilled","partially_fulfilled","broken_promise","rescheduled","cancelled"].includes(status)) return;
  const update:any={status,updated_at:new Date().toISOString()};
  if(status==="fulfilled") update.fulfilled_amount=Number(form.get("promisedAmount")||0);
  await db.from("payment_promises").update(update).eq("id",id);
  revalidatePath("/admin/finance/recovery/promises");
}
