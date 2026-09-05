import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadMoneyToday, loadDeptKpis, loadAlerts, conclude, deptTotals } from "@/lib/command-center";
import { AlertTriangle, CheckCircle2, ArrowRight, TrendingUp, Sparkles } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const OWNER_ROLES = ["owner", "super_admin", "admin"];

/**
 * Rs 0 aur "—" ek cheez nahi.
 *
 * Rs 0 kehta hai "dekh liya, kuch nahi hua". "—" kehta hai "is ka
 * hisaab hi nahi rakha jata". Is project mein ye farq teen dafa ghalat
 * adad de chuka hai, is liye yahan sirf ek jagah tay hota hai.
 */
function rs(value: number | null): string {
  if (value == null) return "—";
  return `Rs ${Math.round(value).toLocaleString()}`;
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

/** **bold** wale hisse ko asal bold mein badal deta hai. */
function withBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-surface-900 dark:text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default async function CommandCenterPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !OWNER_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("c_only_owner_admin", lang)}</div>;
  }

  const [money, depts, alerts] = await Promise.all([loadMoneyToday(), loadDeptKpis(lang), loadAlerts()]);
  const lines = conclude(depts, lang);
  const totals = deptTotals(depts);

  const moneyTiles = [
    { label: t("cc_t_sales", lang), value: rs(money.revenue), href: "/admin/pos" },
    { label: t("cc_t_expenses", lang), value: rs(money.expenses), href: "/admin/company-expenses" },
    { label: t("cc_t_profit", lang), value: rs(money.net), href: "/admin/reports/pnl", tone: money.net < 0 ? "red" : "green" },
    { label: t("cc_t_cash", lang), value: rs(money.cash), href: "/admin/finance" },
    { label: t("cc_t_receivable", lang), value: rs(money.receivable), href: "/admin/branch-credit" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("cc_title", lang)}
        description={t("cc_subtitle", lang)}
      />

      {/* ---- Aaj ---- */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("cc_today", lang)}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {moneyTiles.map((tile) => (
            <Link key={tile.label} href={tile.href}>
              <Card className="h-full p-4 transition hover:border-brand-400">
                <p className="text-xs text-surface-500">{tile.label}</p>
                <p
                  className={`mt-1 text-xl font-semibold ${
                    tile.tone === "red"
                      ? "text-red-600"
                      : tile.tone === "green"
                        ? "text-green-700 dark:text-green-400"
                        : "text-surface-900 dark:text-white"
                  }`}
                >
                  {tile.value}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ---- Departments ---- */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("cc_dept_this_month", lang)}</h2>

        {/* Chaar card -- sirf un departments se jin ka hisaab poora hai. */}
        <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-surface-500">{t("cc_total_revenue", lang)}</p>
            <p className="mt-1 text-xl font-semibold text-surface-900 dark:text-white">{rs(totals.revenue)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-surface-500">{t("cc_total_cost", lang)}</p>
            <p className="mt-1 text-xl font-semibold text-surface-900 dark:text-white">{rs(totals.cost)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-surface-500">{t("cc_net", lang)}</p>
            <p
              className={`mt-1 text-xl font-semibold ${
                totals.net < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"
              }`}
            >
              {rs(totals.net)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-surface-500">{t("cc_needs_attention_count", lang)}</p>
            <p
              className={`mt-1 text-xl font-semibold ${
                totals.attention > 0 ? "text-amber-600" : "text-surface-900 dark:text-white"
              }`}
            >
              {totals.attention}
            </p>
          </Card>
        </div>

        {/* Adhoore department chup chaap sifar nahi ginte -- saaf likha jata
            hai ke wo in totals mein hain hi nahi. */}
        <p className="mb-2 px-1 text-xs text-surface-400">
          {t("cc_only_complete", lang)}
          {totals.excluded.length > 0 && (
            <span className="text-amber-700 dark:text-amber-500">
              {" "}
              {t("cc_excluded", lang).replace("{names}", totals.excluded.join(", "))}
            </span>
          )}
        </p>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
              <tr>
                <th className="px-4 py-2 font-medium">{t("c_department", lang)}</th>
                <th className="px-4 py-2 font-medium">{t("cc_work", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("cc_income", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("cc_direct_cost", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("cc_other_expense", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("cc_profit_loss", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("cc_margin", lang)}</th>
                <th className="px-4 py-2 font-medium">{t("cc_attention_col", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {depts.map((d) => (
                <tr key={d.key} className="transition hover:bg-brand-25 dark:hover:bg-surface-900/40">
                  <td className="px-4 py-3 align-top">
                    <Link href={d.href} className="font-medium text-surface-900 hover:underline dark:text-white">
                      {d.label}
                    </Link>
                    {d.state === "incomplete" && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30">
                        {t("cc_incomplete", lang)}
                      </span>
                    )}
                    {d.note && <p className="mt-0.5 max-w-sm text-xs text-surface-400">{d.note}</p>}
                  </td>

                  <td className="px-4 py-3 align-top text-surface-600 dark:text-surface-400">
                    <div className="flex flex-wrap gap-1">
                      {d.work.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full bg-surface-100 px-2 py-0.5 text-xs dark:bg-surface-800"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right align-top tabular-nums text-surface-700 dark:text-surface-300">
                    {rs(d.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-surface-700 dark:text-surface-300">
                    {rs(d.directCost)}
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-surface-700 dark:text-surface-300">
                    {d.otherExpense == null ? (
                      <span className="text-surface-300" title={t("cc_untracked", lang)}>
                        —
                      </span>
                    ) : (
                      rs(d.otherExpense)
                    )}
                  </td>

                  <td className="px-4 py-3 text-right align-top">
                    <span
                      className={`font-semibold tabular-nums ${
                        d.profit == null
                          ? "text-surface-400"
                          : d.profit < 0
                            ? "text-red-600"
                            : "text-green-700 dark:text-green-400"
                      }`}
                    >
                      {rs(d.profit)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-surface-500">{pct(d.margin)}</td>

                  <td className="px-4 py-3 align-top">
                    {d.pending > 0 ? (
                      <Link
                        href={d.pendingHref ?? d.href}
                        className="inline-flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:underline dark:bg-amber-950/30 dark:text-amber-400"
                      >
                        <span className="font-semibold">{d.pending}</span>
                        <span className="max-w-[13rem]">{d.pendingReason}</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-surface-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ---- Nateeja ---- */}
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
          {t("cc_insight", lang)}
        </h2>
        <Card className="p-4">
          <ul className="space-y-2">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-300">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span>{withBold(line)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-surface-200 pt-2 text-xs text-surface-400 dark:border-surface-800">
            {t("cc_from_books", lang)}
          </p>
        </Card>
      </div>

      {/* ---- Alerts ---- */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("cc_attention", lang)}</h2>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {alerts.map((alert, i) => (
            <Link key={i} href={alert.href}>
              <Card
                className={`flex h-full items-start gap-3 p-3 transition hover:border-brand-400 ${
                  alert.tone === "red"
                    ? "border-l-4 border-l-red-500"
                    : alert.tone === "amber"
                      ? "border-l-4 border-l-amber-500"
                      : "border-l-4 border-l-green-500"
                }`}
              >
                {alert.tone === "green" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${alert.tone === "red" ? "text-red-600" : "text-amber-600"}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{alert.title}</p>
                  <p className="text-xs text-surface-500">{alert.detail}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-surface-300" />
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <p className="px-1 text-xs text-surface-400">
        Tafseel ke liye:{" "}
        <Link href="/admin/master-dashboard" className="underline">{t("md_title", lang)}</Link>{" "}
        (bank, inventory aur receivables ka poora hisaab) •{" "}
        <Link href="/admin/reports/pnl" className="underline">{t("cc_shop_pl", lang)}</Link>
      </p>
    </div>
  );
}
