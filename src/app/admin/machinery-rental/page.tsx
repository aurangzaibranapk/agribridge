import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { MachineryClient } from "./machinery-client";

export const dynamic = "force-dynamic";

export default async function MachineryRentalPage({
  searchParams,
}: {
  searchParams: Promise<{ convert_farmer?: string; convert_request?: string; convert_acres?: string; convert_location?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();

  const [
    { data: vendors },
    { data: rawMachines },
    { data: farmers },
    { data: financeAccounts },
    { data: rawBookings },
  ] = await Promise.all([
    supabase.from("machinery_vendors").select("id, vendor_name, contact_person, phone").eq("is_active", true).order("vendor_name"),
    supabase.from("machinery_vendor_machines").select("*, machinery_vendors(vendor_name)").eq("is_available", true).order("machine_type"),
    supabase.from("farmers").select("id, full_name, farmer_code, booking_link_token").eq("is_deleted", false).order("full_name"),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
    supabase
      .from("machinery_bookings")
      .select("*, farmers(full_name), machinery_vendors(vendor_name), machinery_vendor_machines(machine_type, model)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const machines = (rawMachines ?? []).map((m: any) => {
    const vendor = Array.isArray(m.machinery_vendors) ? m.machinery_vendors[0] : m.machinery_vendors;
    return {
      id: m.id,
      vendor_id: m.vendor_id,
      vendor_name: vendor?.vendor_name ?? "-",
      machine_type: m.machine_type,
      model: m.model,
      rate_type: m.rate_type,
      rate_amount: Number(m.rate_amount),
      commission_percentage: Number(m.commission_percentage),
    };
  });

  const bookings = (rawBookings ?? []).map((b: any) => {
    const farmer = Array.isArray(b.farmers) ? b.farmers[0] : b.farmers;
    const vendor = Array.isArray(b.machinery_vendors) ? b.machinery_vendors[0] : b.machinery_vendors;
    const machine = Array.isArray(b.machinery_vendor_machines) ? b.machinery_vendor_machines[0] : b.machinery_vendor_machines;
    return {
      id: b.id,
      booking_number: b.booking_number,
      booking_date: b.booking_date,
      farmer_name: farmer?.full_name ?? "-",
      vendor_name: vendor?.vendor_name ?? "-",
      machine_label: `${machine?.machine_type ?? ""}${machine?.model ? ` (${machine.model})` : ""}`,
      acres: b.acres ? Number(b.acres) : null,
      hours: b.hours ? Number(b.hours) : null,
      days: b.days ? Number(b.days) : null,
      total_amount: Number(b.total_amount),
      commission_amount: Number(b.commission_amount),
      vendor_payable: Number(b.vendor_payable),
      amount_received_from_farmer: Number(b.amount_received_from_farmer),
      amount_paid_to_vendor: Number(b.amount_paid_to_vendor),
      status: b.status,
    };
  });

  const totalBookingsValue = bookings.reduce((s, b) => s + b.total_amount, 0);
  const totalCommissionEarned = bookings.reduce((s, b) => s + b.commission_amount, 0);
  const totalReceivedFromFarmers = bookings.reduce((s, b) => s + b.amount_received_from_farmer, 0);
  const totalPaidToVendors = bookings.reduce((s, b) => s + b.amount_paid_to_vendor, 0);

  return (
    <div>
      <PageHeader title="Machinery Rental (Vendor Broker Model)" description="Vendor ki machines, Farmer ko book karna, Commission earn karna" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Total Bookings Value</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalBookingsValue.toLocaleString()}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">Commission Earned (AgriBridge)</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">Rs {totalCommissionEarned.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Farmers Se Wasool</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalReceivedFromFarmers.toLocaleString()}</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Vendors Ko Diya</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700">Rs {totalPaidToVendors.toLocaleString()}</p>
        </Card>
      </div>

      <MachineryClient
        vendors={vendors ?? []}
        machines={machines}
        farmers={farmers ?? []}
        financeAccounts={financeAccounts ?? []}
        bookings={bookings}
        defaultFarmerId={params.convert_farmer}
        defaultRequestId={params.convert_request}
        defaultAcres={params.convert_acres}
        defaultLocation={params.convert_location ? decodeURIComponent(params.convert_location) : undefined}
      />
    </div>
  );
}