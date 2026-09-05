import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { leakageReport } from "@/lib/ledger/leakage";
import { AlertTriangle, CheckCircle2, EyeOff, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "finance"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

const MONTHS = [
  "Janwari", "Farwari", "March", "April", "Mai", "Joon",
  "Julai", "August", "Sitambar", "Aktubar", "Nawambar", "Disambar",
];

export default async function LeakagePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; y?: string }>;
}) {
  const params = await searchParams;
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return (
      <div className="p-8 text-center text-surface-400">{t("lk_named_page", lang)}</div>
    );
  }

  const now = new Date();
  const month = Number(params.m) || now.getMonth() + 1;
  const year = Number(params.y) || now.getFullYear();
  const report = await leakageReport(month, year);

  const prev = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
  const next = month === 12 ? { m: 1, y: year + 1 } : { m: month + 1, y: year };

  const change = report.totalMeasured - report.previousTotal;
  const ratio =
    report.monthExpense > 0 ? (report.totalMeasured / report.monthExpense) * 100 : null;
  const activeLeaks = report.leaks.filter((l) => l.amount !== 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("lk_title", lang)}
        description="Ye safha koi naya adad nahi banata — wo sab jorta hai jo pehle se darj hai."
      />

      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/admin/leakage?m=${prev.m}&y=${prev.y}`}
          className="rounded-lg border border-surface-300 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400"
        >
          ← {MONTHS[prev.m - 1]}
        </Link>
        <span className="text-sm font-semibold text-surface-900 dark:text-white">
          {MONTHS[month - 1]} {year}
        </span>
        <Link
          href={`/admin/leakage?m=${next.m}&y=${next.y}`}
          className="rounded-lg border border-surface-300 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400"
        >
          {MONTHS[next.m - 1]} →
        </Link>
      </div>

      {/* ---- Jo nazar aa raha hai ---- */}
      <Card
        className={`p-4 ${
          report.totalMeasured === 0
            ? "border-l-4 border-l-surface-300 dark:border-l-surface-700"
            : "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">{t("lk_found_where_looked", lang)}</p>
        <p className="mt-1 font-display text-3xl font-bold text-surface-900 dark:text-white">
          {rs(report.totalMeasured)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-600 dark:text-surface-400">
          {report.previousTotal !== 0 || report.totalMeasured !== 0 ? (
            <span className="flex items-center gap-1">
              {change > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-red-600" />
              ) : change < 0 ? (
                <TrendingDown className="h-3.5 w-3.5 text-green-600" />
              ) : null}
              pichhle mahine {rs(report.previousTotal)}
              {change !== 0 && ` (${change > 0 ? "+" : ""}${rs(change)})`}
            </span>
          ) : null}
          {ratio !== null && (
            <span>kul kharche ka {ratio.toFixed(1)}%</span>
          )}
        </div>
      </Card>

      {/* ---- Jahan dekha hi nahi ---- */}
      <Card
        className={`p-4 ${
          report.blindSpots.length === 0
            ? "border-l-4 border-l-green-500"
            : "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          {report.blindSpots.length === 0 ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {report.blindSpots.length === 0
                ? "Har jagah par nazar hai"
                : `${report.blindSpots.length} jagah aisi hain jahan hum ne dekha hi nahi`}
            </p>
            <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
              {report.blindSpots.length === 0
                ? "Upar wala adad poori tasveer hai — koi kona bin dekha nahi."
                : "Upar wala adad SIRF wahan ka hai jahan hum ne dekha. In jagahon ka adad sifar isi liye hai ke koi gaya hi nahi — us ka matlab “nuqsan nahi hua” nahi hai."}
            </p>

            {report.blindSpots.length > 0 && (
              <ul className="mt-3 space-y-2">
                {report.blindSpots.map((b) => (
                  <li
                    key={b.key}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 dark:border-amber-900 dark:bg-surface-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{b.title}</p>
                        <p className="mt-0.5 text-xs text-surface-500">{b.detail}</p>
                      </div>
                      <Link
                        href={b.href}
                        className="shrink-0 text-xs font-medium text-brand-700 underline dark:text-brand-400"
                      >{t("lk_fix", lang)}</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {/* ---- Har sooraakh ---- */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">{t("lk_holes", lang)}</h2>
        {activeLeaks.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-surface-500">
              Is mahine kisi khate mein nuqsan darj nahi hua.
              {report.blindSpots.length > 0 &&
                " Magar ooper dekhein — kuch jagahon par nazar hi nahi gayi, is liye ye adad poora nahi."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {activeLeaks.map((leak) => {
              const share =
                report.totalMeasured !== 0
                  ? Math.abs(leak.amount / report.totalMeasured) * 100
                  : 0;
              return (
                <Card key={leak.code} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">
                        {leak.label}
                      </p>
                      <p className="mt-0.5 text-xs text-surface-500">{leak.where}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold tabular-nums text-red-700 dark:text-red-400">
                        {rs(Math.abs(leak.amount))}
                      </p>
                      {leak.change !== null && leak.change !== 0 && (
                        <p
                          className={`text-xs ${
                            leak.change > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-700 dark:text-green-400"
                          }`}
                        >
                          {leak.change > 0 ? "▲" : "▼"} {rs(Math.abs(leak.change))}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${Math.min(100, share)}%` }}
                    />
                  </div>

                  <Link
                    href={leak.href}
                    className="mt-2 inline-block text-xs font-medium text-brand-700 underline dark:text-brand-400"
                  >{t("lk_see_detail", lang)}</Link>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Atka hua paisa ---- */}
      {report.stuck.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400">
            <Clock className="h-3.5 w-3.5" /> Abhi atka hua — {rs(report.totalStuck)}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {report.stuck.map((s) => (
              <Card key={s.label} className="border-l-4 border-l-amber-500 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{s.label}</p>
                    <p className="mt-0.5 text-xs text-surface-500">{s.detail}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {rs(s.amount)}
                  </span>
                </div>
                <Link
                  href={s.href}
                  className="mt-2 inline-block text-xs font-medium text-brand-700 underline dark:text-brand-400"
                >{t("lk_see", lang)}</Link>
              </Card>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs text-surface-400">
            Ye abhi nuqsan nahi — magar jitna waqt guzarta hai, utna kam mumkin hota jata hai ke wapas
            aaye.
          </p>
        </div>
      )}

      {/* ---- Kahan aur kis ke haath ---- */}
      {(report.byBranch.length > 0 || report.byPerson.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {report.byBranch.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">{t("lk_cash_gap_branch", lang)}</div>
              <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                {report.byBranch.map((b) => (
                  <li key={b.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-surface-800 dark:text-surface-200">
                      {b.label}
                      <span className="ml-1.5 text-xs text-surface-400">{b.count} raat</span>
                    </span>
                    <span className="font-medium tabular-nums text-red-700 dark:text-red-400">
                      {rs(b.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {report.byPerson.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
                <p className="text-sm font-semibold text-surface-900 dark:text-white">{t("lk_short_cash_who", lang)}</p>
                <p className="mt-0.5 text-xs text-surface-500">
                  Ye ilzam nahi. Ek dafa kam pahunchna har kisi ke sath ho sakta hai — magar wohi naam
                  har mahine aaye to wo khud sawal ban jata hai.
                </p>
              </div>
              <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                {report.byPerson.map((p) => (
                  <li key={p.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-surface-800 dark:text-surface-200">
                      {p.label}
                      <span className="ml-1.5 text-xs text-surface-400">{p.count} dafa</span>
                    </span>
                    <span className="font-medium tabular-nums text-red-700 dark:text-red-400">
                      {rs(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <p className="flex items-start gap-1.5 px-1 text-xs text-surface-400">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Sifar ka matlab hamesha &quot;sab theek hai&quot; nahi hota. Jahan ginti hi na hui ho, wahan adad
        sifar rehta hai — isi liye &quot;jahan dekha hi nahi&quot; wala hissa upar wale adad se zyada ahem
        hai.
      </p>
    </div>
  );
}
