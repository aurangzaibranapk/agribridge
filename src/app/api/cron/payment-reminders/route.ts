import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { khataReminderText } from "@/lib/sms/deliver";
import { nextSmsAttempt, sendVeevoSms, toVeevoReceiver, veevoEnv, veevoReady } from "@/lib/sms/veevo";

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
    .select("id,party_type,party_id,outstanding_amount,due_date,channel,failure_reason")
    .limit(100);
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  const reminders = claimed ?? [];
  const env = veevoEnv();
  if (!veevoReady(env)) {
    // Paid WhatsApp template band hai. Veevo set na ho to "sent" jhoot nahi.
    let sent = 0;
    const failed = reminders.length;
    await Promise.all(
      reminders.map((reminder: { id: string }) =>
        service
          .from("payment_reminders")
          .update({ delivery_status: "failed", failure_reason: "WhatsApp (paid) reminders filhal band hain — kharcha bachane ke liye." })
          .eq("id", reminder.id)
      )
    );
    return NextResponse.json({ processed: reminders.length, sent, failed });
  }

  let sent = 0;
  let failed = 0;
  for (const reminder of reminders as { id: string; party_type: string; party_id: string; outstanding_amount: number; due_date: string | null; failure_reason: string | null }[]) {
    const phone = await partyPhone(service, reminder.party_type, reminder.party_id);
    if (!phone || !toVeevoReceiver(phone)) {
      failed += 1;
      await service.from("payment_reminders").update({
        delivery_status: "failed", channel: "sms", failure_reason: "Phone darj nahi.",
      }).eq("id", reminder.id);
      continue;
    }
    const result = await sendVeevoSms({
      to: phone,
      text: khataReminderText(Number(reminder.outstanding_amount), reminder.due_date),
      env,
    });
    if (result.sent) {
      sent += 1;
      await service.from("payment_reminders").update({
        delivery_status: "sent", channel: "sms", sent_at: new Date().toISOString(),
        external_message_id: result.messageId, failure_reason: null,
      }).eq("id", reminder.id);
    } else if (result.retryable) {
      const prior = Number(/^retry (\d+):/.exec(reminder.failure_reason ?? "")?.[1] ?? 0);
      const next = nextSmsAttempt(prior);
      failed += 1;
      await service.from("payment_reminders").update({
        delivery_status: next.status === "queued" ? "scheduled" : "failed",
        channel: "sms",
        scheduled_at: next.nextAttemptAt,
        failure_reason: `retry ${next.attempts}: ${result.reason}`.slice(0, 180),
      }).eq("id", reminder.id);
    } else {
      failed += 1;
      await service.from("payment_reminders").update({
        delivery_status: "failed", channel: "sms", failure_reason: result.reason.slice(0, 180),
      }).eq("id", reminder.id);
    }
  }
  return NextResponse.json({ processed: reminders.length, sent, failed });
}

async function partyPhone(service: { from: (table: string) => { select: (cols: string) => { eq: (col: string, value: string) => { maybeSingle: () => Promise<{ data: { phone_number?: string | null } | null }> } } } }, type: string, id: string): Promise<string | null> {
  const table = type === "farmer" ? "farmers" : type === "customer" ? "customers" : type === "dealer" ? "dealers" : "";
  if (!table) return null;
  const { data } = await service.from(table).select("phone_number").eq("id", id).maybeSingle();
  return data?.phone_number ?? null;
}
