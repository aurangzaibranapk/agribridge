import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { loadAchievement } from "@/lib/staff/achievement-data";
import type { Period } from "@/lib/staff/achievement";
import { CongratsButton } from "./congrats-button";

export const dynamic = "force-dynamic";
const MANAGERS = new Set(["owner", "super_admin", "admin", "manager", "finance", "hr"]);
const money = (v: number | null) => (v == null ? "—" : `Rs ${Math.round(v).toLocaleString("en-PK")}`);

export default async function StaffPerformancePage({ searchParams }: { searchParams: { period?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await (createServiceClient() as any).from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) redirect("/login");
  const isManager = MANAGERS.has(String(me.role));
  const period: Period = searchParams.period === "weekly" || searchParams.period === "monthly" ? searchParams.period : "daily";
  // Staff sirf apna dekhta hai; manager sab.
  const data = await loadAchievement(me.organization_id, period, isManager ? undefined : me.id);
  const alerts = data.rows.filter((r) => r.lowPerformance);
  const periods: [Period, string][] = [["daily", t("spf_daily", lang)], ["weekly", t("spf_weekly", lang)], ["monthly", t("spf_monthly", lang)]];

  return (
    <div className="space-y-4">
      <PageHeader title={t("spf_title", lang)} description={`${t("spf_subtitle", lang)} · ${data.start} → ${data.end}`}
        actions={isManager ? <CongratsButton period={period} label={t("spf_congratulate", lang)} /> : undefined} />
      <div className="flex gap-3 text-sm">{periods.map(([p, l]) => <Link key={p} href={`?period=${p}`} className={period === p ? "font-bold text-brand-700" : "text-surface-500"}>{l}</Link>)}</div>
      {data.settingsMissing && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{t("spf_settings_missing", lang)}</p>}
      {data.truncated && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{t("spf_truncated", lang)}</p>}
      {isManager && alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <h2 className="text-sm font-semibold text-red-800">{t("spf_low_alerts", lang)}</h2>
          <ul className="mt-2 text-xs text-red-800">{alerts.map((r) => <li key={r.staff.id}>{r.staff.full_name}: {r.achievementPct}% ({money(r.sales)} / {money(r.target)})</li>)}</ul>
        </Card>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="bg-surface-50 text-[10px] uppercase text-surface-500"><tr>
            <th className="px-3 py-2">{t("spf_rank", lang)}</th><th>{t("spf_staff", lang)}</th><th className="text-right">{t("spf_sales", lang)}</th>
            <th className="text-right">Cash</th><th className="text-right">Bank</th><th className="text-right">Khata</th>
            <th className="text-right">{t("spf_recovery", lang)}</th><th className="text-right">{t("spf_new_customers", lang)}</th>
            <th className="text-right">{t("spf_target", lang)}</th><th className="text-right">%</th><th className="text-right">{t("spf_bonus", lang)}</th><th className="pl-3">{t("spf_top_categories", lang)}</th>
          </tr></thead>
          <tbody className="divide-y divide-surface-100">
            {data.rows.map((r) => (
              <tr key={r.staff.id} className={r.lowPerformance ? "bg-red-50/40" : r.rank === 1 ? "bg-emerald-50/50" : ""}>
                <td className="px-3 py-2 font-semibold">{r.rank ? (r.rank === 1 ? "🏆 1" : r.rank) : "—"}</td>
                <td>{r.staff.full_name}<p className="text-[10px] text-surface-400">{r.staff.role} · {r.invoices} bills</p></td>
                <td className="text-right tabular-nums">{money(r.sales)}</td>
                <td className="text-right tabular-nums">{money(r.breakdown.cash)}</td><td className="text-right tabular-nums">{money(r.breakdown.bank)}</td><td className="text-right tabular-nums">{money(r.breakdown.khata)}</td>
                <td className="text-right tabular-nums">{money(r.recovery)}</td><td className="text-right">{r.newCustomers}</td>
                <td className="text-right tabular-nums">{r.target == null ? t("spf_no_target", lang) : money(r.target)}</td>
                <td className="text-right">{r.achievementPct == null ? "—" : `${r.achievementPct}%`}</td>
                <td className="text-right tabular-nums" title={r.bonusTitles.join(", ")}>{r.bonus == null ? t("spf_no_rule", lang) : money(r.bonus)}</td>
                <td className="pl-3 text-surface-600">{r.categories.slice(0, 3).map((c) => `${c.name} ${money(c.amount)}`).join(" · ") || "—"}</td>
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td colSpan={12} className="p-6 text-center text-surface-400">{t("spf_none", lang)}</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="text-[11px] text-surface-500">{t("spf_note", lang)}</p>
    </div>
  );
}
