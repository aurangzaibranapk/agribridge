import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { DriversClient } from "./drivers-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rawDrivers } = await supabase
    .from("drivers")
    .select("*, dispatch_vehicles(id, vehicle_number, vehicle_type)")
    .order("full_name");

  const drivers = (rawDrivers ?? []).map((d: any) => ({
    id: d.id,
    full_name: d.full_name,
    mobile_number: d.mobile_number,
    cnic_number: d.cnic_number,
    license_number: d.license_number,
    is_active: d.is_active,
    vehicles: (d.dispatch_vehicles ?? []).map((v: any) => ({ id: v.id, vehicle_number: v.vehicle_number, vehicle_type: v.vehicle_type })),
  }));

  return (
    <div>
      <PageHeader title={t("at_drivers_vehicles", lang)} description="Driver register karein, dispatch mein dropdown se select karein" />
      <DriversClient drivers={drivers} />
    </div>
  );
}