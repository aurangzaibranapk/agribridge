import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { Bike, AlertTriangle, Fuel } from "lucide-react";
import { VehicleAssignForm } from "./vehicle-assign-form";
import { PostLogForm } from "./post-log-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const STAFF_ROLES = [
  "owner", "super_admin", "admin", "admin_assistant", "manager",
  "sales_staff", "finance", "warehouse", "hr", "procurement", "milk_collection", "machinery",
];

function statusTone(status: string) {
  if (status === "posted") return "green" as const;
  if (status === "complete") return "blue" as const;
  if (status === "cancelled") return "red" as const;
  return "amber" as const;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Chal raha hai",
  complete: "Manager ke intezar mein",
  posted: "Accounts mein ja chuka",
  cancelled: "Cancel",
};

export default async function VehiclesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, vehicle_name, registration_no, expected_km_per_liter, assigned_profile_id, assigned_rider")
    .eq("is_active", true)
    .order("vehicle_name");

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", STAFF_ROLES)
    .eq("is_active", true)
    .order("full_name");

  const { data: logs } = await supabase
    .from("vehicle_daily_logs")
    .select("id, log_number, vehicle_id, staff_profile_id, log_date, opening_km, closing_km, km_travelled, fuel_liters, fuel_amount, km_per_liter, cost_per_km, expected_liters, liters_difference, status, flags")
    .order("log_date", { ascending: false })
    .limit(60);

  const vehicleName = new Map((vehicles ?? []).map((v) => [v.id, v.vehicle_name]));
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.full_name ?? "Staff"]));

  const rows = logs ?? [];
  const waiting = rows.filter((l) => l.status === "complete");
  const flagged = rows.filter((l) => Array.isArray(l.flags) && (l.flags as unknown[]).length > 0);
  const unassigned = (vehicles ?? []).filter((v) => !v.assigned_profile_id);

  return (
    <div>
      <PageHeader
        title={t("vh_title", lang)}
        description="Har gaari kis staff ke naam par hai, aur WhatsApp se aaye meter/petrol ka rozana hisaab."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><Bike className="h-3.5 w-3.5" />{t("vh_waiting_manager", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{waiting.length}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" />{t("c_marked", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-amber-600">{flagged.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">{t("vh_unassigned", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{unassigned.length}</p>
          <p className="text-xs text-surface-500">{t("vh_no_whatsapp_log", lang)}</p>
        </Card>
      </div>

      <Card className="mb-6 p-4">
        <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("vh_who_has_which", lang)}</h3>
        {(vehicles ?? []).length === 0 ? (
          <p className="text-sm text-surface-500">{t("vh_none", lang)}</p>
        ) : (
          <div className="space-y-2">
            {(vehicles ?? []).map((v) => (
              <VehicleAssignForm
                key={v.id}
                vehicle={{
                  id: v.id,
                  name: v.vehicle_name,
                  registrationNo: v.registration_no,
                  expectedKmPerLiter: Number(v.expected_km_per_liter ?? 45),
                  assignedProfileId: v.assigned_profile_id,
                  assignedRider: v.assigned_rider,
                }}
                staff={(staff ?? []).map((s) => ({ id: s.id, name: s.full_name ?? "Staff" }))}
              />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-surface-500">{t("vh_unassigned_note", lang)}</p>
      </Card>

      <h3 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-white">{t("vh_daily_log", lang)}</h3>

      {rows.length === 0 ? (
        <EmptyState
          title={t("vh_no_daily_log", lang)}
          description="Jab staff WhatsApp par subah ka meter bhejega, wo yahan aayega."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((l) => {
            const flags = Array.isArray(l.flags) ? (l.flags as string[]) : [];
            return (
              <Card key={l.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-surface-500">{l.log_number}</p>
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">
                      {vehicleName.get(l.vehicle_id) ?? "Gaari"} — {staffName.get(l.staff_profile_id) ?? "Staff"}
                    </p>
                    <p className="text-xs text-surface-500">{l.log_date}</p>
                  </div>
                  <Badge tone={statusTone(l.status)}>{STATUS_LABEL[l.status] ?? l.status}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-surface-500">{t("vh_morning_evening", lang)}</p>
                    <p className="text-surface-900 dark:text-white">
                      {l.opening_km == null ? "-" : Number(l.opening_km).toLocaleString()} / {l.closing_km == null ? "-" : Number(l.closing_km).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">{t("vh_ran", lang)}</p>
                    <p className="text-surface-900 dark:text-white">{l.km_travelled == null ? "-" : `${Math.round(Number(l.km_travelled)).toLocaleString()} km`}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-surface-500"><Fuel className="h-3 w-3" />{t("c_petrol", lang)}</p>
                    <p className="text-surface-900 dark:text-white">
                      {l.fuel_liters == null ? "-" : `${l.fuel_liters} L`}
                      {l.fuel_amount != null && <span className="text-xs text-surface-500"> — Rs {Number(l.fuel_amount).toLocaleString()}</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">{t("c_mileage", lang)}</p>
                    <p className="text-surface-900 dark:text-white">
                      {l.km_per_liter == null ? "-" : `${l.km_per_liter} km/L`}
                      {l.liters_difference != null && (
                        <span className={`ml-1 text-xs ${Number(l.liters_difference) > 0 ? "text-amber-600" : "text-surface-500"}`}>
                          ({Number(l.liters_difference) > 0 ? "+" : ""}{l.liters_difference} L)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {flags.length > 0 && (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <p className="flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" />{t("vh_system_caught", lang)}</p>
                    <ul className="mt-1 list-inside list-disc">
                      {flags.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {l.status === "complete" && <PostLogForm logId={l.id} hasFlags={flags.length > 0} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
