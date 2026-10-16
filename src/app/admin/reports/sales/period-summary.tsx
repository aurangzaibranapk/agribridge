import Link from "next/link";
import { t, type Lang } from "@/lib/i18n/translations";
import { SALES_PERIODS, periodRange, pktDayKey, dayKeys, pctChange, type SalesPeriod } from "@/lib/reports/sales-period";

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const PAGE = 1000;

type Scope = { meriDukan: string | null; shopId: string; branchId: string };

/** Saari qatarein (PostgREST 1000 ki hadd se aage) -- request ke waqt live. */
async function salesIn(supabase: any, scope: Scope, from: Date, to: Date) {
  const rows: { id: string; total_amount: number; created_at: string }[] = [];
  for (let off = 0; off < 200000; off += PAGE) {
    let q = supabase.from("pos_sales").select("id, total_amount, created_at")
      .gte("created_at", from.toISOString()).lt("created_at", to.toISOString())
      .order("created_at").range(off, off + PAGE - 1);
    if (scope.meriDukan) q = q.eq("shop_id", scope.meriDukan);
    else if (scope.shopId) q = q.eq("shop_id", scope.shopId);
    else if (scope.branchId) q = q.eq("branch_id", scope.branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function PeriodSalesSummary({ supabase, scope, period, lang, baseQuery, paymentLabels }: {
  supabase: any; scope: Scope; period: SalesPeriod; lang: Lang;
  /** Safhe ke baqi filters (range/branch/shop...) -- link mein wese ke wese. */
  baseQuery: Record<string, string | undefined>;
  paymentLabels: Record<string, string>;
}) {
  const r = periodRange(period);
  const [cur, prev] = await Promise.all([salesIn(supabase, scope, r.start, r.end), salesIn(supabase, scope, r.prevStart, r.prevEnd)]);
  const total = cur.reduce((s, x) => s + Number(x.total_amount ?? 0), 0);
  const prevTotal = prev.reduce((s, x) => s + Number(x.total_amount ?? 0), 0);
  const change = pctChange(total, prevTotal);

  // Wahi hisaab jo "Payment tareeqe se bikri" ka hai: pos_sale_payment_details.amount > 0.
  const byMethod = new Map<string, number>();
  const ids = cur.map((x) => x.id);
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from("pos_sale_payment_details").select("payment_method, amount").in("sale_id", ids.slice(i, i + 300));
    for (const a of (data ?? []) as { payment_method: string; amount: number }[]) {
      const amt = Number(a.amount ?? 0); if (amt <= 0) continue;
      const k = paymentLabels[a.payment_method] ?? a.payment_method;
      byMethod.set(k, (byMethod.get(k) ?? 0) + amt);
    }
  }
  const methods = [...byMethod.entries()].sort((a, b) => b[1] - a[1]);

  const perDay = new Map(dayKeys(r).map((d) => [d, 0]));
  for (const x of cur) { const k = pktDayKey(x.created_at); if (perDay.has(k)) perDay.set(k, perDay.get(k)! + Number(x.total_amount ?? 0)); }
  // Lambi range (3 mahine / saal) mein har din ki patli line -- chart chhota hi rahe.
  const bars = [...perDay.entries()];
  const max = Math.max(1, ...bars.map(([, v]) => v));
  const href = (p: SalesPeriod) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(baseQuery)) if (v && k !== "sp") q.set(k, v);
    q.set("sp", p);
    return `?${q.toString()}`;
  };
  const fmtDay = (d: Date) => pktDayKey(d);

  return (
    <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("sps_title", lang)}</h2>
          <p className="text-xs text-surface-400">{t("sps_note", lang)} · {fmtDay(r.start)} → {fmtDay(new Date(r.end.getTime() - 1))}</p>
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          {SALES_PERIODS.map((p) => (
            <Link key={p} href={href(p)} scroll={false} className={`rounded-full border px-2.5 py-1 ${p === period ? "border-brand-600 bg-brand-600 text-white" : "border-surface-200 text-surface-600 hover:border-brand-400"}`}>{t(`sps_${p}` as any, lang)}</Link>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-50 p-3 dark:bg-surface-800"><p className="text-xs text-surface-500">{t("sps_total", lang)}</p><p className="mt-1 text-xl font-bold text-surface-900 dark:text-surface-100">{rs(total)}</p>
          <p className={`text-[11px] font-semibold ${change == null ? "text-surface-400" : change >= 0 ? "text-emerald-700" : "text-red-700"}`}>{change == null ? t("sps_no_prev", lang) : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% ${t("sps_vs_prev", lang)} (${rs(prevTotal)})`}</p></div>
        <div className="rounded-xl bg-surface-50 p-3 dark:bg-surface-800"><p className="text-xs text-surface-500">{t("sps_count", lang)}</p><p className="mt-1 text-xl font-bold text-surface-900 dark:text-surface-100">{cur.length.toLocaleString()}</p><p className="text-[11px] text-surface-400">{prev.length.toLocaleString()} ← {t("sps_vs_prev", lang)}</p></div>
        <div className="rounded-xl bg-surface-50 p-3 dark:bg-surface-800"><p className="text-xs text-surface-500">{t("sps_avg", lang)}</p><p className="mt-1 text-xl font-bold text-surface-900 dark:text-surface-100">{rs(total / Math.max(1, r.days))}</p><p className="text-[11px] text-surface-400">{r.days} {t("sps_per_day", lang)}</p></div>
      </div>
      {total === 0 ? <p className="mt-4 text-sm text-surface-400">{t("sps_none", lang)}</p> : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-surface-500">{t("sps_by_method", lang)}</p>
            <ul className="space-y-1 text-sm">
              {methods.map(([k, v]) => (
                <li key={k} className="flex items-center gap-2"><span className="w-32 shrink-0 truncate text-surface-700 dark:text-surface-300">{k}</span>
                  <span className="h-2 flex-1 rounded bg-surface-100 dark:bg-surface-800"><span className="block h-2 rounded bg-brand-500" style={{ width: `${(v / total) * 100}%` }} /></span>
                  <span className="w-28 text-right tabular-nums">{rs(v)}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-surface-500">{t("sps_per_day", lang)}</p>
            <div className="flex h-24 items-end gap-px" role="img" aria-label={t("sps_per_day", lang)}>
              {bars.map(([d, v]) => <div key={d} title={`${d}: ${rs(v)}`} className="flex-1 rounded-t bg-brand-500/80" style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />)}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-surface-400"><span>{bars[0]?.[0]}</span><span>{bars[bars.length - 1]?.[0]}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
