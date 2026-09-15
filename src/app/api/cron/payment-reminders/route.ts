import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";

/**
 * Har chand minute mein chalta hai (cron) — jo reminder "scheduled" aur
 * waqt aa chuka, wo bhej deta hai.
 *
 * User session yahan kabhi nahi hoti -- cron koi login nahi karta. Is
 * liye tasdeeq ek shared secret (CRON_SECRET) se, jo scheduler khud
 * header mein bhejta hai.
 *
 * Qatarein pehle SELECT kar ke phir ek ek kar ke bhejna -- agar cron do
 * dafa ek sath chal jaye (retry, ya platform ka apna overlap) to dono
 * ko wahi "scheduled" qatarein mil jatin aur paighaam do dafa jata.
 * Is liye pehle claim karte hain (status "processing" par le aate
 * hain), aur claim ke baad hi bhejte hain -- doosra cron ab inhen
 * "scheduled" mein nahi paayega.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient() as any;
  const now = new Date().toISOString();

  const { data: claimed, error: claimError } = await service
    .from("payment_reminders")
    .update({ delivery_status: "processing" })
    .eq("delivery_status", "scheduled")
    .lte("scheduled_at", now)
    .select("id,party_type,party_id,outstanding_amount,due_date,channel")
    .limit(100);
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  const reminders = claimed ?? [];
  const config: Record<string, { table: string; name: string; phone: string }> = {
    customer: { table: "customers", name: "name", phone: "phone_number" },
    farmer: { table: "farmers", name: "full_name", phone: "whatsapp_number" },
    dealer: { table: "dealers", name: "business_name", phone: "phone_number" },
    supplier: { table: "suppliers", name: "name", phone: "phone_number" },
  };
  const template = process.env.WHATSAPP_PAYMENT_REMINDER_TEMPLATE;

  let sent = 0;
  let failed = 0;
  for (const reminder of reminders) {
    try {
      if (reminder.channel !== "whatsapp") throw new Error(`${reminder.channel} gateway is not configured.`);
      if (!template) throw new Error("WHATSAPP_PAYMENT_REMINDER_TEMPLATE set nahi hai.");
      const c = config[reminder.party_type];
      if (!c) throw new Error("Unsupported party type.");
      const { data: party } = await service.from(c.table).select(`${c.name},${c.phone}`).eq("id", reminder.party_id).maybeSingle();
      const name = party?.[c.name];
      const phone = party?.[c.phone];
      if (!phone) throw new Error("WhatsApp number missing.");
      await sendWhatsAppTemplate(phone, template, process.env.WHATSAPP_PAYMENT_REMINDER_LANGUAGE || "en", [
        name || "Customer",
        Math.round(Number(reminder.outstanding_amount)).toLocaleString("en-PK"),
        reminder.due_date || "as soon as possible",
      ]);
      await service.from("payment_reminders").update({ delivery_status: "sent", sent_at: now, failure_reason: null }).eq("id", reminder.id);
      sent++;
    } catch (err) {
      await service
        .from("payment_reminders")
        .update({ delivery_status: "failed", failure_reason: err instanceof Error ? err.message : "Send failed" })
        .eq("id", reminder.id);
      failed++;
    }
  }
  return NextResponse.json({ processed: reminders.length, sent, failed });
}
