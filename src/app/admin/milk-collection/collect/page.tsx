import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { CollectForm, type FarmerOption } from "./collect-form";
import { STATUS_LABEL, SOURCE_LABEL, type MilkStatus, type MilkSource } from "@/lib/milk-collection";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];

function statusTone(status: string) {
  if (status === "priced") return "blue" as const;
  if (status === "verified") return "green" as const;
  if (status === "rejected") return "red" as const;
  return "amber" as const;
}

export default async function MilkCollectPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active, full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ALLOWED_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf doodh jama karne wale staff ke liye hai.</div>;
  }

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: farmers }, { data: mine }, { data: staff }] = await Promise.all([
    supabase
      .from("farmers")
      .select("id, full_name, farmer_code")
      .eq("is_deleted", false)
      .order("farmer_code"),
    supabase
      .from("milk_entries")
      .select("id, collection_number, quantity_liters, lr, status, source, shift, flags, farmers(full_name, farmer_code)")
      .eq("mca_profile_id", user!.id)
      .eq("entry_date", today)
      .order("created_at", { ascending: false }),
    supabase.from("staff_details").select("milk_route_name, milk_chiller_name").eq("profile_id", user!.id).maybeSingle(),
  ]);

  const options: FarmerOption[] = (farmers ?? []).map((f) => ({
    id: f.id,
    full_name: f.full_name ?? "—",
    farmer_code: f.farmer_code,
  }));

  const todaysLiters = (mine ?? []).reduce((sum, e) => sum + Number(e.quantity_liters), 0);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title="Doodh Jama Karein"
        description={
          staff?.milk_route_name
            ? `Route: ${staff.milk_route_name}${staff.milk_chiller_name ? ` • Chiller: ${staff.milk_chiller_name}` : ""}`
            : "Route abhi darj nahi — HR se kehein ke aap ka route aur chiller likh dein."
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-surface-500">Aaj ki entries</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">{mine?.length ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">Aaj ka doodh</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
            {Math.round(todaysLiters * 10) / 10} L
          </p>
        </Card>
      </div>

      <CollectForm farmers={options} />

      <Card className="overflow-hidden">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Aaj ki entries</h3>
        </div>
        {(mine ?? []).length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-surface-400">Aaj abhi tak koi entry nahi.</p>
        ) : (
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {(mine ?? []).map((e) => {
              const farmer = Array.isArray(e.farmers) ? e.farmers[0] : e.farmers;
              const flags = Array.isArray(e.flags) ? (e.flags as string[]) : [];
              return (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-900 dark:text-white">
                        {farmer?.farmer_code} — {farmer?.full_name ?? "—"}
                      </p>
                      <p className="text-xs text-surface-500">
                        {Number(e.quantity_liters)} L
                        {e.lr != null && ` • LR ${Number(e.lr)}`}
                        {" • "}
                        {e.shift === "morning" ? "Subah" : "Shaam"}
                        {" • "}
                        {SOURCE_LABEL[e.source as MilkSource] ?? e.source}
                      </p>
                      <p className="text-xs text-surface-400">{e.collection_number}</p>
                    </div>
                    <Badge tone={statusTone(e.status)}>{STATUS_LABEL[e.status as MilkStatus] ?? e.status}</Badge>
                  </div>
                  {flags.map((f) => (
                    <p key={f} className="mt-1 text-xs text-amber-700">⚠️ {f}</p>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
