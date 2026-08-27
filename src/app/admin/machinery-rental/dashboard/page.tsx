import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import Link from "next/link";

export const dynamic = "force-dynamic";

const MACHINE_LABELS: Record<string, string> = {
  rotavator: "Rotavator",
  thresher: "Thresher",
  harvester: "Harvester",
  tractor: "Tractor",
  kubota: "Kubota",
  other: "Other",
};

export default async function MachineryDashboardPage() {
  const supabase = createClient();

  const [{ data: bookings }, { data: requests }] = await Promise.all([
    supabase.from("machinery_bookings").select("*, machinery_vendor_machines(machine_type)"),
    supabase
      .from("machinery_requests")
      .select("*, farmers(full_name, farmer_code, phone_number)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const totalBookingsValue = (bookings ?? []).reduce((s, b) => s + Number(b.total_amount), 0);
  const totalCommission = (bookings ?? []).reduce((s, b) => s + Number(b.commission_amount), 0);
  const totalReceivedFromFarmers = (bookings ?? []).reduce((s, b) => s + Number(b.amount_received_from_farmer), 0);
  const totalPaidToVendors = (bookings ?? []).reduce((s, b) => s + Number(b.amount_paid_to_vendor), 0);
  const totalDiesel = (bookings ?? []).reduce((s, b) => s + Number(b.diesel_amount ?? 0), 0);
  const completedCount = (bookings ?? []).filter((b) => b.status === "completed").length;
  const pendingCount = (bookings ?? []).filter((b) => b.status === "pending").length;
  const willSellCount = (bookings ?? []).filter((b) => b.will_sell_to_us === true).length;
  const wantsReminderCount =
    (bookings ?? []).filter((b) => b.wants_next_season_reminder === true).length +
    (requests ?? []).filter((r) => r.wants_next_season_reminder === true).length;

  const byMachineType: Record<string, { count: number; value: number }> = {};
  (bookings ?? []).forEach((b: any) => {
    const machine = Array.isArray(b.machinery_vendor_machines) ? b.machinery_vendor_machines[0] : b.machinery_vendor_machines;
    const type = machine?.machine_type ?? "other";
    if (!byMachineType[type]) byMachineType[type] = { count: 0, value: 0 };
    byMachineType[type].count += 1;
    byMachineType[type].value += Number(b.total_amount);
  });

  const pendingRequests = (requests ?? []).filter((r) => r.status === "pending" || !r.status);

  const outstandingMap: Record<string, { farmer_name: string; total: number }> = {};
  (bookings ?? []).forEach((b: any) => {
    const remaining = Number(b.total_amount) - Number(b.amount_received_from_farmer);
    if (remaining <= 0) return;
    if (!outstandingMap[b.farmer_id]) outstandingMap[b.farmer_id] = { farmer_name: "", total: 0 };
    outstandingMap[b.farmer_id].total += remaining;
  });

  const now = Date.now();
  const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
  const overdueBookings = (bookings ?? []).filter((b: any) => {
    const remaining = Number(b.total_amount) - Number(b.amount_received_from_farmer);
    if (remaining <= 0) return false;
    const referenceDate = b.completed_at ? new Date(b.completed_at).getTime() : new Date(b.booking_date).getTime();
    return now - referenceDate > FIFTEEN_DAYS_MS;
  });

  const { data: farmersForNames } = await supabase.from("farmers").select("id, full_name, farmer_code");
  const farmerNameMap: Record<string, { name: string; code: string }> = {};
  (farmersForNames ?? []).forEach((f: any) => {
    farmerNameMap[f.id] = { name: f.full_name, code: f.farmer_code };
  });
  Object.keys(outstandingMap).forEach((fid) => {
    outstandingMap[fid].farmer_name = farmerNameMap[fid]?.name ?? "-";
  });
  const outstandingList = Object.entries(outstandingMap)
    .map(([farmerId, v]) => ({ farmerId, ...v }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <PageHeader title="Machinery Business Dashboard" description="Bookings + Vendor Commission + Farmer Requests - poora hisaab" />

      <div className="mb-4 flex gap-2">
        <Link href="/admin/machinery-rental" className="rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">Booking Page</Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Total Bookings Value</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalBookingsValue.toLocaleString()}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">Commission Earned</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">Rs {totalCommission.toLocaleString()}</p>
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

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-xs text-surface-500">Diesel Total</p>
          <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">Rs {totalDiesel.toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-xs text-surface-500">Completed Bookings</p>
          <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">{completedCount}</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-xs text-surface-500">Pending Bookings</p>
          <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">{pendingCount}</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-xs text-surface-500">Hamein Bechenge (Yes)</p>
          <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">{willSellCount}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Machine Type Ke Hisaab Se</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(byMachineType).map(([type, stat]) => (
            <div key={type} className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
              <p className="text-xs text-surface-500">{MACHINE_LABELS[type] ?? type}</p>
              <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">{stat.count} bookings</p>
              <p className="text-xs text-surface-400">Rs {stat.value.toLocaleString()}</p>
            </div>
          ))}
          {Object.keys(byMachineType).length === 0 && <p className="text-sm text-surface-400">Koi booking nahi hai.</p>}
        </div>
      </div>

      <div className="mb-6 rounded-card border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300">
        <strong>{wantsReminderCount}</strong> Farmers ne agli season ke liye Machinery Booking Reminder mangi hai.
      </div>

      {overdueBookings.length > 0 && (
        <div className="mb-6 rounded-card border-2 border-red-300 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
          <p className="text-sm font-semibold text-red-700">15+ Din Se Payment Baaqi ({overdueBookings.length})</p>
          <div className="mt-2 space-y-1">
            {overdueBookings.map((b: any) => {
              const remaining = Number(b.total_amount) - Number(b.amount_received_from_farmer);
              return (
                <div key={b.id} className="flex justify-between text-xs text-red-700">
                  <span>{farmerNameMap[b.farmer_id]?.name ?? "-"} - {b.booking_number}</span>
                  <span className="font-semibold">Rs {remaining.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Farmer-wise Outstanding (Total Baaqi)</h3>
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">Farmer</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">Total Baaqi</th>
              </tr>
            </thead>
            <tbody>
              {outstandingList.map((o) => (
                <tr key={o.farmerId} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{o.farmer_name}</td>
                  <td className="px-3 py-2 text-right font-semibold text-amber-600">Rs {o.total.toLocaleString()}</td>
                </tr>
              ))}
              {outstandingList.length === 0 && (
                <tr><td colSpan={2} className="px-3 py-8 text-center text-surface-400">Koi outstanding nahi hai.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Farmer Se Aayi Hui Naye Requests (Pending)</h3>
        <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">Farmer</th>
                <th className="px-3 py-2 font-medium text-surface-500">Machine</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">Acres</th>
                <th className="px-3 py-2 font-medium text-surface-500">Crop</th>
                <th className="px-3 py-2 font-medium text-surface-500">Kab Chahiye</th>
                <th className="px-3 py-2 font-medium text-surface-500">Bechega?</th>
                <th className="px-3 py-2 font-medium text-surface-500">Reminder?</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((r: any) => {
                const farmer = Array.isArray(r.farmers) ? r.farmers[0] : r.farmers;
                return (
                  <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">
                      {farmer?.full_name ?? "-"} <span className="block text-xs text-surface-400">{farmer?.phone_number}</span>
                    </td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{MACHINE_LABELS[r.machine_type] ?? r.machine_type_other ?? r.machine_type}</td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{r.acres ?? "-"}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{r.crop_type ?? "-"}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{r.expected_date}</td>
                    <td className="px-3 py-2">{r.will_sell_to_us === true ? <span className="text-green-600">Haan</span> : r.will_sell_to_us === false ? <span className="text-surface-400">Nahi</span> : "-"}</td>
                    <td className="px-3 py-2">{r.wants_next_season_reminder === true ? <span className="text-brand-600">Haan</span> : r.wants_next_season_reminder === false ? <span className="text-surface-400">Nahi</span> : "-"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/machinery-rental?convert_farmer=${r.farmer_id}&convert_request=${r.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                        Booking Karein
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {pendingRequests.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-surface-400">Koi pending request nahi hai.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}