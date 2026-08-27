import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateMachineryBookingsListPdf } from "@/lib/machinery-bookings-list-pdf";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();

  const { data: bookings } = await supabase
    .from("machinery_bookings")
    .select(
      "booking_number, booking_date, total_amount, amount_received_from_farmer, status, farmers(full_name, phone_number), machinery_vendor_machines(machine_type, model)"
    )
    .order("booking_date", { ascending: false });

  const rows = (bookings ?? []).map((b: any) => {
    const farmer = Array.isArray(b.farmers) ? b.farmers[0] : b.farmers;
    const machine = Array.isArray(b.machinery_vendor_machines) ? b.machinery_vendor_machines[0] : b.machinery_vendor_machines;
    return {
      bookingNumber: b.booking_number,
      bookingDate: b.booking_date,
      farmerName: farmer?.full_name ?? "-",
      farmerPhone: farmer?.phone_number ?? null,
      machineLabel: `${machine?.machine_type ?? ""}${machine?.model ? ` (${machine.model})` : ""}`,
      totalAmount: Number(b.total_amount),
      amountReceived: Number(b.amount_received_from_farmer),
      status: b.status,
    };
  });

  const pdfBuffer = await generateMachineryBookingsListPdf(rows);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="machinery-bookings-list.pdf"`,
    },
  });
}