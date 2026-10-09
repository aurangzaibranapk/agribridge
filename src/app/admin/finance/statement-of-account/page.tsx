import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { aajKaKhana } from "@/lib/utils/format";
import { loadStatementOfAccount, type SoaView } from "@/lib/ledger/statement-of-account";
import { SoaTable } from "./soa-table";
import { AlertTriangle, CheckCircle2, BookOpen, Landmark } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function money(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Statement Of Account -- bank ke statement jaisa safha (9 October).
 * Ledger (GL) aur Cash Book dono yahan, ek hi shakal mein; farq ho to
 * tanbeeh. Sirf parhta hai. Tafseel: `src/lib/ledger/statement-of-account.ts`.
 */
export default async function StatementOfAccountPage({
  searchParams,
}: {
  searchParams: { account?: string; from?: string; to?: string; view?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf finance / admin ke liye hai.</div>;
  }

  const aaj = aajKaKhana();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from ?? "") ? searchParams.from! : `${aaj.slice(0, 4)}-01-01`;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to ?? "") ? searchParams.to! : aaj;

  const soa = await loadStatementOfAccount({ account: searchParams.account, from, to });
  const requested: SoaView = searchParams.view === "cb" ? "cb" : "gl";
  const view: SoaView = requested === "cb" && soa.cb ? "cb" : soa.gl ? "gl" : soa.cb ? "cb" : "gl";
  const side = view === "cb" ? soa.cb : soa.gl;

  const qs = (v: SoaView) => `?account=${encodeURIComponent(soa.accountValue)}&from=${from}&to=${to}&view=${v}`;
  const diff = soa.gl && soa.cb ? Math.round((soa.gl.closing - soa.cb.closing) * 100) / 100 : 0;
  const both = !!(soa.gl && soa.cb);

  const fieldCls = "rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Statement Of Account"
        description="Bank ke statement jaisa hisaab — har qatar ki Post Date, Value Date, Doc No., tafseel, nikasi (withdrawal), jama (deposit) aur chalta baqi."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/finance" className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800">
              <Landmark className="h-4 w-4" /> Cash Book
            </Link>
            <Link href="/admin/finance/ledger" className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800">
              <BookOpen className="h-4 w-4" /> Ledger
            </Link>
          </div>
        }
      />

      <Card className="print:hidden">
        <form className="flex flex-wrap items-end gap-2" action="/admin/finance/statement-of-account">
          <input type="hidden" name="view" value={view} />
          <div>
            <label className="block text-xs text-surface-500" htmlFor="soa-account">Khata (Account)</label>
            <select id="soa-account" name="account" defaultValue={soa.accountValue} className={`w-72 ${fieldCls}`}>
              <optgroup label="Bank / Cash / Wallet">
                {soa.options.filter((o) => o.group === "finance").map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
              <optgroup label="Ledger (GL) khate">
                {soa.options.filter((o) => o.group === "gl").map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="block text-xs text-surface-500" htmlFor="soa-from">Tareekh se (From)</label>
            <input id="soa-from" type="date" name="from" defaultValue={from} className={fieldCls} />
          </div>
          <div>
            <label className="block text-xs text-surface-500" htmlFor="soa-to">Tareekh tak (To)</label>
            <input id="soa-to" type="date" name="to" defaultValue={to} className={fieldCls} />
          </div>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Dikhayein</button>
        </form>
      </Card>

      {soa.error && (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          Statement nahi ban saki: {soa.error}
        </Card>
      )}

      {!soa.error && (
        <>
          <nav className="flex flex-wrap gap-1 border-b border-surface-200 pb-2 text-sm print:hidden dark:border-surface-800">
            {soa.gl && (
              <Link href={`/admin/finance/statement-of-account${qs("gl")}`} className={`rounded-full px-3 py-1.5 ${view === "gl" ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"}`}>
                Ledger (GL {soa.glCode})
              </Link>
            )}
            {soa.cb && (
              <Link href={`/admin/finance/statement-of-account${qs("cb")}`} className={`rounded-full px-3 py-1.5 ${view === "cb" ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"}`}>
                Cash Book
              </Link>
            )}
          </nav>

          {both && (
            Math.abs(diff) > 0.5 ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong>Farq hai!</strong> {to} tak Ledger ka baqi Rs {money(soa.gl!.closing)} hai aur Cash Book ka Rs {money(soa.cb!.closing)} — farq Rs {money(Math.abs(diff))}.
                  <span className="block text-xs">
                    Is muddat mein {soa.gl!.unlinked} ledger qatarein Cash Book mein nahi milin, aur {soa.cb!.unlinked} Cash Book qatarein Ledger mein nahi milin (qatar par &quot;Jorr nahi&quot; likha hai).
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  Ledger aur Cash Book barabar hain — {to} tak dono ka baqi Rs {money(soa.gl!.closing)}.
                  {(soa.gl!.unlinked > 0 || soa.cb!.unlinked > 0) && (
                    <span className="block text-xs">
                      Baqi barabar hai, magar {soa.gl!.unlinked} ledger aur {soa.cb!.unlinked} Cash Book qatarein bina jorr ke hain (aksar durustagi ki entries).
                    </span>
                  )}
                </div>
              </div>
            )
          )}

          {side && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card>
                  <p className="text-xs uppercase tracking-wide text-surface-500">Shuru ka baqi (Opening)</p>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums">{money(side.opening)}</p>
                </Card>
                <Card>
                  <p className="text-xs uppercase tracking-wide text-surface-500">Kul nikasi (Withdrawal)</p>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums text-rose-600">{money(side.totalWithdrawal)}</p>
                </Card>
                <Card>
                  <p className="text-xs uppercase tracking-wide text-surface-500">Kul jama (Deposit)</p>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums text-emerald-600">{money(side.totalDeposit)}</p>
                </Card>
                <Card>
                  <p className="text-xs uppercase tracking-wide text-surface-500">Aakhri baqi (Closing)</p>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums text-brand-700 dark:text-brand-300">{money(side.closing)}</p>
                </Card>
              </div>

              <SoaTable
                title={`${soa.accountLabel} — ${view === "cb" ? "Cash Book" : `Ledger ${soa.glCode ?? ""}`}`}
                subtitle={`${soa.accountNumber ? `A/C ${soa.accountNumber} · ` : ""}${from} se ${to} tak`}
                fileName={`statement-${soa.accountLabel.replace(/[^a-z0-9]+/gi, "-")}-${view}-${from}-${to}`}
                linkedLabel={view === "cb" ? "Ledger TXN" : "Cash Book"}
                showLinked={both}
                opening={side.opening}
                closing={side.closing}
                rows={side.rows}
              />
              <p className="text-xs text-surface-500 print:hidden">
                Post Date = entry kab likhi gayi (PKT). Value Date = karobar ki asal tareekh — purani tareekh wali entry par &quot;Purani tareekh&quot; nishan hai. Doc No. par click karein to us din ka General Journal khulta hai; tafseel mein kaam (module) aur party ke link hain. Chalta baqi hamesha tareekh ki tarteeb se hai, column sort karne se nahi badalta.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
