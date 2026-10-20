import type { ReactNode } from "react";
import type { InsightsData } from "@/lib/command-center-insights";
import { marginNote } from "@/lib/command-center-insights-core";
import { CategoryDonut, InsightsFilterBar, KpiCards, LiveFeed, TrendCard } from "./insights-client";

/**
 * Owner Command Center ke NAYE hisse (dashboard upgrade, malik ki
 * manzoori 21 Oct 2026). Mojooda widgets alag hain aur waise hi rehte hain.
 */

const rs = (v: number) => `Rs ${Math.round(v).toLocaleString("en-PK")}`;
const card = "rounded-card border border-surface-200 bg-white p-3.5 shadow-card dark:border-surface-800 dark:bg-surface-900";
const h2 = "font-display text-base font-semibold text-surface-900 dark:text-white";

function Card({ title, children, className = "", sub }: { title: ReactNode; children: ReactNode; className?: string; sub?: string }) {
  return (
    <section className={`${card} ${className}`}>
      <h2 className={h2}>{title}</h2>
      {sub && <p className="mb-2 text-xs text-surface-500">{sub}</p>}
      {!sub && <div className="mb-2" />}
      {children}
    </section>
  );
}

export function InsightsFilters({ d }: { d: InsightsData }) {
  return (
    <div className={card}>
      <InsightsFilterBar shops={d.shops} categories={d.categories} shopId={d.filters.shopId} categoryId={d.filters.categoryId} from={d.filters.from} to={d.filters.to} tf={d.filters.tf} />
    </div>
  );
}

export function InsightsKpis({ d }: { d: InsightsData }) {
  const k = d.kpis;
  const range = `${d.filters.from.slice(5)} – ${d.filters.to.slice(5)}`;
  return (
    <KpiCards
      cards={[
        { label: "Bikri", value: k.sales, format: "rs", sub: range, spark: d.spark.sales },
        { label: "Orders", value: k.orders, format: "int", sub: "bills", spark: d.spark.orders },
        { label: "Customers", value: k.customers, format: "int", sub: "khata / CRM", spark: d.spark.customers },
        { label: "Munafa (POS)", value: k.profit, format: "rs", sub: "cost se", spark: d.spark.profit },
        { label: "Maal biki (qty)", value: k.qty, format: "int", sub: "units", spark: d.spark.qty },
        { label: "Munafa %", value: k.marginPct ?? 0, format: "pct", sub: "margin", spark: d.spark.margin, empty: k.marginPct == null, note: marginNote(k) },
      ]}
    />
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
      <div className="h-full rounded-full bg-brand-600" style={{ width: `${max > 0 ? Math.max(1, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

function RankTable({ rows, empty = "—" }: { rows: { id: string; name: string; qty: number; amount: number }[]; empty?: string }) {
  if (!rows.length) return <p className="py-4 text-center text-sm text-surface-400">{empty}</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-surface-500"><th className="py-1">Product</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Bikri</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800">
            <td className="max-w-[180px] truncate py-1 text-surface-700 dark:text-surface-200">{r.name}</td>
            <td className="py-1 text-right tabular-nums">{Math.round(r.qty).toLocaleString("en-PK")}</td>
            <td className="py-1 text-right tabular-nums">{rs(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Trend + live feed (ek qatar). */
export function InsightsTrendAndFeed({ d }: { d: InsightsData }) {
  return (
    <div className="grid gap-3 xl:grid-cols-[2fr_1fr]">
      <section className={card}>
        <TrendCard points={d.trend} tf={d.filters.tf} title="Bikri ka trend" />
      </section>
      <Card title={<span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Live bikri feed</span>} sub="Har nayi POS sale khud upar aa jati hai">
        <LiveFeed rows={d.feed} />
      </Card>
    </div>
  );
}

export function InsightsGrid({ d }: { d: InsightsData }) {
  const shopMax = Math.max(...d.perShop.map((s) => s.amount), 0);
  const monthMax = Math.max(...d.byMonth.map((m) => m.amount), 0);
  const months = d.byMonth.filter((m, i) => m.amount !== 0 || i === d.byMonth.length - 1);
  return (
    <div className="space-y-3" data-testid="cc-insights-grid">
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Category ke hisaab se bikri" sub="Legend par mouse le jayein">
          <CategoryDonut slices={d.donut} />
        </Card>
        <Card title="Har dukan ki bikri" sub={`${d.filters.from} se ${d.filters.to}`}>
          <div className="space-y-2">
            {d.perShop.map((s) => (
              <div key={s.id}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="truncate text-surface-700 dark:text-surface-200">{s.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{rs(s.amount)} · {s.bills} bills</span>
                </div>
                <Bar value={s.amount} max={shopMax} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Sab se zyada udhaar wale customers">
          {d.udhaar.length ? (
            <table className="w-full text-xs">
              <tbody>
                {d.udhaar.map((c) => (
                  <tr key={c.id} className="border-t border-surface-100 first:border-0 dark:border-surface-800">
                    <td className="max-w-[200px] truncate py-1 text-surface-700 dark:text-surface-200">{c.name}</td>
                    <td className="py-1 text-right tabular-nums">{rs(c.balance)}</td>
                  </tr>
                ))}
                <tr className="border-t border-surface-200 font-bold dark:border-surface-700">
                  <td className="py-1">Kul udhaar</td>
                  <td className="py-1 text-right tabular-nums">{rs(d.udhaarTotal)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="py-4 text-center text-sm text-surface-400">—</p>
          )}
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Top 10 products">
          <RankTable rows={d.top10} />
        </Card>
        <Card title="Kam bikne wale 5 products">
          <RankTable rows={d.bottom5} />
          <h3 className="mb-2 mt-4 font-display text-sm font-semibold text-surface-900 dark:text-white">Mahine ke hisaab se</h3>
          <div className="space-y-2">
            {months.map((m) => (
              <div key={m.key}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span>{m.label} {m.key.slice(0, 4)}</span>
                  <span className="font-semibold tabular-nums">{rs(m.amount)} · munafa {rs(m.profit)}</span>
                </div>
                <Bar value={m.amount} max={monthMax} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Category matrix" sub="Bikri aur munafa, category ke hisaab se">
          {d.catTable.length ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-surface-500"><th className="py-1">Category</th><th className="py-1 text-right">Bikri</th><th className="py-1 text-right">Munafa</th></tr>
              </thead>
              <tbody>
                {d.catTable.map((c) => (
                  <tr key={c.id} className="border-t border-surface-100 dark:border-surface-800">
                    <td className="max-w-[170px] truncate py-1 text-surface-700 dark:text-surface-200">{c.name}</td>
                    <td className="py-1 text-right tabular-nums">{rs(c.amount)}</td>
                    <td className={`py-1 text-right tabular-nums ${c.profit < 0 ? "text-red-600" : ""}`}>{rs(c.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-4 text-center text-sm text-surface-400">—</p>
          )}
        </Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Doodh (litre)" sub={`${d.filters.from} se ${d.filters.to}`}>
          <p className="text-2xl font-bold tabular-nums text-surface-900 dark:text-white" data-testid="cc-milk">
            {d.milk ? `${Math.round(d.milk.liters).toLocaleString("en-PK")} L` : "—"}
          </p>
          <p className="text-xs text-surface-500">{d.milk ? `${d.milk.entries} entries` : "Is muddat mein doodh ki koi entry nahi"}</p>
        </Card>
        <Card title="Gandum / anaj" sub={`${d.filters.from} se ${d.filters.to}`}>
          <p className="text-2xl font-bold tabular-nums text-surface-900 dark:text-white" data-testid="cc-grain">
            {d.grain && d.grain.entries ? `${Math.round(d.grain.kg).toLocaleString("en-PK")} kg` : "—"}
          </p>
          <p className="text-xs text-surface-500">
            {d.grain && d.grain.entries ? `Kharidari ${rs(d.grain.amount)} · ${d.grain.entries} entries` : "Is muddat mein kharidari nahi"}
            {d.grain?.stockKg != null ? ` · Godam stock ${Math.round(d.grain.stockKg).toLocaleString("en-PK")} kg` : ""}
          </p>
        </Card>
      </div>
    </div>
  );
}
