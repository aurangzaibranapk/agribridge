import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

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
  // Malik (16 September): WhatsApp ka paid (template) raasta filhal
  // band -- Khata Recovery reminder isi se jata hai. Qatarein claim ho
  // kar "failed" par likh di jati hain, "sent" kabhi jhoot nahi bolta.
  let sent = 0;
  let failed = reminders.length;
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
