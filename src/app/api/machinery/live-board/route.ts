import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // Live board admin panel ka andaruni safha hai. Middleware /api ko nahi bachata,
  // is liye rok yahan lagani parti hai.
  const auth = await requireStaff();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: bookings } = await supabase
    .from("machinery_bookings")
    .select(
      "id, booking_number, booking_date, status, created_at, acres, hours, days, total_amount, farmers(full_name), machinery_vendors(vendor_name), machinery_vendor_machines(machine_type, model)"
    )
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  const cards = (bookings ?? []).map((b: any) => {
    const farmer = Array.isArray(b.farmers) ? b.farmers[0] : b.farmers;
    const vendor = Array.isArray(b.machinery_vendors) ? b.machinery_vendors[0] : b.machinery_vendors;
    const machine = Array.isArray(b.machinery_vendor_machines) ? b.machinery_vendor_machines[0] : b.machinery_vendor_machines;
    return {
      id: b.id,
      booking_number: b.booking_number,
      farmer_name: farmer?.full_name ?? "-",
      vendor_name: vendor?.vendor_name ?? "-",
      machine_label: `${machine?.machine_type ?? ""}${machine?.model ? ` (${machine.model})` : ""}`,
      quantity_label: b.acres ? `${b.acres} Acres` : b.hours ? `${b.hours} Hours` : `${b.days} Days`,
      total_amount: Number(b.total_amount),
      status: b.status,
      booking_date: b.booking_date,
      created_at: b.created_at,
    };
  });

  return NextResponse.json({ cards });
}