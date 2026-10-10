import Link from "next/link";
import { Card } from "@/components/ui/layout-primitives";
import { WASELA_AMANAT_ACCOUNT, type GrainSummary } from "@/lib/grain/ledger-summary";
import { drillHref, type DrillView } from "@/lib/grain/drilldown";

/** Har card kis tafseel par khulta hai. */
export const GRAIN_SUMMARY_DRILL: Record<keyof GrainSummary, DrillView> = {
  receivable: "receivable", payable: "payable", farmerPayable: "payable", waselaAmanat: "payable", sales: "sales", cogs: "profit",
  grossProfit: "profit", expenses: "expenses", netProfit: "profit", stockValue: "stock",
};

const fmt = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;

export const GRAIN_SUMMARY_LABELS: { key: keyof GrainSummary; ur: string; en: string; tone: string }[] = [
  { key: "receivable", ur: "Lena (kul wusooli)", en: "Total Receivable", tone: "text-blue-700" },
  { key: "payable", ur: "Dena (kul adaigi)", en: "Total Payable", tone: "text-amber-700" },
  { key: "sales", ur: "Bikri", en: "Sales", tone: "text-surface-900 dark:text-white" },
  { key: "grossProfit", ur: "Kachcha munafa", en: "Gross Profit", tone: "text-green-700" },
  { key: "expenses", ur: "Kharche", en: "Expenses", tone: "text-red-700" },
  { key: "netProfit", ur: "Asal munafa", en: "Net Profit", tone: "text-green-800" },
  { key: "stockValue", ur: "Godam ka maal (qeemat)", en: "Stock value", tone: "text-surface-900 dark:text-white" },
];

export function GrainSummaryCards({ summary, from, to, error }: { summary: GrainSummary | null; from: string; to: string; error?: string | null }) {
  return (
    <div className="mb-6">
      <form method="get" className="mb-3 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col text-xs text-surface-500">Se / From
          <input type="date" name="from" defaultValue={from} className="rounded border px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col text-xs text-surface-500">Tak / To
          <input type="date" name="to" defaultValue={to} className="rounded border px-2 py-1 text-sm" />
        </label>
        <button type="submit" className="rounded bg-surface-900 px-3 py-1.5 text-white dark:bg-white dark:text-surface-900">Dikhao / Apply</button>
        <span className="text-xs text-surface-500">Ledger se. Lena, dena aur stock &quot;tak&quot; tareekh ka baqaya hain.</span>
      </form>
      {error ? <p className="mb-2 text-sm text-red-600">Ledger summary load nahi hui: {error}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {GRAIN_SUMMARY_LABELS.map(c => (
          <Card key={c.key} className="relative transition hover:ring-2 hover:ring-brand-300">
            <Link href={drillHref(GRAIN_SUMMARY_DRILL[c.key], { from, to })} className="absolute inset-0" aria-label={`${c.en} tafseel / details`} />
            <p className="text-xs font-medium text-surface-500">{c.ur}<br /><span className="uppercase tracking-wide">{c.en}</span></p>
            <p className={`mt-2 font-display text-lg font-semibold ${c.tone}`}>{summary ? fmt(summary[c.key]) : "-"}</p>
            {c.key === "payable" && summary ? (
              <div className="mt-1 space-y-0.5 text-xs text-surface-500">
                <p><Link href={drillHref("payable", { from, to })} className="relative z-10 hover:underline">Kisan / farmers: {fmt(summary.farmerPayable)}</Link></p>
                <p><Link href={`/admin/finance/ledger?account=${WASELA_AMANAT_ACCOUNT}${from ? `&from=${from}` : ""}&to=${to}`} className="relative z-10 hover:underline">Wasela amanat ({WASELA_AMANAT_ACCOUNT}): {fmt(summary.waselaAmanat)}</Link></p>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
