import Link from "next/link";
import { ArrowDown, ArrowUp, FileText, Users } from "lucide-react";
import { GlassStyles } from "./glass-styles";
import { GlassDebitCard } from "./glass-debit-card";
import { rsFmt, type GLang } from "@/lib/glass/glass";
import { gw } from "@/lib/glass/wallet-labels";

/** Admin: kisan ke wallet ka glassy card (asal wallet balance + aakhri len-den). Sirf parhai. */
export function AdminWalletGlass({ lang, code, name, balance, recent }: {
  lang: GLang; code: string; name: string; balance: number;
  recent: Array<{ id: string; label: string; date: string; amount: number; credit: boolean }>;
}) {
  return (
    <div className="gl-bg mb-5 grid items-start gap-5 lg:grid-cols-[minmax(0,480px)_1fr]" data-testid="admin-wallet-glass">
      <GlassStyles />
      <GlassDebitCard code={code} name={name} balanceLabel="WALLET BALANCE" balance={`${balance < 0 ? "− " : ""}${rsFmt(balance)}`} sub={code} />
      <section className="gl-panel p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="font-semibold text-surface-900 dark:text-white">{gw("recent", lang)}</p>
          <span className="gl-ur text-xs text-surface-500 dark:text-slate-400">حالیہ لین دین</span>
        </div>
        {recent.length === 0 ? <p className="py-3 text-sm text-surface-500">—</p> : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-white ${r.credit ? "bg-emerald-600" : "bg-[#1e3a6e]"}`}>{r.credit ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-surface-900 dark:text-slate-100">{r.label}</p><p className="text-[11px] text-surface-500">{r.date}</p></div>
                <b className={`text-sm ${r.credit ? "text-emerald-600 dark:text-emerald-300" : "text-surface-900 dark:text-white"}`}>{r.credit ? "+ " : "− "}{rsFmt(r.amount)}</b>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
          <a href="#statement" className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><FileText className="h-3.5 w-3.5" />{gw("statement", lang)}</a>
          <Link href="/admin/wallets" className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><Users className="h-3.5 w-3.5" />Sab wallets</Link>
        </div>
      </section>
    </div>
  );
}
