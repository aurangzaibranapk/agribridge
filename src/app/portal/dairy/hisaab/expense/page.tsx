import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { addDays, sortByTag } from "@/lib/portal/dairy";
import { CAT_ICON, CHARA_TYPES, EXPENSE_CATS, PAYMENTS, UNITS, rs, type ExpenseCat } from "@/lib/portal/dairy-pl";
import { loadSuggestions } from "@/lib/portal/dairy-pl-load";
import { Card, CardHead } from "@/components/portal/khata/khata-parts";
import { ErrorNote, Footer, Hero } from "@/components/portal/dairy/dairy-parts";
import { Field, Seg, inputCls } from "@/components/portal/dairy/form-parts";
import { AmountCalc } from "@/components/portal/dairy/amount-calc";
import { addExpenseAction, addFromShopAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AddExpense({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const [{ animals }, sugg] = await Promise.all([loadDairy(asOf, 1), loadSuggestions()]);
  const active = sortByTag(animals.filter((a) => a.status !== "sold" && a.status !== "dead"));

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <Hero title={<>➕ {L("dy2_exp_title")} {lang !== "ur" && <span dir="rtl">· {t("dy2_exp_title", "ur")}</span>}</>} sub={L("dy2_exp_sub")} />
      {searchParams?.ok && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{L("dy2_saved")}</p>}
      <ErrorNote e={searchParams?.e} lang={lang} />
      <div className="pf-grow pf-grid grid gap-4 lg:grid-cols-[1.45fr_1fr] fit:gap-2.5">
        <Card className="pf-scroll fit:p-3.5">
          <CardHead title={L("dy2_exp_details")} />
          <form action={addExpenseAction} className="space-y-4">
            <Field k="dy2_f_cat" lang={lang}>
              <div className="flex flex-wrap gap-1.5">
                {EXPENSE_CATS.map((c, i) => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="category" value={c} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="block rounded-full border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-800 peer-checked:border-green-600 peer-checked:bg-green-600 peer-checked:text-white dark:border-surface-700 dark:bg-surface-800 dark:text-slate-100">{CAT_ICON[c as ExpenseCat]} {L(`cat_${c}` as TranslationKey)}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field k="dy2_f_chara" lang={lang}><Seg name="sub_type" value="green" lang={lang} options={CHARA_TYPES.map((c) => ({ v: c, k: `ct_${c}` as TranslationKey }))} /></Field>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field k="dy2_f_qty" lang={lang}><input name="qty" inputMode="decimal" placeholder="40" className={inputCls} /></Field>
              <Field k="dy2_f_unit" lang={lang}><select name="unit" className={inputCls}>{UNITS.map((u) => <option key={u} value={u}>{L(`un_${u}` as TranslationKey)}</option>)}</select></Field>
              <Field k="dy2_f_rate" lang={lang}><input name="rate" inputMode="decimal" placeholder="450" className={inputCls} /></Field>
              <Field k="dy2_f_amount" lang={lang}><AmountCalc className={`${inputCls} font-bold text-green-700 dark:text-green-300`} placeholder={L("dy2_f_amount_hint")} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field k="dy2_f_date" lang={lang}><input type="date" name="expense_date" defaultValue={asOf} max={asOf} min={addDays(asOf, -400)} className={`${inputCls} dark:[color-scheme:dark]`} /></Field>
              <Field k="dy2_f_for" lang={lang}>
                <select name="animal_id" className={inputCls}><option value="">🐄 {L("dy2_f_herd")}</option>{active.map((a) => <option key={a.id} value={a.id}>#{a.tag_no}{a.name ? ` · ${a.name}` : ""}</option>)}</select>
              </Field>
              <Field k="dy2_f_paid_to" lang={lang}><input name="paid_to" maxLength={80} className={inputCls} /></Field>
              <Field k="dy2_f_payment" lang={lang}><Seg name="payment" value="cash" lang={lang} options={PAYMENTS.map((p) => ({ v: p, k: `dy2_pay_${p}` as TranslationKey }))} /></Field>
            </div>
            <Field k="dy2_f_note" lang={lang}><input name="note" maxLength={300} className={inputCls} /></Field>
            <div className="flex justify-end gap-2">
              <Link href="/portal/dairy/hisaab" className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-semibold text-surface-700 dark:border-surface-700 dark:text-slate-200">{L("dy_cancel")}</Link>
              <button className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700">✓ {L("dy2_save_exp")}</button>
            </div>
          </form>
        </Card>
        <div className="pf-scroll space-y-4 fit:space-y-2.5">
          <Card className="fit:p-3.5">
            <CardHead title={L("dy2_shop_title")} right={<span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">{L("dy2_readonly")}</span>} />
            <p className="mb-3 text-xs text-surface-500 dark:text-slate-400">{L("dy2_shop_note")}</p>
            {sugg.length === 0 && <p className="py-6 text-center text-sm text-surface-500">{L("dy2_shop_none")}</p>}
            <div className="space-y-2">
              {sugg.map((s) => (
                <div key={s.item_id} className={`flex items-center gap-3 rounded-xl border border-dashed p-3 ${s.added ? "border-green-400 bg-green-50/60 dark:border-green-600/50 dark:bg-green-500/10" : "border-sky-300 bg-sky-50/50 dark:border-sky-600/40 dark:bg-sky-500/10"}`}>
                  <span className="text-xl">{s.added ? "✅" : CAT_ICON[(s.category in CAT_ICON ? s.category : "other") as ExpenseCat]}</span>
                  <div className="min-w-0 flex-1"><b className="block truncate text-[13px] text-surface-900 dark:text-white">{s.product} · {s.qty}</b><span className="text-[11px] text-surface-500">{s.ref} · {s.sale_date}</span></div>
                  {s.added ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-500/20 dark:text-green-200">{L("dy2_shop_added")}</span> : (<>
                    <b className="text-[13px] text-surface-900 dark:text-white">{rs(s.amount)}</b>
                    <form action={addFromShopAction}><input type="hidden" name="item_id" value={s.item_id} /><button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">{L("dy2_shop_add")}</button></form>
                  </>)}
                </div>
              ))}
            </div>
          </Card>
          <p className="rounded-xl border border-sky-300/50 bg-sky-50 p-3 text-xs text-surface-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-slate-200">🔒 {L("dy2_shop_lock")}</p>
        </div>
      </div>
      <Footer lang={lang} />
    </div>
  );
}
