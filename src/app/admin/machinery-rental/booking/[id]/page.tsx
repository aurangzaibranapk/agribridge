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

  const [{ data: payments }, { data: dispatches }, { data: fuelLogs }, { data: efficiency }, { data: followUp }, { data: work }, { data: bill }, { data: events }, { data: reminders }, { data: rawMachines }, { data: accounts }, { data: profile }] =
    await Promise.all([
      supabase.from("machinery_payments").select("*").eq("booking_id", id).order("created_at"),
      supabase.from("machinery_dispatches").select("*").eq("booking_id", id).order("departure_at"),
      supabase.from("machinery_fuel_logs").select("*").eq("booking_id", id).order("log_date"),
      supabase.from("v_machinery_work_efficiency").select("*").eq("booking_id", id).maybeSingle(),
      supabase.from("machinery_bookings").select("booking_number").eq("parent_booking_id", id).maybeSingle(),
      supabase.from("machinery_work_records").select("*").eq("booking_id", id).order("work_date"),
      supabase.from("machinery_bills").select("*").eq("booking_id", id).maybeSingle(),
      supabase.from("machinery_booking_events").select("*").eq("booking_id", id).order("created_at"),
      supabase
        .from("machinery_payment_reminders")
        .select("id, status, error, created_at, sent_by")
        .eq("booking_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("machinery_vendor_machines")
        .select("id, machine_type, model, rate_type, rate_amount, driver_name, driver_phone, machinery_vendors(vendor_name)")
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

  // Har qadam ke sath us ka karne wala. Timeline ka unwan hi "kis ne kya
  // kiya" hai -- naam ke baghair wo sirf "kya kiya" reh jata hai, aur
  // sawal poochhne ke liye naam hi chahiye hota hai.
  const actorIds = [
    ...new Set(
      [
        booking.created_by,
        ...(payments ?? []).map((p) => p.received_by),
        ...(events ?? []).map((e) => e.actor_id),
        ...(dispatches ?? []).map((d) => d.created_by),
        ...(work ?? []).map((w) => w.created_by),
        bill?.created_by ?? null,
      ].filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: actorRows } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorName = new Map((actorRows ?? []).map((a) => [a.id, a.full_name ?? "—"]));

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
      driverName: (m.driver_name as string | null) ?? "",
      driverPhone: (m.driver_phone as string | null) ?? "",
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
        field_ready: booking.field_ready,
        harvest_ready: booking.harvest_ready,
        village: booking.village,
        location_address: booking.location_address,
        harvest_area: Number(booking.harvest_area ?? 0),
        total_area: Number(booking.total_area ?? 0),
        machine_type_requested: booking.machine_type_requested,
        machine_label: machine ? `${machine.machine_type}${machine.model ? ` (${machine.model})` : ""}` : null,
        estimated_rate: booking.estimated_rate === null ? null : Number(booking.estimated_rate),
        final_rate: booking.final_rate === null ? null : Number(booking.final_rate),
        rate_status: booking.rate_status,
        // Kattai ki qism (176). Purani booking par ye null hai -- wahan
        // screen bilkul waise chalti hai jaise pehle chalti thi.
        harvest_type: booking.harvest_type ?? null,
        sabit_area: booking.sabit_area === null ? null : Number(booking.sabit_area),
        kutra_area: booking.kutra_area === null ? null : Number(booking.kutra_area),
        sabit_rate: booking.sabit_rate === null ? null : Number(booking.sabit_rate),
        kutra_rate: booking.kutra_rate === null ? null : Number(booking.kutra_rate),
        expected_harvest_date: booking.expected_harvest_date,
        rate_confirmation_sent_at: booking.rate_confirmation_sent_at,
        farmer_confirmed_at: booking.farmer_confirmed_at,
        payment_promise_date: booking.payment_promise_date,
        advance_declined_at: booking.advance_declined_at,
        follow_up_number: followUp?.booking_number ?? null,
        payment_promise_note: booking.payment_promise_note,
        will_sell_to_us: booking.will_sell_to_us,
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
        received_by_name: p.received_by ? actorName.get(p.received_by) ?? "—" : null,
      }))}
      dispatches={(dispatches ?? []).map((d) => ({
        id: d.id,
        operator_name: d.operator_name,
        departure_at: d.departure_at,
        opening_meter: d.opening_meter === null ? null : Number(d.opening_meter),
      }))}
      efficiency={
        efficiency
          ? {
              kulGhante: efficiency.kul_ghante === null ? null : Number(efficiency.kul_ghante),
              kulLitre: efficiency.kul_litre === null ? null : Number(efficiency.kul_litre),
              litrePerGhanta: efficiency.litre_per_ghanta === null ? null : Number(efficiency.litre_per_ghanta),
              acrePerGhanta: efficiency.acre_per_ghanta === null ? null : Number(efficiency.acre_per_ghanta),
              litrePerAcre: efficiency.litre_per_acre === null ? null : Number(efficiency.litre_per_acre),
            }
          : null
      }
      fuelLogs={(fuelLogs ?? []).map((f) => ({
        id: f.id,
        log_date: f.log_date,
        litres: f.litres === null ? null : Number(f.litres),
        rate_per_litre: f.rate_per_litre === null ? null : Number(f.rate_per_litre),
        amount: Number(f.amount),
        paid_by: f.paid_by,
        vendor_recoverable: Boolean(f.vendor_recoverable),
      }))}
      work={(work ?? []).map((w) => ({
        id: w.id,
        work_date: w.work_date,
        is_final: w.is_final,
        actual_area: Number(w.actual_area),
        started_at: w.started_at,
        finished_at: w.finished_at,
        completion_photo_url: w.completion_photo_url,
        farmer_confirmed: w.farmer_confirmed,
      }))}
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
              diesel_deducted: Number(bill.diesel_deducted ?? 0),
              // Qism ka batwara (176). Purane bill par ye khali hain --
              // wahan bill ek hi lakeer mein dikhta hai, jaise pehle.
              sabit_area: bill.sabit_area === null ? null : Number(bill.sabit_area),
              kutra_area: bill.kutra_area === null ? null : Number(bill.kutra_area),
              sabit_rate: bill.sabit_rate === null ? null : Number(bill.sabit_rate),
              kutra_rate: bill.kutra_rate === null ? null : Number(bill.kutra_rate),
              sabit_amount: bill.sabit_amount === null ? null : Number(bill.sabit_amount),
              kutra_amount: bill.kutra_amount === null ? null : Number(bill.kutra_amount),
            }
          : null
      }
      events={(events ?? []).map((e) => ({
        id: e.id,
        event_type: e.event_type,
        note: e.note,
        to_status: e.to_status,
        created_at: e.created_at,
        actor_name: e.actor_id ? actorName.get(e.actor_id) ?? "—" : null,
      }))}
      machines={machines}
      reminders={(reminders ?? []).map((r) => ({
        id: r.id as string,
        status: r.status as string,
        error: (r.error as string | null) ?? null,
        sentAt: r.created_at as string,
        bySystem: r.sent_by === null,
      }))}
      accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name, account_type: a.account_type }))}
      advanceTotal={advanceTotal}
      finalPaid={finalPaid}
      vendorName={vendorName}
      paidToVendor={Number(booking.amount_paid_to_vendor ?? 0)}
      canOverride={["owner", "super_admin", "admin", "manager"].includes(profile?.role ?? "")}
    />
  );
}
