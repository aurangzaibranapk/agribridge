import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadMoneyToday, loadDeptKpis, loadAlerts, conclude } from "@/lib/command-center";
import { AlertTriangle, CheckCircle2, ArrowRight, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const OWNER_ROLES = ["owner", "super_admin", "admin"];

function rs(value: number | null): string {
  if (value == null) return "—";
  return `Rs ${Math.round(value).toLocaleString()}`;
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !OWNER_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf Owner aur Admin ke liye hai.</div>;
  }

  const [money, depts, alerts] = await Promise.all([loadMoneyToday(), loadDeptKpis(), loadAlerts()]);
  const lines = conclude(depts);

  const moneyTiles = [
    { label: "Aaj ki bikri", value: rs(money.revenue), href: "/admin/pos" },
    { label: "Aaj ke kharche", value: rs(money.expenses), href: "/admin/company-expenses" },
    { label: "Aaj ka nafa", value: rs(money.net), href: "/admin/reports/pnl", tone: money.net < 0 ? "red" : "green" },
    { label: "Khaton mein maujood", value: rs(money.cash), href: "/admin/finance" },
    { label: "Wusool karna hai", value: rs(money.receivable), href: "/admin/branch-credit" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Owner Command Center"
        description="Aaj ka paisa, har department ka moqabla, aur wo cheezein jo tawajjah mangti hain."
      />

      {/* ---- Aaj ---- */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Aaj</h2>
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
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
          Department — is mahine
        </h2>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
              <tr>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Kaam</th>
                <th className="px-4 py-2 text-right font-medium">Aamdani</th>
                <th className="px-4 py-2 text-right font-medium">Lagat / Kharcha</th>
                <th className="px-4 py-2 text-right font-medium">Nafa</th>
                <th className="px-4 py-2 text-right font-medium">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {depts.map((d) => {
                const margin = d.profit != null && (d.revenue ?? 0) > 0 ? ((d.profit / (d.revenue ?? 1)) * 100) : null;
                return (
                  <tr key={d.key}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-surface-900 dark:text-white">{d.label}</p>
                      {d.note && <p className="mt-0.5 max-w-xs text-xs text-surface-400">{d.note}</p>}
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">
                      <span className="text-xs text-surface-400">{d.volumeLabel}: </span>
                      {d.volume}
                    </td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">{rs(d.revenue)}</td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">{rs(d.cost)}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          d.profit == null
                            ? "text-surface-400"
                            : d.profit < 0
                              ? "text-red-600"
                              : "text-green-700 dark:text-green-400"
                        }`}
                      >
                        {rs(d.profit)}
                      </span>
                      {margin != null && <span className="block text-xs text-surface-400">{margin.toFixed(1)}%</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.pending > 0 ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/30">
                          {d.pending}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ---- Nateeja ---- */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Nateeja</h2>
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
            Ye nateeja aap ke apne khaton se ginam kar nikala gaya hai — koi andaza nahi. Jo baat khaton
            se nahi nikalti, wo yahan likhi bhi nahi jati.
          </p>
        </Card>
      </div>

      {/* ---- Alerts ---- */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Tawajjah</h2>
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
        <Link href="/admin/master-dashboard" className="underline">
          Master Dashboard
        </Link>{" "}
        (bank, inventory aur receivables ka poora hisaab) •{" "}
        <Link href="/admin/reports/pnl" className="underline">
          Shop-wise P&amp;L
        </Link>
      </p>
    </div>
  );
}
