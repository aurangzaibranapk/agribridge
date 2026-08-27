import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VendorDashboardClient } from "./vendor-dashboard-client";

export const dynamic = "force-dynamic";

export default async function VendorPortalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendor } = await supabase.from("machinery_vendors").select("*").eq("user_id", user.id).single();
  if (!vendor) redirect("/login");

  const { data: bookings } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, status, booking_date, total_amount, vendor_payable, amount_paid_to_vendor, farmers(full_name), machinery_vendor_machines(machine_type, model)")
    .eq("vendor_id", vendor.id)
    .order("booking_date", { ascending: false })
    .limit(50);

  const normalized = (bookings ?? []).map((b: any) => {
    const farmer = Array.isArray(b.farmers) ? b.farmers[0] : b.farmers;
    const machine = Array.isArray(b.machinery_vendor_machines) ? b.machinery_vendor_machines[0] : b.machinery_vendor_machines;
    return {
      id: b.id,
      bookingNumber: b.booking_number,
      status: b.status,
      bookingDate: b.booking_date,
      totalAmount: Number(b.total_amount),
      vendorPayable: Number(b.vendor_payable),
      amountPaidToVendor: Number(b.amount_paid_to_vendor),
      farmerName: farmer?.full_name ?? "-",
      machineLabel: `${machine?.machine_type ?? ""}${machine?.model ? ` (${machine.model})` : ""}`,
    };
  });

  const totalOutstanding = normalized.reduce((s, b) => s + (b.vendorPayable - b.amountPaidToVendor), 0);
  const pendingCount = normalized.filter((b) => b.status === "pending").length;

  return (
    <VendorDashboardClient
      vendorName={vendor.vendor_name}
      totalOutstanding={totalOutstanding}
      pendingCount={pendingCount}
      bookings={normalized}
    />
  );
}