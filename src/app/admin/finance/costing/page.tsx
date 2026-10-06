import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ArrowLeft } from "lucide-react";
import { RateAlertCard } from "./rate-alert-card";
import { saveProductCostingOverride } from "@/actions/product-costing";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

/**
 * Cheez ki lagat -- ausat kharid rate.
 *
 * Ye safha koi rate BADALTA nahi. Wo faisla insaan ka rehta hai, aur us
 * ka apna raasta (product ka safha) pehle se maujood hai jahan har
 * tabdeeli nishaan ke sath darj hoti hai (293).
 */
export default async function CostingPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("cst_only_finance", lang)}</div>;
  }

  const service = createServiceClient();
  const [{ data: rows, error }, { data: cfg }] = await Promise.all([
    service.from("v_product_costing_with_override").select("*").limit(500),
    service.from("rate_alert_config").select("*").eq("id", 1).maybeSingle(),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("cst_title", lang)} />
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("cst_load_error", lang)}: {error.message}
        </Card>
      </div>
    );
  }

  const list = (rows ?? [])
    .map((r) => {
      const avg = r.weighted_avg === null ? null : Number(r.weighted_avg);
      const ref = r.reference_rate === null ? null : Number(r.reference_rate);
      // Farq sirf tab jab dono adad maujood hon. Ek bhi na ho to "—".
      const farq = avg === null || ref === null || avg === 0 ? null : ((ref - avg) / avg) * 100;
      return {
        id: r.product_id as string,
        name: r.name as string,
        pack: (r.pack_size as string | null) ?? "",
        avg,
        override: r.override_average === null || r.override_average === undefined ? null : Number(r.override_average),
        ref,
        qty: Number(r.total_qty ?? 0),
        count: Number(r.purchase_count ?? 0),
        last: (r.last_purchase_date as string | null) ?? null,
        farq,
      };
    })
    .sort((a, b) => Math.abs(b.farq ?? 0) - Math.abs(a.farq ?? 0));

  const rs = (n: number | null) => (n === null ? "—" : `Rs ${Math.round(n).toLocaleString()}`);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("cst_title", lang)}
        description={t("cst_desc", lang)}
        actions={
          <Link
            href="/admin/finance/center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("cst_back", lang)}
          </Link>
        }
      />

      {["owner", "super_admin", "admin"].includes(me.role) && (
        <RateAlertCard
          lang={lang}
          config={
            cfg
              ? {
                  tolAmt: Number(cfg.tolerance_amount),
                  tolPct: Number(cfg.tolerance_pct),
                  bigAmt: Number(cfg.big_change_amount),
                  bigPct: Number(cfg.big_change_pct),
                }
              : null
          }
        />
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
            <tr>
              <th className="px-4 py-2">{t("cst_product", lang)}</th>
              <th className="px-4 py-2 text-right">{t("cst_qty", lang)}</th>
              <th className="px-4 py-2 text-right">{t("cst_purchases", lang)}</th>
              <th className="px-4 py-2 text-right">{t("cst_avg", lang)}</th>
              <th className="px-4 py-2 text-right">Correction</th>
              <th className="px-4 py-2 text-right">{t("cst_ref", lang)}</th>
              <th className="px-4 py-2 text-right">{t("cst_diff", lang)}</th>
              <th className="px-4 py-2">{t("cst_last", lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-surface-400">
                  {t("cst_empty", lang)}
                </td>
              </tr>
            )}
            {list.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-1.5">
                  <Link href={`/admin/products/${r.id}`} className="text-brand-600 hover:underline">
                    {r.name}
                  </Link>
                  {r.pack && <span className="ml-1 text-xs text-surface-400">({r.pack})</span>}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-surface-500">{r.qty}</td>
                <td className="px-4 py-1.5 text-right tabular-nums text-surface-500">{r.count}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{rs(r.avg)}</td>
                <td className="px-4 py-1.5 text-right">
                  <details className="inline-block text-left">
                    <summary className="cursor-pointer rounded border border-surface-200 px-2 py-1 text-xs text-brand-700 hover:bg-surface-50 dark:border-surface-700 dark:text-brand-300">
                      Edit average
                    </summary>
                    <form action={saveProductCostingOverride} className="mt-2 w-64 space-y-2 rounded-lg border border-surface-200 bg-white p-3 shadow-lg dark:border-surface-700 dark:bg-surface-900">
                      <input type="hidden" name="product_id" value={r.id} />
                      <label className="block text-xs text-surface-500">Correct average rate</label>
                      <input name="override_average" type="number" min="0" step="0.01" defaultValue={r.override ?? r.avg ?? ""} className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-600 dark:bg-surface-800" />
                      <label className="block text-xs text-surface-500">Reason</label>
                      <input name="reason" required minLength={5} placeholder="e.g. duplicate purchase rate" className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-600 dark:bg-surface-800" />
                      <div className="flex gap-2">
                        <button name="command" value="save" type="submit" className="rounded bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white">Save</button>
                        {r.override !== null && <button name="command" value="clear" type="submit" className="rounded border border-rose-300 px-2.5 py-1.5 text-xs text-rose-700">Clear</button>}
                      </div>
                      {r.override !== null && <p className="text-[11px] text-amber-600">Manual override active; calculated average remains محفوظ.</p>}
                    </form>
                  </details>
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">{rs(r.ref)}</td>
                <td
                  className={`px-4 py-1.5 text-right tabular-nums ${
                    r.farq === null
                      ? "text-surface-300"
                      : Math.abs(r.farq) >= 10
                        ? "font-medium text-rose-600"
                        : "text-surface-500"
                  }`}
                >
                  {r.farq === null ? "—" : `${r.farq > 0 ? "+" : ""}${r.farq.toFixed(1)}%`}
                </td>
                <td className="px-4 py-1.5 text-surface-500">{r.last ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("cst_note", lang)}</Card>
    </div>
  );
}
