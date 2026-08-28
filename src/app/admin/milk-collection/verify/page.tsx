import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { VerifyClient, type PricedEntry } from "./verify-client";

export const dynamic = "force-dynamic";

const VERIFY_ROLES = ["owner", "super_admin", "admin", "manager"];

export default async function MilkVerifyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !VERIFY_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf Manager aur Admin ke liye hai.</div>;
  }

  const { data: rows } = await supabase
    .from("milk_entries")
    .select("id, collection_number, quantity_liters, fat_percentage, ts_value, total_amount, route_name, source, flags, possible_duplicate_of, entry_date, shift, farmers(full_name, farmer_code)")
    .eq("status", "priced")
    .order("entry_date", { ascending: false })
    .order("created_at")
    .limit(200);

  const entries: PricedEntry[] = (rows ?? []).map((row) => {
    const farmer = Array.isArray(row.farmers) ? row.farmers[0] : row.farmers;
    return {
      id: row.id,
      collection_number: row.collection_number ?? "—",
      farmer_label: `${farmer?.farmer_code ?? "—"} — ${farmer?.full_name ?? "—"}`,
      route: `${row.route_name ?? "Bagair route"} • ${row.entry_date} ${row.shift === "morning" ? "Subah" : "Shaam"}`,
      liters: Number(row.quantity_liters),
      fat: row.fat_percentage == null ? null : Number(row.fat_percentage),
      ts: row.ts_value == null ? null : Number(row.ts_value),
      amount: row.total_amount == null ? 0 : Number(row.total_amount),
      source: row.source,
      flags: Array.isArray(row.flags) ? (row.flags as string[]) : [],
      duplicate: row.possible_duplicate_of != null,
    };
  });

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manager Verify"
        description="Rate lag chuka hai. Tasdeeq bina wajah likhe nahi hoti — ye rok database mein bhi lagi hui hai."
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-surface-500">Intezar mein</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">{entries.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">Kul raqam</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
            Rs {Math.round(total).toLocaleString()}
          </p>
        </Card>
      </div>

      <VerifyClient entries={entries} />
    </div>
  );
}
