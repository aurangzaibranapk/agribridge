import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { Building2, Calculator, Layers, Plus } from "lucide-react";
import { NewAssetForm } from "./new-asset-form";

export const dynamic = "force-dynamic";

const VIEW_ROLES = ["owner", "super_admin", "admin", "manager", "finance"];
const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];

/**
 * Asaason ka register.
 *
 * Kitabi qeemat (book value) yahan GINI NAHI JATI -- wo `v_fixed_assets`
 * se aati hai, jahan wo ek hi jagah bunti hai. Safhe par alag se ginne
 * ka matlab hota hai ke kal koi safha thora sa mukhtalif gine, aur do
 * adad ho jayen.
 */
export default async function AssetsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !VIEW_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("fa_only_finance", lang)}</div>;
  }
  const canRun = RUN_ROLES.includes(me.role);

  const service = createServiceClient();
  const [{ data: assets, error }, { data: cats }, { data: accounts }, { data: suppliers }] = await Promise.all([
    service
      .from("v_fixed_assets")
      .select("id, code, name, category_name, status, acquired_on, cost, gross_value, accumulated_depreciation, book_value, method, depreciated_upto")
      .order("code"),
    service.from("asset_categories").select("id, name, default_life_months, default_method, default_rate").eq("is_active", true).order("name"),
    service.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
    service.from("suppliers").select("id, name").order("name").limit(300),
  ]);

  // Jawab hi na mile to khali fehrist nahi dikhayi jati -- khali fehrist
  // "koi asaasa hai hi nahi" kehti hai, aur wo jhoot ho sakta hai.
  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("fa_title", lang)} />
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("fa_load_error", lang)}: {error.message}
        </Card>
      </div>
    );
  }

  const rows = assets ?? [];
  const active = rows.filter((r) => r.status === "active");
  const kulQeemat = active.reduce((s, r) => s + Number(r.gross_value), 0);
  const kulGhisai = active.reduce((s, r) => s + Number(r.accumulated_depreciation), 0);
  const kulKitabi = active.reduce((s, r) => s + Number(r.book_value), 0);

  const rs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("fa_title", lang)}
        description={t("fa_desc", lang)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/finance/assets/depreciation"
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              <Calculator className="h-4 w-4" /> {t("fa_dep_link", lang)}
            </Link>
            <Link
              href="/admin/finance/assets/categories"
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              <Layers className="h-4 w-4" /> {t("fa_cats_link", lang)}
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fa_sum_gross", lang)}</p>
          <p className="font-display text-xl font-semibold text-surface-900 dark:text-white">{rs(kulQeemat)}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fa_sum_accum", lang)}</p>
          <p className="font-display text-xl font-semibold text-amber-600">− {rs(kulGhisai)}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fa_sum_book", lang)}</p>
          <p className="font-display text-xl font-semibold text-emerald-600">{rs(kulKitabi)}</p>
        </Card>
      </div>

      {canRun && (
        <NewAssetForm
          lang={lang}
          categories={(cats ?? []).map((c) => ({
            id: c.id as string,
            name: c.name as string,
            life: Number(c.default_life_months),
            method: c.default_method as string,
            rate: c.default_rate === null ? null : Number(c.default_rate),
          }))}
          accounts={(accounts ?? []).map((a) => ({ id: a.id as string, name: a.name as string }))}
          suppliers={(suppliers ?? []).map((s) => ({ id: s.id as string, name: s.name as string }))}
        />
      )}

      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Building2 className="h-8 w-8 text-surface-300" />
            <p className="text-sm text-surface-500">{t("fa_empty", lang)}</p>
            {canRun && (
              <p className="text-xs text-surface-400">
                <Plus className="mr-1 inline h-3 w-3" />
                {t("fa_empty_hint", lang)}
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
              <tr>
                <th className="px-4 py-3">{t("fa_col_code", lang)}</th>
                <th className="px-4 py-3">{t("fa_col_name", lang)}</th>
                <th className="px-4 py-3">{t("fa_col_cat", lang)}</th>
                <th className="px-4 py-3">{t("fa_col_bought", lang)}</th>
                <th className="px-4 py-3 text-right">{t("fa_col_cost", lang)}</th>
                <th className="px-4 py-3 text-right">{t("fa_col_accum", lang)}</th>
                <th className="px-4 py-3 text-right">{t("fa_col_book", lang)}</th>
                <th className="px-4 py-3">{t("fa_col_status", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {rows.map((r) => (
                <tr key={r.id as string} className="hover:bg-surface-50 dark:hover:bg-surface-800/40">
                  <td className="px-4 py-3">
                    <Link href={`/admin/finance/assets/${r.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                      {r.code as string}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{r.name as string}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{r.category_name as string}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{String(r.acquired_on)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rs(Number(r.gross_value))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600">
                    {Number(r.accumulated_depreciation) > 0 ? `− ${rs(Number(r.accumulated_depreciation))}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{rs(Number(r.book_value))}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.status === "active"
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300"
                      }
                    >
                      {r.status === "active"
                        ? t("fa_status_active", lang)
                        : r.status === "disposed"
                          ? t("fa_status_disposed", lang)
                          : t("fa_status_written", lang)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("fa_note", lang)}</Card>
    </div>
  );
}
