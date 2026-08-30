import { createClient } from "@/lib/supabase/server";
import { MachineryListClient } from "./list-client";

export const dynamic = "force-dynamic";

/**
 * Machinery ka control center.
 *
 * Ye safha pehle sirf bookings ki fehrist tha. Us se do sawal kabhi
 * nahi mil sakte the, aur wohi do sawal roz poochhe jate hain: "is
 * booking par ab MERA kya kaam hai?" aur "is kisan se kul kitna lena
 * hai?"
 *
 * Adad yahan bilkul nahi ginte jate -- sab kuch v_machinery_control se
 * aata hai, jahan kaam ki halat, paise ki halat aur agla kaam records
 * se khud nikalte hain. Yahan dobara hisaab karne ka matlab hota do
 * jagah do qaide, aur kisi din wo alag ho jate.
 */
export default async function MachineryBookingsListPage() {
  const supabase = createClient();

  const [{ data: rows }, { data: farmers }] = await Promise.all([
    supabase.from("v_machinery_control").select("*").order("booking_date", { ascending: false }),
    supabase.from("v_machinery_farmer_statement").select("*").order("kul_baqi", { ascending: false }),
  ]);

  return (
    <MachineryListClient
      rows={(rows ?? []).map((r) => ({
        id: r.booking_id as string,
        bookingNumber: r.booking_number as string,
        bookingDate: r.booking_date as string,
        harvestDate: r.preferred_date as string | null,
        farmerId: r.farmer_id as string | null,
        farmerName: (r.farmer_name as string | null) ?? "-",
        farmerCode: (r.farmer_code as string | null) ?? "",
        farmerPhone: r.farmer_phone as string | null,
        village: r.village as string | null,
        cropType: r.crop_type as string | null,
        machineType: r.machine_type as string | null,
        machineModel: r.machine_model as string | null,
        vendorId: r.vendor_id as string | null,
        vendorName: r.vendor_name as string | null,
        area: Number(r.harvest_area ?? 0),
        rate: r.final_rate === null ? null : Number(r.final_rate),
        billNumber: r.bill_number as string | null,
        gross: r.gross_amount === null ? null : Number(r.gross_amount),
        received: Number(r.ab_tak_mila ?? 0),
        advance: Number(r.advance_mila ?? 0),
        outstanding: Number(r.baqi ?? 0),
        overpaid: Number(r.zyada_diya ?? 0),
        vendorOutstanding: Number(r.vendor_ka_baqi ?? 0),
        commission: Number(r.hamara_commission ?? 0),
        workState: r.kaam_ki_halat as string,
        payState: r.paise_ki_halat as string,
        nextAction: r.agla_kaam as string,
        overdue: Boolean(r.kattai_ki_tareekh_guzri),
        promiseDate: r.payment_promise_date as string | null,
        lastPayment: r.aakhri_payment as string | null,
      }))}
      farmers={(farmers ?? []).map((f) => ({
        farmerId: f.farmer_id as string,
        farmerName: (f.farmer_name as string | null) ?? "-",
        farmerCode: (f.farmer_code as string | null) ?? "",
        village: f.village as string | null,
        bookings: Number(f.kitni_bookings ?? 0),
        done: Number(f.mukammal_bookings ?? 0),
        totalBill: Number(f.kul_bill ?? 0),
        received: Number(f.kul_mila ?? 0),
        outstanding: Number(f.kul_baqi ?? 0),
        lastPayment: f.aakhri_payment as string | null,
      }))}
    />
  );
}
