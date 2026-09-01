import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPaymentReminder } from "@/lib/machinery/payment-reminder";

export const dynamic = "force-dynamic";

// cPanel Cron Job is URL ko roz ek dafa maarta hai:
// curl "https://alranatraders.pk/api/cron/machinery-payment-reminders?token=YOUR_SECRET"
//
// Roz ek dafa jaan boojh kar hai. Kisan ko din mein teen dafa paisa
// maangne ka paighaam bhejna wo cheez hai jis se log number block kar
// dete hain -- aur phir wo paighaam bhi nahi pahunchta jo waqai zaroori
// ho.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Jin ka wada aa chuka hai aur paisa abhi baqi hai. Dono shartein
  // qatar khud lagati hai (164) -- yahan sirf aaj ka din chunte hain.
  const { data: due, error } = await supabase
    .from("v_machinery_payment_due")
    .select("*")
    .eq("wada_aa_gaya", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  let bheje = 0;
  let nakaam = 0;
  let chhore = 0;

  for (const row of due ?? []) {
    // Aaj pehle hi ja chuka ho to dobara nahi. Ek din, ek paighaam.
    const aakhri = row.aakhri_reminder as string | null;
    if (aakhri && aakhri.slice(0, 10) === today) {
      chhore += 1;
      continue;
    }

    const res = await sendPaymentReminder(
      {
        bookingId: row.booking_id as string,
        bookingNumber: (row.booking_number as string) ?? "-",
        farmerId: (row.farmer_id as string | null) ?? null,
        farmerName: (row.farmer_name as string | null) ?? null,
        phone: (row.farmer_phone as string | null) ?? null,
        amount: Number(row.baqi ?? 0),
        promiseDate: (row.payment_promise_date as string | null) ?? null,
      },
      null
    );

    if (res.ok) bheje += 1;
    else nakaam += 1;
  }

  return NextResponse.json({ bheje, nakaam, chhore, kul: (due ?? []).length });
}
