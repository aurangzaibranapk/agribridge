import { createClient } from "@/lib/supabase/server";
import { executeBridgeTool } from "@/lib/utils/bridge-tools";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import {
  TrendingUp,
  Package,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart2,
  ShoppingCart,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function rs(v: number) {
  return `Rs ${Math.round(v).toLocaleString()}`;
}

function StatusBadge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok
          ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {text}
    </span>
  );
}

export default async function DailyBriefingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle()
    : { data: null };

  const role = me?.role ?? "staff";
  const isAdmin = ["owner", "super_admin", "admin", "finance", "manager"].includes(role);

  // Sab tools parallel chalao
  const [bizResult, stockResult, staffResult, pendingResult] = await Promise.allSettled([
    executeBridgeTool("get_business_report", supabase, { period: "aaj" }, role),
    executeBridgeTool("get_demand_forecast", supabase, { days: 7 }, role),
    isAdmin ? executeBridgeTool("get_staff_performance", supabase, { days: 1 }, role) : Promise.resolve(null),
    isAdmin ? executeBridgeTool("get_pending_approvals", supabase, {}, role) : Promise.resolve(null),
  ]);

  const biz = bizResult.status === "fulfilled" ? (bizResult.value as any) : null;
  const stock = stockResult.status === "fulfilled" ? (stockResult.value as any) : null;
  const staff = staffResult.status === "fulfilled" ? (staffResult.value as any) : null;
  const pending = pendingResult.status === "fulfilled" ? (pendingResult.value as any) : null;

  const today = new Date().toLocaleDateString("en-PK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/bridge-ai"
            className="mb-1 flex items-center gap-1 text-xs text-surface-400 hover:text-brand-600"
          >
            <ArrowLeft className="h-3 w-3" /> Bridge AI
          </Link>
          <PageHeader
            title="Daily Briefing"
            description={today}
          />
        </div>
      </div>

      {/* ---- Aaj ki Sales ---- */}
      {biz && !biz.error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-surface-500">Aaj ki Bikri</p>
                <p className="mt-0.5 text-xl font-bold text-surface-900 tabular-nums dark:text-white">
                  {rs(biz.summary?.total_sales ?? 0)}
                </p>
              </div>
              <TrendingUp className="h-5 w-5 shrink-0 text-brand-500" />
            </div>
            <p className="mt-1 text-xs text-surface-500">{biz.summary?.transaction_count ?? 0} transactions</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-surface-500">Cash / Online</p>
                <p className="mt-0.5 text-xl font-bold text-surface-900 tabular-nums dark:text-white">
                  {rs(biz.payment_mode_breakdown?.cash ?? 0)}
                </p>
              </div>
              <ShoppingCart className="h-5 w-5 shrink-0 text-emerald-500" />
            </div>
            <p className="mt-1 text-xs text-surface-500">
              Online: {rs(biz.payment_mode_breakdown?.online ?? 0)}
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-surface-500">Top Branch</p>
                <p className="mt-0.5 text-base font-bold text-surface-900 dark:text-white line-clamp-1">
                  {biz.top_branch?.branch_name ?? "—"}
                </p>
              </div>
              <BarChart2 className="h-5 w-5 shrink-0 text-purple-500" />
            </div>
            <p className="mt-1 text-xs text-surface-500">
              {biz.top_branch ? rs(biz.top_branch.total) : "Koi sale nahi"}
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-surface-500">Credit Sale</p>
                <p className="mt-0.5 text-xl font-bold text-surface-900 tabular-nums dark:text-white">
                  {rs(biz.payment_mode_breakdown?.credit ?? 0)}
                </p>
              </div>
              <Clock className="h-5 w-5 shrink-0 text-amber-500" />
            </div>
            <p className="mt-1 text-xs text-surface-500">Baad mein lena baaqi</p>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- Stock Alerts ---- */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
              <Package className="h-4 w-4 text-orange-500" /> Stock Alert (7 din)
            </h2>
            {stock && !stock.error && (
              <StatusBadge
                ok={(stock.urgent_products?.length ?? 0) === 0}
                text={
                  (stock.urgent_products?.length ?? 0) === 0
                    ? "Sab theek"
                    : `${stock.urgent_products.length} urgent`
                }
              />
            )}
          </div>
          {!stock || stock.error ? (
            <p className="px-4 py-5 text-sm text-surface-400">Data nahi mil saka.</p>
          ) : (stock.urgent_products?.length ?? 0) === 0 && (stock.need_soon?.length ?? 0) === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-green-700 dark:text-green-400">
              Agle 7 dinon ke liye stock kaafi hai.
            </p>
          ) : (
            <ul className="divide-y divide-surface-100 dark:divide-surface-800">
              {[...(stock.urgent_products ?? []), ...(stock.need_soon ?? [])].slice(0, 8).map((p: any, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-surface-900 dark:text-white">{p.product_name}</p>
                    <p className="text-xs text-surface-500">
                      Bacha: {p.on_hand ?? 0} {p.unit ?? ""} — {p.days_left ?? 0} din
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      (p.urgency === "urgent" || (stock.urgent_products ?? []).includes(p))
                        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    }`}
                  >
                    {p.urgency === "urgent" ? "Urgent" : "Jald"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ---- Staff Performance (aaj) ---- */}
        {isAdmin && (
          <Card className="overflow-hidden">
            <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                <Users className="h-4 w-4 text-brand-500" /> Aaj Staff ki Performance
              </h2>
            </div>
            {!staff || staff.error || !staff.ranking?.length ? (
              <p className="px-4 py-5 text-center text-sm text-surface-400">
                Aaj abhi koi sale record nahi.
              </p>
            ) : (
              <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                {(staff.ranking as any[]).slice(0, 6).map((s: any, i: number) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40"
                          : "bg-surface-100 text-surface-600 dark:bg-surface-800"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900 dark:text-white">{s.name}</p>
                      <p className="text-xs text-surface-500">{s.transaction_count} sales</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-200">
                      {rs(s.total_sales)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* ---- Pending Approvals ---- */}
        {isAdmin && pending && !pending.error && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                <Clock className="h-4 w-4 text-amber-500" /> Pending Approvals
              </h2>
              <StatusBadge
                ok={(pending.pending_count ?? 0) === 0}
                text={
                  (pending.pending_count ?? 0) === 0
                    ? "Kuch nahi"
                    : `${pending.pending_count} baaki`
                }
              />
            </div>
            {(pending.pending_count ?? 0) === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-green-700 dark:text-green-400">
                Koi approval pending nahi.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                  {(pending.approvals as any[]).slice(0, 5).map((a: any, i: number) => (
                    <li key={i} className="px-4 py-2.5">
                      <p className="text-sm font-medium text-surface-900 dark:text-white">
                        {a.description ?? a.type}
                      </p>
                      <p className="text-xs text-surface-500">{a.submitted_at}</p>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-surface-100 px-4 py-2.5 dark:border-surface-800">
                  <Link
                    href="/admin/bridge-ai/action-requests"
                    className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Sab dekho →
                  </Link>
                </div>
              </>
            )}
          </Card>
        )}

        {/* ---- Top Products aaj ---- */}
        {biz && !biz.error && (biz.top_products?.length ?? 0) > 0 && (
          <Card className="overflow-hidden">
            <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Aaj ke Best Sellers
              </h2>
            </div>
            <ul className="divide-y divide-surface-100 dark:divide-surface-800">
              {(biz.top_products as any[]).slice(0, 6).map((p: any, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-900 dark:text-white">{p.product_name}</p>
                    <p className="text-xs text-surface-500">{p.qty_sold} bika</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-200">
                    {rs(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* ---- AI se poochein ---- */}
      <Card className="p-4">
        <p className="text-sm text-surface-600 dark:text-surface-400">
          Zyada detail chahiye?{" "}
          <Link href="/admin/bridge-ai" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Bridge AI se poochein →
          </Link>
        </p>
      </Card>
    </div>
  );
}
