import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { MachinerySlipClient } from "./slip-client";

export const dynamic = "force-dynamic";

export default async function MachineryBookingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const lang = getLanguageFromCookies("rm");
  const { id } = await params;
  const supabase = createClient();

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select(
      "id, booking_number, booking_date, acres, hours, days, rate_amount, total_amount, amount_received_from_farmer, location_address, farmers(full_name, farmer_code, phone_number), machinery_vendors(vendor_name), machinery_vendor_machines(machine_type, model)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!booking) {
    return <div className="p-8 text-center text-surface-400">{t("mc_booking_not_found", lang)}</div>;
  }

  const farmer = Array.isArray(booking.farmers) ? booking.farmers[0] : booking.farmers;
  const vendor = Array.isArray(booking.machinery_vendors) ? booking.machinery_vendors[0] : booking.machinery_vendors;
  const machine = Array.isArray(booking.machinery_vendor_machines) ? booking.machinery_vendor_machines[0] : booking.machinery_vendor_machines;

  const quantityLabel = booking.acres ? `${booking.acres} Acres` : booking.hours ? `${booking.hours} Hours` : `${booking.days} Days`;

  const slip = {
    id: booking.id,
    bookingNumber: booking.booking_number,
    bookingDate: booking.booking_date,
    farmerName: farmer?.full_name ?? "-",
    farmerCode: farmer?.farmer_code ?? null,
    farmerPhone: farmer?.phone_number ?? null,
    vendorName: vendor?.vendor_name ?? "-",
    machineLabel: `${machine?.machine_type ?? ""}${machine?.model ? ` (${machine.model})` : ""}`,
    quantityLabel,
    rateAmount: Number(booking.rate_amount),
    totalAmount: Number(booking.total_amount),
    amountReceived: Number(booking.amount_received_from_farmer),
    locationAddress: booking.location_address,
  };

  return <MachinerySlipClient slip={slip} />;
}