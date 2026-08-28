import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { signedLrUrl } from "@/lib/milk-collection";
import { ChillerClient, type RouteGroup, type PendingEntry } from "./chiller-client";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];
const NO_ROUTE = "Bagair route";

export default async function ChillerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; shift?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ALLOWED_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf chiller aur manager ke liye hai.</div>;
  }

  const date = params.date ?? new Date().toISOString().slice(0, 10);
  const shift = params.shift ?? (new Date().getHours() < 14 ? "morning" : "evening");

  const [{ data: entries }, { data: receipts }] = await Promise.all([
    supabase
      .from("milk_entries")
      .select("id, collection_number, quantity_liters, lr, status, entry_channel, collection_source, route_name, lr_image_path, flags, farmers(full_name, farmer_code)")
      .eq("entry_date", date)
      .eq("shift", shift)
      .neq("status", "rejected")
      .order("created_at"),
    supabase
      .from("milk_route_collections")
      .select("route_name, chiller_received_volume, shortage_liters, is_red_alert")
      .eq("collection_date", date)
      .eq("shift", shift),
  ]);

  // Signed URL ek ek kar ke banti hai, is liye sirf un entries ke liye
  // jo abhi FAT ka intezar kar rahi hain -- jin par rate lag chuka, un
  // ki parchi dobara kholne ki zarurat nahi.
  const groups = new Map<string, RouteGroup>();
  let pendingCount = 0;
  let totalLiters = 0;

  let selfDeliveryLiters = 0;
  let selfDeliveryCount = 0;

  for (const row of entries ?? []) {
    const liters = Number(row.quantity_liters);
    totalLiters += liters;

    // Kisan khud laya hua doodh kisi route ke hisaab mein nahi jata.
    // Use MCA ke trip mein milane se us ka nuqsan ghalat nikalta hai.
    if (row.collection_source === "self_delivery") {
      selfDeliveryLiters += liters;
      selfDeliveryCount += 1;
      continue;
    }

    const route = row.route_name ?? NO_ROUTE;

    let group = groups.get(route);
    if (!group) {
      const receipt = (receipts ?? []).find((r) => r.route_name === route);
      group = {
        route,
        entries: [],
        liters: 0,
        received: receipt?.chiller_received_volume == null ? null : Number(receipt.chiller_received_volume),
        shortageLiters: receipt?.shortage_liters == null ? null : Number(receipt.shortage_liters),
        redAlert: receipt?.is_red_alert ?? false,
      };
      groups.set(route, group);
    }
    group.liters += liters;

    if (row.status !== "pending_fat") continue;
    pendingCount += 1;

    const farmer = Array.isArray(row.farmers) ? row.farmers[0] : row.farmers;
    const entry: PendingEntry = {
      id: row.id,
      collection_number: row.collection_number ?? "—",
      farmer_label: `${farmer?.farmer_code ?? "—"} — ${farmer?.full_name ?? "—"}`,
      liters,
      lr: row.lr == null ? null : Number(row.lr),
      channel: row.entry_channel,
      collectionSource: row.collection_source,
      lr_url: await signedLrUrl(row.lr_image_path),
      flags: Array.isArray(row.flags) ? (row.flags as string[]) : [],
    };
    group.entries.push(entry);
  }

  const list = [...groups.values()].sort((a, b) => a.route.localeCompare(b.route));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chiller — FAT aur Dispatch"
        description="FAT yahan lagta hai. Us ke baad hi rate banta hai aur paisa kisan ke khate mein jata hai."
      />

      <Card className="p-3">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div>
            <label className="text-xs text-surface-500">Tareekh</label>
            <input
              name="date"
              type="date"
              defaultValue={date}
              className="mt-1 rounded-lg border border-surface-200 p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-surface-500">Shift</label>
            <select name="shift" defaultValue={shift} className="mt-1 rounded-lg border border-surface-200 p-2 text-sm">
              <option value="morning">Subah</option>
              <option value="evening">Shaam</option>
            </select>
          </div>
          <button type="submit" className="rounded-lg border border-surface-300 px-3 py-2 text-sm">
            Dikhayein
          </button>
          <Link
            href="/admin/milk-collection/verify"
            className="ml-auto rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Manager Verify
          </Link>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-surface-500">MCA ka doodh</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
            {Math.round((totalLiters - selfDeliveryLiters) * 10) / 10} L
          </p>
          <p className="text-xs text-surface-400">{list.length} route</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">Kisan khud laya</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
            {Math.round(selfDeliveryLiters * 10) / 10} L
          </p>
          <p className="text-xs text-surface-400">{selfDeliveryCount} entries</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">Kul mausool</p>
          <p className="mt-1 text-2xl font-semibold text-brand-700 dark:text-brand-400">
            {Math.round(totalLiters * 10) / 10} L
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">FAT ka intezar</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{pendingCount}</p>
        </Card>
      </div>

      <p className="px-1 text-xs text-surface-400">
        Neeche ke route sirf MCA ka doodh dikhate hain. Jo kisan khud le kar aaye, wo kisi MCA ke trip
        mein nahi ginta — warna us ka nuqsan aur karkardagi dono ghalat nikalte.
      </p>

      <ChillerClient groups={list} date={date} shift={shift} />
    </div>
  );
}
