import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { MachinerySlipClient } from "./slip-client";

export const dynamic = "force-dynamic";

/**
 * Booking ki parchi.
 *
 * Ye safha booking ke PURANE khanon se parhta tha -- acres, hours,
 * days, rate_amount, total_amount, amount_received_from_farmer -- aur
 * nayi zanjeer un mein se kisi ko haath hi nahi lagati. Nateeja parchi
 * par saaf nazar aata tha: "null Days", "Rate: Rs 0", "Received Rs 0",
 * jabke kaam bhi ho chuka tha aur rate bhi tay tha.
 *
 * Ab har adad apne asal malik se aata hai:
 *
 *   Bill ban chuka ho  -> bill se: asal raqba, asal rate, asal raqam.
 *   Bill na bana ho     -> booking se: raqba aur tay shuda rate, aur
 *                          parchi khud kehti hai ke ye ANDAZA hai.
 *   Mili hui raqam      -> machinery_payments se (sirf tasdeeq shuda),
 *                          us purane khane se nahi jise koi bharta hi
 *                          nahi.
 */
export default async function MachineryBookingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const lang = getLanguageFromCookies("rm");
  const { id } = await params;
  const supabase = createClient();

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select(
      "id, booking_number, booking_date, preferred_date, crop_type, harvest_area, harvest_type, sabit_area, kutra_area, sabit_rate, kutra_rate, final_rate, estimated_rate, rate_status, village, location_address, farmers(full_name, farmer_code, phone_number), machinery_vendors(vendor_name), machinery_vendor_machines(machine_type, model)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!booking) {
    return <div className="p-8 text-center text-surface-400">{t("mc_booking_not_found", lang)}</div>;
  }

  const [{ data: bill }, { data: payments }] = await Promise.all([
    supabase
      .from("machinery_bills")
      .select(
        "bill_number, bill_date, actual_area, rate_amount, gross_amount, discount_amount, discount_reason, sabit_area, kutra_area, sabit_rate, kutra_rate, sabit_amount, kutra_amount, advance_adjusted, previous_payment, diesel_deducted, balance_payable"
      )
      .eq("booking_id", id)
      .is("cancelled_at", null)
      .maybeSingle(),
    supabase
      .from("machinery_payments")
      .select("amount, kind")
      .eq("booking_id", id)
      .eq("verification_status", "verified"),
  ]);

  const farmer = Array.isArray(booking.farmers) ? booking.farmers[0] : booking.farmers;
  const vendor = Array.isArray(booking.machinery_vendors) ? booking.machinery_vendors[0] : booking.machinery_vendors;
  const machine = Array.isArray(booking.machinery_vendor_machines)
    ? booking.machinery_vendor_machines[0]
    : booking.machinery_vendor_machines;

  const n = (v: unknown) => Number(v ?? 0);
  const rows = payments ?? [];
  const advancePaid = rows.filter((p) => p.kind === "advance").reduce((s, p) => s + n(p.amount), 0);
  const finalPaid = rows.filter((p) => p.kind === "final").reduce((s, p) => s + n(p.amount), 0);

  // Bill ban chuka ho to sach wahi hai; warna booking ka andaza.
  const isFinal = !!bill;
  const area = isFinal ? n(bill.actual_area) : n(booking.harvest_area);
  const rate = isFinal ? n(bill.rate_amount) : n(booking.final_rate) || n(booking.estimated_rate);
  const gross = isFinal ? n(bill.gross_amount) : Math.round(area * rate * 100) / 100;
  const received = advancePaid + finalPaid;
  const balance = isFinal ? Math.max(n(bill.balance_payable) - finalPaid, 0) : Math.max(gross - received, 0);

  const slip = {
    id: booking.id,
    bookingNumber: booking.booking_number,
    bookingDate: booking.booking_date,
    harvestDate: booking.preferred_date,
    billNumber: bill?.bill_number ?? null,
    billDate: bill?.bill_date ?? null,
    isFinal,
    farmerName: farmer?.full_name ?? "-",
    farmerCode: farmer?.farmer_code ?? null,
    farmerPhone: farmer?.phone_number ?? null,
    vendorName: vendor?.vendor_name ?? "-",
    machineLabel: `${machine?.machine_type ?? ""}${machine?.model ? ` (${machine.model})` : ""}`.trim() || "-",
    cropType: booking.crop_type,
    locationAddress: booking.location_address ?? booking.village,
    area,
    rate,
    gross,
    // Qism ka batwara (176) -- bill ban chuka ho to bill ka, warna booking ka.
    harvestType: booking.harvest_type,
    sabitArea: isFinal ? (bill.sabit_area === null ? null : n(bill.sabit_area)) : (booking.sabit_area === null ? null : n(booking.sabit_area)),
    kutraArea: isFinal ? (bill.kutra_area === null ? null : n(bill.kutra_area)) : (booking.kutra_area === null ? null : n(booking.kutra_area)),
    sabitRate: isFinal ? (bill.sabit_rate === null ? null : n(bill.sabit_rate)) : (booking.sabit_rate === null ? null : n(booking.sabit_rate)),
    kutraRate: isFinal ? (bill.kutra_rate === null ? null : n(bill.kutra_rate)) : (booking.kutra_rate === null ? null : n(booking.kutra_rate)),
    sabitAmount: isFinal ? (bill.sabit_amount === null ? null : n(bill.sabit_amount)) : null,
    kutraAmount: isFinal ? (bill.kutra_amount === null ? null : n(bill.kutra_amount)) : null,
    // Riayat (194). Kisan ki parchi par ye lakeer chhupani nahi --
    // warna wo Rs 30,000 parhta hai aur neeche Rs 28,000, aur beech ka
    // farq us ke liye ek an-kaha sawal ban jata hai.
    discount: isFinal ? n(bill.discount_amount) : 0,
    discountReason: isFinal ? ((bill.discount_reason as string | null) ?? null) : null,
    advanceAdjusted: isFinal ? n(bill.advance_adjusted) : advancePaid,
    previousPayment: isFinal ? n(bill.previous_payment) : 0,
    dieselDeducted: isFinal ? n(bill.diesel_deducted) : 0,
    received,
    balance,
  };

  return <MachinerySlipClient slip={slip} />;
}
