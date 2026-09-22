import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ArrowLeft } from "lucide-react";
import { AssetActions } from "./asset-actions";

export const dynamic = "force-dynamic";

const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];
const VIEW_ROLES = [...RUN_ROLES, "manager"];

/**
 * Ek asaase ki poori kahani: khareed se aaj tak.
 *
 * Ledger `v_fixed_asset_ledger` se aata hai -- khareed, har mahine ki
 * ghisai, dobara qeemat aur farokht ek hi fehrist mein, tareekh ke
 * hisaab se. Ye us sawal ka jawab hai jo asaason par sab se zyada
 * poochha jata hai: "ye Rs 3 lakh kahan se aaye?"
 */
export default async function AssetDetailPage({ params }: { params: { id: string } }) {
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

  const service = createServiceClient();
  const { data: asset } = await service.from("v_fixed_assets").select("*").eq("id", params.id).maybeSingle();
  if (!asset) notFound();

  const [{ data: ledger, error: ledErr }, { data: accounts }, { data: disposal }] = await Promise.all([
    service
      .from("v_fixed_asset_ledger")
      .select("event_date, event_type, label, amount, running_carrying, entry_id")
      .eq("asset_id", params.id)
      .order("event_date"),
    service.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
    service
      .from("asset_disposals")
      .select("disposed_on, disposal_type, proceeds, buyer_name, book_value, gain_loss, reason")
      .eq("asset_id", params.id)
      .maybeSingle(),
  ]);

  const rs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;
  const active = asset.status === "active";
  const canRun = RUN_ROLES.includes(me.role);

  const facts: { label: string; value: string }[] = [
    { label: t("fa_col_cat", lang), value: String(asset.category_name) },
    { label: t("fa_f_bought", lang), value: String(asset.acquired_on) },
    { label: t("fa_f_service", lang), value: String(asset.in_service_on) },
    { label: t("fa_f_cost", lang), value: rs(Number(asset.cost)) },
    {
      label: t("fa_reval_adj", lang),
      value: Number(asset.revaluation_adjustment) === 0 ? "—" : rs(Number(asset.revaluation_adjustment)),
    },
    { label: t("fa_f_salvage", lang), value: rs(Number(asset.salvage_value)) },
    { label: t("fa_f_life", lang), value: `${asset.life_months}` },
    {
      label: t("fa_f_method", lang),
      value:
        asset.method === "straight_line"
          ? t("fa_m_sl", lang)
          : `${t("fa_m_rb", lang)} ${asset.dep_rate ?? "—"}%`,
    },
    {
      label: t("fa_dep_upto", lang),
      // Sifar aur "abhi shuru nahi hui" ek cheez nahi.
      value: asset.depreciated_upto ? String(asset.depreciated_upto).slice(0, 7) : "—",
    },
    { label: t("fa_f_serial", lang), value: (asset.serial_no as string | null) ?? "—" },
    { label: t("fa_f_location", lang), value: (asset.location as string | null) ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${asset.code} — ${asset.name}`}
        description={active ? t("fa_detail_active", lang) : t("fa_detail_closed", lang)}
        actions={
          <Link
            href="/admin/finance/assets"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("fa_back_register", lang)}
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fa_sum_gross", lang)}</p>
          <p className="font-display text-xl font-semibold text-surface-900 dark:text-white">{rs(Number(asset.gross_value))}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fa_sum_accum", lang)}</p>
          <p className="font-display text-xl font-semibold text-amber-600">− {rs(Number(asset.accumulated_depreciation))}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fa_sum_book", lang)}</p>
          <p className="font-display text-xl font-semibold text-emerald-600">{rs(Number(asset.book_value))}</p>
        </Card>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="rounded-lg bg-surface-50 p-2.5 dark:bg-surface-800/50">
              <p className="text-[11px] uppercase tracking-wide text-surface-500">{f.label}</p>
              <p className="mt-0.5 text-sm font-medium text-surface-900 dark:text-white">{f.value}</p>
            </div>
          ))}
        </div>
        {asset.notes && <p className="mt-3 text-sm text-surface-600 dark:text-surface-300">{asset.notes as string}</p>}
      </Card>

      {disposal && (
        <Card className="space-y-1 border-surface-300 bg-surface-50 text-sm dark:border-surface-700 dark:bg-surface-800/50">
          <p className="font-medium text-surface-900 dark:text-white">{t("fa_disposed_head", lang)}</p>
          <p className="text-surface-600 dark:text-surface-300">
            {String(disposal.disposed_on)} · {t("fa_d_book", lang)} {rs(Number(disposal.book_value))} ·{" "}
            {t("fa_d_proceeds", lang)} {rs(Number(disposal.proceeds))} ·{" "}
            <span className={Number(disposal.gain_loss) >= 0 ? "text-emerald-600" : "text-rose-600"}>
              {Number(disposal.gain_loss) >= 0 ? t("fa_d_gain", lang) : t("fa_d_loss", lang)}{" "}
              {rs(Math.abs(Number(disposal.gain_loss)))}
            </span>
          </p>
          {disposal.buyer_name && <p className="text-surface-500">{disposal.buyer_name as string}</p>}
          {disposal.reason && <p className="text-surface-500">{disposal.reason as string}</p>}
        </Card>
      )}

      {canRun && active && (
        <AssetActions
          lang={lang}
          assetId={params.id}
          bookValue={Number(asset.book_value)}
          accounts={(accounts ?? []).map((a) => ({ id: a.id as string, name: a.name as string }))}
        />
      )}

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">{t("fa_ledger_title", lang)}</p>
        </div>
        {ledErr ? (
          <p className="p-4 text-sm text-rose-600">
            {t("fa_load_error", lang)}: {ledErr.message}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
              <tr>
                <th className="px-4 py-3">{t("fa_l_date", lang)}</th>
                <th className="px-4 py-3">{t("fa_l_what", lang)}</th>
                <th className="px-4 py-3 text-right">{t("fa_l_amount", lang)}</th>
                <th className="px-4 py-3 text-right">{t("fa_l_after", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {(ledger ?? []).map((l, i) => (
                <tr key={`${l.event_type}-${l.event_date}-${i}`}>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{String(l.event_date)}</td>
                  <td className="px-4 py-3 text-surface-900 dark:text-white">{l.label as string}</td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${Number(l.amount) < 0 ? "text-amber-600" : "text-emerald-600"}`}
                  >
                    {Number(l.amount) < 0 ? "− " : ""}
                    {rs(Math.abs(Number(l.amount)))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{rs(Number(l.running_carrying))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
