import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { MapPin, Smartphone, Monitor } from "lucide-react";

export const dynamic = "force-dynamic";

function readableDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function time(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default async function AttendanceLogPage() {
  const supabase = createClient();

  const { data: records } = await supabase
    .from("attendance_records")
    .select("id, profile_id, attendance_date, status, source, check_in_at, check_out_at, check_in_distance_meters, check_in_location_ok, check_out_distance_meters, check_out_location_ok, check_in_lat, check_in_lng")
    .order("attendance_date", { ascending: false })
    .limit(200);

  const rows = records ?? [];
  const ids = Array.from(new Set(rows.map((r) => r.profile_id).filter(Boolean))) as string[];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, role").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; role: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Staff"]));

  const flagged = rows.filter((r) => r.check_in_location_ok === false);
  const unverified = rows.filter((r) => r.check_in_location_ok === null && r.check_in_at);

  return (
    <div>
      <PageHeader
        title="Hazri ka Record (Location ke sath)"
        description="Kaun kahan se hazri laga raha hai — daire ke andar ya bahar."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-surface-500">Kul hazriyan</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">⚠️ Daire se bahar</p>
          <p className="mt-1 font-display text-xl font-bold text-amber-600">{flagged.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">Tasdeeq nahi ho saki</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-500">{unverified.length}</p>
          <p className="text-xs text-surface-500">Location nahi bheji, ya branch ki jagah darj nahi</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Abhi tak koi hazri nahi lagi." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">Tareekh</th>
                <th className="px-3 py-2 font-medium text-surface-500">Naam</th>
                <th className="px-3 py-2 font-medium text-surface-500">Aaya</th>
                <th className="px-3 py-2 font-medium text-surface-500">Gaya</th>
                <th className="px-3 py-2 font-medium text-surface-500">Kahan se</th>
                <th className="px-3 py-2 font-medium text-surface-500">Zariya</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const dist = r.check_in_distance_meters == null ? null : Number(r.check_in_distance_meters);
                const hasCoords = r.check_in_lat != null && r.check_in_lng != null;
                return (
                  <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{r.attendance_date}</td>
                    <td className="px-3 py-2 text-surface-900 dark:text-white">{nameById.get(r.profile_id as string) ?? "-"}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{time(r.check_in_at)}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{time(r.check_out_at)}</td>
                    <td className="px-3 py-2">
                      {r.check_in_location_ok === true && <Badge tone="green">Branch par ({dist != null ? readableDistance(dist) : "-"})</Badge>}
                      {r.check_in_location_ok === false && (
                        <Badge tone="amber">Door se — {dist != null ? readableDistance(dist) : "?"}</Badge>
                      )}
                      {r.check_in_location_ok == null && (
                        <span className="text-xs text-surface-400">
                          {hasCoords ? "Branch ki jagah darj nahi" : "Location nahi bheji"}
                        </span>
                      )}
                      {hasCoords && (
                        <a
                          href={`https://www.google.com/maps?q=${r.check_in_lat},${r.check_in_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-0.5 text-xs text-brand-600 hover:underline"
                        >
                          <MapPin className="h-3 w-3" /> Map
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                        {r.source === "whatsapp" ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                        {r.source === "whatsapp" ? "WhatsApp" : "Website"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
