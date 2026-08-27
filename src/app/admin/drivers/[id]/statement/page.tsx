import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { DriverStatementClient } from "./driver-statement-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DriverStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  const { data: driver } = await supabase.from("drivers").select("*, dispatch_vehicles(id, vehicle_number, vehicle_type)").eq("id", id).maybeSingle();
  if (!driver) return notFound();

  const vehicle = Array.isArray(driver.dispatch_vehicles) ? driver.dispatch_vehicles[0] : driver.dispatch_vehicles;

  const { data: rawTrips } = await supabase
    .from("agri_dispatches")
    .select("id, dispatch_number, dispatch_date, delivery_location, status, order_id, agri_orders(order_number, shop_dealer_name)")
    .eq("driver_name", driver.full_name)
    .order("dispatch_date", { ascending: false })
    .limit(50);

  const { data: rawPayments } = await supabase
    .from("driver_payments")
    .select("*")
    .eq("driver_id", id)
    .order("payment_date", { ascending: false });

  const { data: rawMaintenance } = vehicle
    ? await supabase.from("vehicle_maintenance_records").select("*").eq("vehicle_id", vehicle.id).order("maintenance_date", { ascending: false })
    : { data: [] };

  const trips = (rawTrips ?? []).map((t: any) => ({
    id: t.id,
    dispatch_number: t.dispatch_number,
    dispatch_date: t.dispatch_date,
    delivery_location: t.delivery_location,
    status: t.status,
    order_id: t.order_id,
    order_number: Array.isArray(t.agri_orders) ? t.agri_orders[0]?.order_number : t.agri_orders?.order_number,
    shop_name: Array.isArray(t.agri_orders) ? t.agri_orders[0]?.shop_dealer_name : t.agri_orders?.shop_dealer_name,
  }));

  const payments = (rawPayments ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    payment_type: p.payment_type,
    payment_date: p.payment_date,
    notes: p.notes,
  }));

  const maintenance = (rawMaintenance ?? []).map((m: any) => ({
    id: m.id,
    maintenance_type: m.maintenance_type,
    amount: Number(m.amount),
    odometer_km: m.odometer_km ? Number(m.odometer_km) : null,
    maintenance_date: m.maintenance_date,
    notes: m.notes,
  }));

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalMaintenance = maintenance.reduce((sum, m) => sum + m.amount, 0);

  return (
    <div>
      <PageHeader title={driver.full_name} description={`${driver.mobile_number ?? "-"} | Vehicle: ${vehicle?.vehicle_number ?? "Koi vehicle nahi"}`} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Total Trips</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{trips.length}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">Total Salary Paid</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">Rs {totalPaid.toLocaleString()}</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Total Maintenance Cost</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700">Rs {totalMaintenance.toLocaleString()}</p>
        </Card>
      </div>

      <DriverStatementClient
        driverId={driver.id}
        vehicleId={vehicle?.id ?? null}
        trips={trips}
        payments={payments}
        maintenance={maintenance}
      />
    </div>
  );
}