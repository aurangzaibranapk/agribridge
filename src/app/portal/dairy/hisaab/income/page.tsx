import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { addDays, sortByTag } from "@/lib/portal/dairy";
import { INCOME_KINDS, rs } from "@/lib/portal/dairy-pl";
import { loadEntries } from "@/lib/portal/dairy-pl-load";
import { Card, CardHead } from "@/components/portal/khata/khata-parts";
import { ErrorNote, Footer, Hero } from "@/components/portal/dairy/dairy-parts";
import { Field, Seg, inputCls } from "@/components/portal/dairy/form-parts";
import { AmountCalc } from "@/components/portal/dairy/amount-calc";
import { addIncomeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AddIncome({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const [{ animals }, entries] = await Promise.all([loadDairy(asOf, 1), loadEntries(addDays(asOf, -365), asOf, 60)]);
  const recent = entries.filter((e) => e.type === "income");
  const total = recent.reduce((a, e) => a + e.amount, 0);
  const active = sortByTag(animals.filter((a) => a.status !== "sold" && a.status !== "dead"));
  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <Hero title={<>➕ {L("dy2_inc_title")} {lang !== "ur" && <span dir="rtl">· {t("dy2_inc_title", "ur")}</span>}</>} sub={L("dy2_inc_sub")} />
      <ErrorNote e={searchParams?.e} lang={lang} />
      <div className="pf-grow pf-grid grid gap-4 lg:grid-cols-[1.3fr_1fr] fit:gap-2.5">
      <Card className="pf-scroll fit:p-3.5">
        <CardHead title={L("dy2_inc_title")} />
        <form action={addIncomeAction} className="space-y-4">
          <Field k="dy2_f_kind" lang={lang}><Seg name="kind" value="home_milk" lang={lang} options={INCOME_KINDS.map((k) => ({ v: k, k: `inc_${k}` as TranslationKey, icon: k === "home_milk" ? "🏠" : k === "animal_sale" ? "🐄" : "➕" }))} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field k="dy2_f_qty" lang={lang}><input name="qty" inputMode="decimal" placeholder="L" className={inputCls} /></Field>
            <Field k="dy2_f_rate" lang={lang}><input name="rate" inputMode="decimal" className={inputCls} /></Field>
            <Field k="dy2_f_amount" lang={lang}><AmountCalc className={`${inputCls} font-bold text-green-700 dark:text-green-300`} placeholder={L("dy2_f_amount_hint")} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field k="dy2_f_date" lang={lang}><input type="date" name="income_date" defaultValue={asOf} max={asOf} min={addDays(asOf, -400)} className={`${inputCls} dark:[color-scheme:dark]`} /></Field>
            <Field k="dy2_f_buyer" lang={lang}><input name="buyer" maxLength={80} className={inputCls} /></Field>
          </div>
          <Field k="dy2_f_animal_sale" lang={lang}>
            <select name="animal_id" className={inputCls}><option value="">—</option>{active.map((a) => <option key={a.id} value={a.id}>#{a.tag_no}{a.name ? ` · ${a.name}` : ""}</option>)}</select>
            <span className="text-[11px] font-normal text-surface-500">{L("dy2_mark_sold")}</span>
          </Field>
          <Field k="dy2_f_note" lang={lang}><input name="note" maxLength={300} className={inputCls} /></Field>
          <p className="rounded-xl border border-sky-300/50 bg-sky-50 p-3 text-xs text-surface-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-slate-200">🥛 {L("dy2_inc_sub")}</p>
          <div className="flex justify-end gap-2">
            <Link href="/portal/dairy/hisaab" className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-semibold text-surface-700 dark:border-surface-700 dark:text-slate-200">{L("dy_cancel")}</Link>
            <button className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700">✓ {L("dy2_save_inc")}</button>
          </div>
        </form>
      </Card>
      <Card className="pf-panel fit:p-3.5">
        <CardHead title={`${L("os2_history")} · ${L("dy2_income")}`} right={<b className="text-sm text-green-600 dark:text-green-400">{rs(total)}</b>} />
        <div className="pf-body">
          {recent.length === 0 && <p className="py-8 text-center text-sm text-surface-500">{L("dy2_none")}</p>}
          {recent.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 border-b border-surface-100 py-2.5 text-[13px] last:border-0 dark:border-surface-800">
              <div className="min-w-0">
                <b className="text-surface-900 dark:text-white">{L(`inc_${e.cat}` as TranslationKey)}</b>
                <p className="truncate text-xs text-surface-500 dark:text-slate-400">{e.date}{e.qty ? ` · ${e.qty}` : ""}{e.detail ? ` · ${e.detail}` : ""}</p>
              </div>
              <b className="shrink-0 text-green-600 dark:text-green-400">{rs(e.amount)}</b>
            </div>
          ))}
        </div>
      </Card>
      </div>
      <Footer lang={lang} />
    </div>
  );
}
