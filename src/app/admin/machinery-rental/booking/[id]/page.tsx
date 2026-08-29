import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BookingDetail } from "./booking-detail";

export const dynamic = "force-dynamic";

export default async function MachineryBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select(
      "*, farmers(full_name, farmer_code, phone_number, village), machinery_vendor_machines(machine_type, model), machinery_vendors(vendor_name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!booking) notFound();

  const [{ data: payments }, { data: dispatches }, { data: work }, { data: bill }, { data: events }, { data: rawMachines }, { data: accounts }, { data: profile }] =
    await Promise.all([
      supabase.from("machinery_payments").select("*").eq("booking_id", id).order("created_at"),
      supabase.from("machinery_dispatches").select("*").eq("booking_id", id).order("departure_at"),
      supabase.from("machinery_work_records").select("*").eq("booking_id", id).maybeSingle(),
      supabase.from("machinery_bills").select("*").eq("booking_id", id).maybeSingle(),
      supabase.from("machinery_booking_events").select("*").eq("booking_id", id).order("created_at"),
      supabase
        .from("machinery_vendor_machines")
        .select("id, machine_type, model, rate_type, rate_amount, machinery_vendors(vendor_name)")
        .eq("is_available", true)
        .order("machine_type"),
      supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
      supabase.auth.getUser().then(async ({ data }) =>
        data.user ? supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle() : { data: null }
      ),
    ]);

  const farmer = Array.isArray(booking.farmers) ? booking.farmers[0] : booking.farmers;
  const machine = Array.isArray(booking.machinery_vendor_machines)
    ? booking.machinery_vendor_machines[0]
    : booking.machinery_vendor_machines;
  const vendorRow = Array.isArray(booking.machinery_vendors) ? booking.machinery_vendors[0] : booking.machinery_vendors;
  const vendorName = vendorRow?.vendor_name ?? null;

  const advanceTotal = (payments ?? [])
    .filter((p) => p.kind === "advance")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const finalPaid = (payments ?? [])
    .filter((p) => p.kind === "final")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const machines = (rawMachines ?? []).map((m: any) => {
    const vendor = Array.isArray(m.machinery_vendors) ? m.machinery_vendors[0] : m.machinery_vendors;
    return {
      id: m.id,
      label: `${m.machine_type}${m.model ? ` (${m.model})` : ""} — ${vendor?.vendor_name ?? "-"}`,
    };
  });

  return (
    <BookingDetail
      booking={{
        id: booking.id,
        booking_number: booking.booking_number,
        status: booking.status,
        booking_date: booking.booking_date,
        crop_type: booking.crop_type,
        village: booking.village,
        location_address: booking.location_address,
        harvest_area: Number(booking.harvest_area ?? 0),
        total_area: Number(booking.total_area ?? 0),
        machine_type_requested: booking.machine_type_requested,
        machine_label: machine ? `${machine.machine_type}${machine.model ? ` (${machine.model})` : ""}` : null,
        estimated_rate: booking.estimated_rate === null ? null : Number(booking.estimated_rate),
        final_rate: booking.final_rate === null ? null : Number(booking.final_rate),
        rate_status: booking.rate_status,
        expected_harvest_date: booking.expected_harvest_date,
        rate_confirmation_sent_at: booking.rate_confirmation_sent_at,
        farmer_confirmed_at: booking.farmer_confirmed_at,
        farmer_confirmation_response: booking.farmer_confirmation_response,
        farmer_confirmation_channel: booking.farmer_confirmation_channel,
        confirmation_override_reason: booking.confirmation_override_reason,
        cancellation_reason: booking.cancellation_reason,
        farmer_name: farmer?.full_name ?? "-",
        farmer_code: farmer?.farmer_code ?? "",
        farmer_phone: farmer?.phone_number ?? "",
        farmer_village: farmer?.village ?? "",
      }}
      payments={(payments ?? []).map((p) => ({
        id: p.id,
        kind: p.kind,
        amount: Number(p.amount),
        method: p.method,
        payment_date: p.payment_date,
        reference: p.reference,
        evidence_url: p.evidence_url,
      }))}
      dispatches={(dispatches ?? []).map((d) => ({
        id: d.id,
        operator_name: d.operator_name,
        departure_at: d.departure_at,
        opening_meter: d.opening_meter === null ? null : Number(d.opening_meter),
        fuel_litres: d.fuel_litres === null ? null : Number(d.fuel_litres),
      }))}
      work={
        work
          ? {
              actual_area: Number(work.actual_area),
              started_at: work.started_at,
              finished_at: work.finished_at,
              completion_photo_url: work.completion_photo_url,
              farmer_confirmed: work.farmer_confirmed,
            }
          : null
      }
      bill={
        bill
          ? {
              bill_number: bill.bill_number,
              bill_date: bill.bill_date,
              actual_area: Number(bill.actual_area),
              rate_amount: Number(bill.rate_amount),
              gross_amount: Number(bill.gross_amount),
              advance_adjusted: Number(bill.advance_adjusted),
              previous_payment: Number(bill.previous_payment),
              balance_payable: Number(bill.balance_payable),
              commission_percentage: Number(bill.commission_percentage),
              commission_amount: Number(bill.commission_amount),
              vendor_payable: Number(bill.vendor_payable),
            }
          : null
      }
      events={(events ?? []).map((e) => ({
        id: e.id,
        event_type: e.event_type,
        note: e.note,
        to_status: e.to_status,
        created_at: e.created_at,
      }))}
      machines={machines}
      accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name, account_type: a.account_type }))}
      advanceTotal={advanceTotal}
      finalPaid={finalPaid}
      vendorName={vendorName}
      paidToVendor={Number(booking.amount_paid_to_vendor ?? 0)}
      canOverride={["owner", "super_admin", "admin", "manager"].includes(profile?.role ?? "")}
    />
  );
}
