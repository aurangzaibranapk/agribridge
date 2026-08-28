import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { MaintenanceClient } from "./maintenance-client";
import { ApprovalQueue, type PendingMaintenance } from "./approval-queue";
import { Card } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const supabase = createClient();

  const { data: rawVehicles } = await supabase
    .from("vehicles")
    .select("id, vehicle_name, last_service_km, service_interval_km")
    .eq("is_active", true)
    .order("vehicle_name");

  // Maujooda KM. Rozana log asal khana hai (wahin se meter ki photo
  // aati hai); purana fuel_logs sirf sahare ke liye, taake purani
  // gaariyon ka hisaab na toote.
  const [{ data: dailyKm }, { data: latestKm }] = await Promise.all([
    supabase
      .from("vehicle_daily_logs")
      .select("vehicle_id, closing_km, log_date")
      .not("closing_km", "is", null)
      .order("log_date", { ascending: false }),
    supabase.from("fuel_logs").select("vehicle_id, closing_km, log_date").order("log_date", { ascending: false }),
  ]);

  const currentKmMap = new Map<string, number>();
  (dailyKm ?? []).forEach((l) => {
    if (l.closing_km != null && !currentKmMap.has(l.vehicle_id)) currentKmMap.set(l.vehicle_id, Number(l.closing_km));
  });
  (latestKm ?? []).forEach((l) => {
    if (!currentKmMap.has(l.vehicle_id)) currentKmMap.set(l.vehicle_id, Number(l.closing_km));
  });

  const vehicles = (rawVehicles ?? []).map((v) => ({
    id: v.id,
    vehicle_name: v.vehicle_name,
    last_service_km: Number(v.last_service_km),
    service_interval_km: Number(v.service_interval_km),
    current_km: currentKmMap.get(v.id) ?? Number(v.last_service_km),
  }));

  const { data: rawLogs } = await supabase
    .from("maintenance_logs")
    .select("id, service_date, description, cost, km_at_service, vehicles(vehicle_name)")
    .order("service_date", { ascending: false })
    .limit(50);

  const logs = (rawLogs ?? []).map((l: any) => ({
    id: l.id,
    service_date: l.service_date,
    description: l.description,
    cost: Number(l.cost),
    km_at_service: Number(l.km_at_service),
    vehicle_name: Array.isArray(l.vehicles) ? l.vehicles[0]?.vehicle_name : l.vehicles?.vehicle_name,
  }));

  // Faisle ke intezar mein pari maintenance.
  const { data: rawPending } = await supabase
    .from("maintenance_logs")
    .select("id, service_date, description, cost, km_at_service, maintenance_type, status, branch_comment, branch_verified_by, vehicles(vehicle_name)")
    .in("status", ["pending", "branch_verified"])
    .order("service_date", { ascending: false });

  const pending: PendingMaintenance[] = (rawPending ?? []).map((l) => {
    const vehicle = Array.isArray(l.vehicles) ? l.vehicles[0] : l.vehicles;
    return {
      id: l.id,
      vehicleName: vehicle?.vehicle_name ?? "Gaari",
      serviceDate: l.service_date,
      description: l.description,
      type: l.maintenance_type ?? "other",
      cost: Number(l.cost),
      km: Number(l.km_at_service),
      status: l.status,
      branchComment: l.branch_comment,
      branchVerifiedBy: l.branch_verified_by,
    };
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const role = me?.role ?? "";
  const canVerify = ["owner", "super_admin", "admin", "manager"].includes(role);
  const canApprove = ["owner", "super_admin", "admin", "manager", "milk_collection"].includes(role);

  const { data: fundSettings } = await supabase.from("replacement_fund_settings").select("monthly_contribution, fund_start_date").limit(1).single();
  const monthlyContribution = Number(fundSettings?.monthly_contribution ?? 25000);
  const startDate = fundSettings?.fund_start_date ? new Date(fundSettings.fund_start_date) : new Date();
  const now = new Date();
  const monthsElapsed = Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()));
  const totalContributed = monthsElapsed * monthlyContribution;

  const { data: withdrawals } = await supabase.from("replacement_fund_withdrawals").select("amount");
  const totalWithdrawn = (withdrawals ?? []).reduce((sum, w) => sum + Number(w.amount), 0);
  const fundBalance = totalContributed - totalWithdrawn;

  return (
    <div>
      <PageHeader
        title="Fleet & Maintenance"
        description="Oil ki yaad dihani, do qadam ki manzoori, aur gaari badalne ka fund."
      />

      <Card className="mb-4 p-4">
        <h2 className="mb-1 text-sm font-semibold text-surface-900 dark:text-white">
          Faisle ke intezar mein ({pending.length})
        </h2>
        <p className="mb-3 text-xs text-surface-500">
          Pehle Branch Manager dekhta hai (wo mauqe par tha), phir Milk Manager aakhri manzoori deta
          hai — kyunke kharcha doodh ke khate mein jata hai. Manzoori se pehle ye kharcha kisi hisaab
          mein nahi ginta.
        </p>
        <ApprovalQueue rows={pending} canVerify={canVerify} canApprove={canApprove} />
      </Card>

      <MaintenanceClient vehicles={vehicles} logs={logs} fundBalance={fundBalance} monthlyContribution={monthlyContribution} />
    </div>
  );
}