import Link from "next/link";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { productMetrics } from "@/lib/intelligence/core";
import { loadProducts } from "@/lib/intelligence/data";
import { requireIntelligence } from "@/lib/intelligence/access";

export const dynamic = "force-dynamic";
const money = (v: number | null) => (v == null ? "—" : `Rs ${Math.round(v).toLocaleString("en-PK")}`);
const MOVE_TONE = { fast: "text-emerald-700", slow: "text-amber-700", none: "text-red-700" } as const;

export default async function ProductIntelligencePage({ searchParams }: { searchParams: { days?: string; q?: string; move?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const me = await requireIntelligence("intelligence.products");
  if (!me) return <div className="p-8 text-center text-surface-500">{t("ppi_no_access", lang)}</div>;
  const days = [30, 90, 180, 365].includes(Number(searchParams.days)) ? Number(searchParams.days) : 90;
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { products, error } = await loadProducts(from, (searchParams.q ?? "").slice(0, 60), null);
  let rows = products.map((p) => ({ p, m: productMetrics(p, { now, periodDays: days, expiryWarnDays: 60 }) }));
  if (searchParams.move === "fast" || searchParams.move === "slow" || searchParams.move === "none") rows = rows.filter((r) => r.m.movement === searchParams.move);
  rows.sort((a, b) => b.p.soldValue - a.p.soldValue);
  return (
    <div className="space-y-4">
      <PageHeader title={t("ppi_products", lang)} description={t("ppi_products_sub", lang)} />
      <form className="flex flex-wrap gap-2 text-sm">
        <input name="q" defaultValue={searchParams.q} placeholder={t("ppi_search", lang)} className="w-56 rounded-lg border px-3 py-1.5" />
        <select name="days" defaultValue={String(days)} className="rounded-lg border px-2">{[30, 90, 180, 365].map((d) => <option key={d} value={d}>{d} {t("ppi_days", lang)}</option>)}</select>
        <select name="move" defaultValue={searchParams.move ?? ""} className="rounded-lg border px-2"><option value="">{t("ppi_all", lang)}</option><option value="fast">fast</option><option value="slow">slow</option><option value="none">no movement</option></select>
        <button className="rounded-lg border px-3">{t("ppi_search", lang)}</button>
      </form>
      {error && <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">{t("ppi_data_na", lang)}: {error}</p>}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[1200px] text-left text-xs">
          <thead className="bg-surface-50 text-[10px] uppercase text-surface-500"><tr>
            <th className="px-3 py-2">{t("ppi_product", lang)}</th><th className="text-right">{t("ppi_purchased", lang)}</th><th className="text-right">{t("ppi_sold", lang)}</th>
            <th className="text-right">{t("ppi_stock_value", lang)}</th><th className="text-right">{t("ppi_avg_buy", lang)}</th><th className="text-right">{t("ppi_avg_sell", lang)}</th>
            <th className="text-right">{t("ppi_margin", lang)}</th><th>{t("ppi_movement", lang)}</th><th>{t("ppi_expiry", lang)}</th><th>{t("ppi_suppliers", lang)}</th>
          </tr></thead>
          <tbody className="divide-y divide-surface-100">
            {rows.map(({ p, m }) => (
              <tr key={p.id}>
                <td className="px-3 py-2"><Link className="font-medium text-brand-700 hover:underline" href={`/admin/inventory/product/${p.id}/statement`}>{p.name}</Link><p className="text-[10px] text-surface-400">{p.category ?? "—"}</p></td>
                <td className="text-right tabular-nums">{p.purchasedQty} · {money(p.purchasedValue)}</td>
                <td className="text-right tabular-nums">{p.soldQty} · {money(p.soldValue)}</td>
                <td className="text-right tabular-nums">{p.stockQty} · {money(p.stockValue)}</td>
                <td className="text-right tabular-nums">{money(m.avgPurchase)}</td><td className="text-right tabular-nums">{money(m.avgSale)}</td>
                <td className="text-right tabular-nums">{m.margin == null ? t("ppi_data_na", lang) : `${money(m.margin)} (${m.marginPct}%)`}</td>
                <td className={MOVE_TONE[m.movement]}>{m.movement}{m.daysOfStock != null ? ` · ${m.daysOfStock}d` : ""}</td>
                <td className={m.expiry === "expired" ? "text-red-700" : m.expiry === "near" ? "text-amber-700" : ""}>{p.nearestExpiry ?? "—"}{m.expiry && m.expiry !== "ok" ? ` (${m.expiry})` : ""}</td>
                <td className="text-surface-600">{m.supplierRates.slice(0, 3).map((s) => `${s.supplier} ${money(s.rate)}`).join(" · ") || "—"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} className="p-6 text-center text-surface-400">{t("ppi_none", lang)}</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="text-[11px] text-surface-500">{t("ppi_products_note", lang)}</p>
    </div>
  );
}
