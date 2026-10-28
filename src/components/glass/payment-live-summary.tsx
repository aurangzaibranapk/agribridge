"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, CheckCircle2, Landmark, User } from "lucide-react";
import { optionName, paymentPreview, rsFmt } from "@/lib/glass/glass";

/**
 * Payment modal ka live khulasa. Form ko SIRF parhta hai (input events),
 * kuch set ya post nahi karta -- posting logic bilkul waisi hi.
 */
export function PaymentLiveSummary({ direction, accounts }: { direction: "pay" | "receive"; accounts: Array<{ id: string; name: string; balance: number }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ amount: 0, accountId: "", party: "" });
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      const el = form.elements;
      const amount = Number((el.namedItem("amount") as HTMLInputElement | null)?.value || 0);
      const accountId = (el.namedItem("financeAccountId") as HTMLSelectElement | null)?.value || "";
      const partySel = form.querySelector("select") as HTMLSelectElement | null;
      const other = (el.namedItem("otherPartyName") as HTMLInputElement | null)?.value;
      const txt = partySel?.value ? (partySel.value === "other:" ? other ?? "" : partySel.selectedOptions[0]?.text ?? "") : "";
      setV({ amount, accountId, party: optionName(txt) });
    };
    read();
    form.addEventListener("input", read); form.addEventListener("change", read);
    return () => { form.removeEventListener("input", read); form.removeEventListener("change", read); };
  }, []);
  const acc = accounts.find((a) => a.id === v.accountId);
  const p = paymentPreview({ direction, amount: v.amount, accountBalance: acc?.balance ?? null });
  const ready = !!acc && !!v.party && p.amount > 0;
  const from = direction === "pay" ? acc?.name : v.party;
  const to = direction === "pay" ? v.party : acc?.name;
  return (
    <div ref={ref} className="gl-sec rounded-2xl bg-gradient-to-br from-emerald-500/10 to-[#1e3a6e]/10 p-4" data-testid="payment-live-summary">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-surface-500 dark:text-slate-400">Live summary · <span className="gl-ur normal-case">خلاصہ</span></p>
      <div className="mt-2 grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-2 rounded-xl bg-white/60 p-2.5 dark:bg-white/5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a6e] text-white dark:bg-emerald-600">{direction === "pay" ? <Landmark className="h-4 w-4" /> : <User className="h-4 w-4" />}</span><b className="truncate text-sm">{from || "—"} se</b></div>
        <span className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><ArrowDown className="h-3.5 w-3.5 sm:-rotate-90" />{rsFmt(p.amount)}</span>
        <div className="flex items-center gap-2 rounded-xl bg-white/60 p-2.5 dark:bg-white/5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a6e] text-white dark:bg-emerald-600">{direction === "pay" ? <User className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}</span><b className="truncate text-sm">{to || "—"} ko</b></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <p className="flex justify-between rounded-lg bg-white/50 px-2.5 py-1.5 dark:bg-white/5"><span>{acc?.name ?? "Account"} abhi</span><b>{p.before == null ? "—" : rsFmt(p.before)}</b></p>
        <p className="flex justify-between rounded-lg bg-white/50 px-2.5 py-1.5 dark:bg-white/5"><span>Payment ke baad</span><b className={p.short ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"} data-testid="balance-after">{p.after == null ? "—" : `${p.after < 0 ? "− " : ""}${rsFmt(p.after)}`}</b></p>
      </div>
      {p.short && <p className="mt-2 text-xs font-semibold text-rose-600">Account mein itna balance nahi.</p>}
      {ready && !p.short && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Ready to post · preview sirf dikhane ke liye</p>}
    </div>
  );
}
