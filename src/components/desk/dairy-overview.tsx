import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { Droplets, Users, TrendingUp, Truck } from "lucide-react";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const ct = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-PK"));
const liters = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toFixed(1)} L`;

export async function DairyOverview({ branchId }: { branchId: string | null }) {
  const service = createServiceClient();
  const today = aajKaKhana();

  try {
    let q = service
      .from("milk_entries")
      .select("id, quantity_liters, fat_percentage, total_amount, shift, farmers(full_name)")
      .eq("entry_date", today);
    if (branchId) q = q.eq("branch_id", branchId);

    const [todayRes, recentRes] = await Promise.all([
      q,
      (() => {
        let rq = service
          .from("milk_entries")
          .select("id, entry_date, quantity_liters, fat_percentage, total_amount, shift, farmers(full_name)")
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8);
        if (branchId) rq = rq.eq("branch_id", branchId);
        return rq;
      })(),
    ]);

    const todayEntries = todayRes.data ?? [];
    const totalLiters = todayEntries.reduce((s, r: any) => s + Number(r.quantity_liters ?? 0), 0);
    const totalAmount = todayEntries.reduce((s, r: any) => s + Number(r.total_amount ?? 0), 0);
    const avgFat =
      todayEntries.length > 0
        ? todayEntries.reduce((s, r: any) => s + Number(r.fat_percentage ?? 0), 0) / todayEntries.length
        : null;
    const morningEntries = todayEntries.filter((r: any) => r.shift === "morning").length;
    const eveningEntries = todayEntries.filter((r: any) => r.shift === "evening").length;
    const recentEntries = recentRes.data ?? [];

    return (
      <div className="staff-desk-screen">
        <div className="staff-desk-top-grid">
          <section className="desk-card staff-desk-ledger">
            <div className="staff-desk-card-title">
              <span><Droplets /> Aaj Ka Doodh</span>
              <span className="staff-desk-live">Dairy</span>
            </div>
            <div className="staff-desk-ledger-total">
              <strong>{liters(totalLiters)}</strong>
              <span>Aaj ka total — {today}</span>
            </div>
            <div className="staff-desk-ledger-split">
              <div><span>Raqam</span><strong>{money(totalAmount)}</strong></div>
              <div><span>Subah entries</span><strong>{ct(morningEntries)}</strong></div>
              <div><span>Shaam entries</span><strong>{ct(eveningEntries)}</strong></div>
            </div>
            <Link href="/admin/milk-collection" className="mt-4 block text-[12px] text-brand-600 dark:text-brand-400">
              Doodh collection →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><TrendingUp /> FAT &amp; Quality</h2>
            <div className="staff-desk-funnel">
              <div>
                <strong>{avgFat != null ? avgFat.toFixed(1) + "%" : "—"}</strong>
                <span>Avg FAT aaj</span>
              </div>
              <div><strong>{ct(todayEntries.length)}</strong><span>Total entries</span></div>
              <div><strong>{money(totalAmount)}</strong><span>Aaj ka total</span></div>
            </div>
            <Link href="/admin/milk-collection" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Details dekhein →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><Users /> Farmers</h2>
            <div className="staff-desk-health">
              <div><strong>{ct(todayEntries.length)}</strong><span>Aaj ka</span></div>
              <div><strong>{ct(morningEntries)}</strong><span>Subah</span></div>
              <div><strong>{ct(eveningEntries)}</strong><span>Shaam</span></div>
            </div>
            <Link href="/admin/farmers" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Farmers →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary staff-desk-urgent">
            <h2><Truck /> Collection</h2>
            <div className="staff-desk-funnel">
              <div><strong>{ct(morningEntries)}</strong><span>Morning</span></div>
              <div><strong>{ct(eveningEntries)}</strong><span>Evening</span></div>
            </div>
            <Link href="/admin/milk-collection/routes" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Routes dekhein →
            </Link>
          </section>
        </div>

        {/* Recent Milk Entries */}
        <section className="desk-card">
          <div className="staff-desk-card-title">
            <span><Droplets /> Haal Ki Doodh Entries</span>
            <Link href="/admin/milk-collection" className="text-[11px] text-brand-600 dark:text-brand-400">Sab dekhein →</Link>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentEntries.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-surface-400">Koi entry nahi mili.</p>
            ) : (
              recentEntries.map((e: any) => {
                const farmer = Array.isArray(e.farmers) ? e.farmers[0] : e.farmers;
                return (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-surface-800 dark:text-surface-100">
                        {farmer?.full_name ?? "—"} · {e.shift ?? "—"}
                      </p>
                      <p className="text-[11px] text-surface-500">
                        {e.entry_date} · FAT: {e.fat_percentage != null ? `${Number(e.fat_percentage).toFixed(1)}%` : "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                      {liters(Number(e.quantity_liters ?? 0))}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    );
  } catch {
    return (
      <div className="desk-card">
        <p className="text-sm text-surface-500">Dairy ka data load nahi hua. Refresh karein.</p>
        <Link href="/admin/milk-collection" className="mt-2 block text-sm text-brand-600">Milk collection kholein →</Link>
      </div>
    );
  }
}
