import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { trialBalance, profitAndLoss, balanceSheet, generalJournal } from "@/lib/ledger/statements";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Maali gosharay: Trial Balance, Nafa Nuqsan, Balance Sheet, Journal.
 *
 * Chaaron ek hi safhe par, patti ke sath -- alag alag safhe banane se
 * tareekh har jagah dobara chunni parti hai, aur log wahi report dekhte
 * hain jo saamne ho.
 *
 * Yahan koi naya hisaab nahi hota. Chaaron us ek fehrist par khaRe hain
 * jo pehle se chal rahi hai (journal_lines). Report ke liye adad alag se
 * jama karna wo raasta hai jahan se do jagah do adad paida hote hain.
 */

type View = "trial" | "pnl" | "bs" | "journal";

const VIEWS: { key: View; label: string }[] = [
  { key: "trial", label: "fs_trial" },
  { key: "pnl", label: "fs_pnl" },
  { key: "bs", label: "fs_bs" },
  { key: "journal", label: "fs_journal" },
];

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function money(n: number) {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toLocaleString();
  return neg ? `(${s})` : s;
}

/** Saal ki shuruaat: julaai se (Pakistan ka maali saal). */
function yearStartOf(d: Date): string {
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-07-01`;
}

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: { view?: string; from?: string; to?: string };
}) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("fs_only_finance", lang)}</div>;
  }

  const view = (VIEWS.find((v) => v.key === searchParams.view)?.key ?? "trial") as View;
  const today = new Date();
  const to = searchParams.to || today.toISOString().slice(0, 10);
  const from = searchParams.from || yearStartOf(today);

  const qs = (v: View) => `?view=${v}&from=${from}&to=${to}`;

  return (
    <div className="space-y-4">
      <PageHeader title={t("fs_title", lang)} description={t("fs_desc", lang)} />

      <nav className="-mt-2 flex flex-wrap gap-1 border-b border-surface-200 pb-2 text-sm dark:border-surface-800">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/admin/finance/statements${qs(v.key)}`}
            className={`rounded-full px-3 py-1.5 ${
              v.key === view
                ? "bg-brand-600 text-white"
                : "text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
            }`}
          >
            {t(v.label as any, lang)}
          </Link>
        ))}
      </nav>

      {/* Tareekh ki hadd. Nafa nuqsan hamesha DO tareekhon ke darmiyan ka
          hota hai; balance sheet hamesha EK tareekh par -- is liye wahan
          sirf "is tareekh tak" maayne rakhta hai. */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="view" value={view} />
        <label className="text-xs text-surface-500">
          {view === "bs" ? t("fs_as_of", lang) : t("fs_from", lang)}
          {view !== "bs" && (
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 block h-9 rounded-lg border border-surface-200 px-2 text-sm dark:border-surface-700 dark:bg-surface-800"
            />
          )}
        </label>
        <label className="text-xs text-surface-500">
          {view === "bs" ? "" : t("fs_to", lang)}
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-1 block h-9 rounded-lg border border-surface-200 px-2 text-sm dark:border-surface-700 dark:bg-surface-800"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          {t("fs_show", lang)}
        </button>
      </form>

      {view === "trial" && <TrialView from={from} to={to} lang={lang} />}
      {view === "pnl" && <PnlView from={from} to={to} lang={lang} />}
      {view === "bs" && <BsView to={to} yearStart={yearStartOf(new Date(to))} lang={lang} />}
      {view === "journal" && <JournalView from={from} to={to} lang={lang} />}
    </div>
  );
}

function Fail({ msg }: { msg: string }) {
  // Jawab na mile to khali fehrist NAHI dikhayi jati -- khali fehrist
  // "sab khaate sifar hain" kehti hai, aur wo jhoot hai.
  return (
    <Card className="flex items-start gap-2 border-red-200 bg-red-50 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{msg}</span>
    </Card>
  );
}

async function TrialView({ from, to, lang }: { from: string; to: string; lang: any }) {
  const tb = await trialBalance(from, to);
  if (tb.error) return <Fail msg={`${t("fs_failed", lang)} ${tb.error}`} />;

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-700">
            <th className="py-2">{t("fs_account", lang)}</th>
            <th className="py-2 text-right">{t("fs_debit", lang)}</th>
            <th className="py-2 text-right">{t("fs_credit", lang)}</th>
          </tr>
        </thead>
        <tbody>
          {tb.rows.map((r) => (
            <tr key={r.code} className="border-b border-surface-100 dark:border-surface-800">
              <td className="py-1.5">
                <span className="font-mono text-xs text-surface-400">{r.code}</span> {r.name}
              </td>
              <td className="py-1.5 text-right tabular-nums">{r.debit ? money(r.debit) : ""}</td>
              <td className="py-1.5 text-right tabular-nums">{r.credit ? money(r.credit) : ""}</td>
            </tr>
          ))}
          {tb.rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-surface-400">
                {t("fs_no_entries", lang)}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-surface-300 font-semibold dark:border-surface-600">
            <td className="py-2">{t("fs_total", lang)}</td>
            <td className="py-2 text-right tabular-nums">{money(tb.totalDebit)}</td>
            <td className="py-2 text-right tabular-nums">{money(tb.totalCredit)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Dono taraf barabar hona ledger ki apni sehat ki jaanch hai. Farq
          aaye to wo report ki ghalti nahi -- wo asal masla hai, aur usay
          chhupaya nahi jata. */}
      {tb.farq !== 0 ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t("fs_not_equal", lang)} Rs {money(tb.farq)}
        </p>
      ) : (
        tb.rows.length > 0 && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
            {t("fs_equal", lang)}
          </p>
        )
      )}
    </Card>
  );
}

async function PnlView({ from, to, lang }: { from: string; to: string; lang: any }) {
  const p = await profitAndLoss(from, to);
  if (p.error) return <Fail msg={`${t("fs_failed", lang)} ${p.error}`} />;

  const Section = ({ title, rows, total }: { title: string; rows: any[]; total: number }) => (
    <>
      <tr className="bg-surface-50 dark:bg-surface-800/60">
        <td colSpan={2} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-surface-500">
          {title}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.code} className="border-b border-surface-100 dark:border-surface-800">
          <td className="py-1.5 pl-3">
            <span className="font-mono text-xs text-surface-400">{r.code}</span> {r.name}
          </td>
          <td className="py-1.5 text-right tabular-nums">{money(r.balance)}</td>
        </tr>
      ))}
      {rows.length === 0 && (
        <tr>
          <td colSpan={2} className="py-1.5 pl-3 text-surface-400">
            —
          </td>
        </tr>
      )}
      <tr className="border-b border-surface-200 font-medium dark:border-surface-700">
        <td className="py-1.5 pl-3">{t("fs_total", lang)}</td>
        <td className="py-1.5 text-right tabular-nums">{money(total)}</td>
      </tr>
    </>
  );

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <tbody>
          <Section title={t("fs_income", lang)} rows={p.income.rows} total={p.income.total} />
          {/* Lagat aur baqi kharche alag. Mila dene se "maal par kitna
              bacha" ka jawab hi nahi milta -- aur dukan par yehi asal
              sawal hai. */}
          <Section title={t("fs_cogs", lang)} rows={p.cogs.rows} total={p.cogs.total} />
          <tr className="border-b border-surface-200 font-semibold dark:border-surface-700">
            <td className="py-2">{t("fs_gross", lang)}</td>
            <td className="py-2 text-right tabular-nums">{money(p.grossProfit)}</td>
          </tr>
          <Section title={t("fs_expense", lang)} rows={p.expense.rows} total={p.expense.total} />
          <tr className="border-t-2 border-surface-300 dark:border-surface-600">
            <td className="py-2 font-display text-base font-semibold">{t("fs_net", lang)}</td>
            <td
              className={`py-2 text-right font-display text-lg font-bold tabular-nums ${
                p.netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"
              }`}
            >
              Rs {money(p.netProfit)}
            </td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

async function BsView({ to, yearStart, lang }: { to: string; yearStart: string; lang: any }) {
  const b = await balanceSheet(to, yearStart);
  if (b.error) return <Fail msg={`${t("fs_failed", lang)} ${b.error}`} />;

  const Side = ({ title, rows, total }: { title: string; rows: any[]; total: number }) => (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-500">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-b border-surface-100 dark:border-surface-800">
              <td className="py-1.5">
                <span className="font-mono text-xs text-surface-400">{r.code}</span> {r.name}
              </td>
              <td className="py-1.5 text-right tabular-nums">{money(r.balance)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="py-1.5 text-surface-400">—</td>
              <td />
            </tr>
          )}
          <tr className="font-semibold">
            <td className="py-1.5">{t("fs_total", lang)}</td>
            <td className="py-1.5 text-right tabular-nums">{money(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <Card className="space-y-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Side title={t("fs_assets", lang)} rows={b.assets.rows} total={b.assets.total} />
        <div className="space-y-4">
          <Side title={t("fs_liabilities", lang)} rows={b.liabilities.rows} total={b.liabilities.total} />
          <Side title={t("fs_equity", lang)} rows={b.equity.rows} total={b.equity.total} />
          {/* Nafa nuqsan ke khate saal ke aakhir mein sarmaye mein jate
              hain. Jab tak wo band na hon, ye qatar dikhaye baghair
              balance sheet barabar nahi hoti. */}
          <div className="flex justify-between border-t border-surface-200 pt-2 text-sm font-medium dark:border-surface-700">
            <span>{t("fs_year_profit", lang)}</span>
            <span className="tabular-nums">{money(b.yearProfit)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t-2 border-surface-300 pt-3 md:grid-cols-2 dark:border-surface-600">
        <div className="flex justify-between font-display font-semibold">
          <span>{t("fs_assets", lang)}</span>
          <span className="tabular-nums">Rs {money(b.totalLeft)}</span>
        </div>
        <div className="flex justify-between font-display font-semibold">
          <span>{t("fs_liab_equity", lang)}</span>
          <span className="tabular-nums">Rs {money(b.totalRight)}</span>
        </div>
      </div>

      {b.farq !== 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t("fs_bs_not_equal", lang)} Rs {money(b.farq)}
        </p>
      )}
    </Card>
  );
}

async function JournalView({ from, to, lang }: { from: string; to: string; lang: any }) {
  const j = await generalJournal(from, to, 100);
  if (j.error) return <Fail msg={`${t("fs_failed", lang)} ${j.error}`} />;

  return (
    <Card className="space-y-3">
      {j.entries.length === 0 && <p className="py-6 text-center text-sm text-surface-400">{t("fs_no_entries", lang)}</p>}
      {j.entries.map((e) => (
        <div key={e.id} className="rounded-lg border border-surface-200 p-3 dark:border-surface-800">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
              <span className="font-mono text-xs text-surface-400">{e.entry_number}</span> {e.description}
            </p>
            <p className="text-xs text-surface-500">
              {new Date(e.entry_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
              {e.source_module}
              {/* Ulti gayi aur purani tareekh wali entriyaan alag nishaan
                  ke sath -- dono jaiz hain, magar dono ko nazar mein
                  rakha jata hai. */}
              {e.is_reversal && <span className="ml-1 text-amber-700">· {t("fs_reversal", lang)}</span>}
              {e.is_backdated && <span className="ml-1 text-amber-700">· {t("fs_backdated", lang)}</span>}
            </p>
          </div>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {e.lines.map((l, i) => (
                <tr key={i} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="py-1">
                    <span className="font-mono text-xs text-surface-400">{l.account_code}</span> {l.account_name}
                    {l.memo && <span className="ml-1 text-xs text-surface-400">— {l.memo}</span>}
                  </td>
                  <td className="w-28 py-1 text-right tabular-nums">{l.debit ? money(l.debit) : ""}</td>
                  <td className="w-28 py-1 text-right tabular-nums">{l.credit ? money(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Card>
  );
}
