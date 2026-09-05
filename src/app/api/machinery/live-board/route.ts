import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Live board ka data.
 *
 * Ye pehle booking ke PURANE khanon se parhta tha -- acres, hours,
 * days, total_amount. Nayi zanjeer un mein se koi nahi likhti (raqba
 * ab harvest_area mein hai, aur raqam bill par banti hai), is liye
 * board par "null Days" aur "Rs NaN" nazar aate the.
 *
 * Ab wohi qatar jo baqi poora module dekhta hai (v_machinery_control).
 * Isi mein "agla kaam" bhi pehle se nikla hua hai -- board ko wo khud
 * sochna nahi parta, aur board ka jawab aur fehrist ka jawab hamesha
 * ek hi rehta hai.
 *
 * Aur ek usool: jo cheez maloom nahi, us ki jagah KHAALI nahi chhorte
 * -- us ka naam likhte hain. "Tareekh tay nahi" batata hai ke kya
 * karna hai; "--" sirf ye batata hai ke system ko pata nahi.
 */
export async function GET() {
  // Live board admin panel ka andaruni safha hai. Middleware /api ko nahi bachata,
  // is liye rok yahan lagani parti hai.
  const auth = await requireStaff();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createClient();

  const { data: rows } = await supabase
    .from("v_machinery_control")
    .select("*")
    .neq("raw_status", "cancelled")
    .order("booking_date", { ascending: false })
    .limit(60);

  const cards = (rows ?? []).map((b) => {
    const area = Number(b.harvest_area ?? 0);
    const rate = b.final_rate === null ? null : Number(b.final_rate);
    const gross = b.gross_amount === null ? null : Number(b.gross_amount);

    return {
      id: b.booking_id as string,
      booking_number: (b.booking_number as string) ?? "-",
      farmer_name: (b.farmer_name as string | null) ?? "-",
      // Kisan ka apna code. Board par ek hi kisan ki do bookingein do
      // card banati hain -- aur card par sirf booking number likha ho to
      // wo do adad do alag bandon jaise parhe jate hain. Kisan ka code
      // dono card par ek hi hota hai, is liye wohi ye sawal khatam
      // karta hai.
      farmer_code: (b.farmer_code as string | null) ?? null,
      farmer_phone: (b.farmer_phone as string | null) ?? null,
      village: (b.village as string | null) ?? null,
      crop_type: (b.crop_type as string | null) ?? null,
      area,
      machine_label: b.machine_type
        ? `${b.machine_type}${b.machine_model ? ` (${b.machine_model})` : ""}`
        : null,
      vendor_name: (b.vendor_name as string | null) ?? null,
      location_address: (b.location_address as string | null) ?? null,
      harvest_date: (b.preferred_date as string | null) ?? null,
      booking_date: b.booking_date as string,

      // Bill ban chuka ho to bill; warna rate se andaza, aur wo saaf
      // "andaza" likha jayega. Andaze ko bill ki tarah dikhana wo
      // ghalti hai jis se kisan se ghalat raqam maangi jati hai.
      bill_amount: gross,
      estimate_amount: gross === null && rate !== null && area > 0 ? rate * area : null,
      advance: Number(b.advance_mila ?? 0),
      received: Number(b.ab_tak_mila ?? 0),
      outstanding: Number(b.baqi ?? 0),
      overpaid: Number(b.zyada_diya ?? 0),

      work_state: (b.kaam_ki_halat as string) ?? "nayi",
      pay_state: (b.paise_ki_halat as string) ?? "bill_nahi_bana",
      next_action: (b.agla_kaam as string) ?? "rate_final_karein",
      overdue: Boolean(b.kattai_ki_tareekh_guzri),
    };
  });

  return NextResponse.json({ cards });
}
