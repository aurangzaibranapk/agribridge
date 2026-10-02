import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { ShoppingCart, Wheat, Building2, AlertTriangle, CheckCircle2 } from "lucide-react";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const ct = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-PK"));
const kg = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("en-PK")} kg`;

export async function ProcurementOverview({ branchId }: { branchId: string | null }) {
  const service = createServiceClient();
  const today = aajKaKhana();

  try {
    const [pendingBillsRes, todayGrainRes, suppliersRes, recentGrainRes] = await Promise.all([
      service
        .from("purchases")
        .select("id, grand_total", { count: "exact" })
        .in("status", ["pending", "received"]),
      service
        .from("grain_procurement_entries")
        .select("id, weight_kg, total_amount, grain_type")
        .eq("entry_date", today),
      service
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      service
        .from("grain_procurement_entries")
        .select("id, entry_date, grain_type, weight_kg, total_amount, farmers(full_name), grain_parties(party_name)")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const pendingBillCount = pendingBillsRes.count ?? 0;
    const pendingBillAmount = (pendingBillsRes.data ?? []).reduce((s: number, r: any) => s + Number(r.grand_total ?? 0), 0);
    const todayGrain = todayGrainRes.data ?? [];
    const todayGrainKg = todayGrain.reduce((s, r: any) => s + Number(r.weight_kg ?? 0), 0);
    const todayGrainAmount = todayGrain.reduce((s, r: any) => s + Number(r.total_amount ?? 0), 0);
    const supplierCount = suppliersRes.count ?? 0;
    const recentGrain = recentGrainRes.data ?? [];

    // Grain types aaj
    const grainTypes = new Set(todayGrain.map((r: any) => r.grain_type)).size;

    return (
      <div className="staff-desk-screen">
        <div className="staff-desk-top-grid">
          <section className="desk-card staff-desk-ledger">
            <div className="staff-desk-card-title">
              <span><Wheat /> Aaj Ka Grain</span>
              <span className="staff-desk-live">Procurement</span>
            </div>
            <div className="staff-desk-ledger-total">
              <strong>{kg(todayGrainKg)}</strong>
              <span>Aaj ka total grain — {today}</span>
            </div>
            <div className="staff-desk-ledger-split">
              <div><span>Raqam</span><strong>{money(todayGrainAmount)}</strong></div>
              <div><span>Entries</span><strong>{ct(todayGrain.length)}</strong></div>
              <div><span>Grain types</span><strong>{ct(grainTypes)}</strong></div>
            </div>
            <Link href="/admin/grain-procurement" className="mt-4 block text-[12px] text-brand-600 dark:text-brand-400">
              Grain procurement →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><ShoppingCart /> Pending Bills</h2>
            <div className="staff-desk-funnel">
              <div><strong>{ct(pendingBillCount)}</strong><span>Pending bills</span></div>
              <div><strong>{money(pendingBillAmount)}</strong><span>Total raqam</span></div>
              <div><strong>{ct(supplierCount)}</strong><span>Active suppliers</span></div>
            </div>
            <Link href="/admin/purchases" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Purchases kholein →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><Building2 /> Suppliers</h2>
            <div className="staff-desk-health">
              <div><strong>{ct(supplierCount)}</strong><span>Active</span></div>
              <div><strong>—</strong><span>Due balance</span></div>
              <div><strong>—</strong><span>This month</span></div>
            </div>
            <Link href="/admin/suppliers" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Suppliers →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary staff-desk-urgent">
            <h2><AlertTriangle /> Bills Pending</h2>
            {pendingBillCount > 0 ? (
              <>
                <div className="staff-desk-funnel">
                  <div><strong className="text-amber-600 dark:text-amber-400">{ct(pendingBillCount)}</strong><span>Manzoori baqi</span></div>
                </div>
                <Link href="/admin/purchases" className="mt-3 block text-[12px] text-amber-600 dark:text-amber-400 font-medium">
                  Bills dekhein →
                </Link>
              </>
            ) : (
              <p className="flex items-center gap-1.5 mt-2 text-[12px] text-surface-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Koi pending bill nahi
              </p>
            )}
          </section>
        </div>

        {/* Recent Grain Entries */}
        <section className="desk-card">
          <div className="staff-desk-card-title">
            <span><Wheat /> Haal Ki Grain Entries</span>
            <Link href="/admin/grain-procurement" className="text-[11px] text-brand-600 dark:text-brand-400">Sab dekhein →</Link>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentGrain.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-surface-400">Koi grain entry nahi mili.</p>
            ) : (
              recentGrain.map((g: any) => {
                const farmer = Array.isArray(g.farmers) ? g.farmers[0] : g.farmers;
                const party = Array.isArray(g.grain_parties) ? g.grain_parties[0] : g.grain_parties;
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-surface-800 dark:text-surface-100">
                        {farmer?.full_name ?? party?.party_name ?? "—"} · {g.grain_type ?? "grain"}
                      </p>
                      <p className="text-[11px] text-surface-500">{g.entry_date} · {kg(Number(g.weight_kg ?? 0))}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                      {money(Number(g.total_amount ?? 0))}
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
        <p className="text-sm text-surface-500">Procurement ka data load nahi hua. Refresh karein.</p>
        <Link href="/admin/grain-procurement" className="mt-2 block text-sm text-brand-600">Grain procurement kholein →</Link>
      </div>
    );
  }
}
