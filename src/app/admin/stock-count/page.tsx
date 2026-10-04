import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { Card, EmptyState } from "@/components/ui/layout-primitives";
import { StartCountForm, CountingSheet, ReviewSheet } from "./count-client";
import { LiabilityPanel } from "./liability-client";
import {
  openCount,
  recentCounts,
  overdueCounts,
  countSchedules,
  openCountsByWarehouse,
  COUNT_OVERDUE_DAYS,
} from "@/lib/ledger/stock-count";
import { ScheduleSection } from "./schedule-client";
import { AdminCommandMonitor, type StockCountCommandRow } from "./admin-command-monitor";
import { AlertTriangle, CheckCircle2, PackageSearch, EyeOff, ArrowLeft, ClipboardCheck, Clock3, Wifi } from "lucide-react";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance", "warehouse"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function StockCountPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; step?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle()
    : { data: null };

  // Ijazat do raaston se aati hai.
  //
  // Purana raasta ROLE ka hai. Naya raasta ZIMMEDARI ka: malik ne kaha
  // *"hum kisi ko bhi access dein ke stock count karwa sakein."* Us ke
  // liye poore nizam ka `warehouse` role de dena bohot bara darwaza
  // kholta -- wo banda phir har godam ka maal hila sakta. Is liye
  // ijazat tang hai: sirf ginti, aur sirf un godamon ki jin ka wo
  // zimmedar likha gaya hai (335).
  const roleSeIjazat = Boolean(me?.is_active) && ROLES.includes(me?.role ?? "");
  const { data: mereGodam } = me?.is_active
    ? await supabase.rpc("fn_stock_count_mere_godam")
    : { data: null };
  const zimmedariWaleGodam = new Set((mereGodam ?? []).map((r) => r.warehouse_id as string));

  if (!me?.is_active || (!roleSeIjazat && zimmedariWaleGodam.size === 0)) {
    return (
      <div className="p-8 text-center text-surface-400">{t("at_warehouse_roles", lang)}</div>
    );
  }

  const seesAll = roleSeIjazat && me.role !== "warehouse" && me.role !== "manager";
  let whQuery = supabase.from("warehouses").select("id, name").eq("is_active", true).order("name");
  if (roleSeIjazat && !seesAll && me.branch_id) whQuery = whQuery.eq("branch_id", me.branch_id);
  const { data: whRows } = await whQuery;

  // Jise sirf zimmedari se ijazat mili, usay SIRF apne godam.
  const warehouses = (whRows ?? [])
    .filter((w) => roleSeIjazat || zimmedariWaleGodam.has(w.id))
    .map((w) => ({ id: w.id, name: w.name }));

  // Tarteeb sirf Admin darja badal sakta hai -- ginne wala nahi. Agar
  // ginne wala apni hi tareekh aage kar sake to ginti hamesha "kal"
  // hoti rehti hai.
  const tarteebBadalSakta = ["owner", "super_admin", "admin"].includes(me.role);
  const [tarteeb, { data: sabLog }] = await Promise.all([
    countSchedules(),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  const tarteebDikhao = roleSeIjazat
    ? tarteeb
    : tarteeb.filter((r) => zimmedariWaleGodam.has(r.warehouseId));
  const selected = params.w ?? warehouses[0]?.id ?? null;

  // Milaan ke safhe par hi asal adad kholte hain. Ginti ke safhe par
  // kabhi nahi -- yehi is poore amal ki jaan hai.
  const reviewing = params.step === "review";
  const current = selected ? await openCount(selected, reviewing) : null;

  // Branch Manager: apni branch ki tasdeeq. Finance/Owner: final post.
  const sabKuchWala = UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));
  const canApprove = sabKuchWala || (await canDo("stock-count", "approve"));
  const canVerify = !canApprove && (await canDo("stock-count", "verify"));

  const [history, overdue, activeCountMap] = await Promise.all([
    recentCounts(15),
    overdueCounts(),
    openCountsByWarehouse(),
  ]);

  // Admin ke liye command/response monitor. Existing stock-count records se
  // reporting banti hai; koi purana data ya product quantity change nahi hoti.
  const commandService = supabase as any;
  const [{ data: commandCounts }, { data: commandSchedules }, { data: commandProfiles }] = await Promise.all([
    commandService
      .from("stock_counts")
      .select("id, warehouse_id, status, started_by, started_at, verified_at, posted_at, warehouses(name), stock_count_lines(counted_qty)")
      .order("started_at", { ascending: false })
      .limit(50),
    commandService
      .from("stock_count_schedules")
      .select("warehouse_id, zimmedar, updated_at, warehouses(name)")
      .limit(100),
    commandService.from("profiles").select("id, full_name").eq("is_active", true).limit(500),
  ]);
  const profileNames = new Map<string, string>((commandProfiles ?? []).map((p: any) => [p.id, p.full_name ?? "—"]));
  const scheduleByWarehouse = new Map<string, any>((commandSchedules ?? []).map((s: any) => [s.warehouse_id, s]));
  const countRows: StockCountCommandRow[] = (commandCounts ?? []).map((c: any) => {
    const schedule = scheduleByWarehouse.get(c.warehouse_id);
    const lines = Array.isArray(c.stock_count_lines) ? c.stock_count_lines : [];
    return {
      id: c.id,
      warehouseName: c.warehouses?.name ?? schedule?.warehouses?.name ?? "—",
      staffName: profileNames.get(schedule?.zimmedar ?? c.started_by) ?? "Staff assignment nahi",
      commandAt: schedule?.updated_at ?? c.started_at ?? null,
      startedAt: c.started_at ?? null,
      completedAt: c.posted_at ?? c.verified_at ?? null,
      totalProducts: lines.length,
      countedProducts: lines.filter((l: any) => l.counted_qty !== null).length,
      status: c.status ?? "—",
    };
  });
  const countedWarehouses = new Set(countRows.map((row) => row.warehouseName));
  const assignedOnlyRows: StockCountCommandRow[] = (commandSchedules ?? [])
    .filter((s: any) => s.zimmedar && !countedWarehouses.has(s.warehouses?.name ?? "—"))
    .map((s: any) => ({
      id: `schedule-${s.warehouse_id}`,
      warehouseName: s.warehouses?.name ?? "—",
      staffName: profileNames.get(s.zimmedar) ?? "Staff assignment nahi",
      commandAt: s.updated_at ?? null,
      startedAt: null,
      completedAt: null,
      totalProducts: 0,
      countedProducts: 0,
      status: "assigned",
    }));
  const commandRows: StockCountCommandRow[] = [...countRows, ...assignedOnlyRows];

  const assignedCount = current?.lines.length ?? null;
  const countedCount = current ? current.lines.filter((line) => line.counted != null).length : null;
  const remainingCount = assignedCount != null && countedCount != null ? assignedCount - countedCount : null;
  const progress = assignedCount && countedCount != null ? Math.round((countedCount / assignedCount) * 100) : null;

  // Ginti ka farq jo staff ke khate ke liye bheja gaya hai -- staff
  // apna hissa yahin qabool/mana karta hai (malik, 15 September: "har
  // product ke sath button ho verify/acknowledge karne ka"). Admin/
  // Owner ko sab ki nigrani, baaqi ko sirf apna hissa dikhta hai.
  let liabilityQuery = supabase
    .from("stock_count_liability_shares")
    .select(
      "id, product_name, reason, share_amount, profile_id, profiles(full_name), stock_count_liability_requests(count_id, stock_counts(count_date, warehouses(name)))"
    )
    .eq("status", "pending")
    .order("id");
  if (!sabKuchWala && user) liabilityQuery = liabilityQuery.eq("profile_id", user.id);
  const { data: pendingShares } = user ? await liabilityQuery : { data: null };

  const liabilityShares = (pendingShares ?? []).map((s: any) => {
    const req = Array.isArray(s.stock_count_liability_requests) ? s.stock_count_liability_requests[0] : s.stock_count_liability_requests;
    const sc = Array.isArray(req?.stock_counts) ? req.stock_counts[0] : req?.stock_counts;
    const wh = Array.isArray(sc?.warehouses) ? sc.warehouses[0] : sc?.warehouses;
    const prof = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    return {
      id: s.id,
      productName: s.product_name,
      reason: s.reason ?? "",
      amount: Number(s.share_amount),
      staffName: prof?.full_name ?? "—",
      warehouseName: wh?.name ?? "—",
      countDate: sc?.count_date ?? "",
    };
  });

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="/admin/my-work" className="mb-3 inline-flex items-center gap-1.5 text-sm text-surface-500 transition hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> My Work
          </a>
          <h1 className="font-display text-3xl font-bold tracking-tight text-surface-900 dark:text-white">{t("sc_title", lang)}</h1>
          <p className="mt-1 max-w-3xl text-sm text-surface-500 dark:text-surface-400">{t("sc_subtitle", lang)}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
          <Wifi className="h-4 w-4" /> Offline save + auto sync active
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Assigned Products", value: assignedCount == null ? "—" : assignedCount.toLocaleString(), tone: "blue", icon: ClipboardCheck },
          { label: "Counted", value: countedCount == null ? "—" : countedCount.toLocaleString(), tone: "green", icon: CheckCircle2 },
          { label: "Remaining", value: remainingCount == null ? "—" : remainingCount.toLocaleString(), tone: "amber", icon: Clock3 },
          { label: "Progress", value: progress == null ? "—" : `${progress}%`, tone: "violet", icon: ClipboardCheck },
        ].map((stat) => {
          const Icon = stat.icon;
          const tone = stat.tone === "green" ? "border-emerald-200 bg-emerald-50/70 text-emerald-800" : stat.tone === "amber" ? "border-amber-200 bg-amber-50/70 text-amber-800" : stat.tone === "violet" ? "border-violet-200 bg-violet-50/70 text-violet-800" : "border-blue-200 bg-blue-50/70 text-blue-800";
          return <div key={stat.label} className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900 ${tone}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 dark:bg-surface-800"><Icon className="h-5 w-5" /></span><div><p className="text-xs font-medium opacity-80">{stat.label}</p><p className="mt-0.5 text-2xl font-bold tabular-nums">{stat.value}</p></div></div>;
        })}
      </div>

      {current && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300"><ClipboardCheck className="h-5 w-5" /> آج مقرر کردہ مصنوعات کی گنتی مکمل کریں</p>
          <p className="text-xs text-rose-700/80 dark:text-rose-300/70">Only assigned products are shown · System quantity is hidden</p>
        </div>
      )}

      <LiabilityPanel shares={liabilityShares} isAdmin={sabKuchWala} />

      {sabKuchWala && <AdminCommandMonitor rows={commandRows} />}

      {/* ---- Jin godamon ki ginti nahi hui ---- */}
      {overdue.length > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{overdue.length} {t("sc_overdue_1", lang)}</strong> {t("sc_overdue_2", lang)} {COUNT_OVERDUE_DAYS} {t("sc_overdue_3", lang)}
              <span className="mt-1 block text-xs font-normal">
                {overdue.map((o) => (
                  <span key={o.warehouseId} className="mr-3 inline-block">
                    {o.warehouseName} — {o.lastCount ? `${t("sc_last_count", lang)} ${o.lastCount}` : t("sc_never_counted", lang)}
                  </span>
                ))}
              </span>
              <span className="mt-1 block text-xs font-normal">
                {t("sc_never_counted_note", lang)}
              </span>
            </span>
          </p>
        </Card>
      )}

      <ScheduleSection
        rows={tarteebDikhao}
        log={(sabLog ?? []).map((p) => ({ id: p.id as string, naam: (p.full_name as string | null) ?? "—" }))}
        canEdit={tarteebBadalSakta}
        activeCountMap={activeCountMap}
      />

      {warehouses.length === 0 ? (
        <Card className="p-4">
          <EmptyState title={t("sc_no_warehouse", lang)} description={t("sc_no_warehouse_note", lang)} />
        </Card>
      ) : (
        <div
          className={
            warehouses.length > 1
              ? "grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]"
              : "grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
          }
        >
          {/* Ek se zyada godam ki ijazat ho to hi chunne wali list --
              ek godam wale (jaise Anwar) ke liye ye khaali box sirf
              jagah leta, kuch chunne ko hota hi nahi. */}
          {(warehouses.length > 1 || current) && (
            <div className="space-y-4">
              <Card className="p-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("sc_warehouse", lang)}</h2>
                <ul className="space-y-1">
                  {warehouses.map((w) => (
                    <li key={w.id}>
                      <a
                        href={`/admin/stock-count?w=${w.id}`}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          selected === w.id
                            ? "bg-brand-50 font-medium text-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
                            : "text-surface-700 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-900"
                        }`}
                      >
                        <span>{w.name}</span>
                        {selected === w.id && <span className="block text-[10px] text-emerald-700 dark:text-emerald-300">Current count</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>

              {!current && (
                <Card className="p-4">
                  <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
                    <PackageSearch className="h-4 w-4" /> {t("sc_new_count", lang)}
                  </h2>
                  <StartCountForm warehouses={warehouses} />
                </Card>
              )}
            </div>
          )}

          {warehouses.length === 1 && !current && (
            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
                <PackageSearch className="h-4 w-4" /> {t("sc_new_count", lang)}
              </h2>
              <StartCountForm warehouses={warehouses} />
            </Card>
          )}

          <div className="space-y-4">
            {current && (
              <Card className="border-emerald-200 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-surface-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Ginti ki surat-e-haal</h2>
                    <p className="text-xs text-surface-500">{countedCount} / {assignedCount} products counted</p>
                  </div>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{progress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                  <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-700 dark:text-amber-300">{remainingCount} baqi</span>
                  {current.allCounted || canApprove ? (
                    <a href={`/admin/stock-count?w=${current.warehouseId}&step=review`} className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white hover:bg-emerald-800">Review &amp; Submit</a>
                  ) : <span className="text-surface-500">Assigned items complete karein</span>}
                </div>
              </Card>
            )}

            {/* ---- Khuli hui ginti ---- */}
            {current ? (
              <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-surface-900 dark:text-white">
                      {current.warehouseName} —{" "}
                      {reviewing
                        ? current.status === "verified"
                          ? "Tasdeeq shuda — final post ka intezar"
                          : t("sc_review", lang)
                        : t("sc_counting", lang)}
                    </h2>
                    <p className="text-xs text-surface-500">
                      {current.countDate} • {current.lines.length} {t("sc_items", lang)}
                      {current.startedByName && ` • ${current.startedByName}`}
                    </p>
                  </div>
                  {(current.allCounted || canApprove) && !reviewing && (
                    <a
                      href={`/admin/stock-count?w=${current.warehouseId}&step=review`}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      {t("sc_go_to_review", lang)}
                    </a>
                  )}
                  {reviewing && (
                    <a
                      href={`/admin/stock-count?w=${current.warehouseId}`}
                      className="text-xs text-surface-500 underline"
                    >
                      {t("sc_back_to_count", lang)}
                    </a>
                  )}
                </div>

                {reviewing ? (
                  <ReviewSheet
                    countId={current.id}
                    lines={current.lines}
                    status={current.status}
                    canVerify={canVerify}
                    canApprove={canApprove}
                  />
                ) : (
                  <CountingSheet
                    countId={current.id}
                    canEditRates={["owner", "super_admin", "admin", "warehouse"].includes(me.role)}
                    canForceClose={["owner", "super_admin", "admin"].includes(me.role)}
                    lines={current.lines.map((l) => ({
                      id: l.id,
                      productId: l.productId,
                      productName: l.productName,
                      unit: l.unit,
                      packSize: l.packSize,
                      counted: l.counted,
                      salePrice: l.salePrice,
                      tradePrice: l.tradePrice,
                      saleRatePending: l.saleRatePending,
                      tradeRatePending: l.tradeRatePending,
                    }))}
                  />
                )}

                {!reviewing && !current.allCounted && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-surface-500">
                    <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {t("sc_hidden_until_all", lang)}
                  </p>
                )}
              </Card>
            ) : (
              <Card className="p-6">
                <EmptyState
                  title={t("sc_no_open_count", lang)}
                  description={t("sc_no_open_count_note", lang)}
                />
              </Card>
            )}

            {/* ---- Purani gintiyan ---- */}
            <Card className="overflow-hidden">
              <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
                {t("sc_past_counts", lang)}
              </div>
              {history.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-surface-400">{t("sc_no_past_counts", lang)}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
                      <tr>
                        <th className="px-4 py-2 font-medium">{t("sc_warehouse", lang)}</th>
                        <th className="px-4 py-2 font-medium">{t("sc_date", lang)}</th>
                        <th className="px-4 py-2 text-right font-medium">{t("sc_items", lang)}</th>
                        <th className="px-4 py-2 text-right font-medium">System Qeemat</th>
                        <th className="px-4 py-2 text-right font-medium">Gini Qeemat</th>
                        <th className="px-4 py-2 text-right font-medium">{t("sc_with_gaps", lang)}</th>
                        <th className="px-4 py-2 text-right font-medium">{t("sc_loss_gain", lang)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {history.map((h) => (
                        <tr key={h.id} className={h.gapCount > 0 ? "bg-red-50/60 dark:bg-red-950/10" : ""}>
                          <td className="px-4 py-2 text-surface-800 dark:text-surface-200">{h.warehouseName}</td>
                          <td className="px-4 py-2 text-xs text-surface-500">{h.countDate}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-surface-500">{h.lineCount}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-300">{rs(h.systemValue)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-300">{rs(h.countedValue)}</td>
                          <td
                            className={`px-4 py-2 text-right tabular-nums ${
                              h.gapCount > 0
                                ? "font-medium text-red-700 dark:text-red-400"
                                : "text-green-700 dark:text-green-400"
                            }`}
                          >
                            {h.gapCount === 0 ? "—" : h.gapCount}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-medium tabular-nums ${
                              h.totalDifferenceValue === 0
                                ? "text-green-700 dark:text-green-400"
                                : h.totalDifferenceValue > 0
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-700 dark:text-red-400"
                            }`}
                          >
                            {h.totalDifferenceValue === 0
                              ? "0"
                              : `${h.totalDifferenceValue < 0 ? "−" : "+"}${rs(Math.abs(h.totalDifferenceValue))}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {overdue.length === 0 && history.length > 0 && (
        <Card className="border-l-4 border-l-green-500 p-4">
          <p className="flex items-center gap-2 text-sm text-green-800 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" /> {t("sc_all_on_time", lang)} {COUNT_OVERDUE_DAYS} {t("sc_all_on_time_days", lang)}
          </p>
        </Card>
      )}
    </div>
  );
}
