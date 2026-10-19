"use client";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { updateMilkSale, type FarmerProfileState } from "@/actions/farmer-profile";
import { submitLivestockLoan, type ServiceRequestState } from "@/actions/service-requests";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

/**
 * Livestock -> Dairy (malik ki manzoori, 19 Oct 2026).
 * Purane /portal/services/livestock safhe ke do kaam ab Dairy Management mein:
 *   1. Doodh ki farokht -- wohi `farmers` ke 4 khane (updateMilkSale)
 *   2. Maweshi loan     -- wohi `livestock_loans` (submitLivestockLoan; staff manzoori)
 * Koi migration nahi, purana data wahin.
 */
const INP = "mt-1 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-900 fit:mt-0.5 fit:py-1.5 fit:text-[13px] focus:border-green-500 focus:outline-none dark:border-surface-700 dark:bg-surface-950 dark:text-white dark:[color-scheme:dark]";
const LBL = "block text-[11.5px] font-medium text-surface-600 dark:text-slate-300";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="shrink-0 whitespace-nowrap rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-60 fit:px-3 fit:py-1.5 fit:text-[13px]">
      {pending ? "…" : label}
    </button>
  );
}

function Msg({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p role={ok ? "status" : "alert"} className={`mt-2 rounded-lg px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"}`}>{text}</p>
  );
}

export interface MilkSaleValues {
  milk_buyer_name: string | null;
  milk_sale_rate: number | null;
  milk_liters_per_day: number | null;
  milk_advance_loan_amount: number | null;
}

export function MilkSalePanel({ lang, values, className = "" }: { lang: Lang; values: MilkSaleValues; className?: string }) {
  const L = (k: TranslationKey) => t(k, lang);
  const [state, action] = useFormState<FarmerProfileState, FormData>(updateMilkSale, {});
  return (
    <form action={action} data-testid="milk-sale-panel" className={`pf-panel rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900 fit:p-3.5 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white">🥛 {L("dy_ms_title")} <span className="text-xs font-normal text-surface-500 dark:text-slate-400">· <span lang="ur">{t("dy_ms_title", "ur")}</span></span></h3>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">{L("dy_ms_badge")}</span>
      </div>
      <div className="pf-body space-y-2">
        <label className="block"><span className={LBL}>{L("dy_ms_buyer")}</span>
          <input name="milk_buyer_name" defaultValue={values.milk_buyer_name ?? ""} placeholder={L("dy_ms_buyer_ph")} maxLength={120} className={INP} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className={LBL}>{L("dy_ms_rate")}</span>
            <input name="milk_sale_rate" inputMode="decimal" defaultValue={values.milk_sale_rate ?? ""} className={INP} /></label>
          <label className="block"><span className={LBL}>{L("dy_ms_lpd")}</span>
            <input name="milk_liters_per_day" inputMode="decimal" defaultValue={values.milk_liters_per_day ?? ""} className={INP} /></label>
        </div>
        <label className="block"><span className={LBL}>{L("dy_ms_advance")}</span>
          <input name="milk_advance_loan_amount" inputMode="decimal" defaultValue={values.milk_advance_loan_amount ?? ""} className={INP} /></label>
        {state.error && <Msg ok={false} text={state.error} />}
        {state.success && <Msg ok text={L("dy_ms_saved")} />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-surface-100 pt-2 dark:border-surface-800">
        <span className="line-clamp-2 text-[11px] text-surface-500 dark:text-slate-400">{L("dy_ms_note")}</span>
        <Submit label={L("dy_ms_save")} />
      </div>
    </form>
  );
}

export interface LoanRow { cow_count: number | null; buffalo_count: number | null; goat_count: number | null; loan_amount: number | null; status: string | null; created_at: string }

export function LivestockLoanPanel({ lang, counts, loans, className = "" }: {
  lang: Lang; counts: { cow: number; buffalo: number; goat: number }; loans: LoanRow[]; className?: string;
}) {
  const L = (k: TranslationKey) => t(k, lang);
  const [state, action] = useFormState<ServiceRequestState, FormData>(submitLivestockLoan, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success) ref.current?.reset(); }, [state.success]);
  const animals = (l: LoanRow) => [l.cow_count ? `${l.cow_count} ${L("animal_cow")}` : "", l.buffalo_count ? `${l.buffalo_count} ${L("animal_buffalo")}` : "", l.goat_count ? `${l.goat_count} ${L("animal_goat")}` : ""].filter(Boolean).join(" · ");
  return (
    <form ref={ref} action={action} data-testid="livestock-loan-panel" className={`pf-panel rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900 fit:p-3.5 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white">🐄 {L("dy_ln_title")} <span className="text-xs font-normal text-surface-500 dark:text-slate-400">· <span lang="ur">{t("dy_ln_title", "ur")}</span></span></h3>
        <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10.5px] font-semibold text-surface-700 dark:bg-surface-800 dark:text-slate-200">{loans.length} {L("dy_ln_n")}</span>
      </div>
      <div className="pf-body space-y-2">
        <p className="text-[11px] text-surface-500 dark:text-slate-400">{L("dy_ln_from")}</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="block"><span className={LBL}>{L("animal_cow")}</span><input type="number" min="0" name="cow_count" defaultValue={counts.cow} className={INP} /></label>
          <label className="block"><span className={LBL}>{L("animal_buffalo")}</span><input type="number" min="0" name="buffalo_count" defaultValue={counts.buffalo} className={INP} /></label>
          <label className="block"><span className={LBL}>{L("animal_goat")}</span><input type="number" min="0" name="goat_count" defaultValue={counts.goat} className={INP} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className={LBL}>{L("dy_ln_amount")}</span><input type="number" min="0" step="1000" name="loan_amount" required placeholder="50000" className={INP} /></label>
          <label className="block"><span className={LBL}>{L("dy_ln_repay")}</span>
            <select name="repayment_type" required defaultValue="" className={INP}>
              <option value="" disabled>{L("select_repayment_placeholder")}</option>
              <option value="milk_installments">{L("repayment_milk_installments")}</option>
              <option value="lump_sum_3_months">{L("repayment_lump_sum_3months")}</option>
            </select></label>
        </div>
        <label className="block"><span className={LBL}>{L("dy_ln_notes")}</span><input name="notes" maxLength={500} className={INP} /></label>
        {state.error && <Msg ok={false} text={state.error} />}
        {state.success && <Msg ok text={L("dy_ln_sent")} />}
        <div>
          <p className={`${LBL} mt-1`}>{L("dy_ln_past")}</p>
          {loans.length === 0 ? <p className="text-xs text-surface-500 dark:text-slate-400">{L("dy_ln_none")}</p> : (
            <ul className="mt-1 divide-y divide-surface-100 text-xs dark:divide-surface-800">
              {loans.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-surface-700 dark:text-slate-200">{animals(l) || "—"}</span>
                  <span className="flex items-center gap-2"><b className="text-surface-900 dark:text-white">Rs {Number(l.loan_amount ?? 0).toLocaleString("en-PK")}</b><span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] dark:bg-surface-800">{l.status ?? "pending"}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-surface-100 pt-2 dark:border-surface-800">
        <span className="text-[11px] text-surface-500 dark:text-slate-400">{L("dy_ln_review")}</span>
        <Submit label={L("dy_ln_send")} />
      </div>
    </form>
  );
}
