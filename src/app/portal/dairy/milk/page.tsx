import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { addDays, r1, sortByTag, validateDate } from "@/lib/portal/dairy";
import { Card, longDate } from "@/components/portal/khata/khata-parts";
import { Footer, Hero, TagChip, Tabs, Tri, fmtL } from "@/components/portal/dairy/dairy-parts";
import { Field, Seg, inputCls } from "@/components/portal/dairy/form-parts";
import { bulkMilkAction, singleMilkAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function MilkEntry({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const date = searchParams?.d && validateDate(searchParams.d, asOf) ? searchParams.d : asOf;
  const shift = searchParams?.s === "pm" ? "pm" : searchParams?.s === "am" ? "am" : Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", hour: "numeric", hour12: false }).format(new Date())) >= 13 ? "pm" : "am";
  const { animals, yields, collection } = await loadDairy(asOf, 61);
  const milking = sortByTag(animals.filter((a) => a.status === "milking" || a.status === "pregnant"));
  const prev = addDays(date, -1);
  const get = (id: string, d: string) => yields.find((y) => y.animal_id === id && y.yield_date === d && y.shift === shift)?.liters;
  const homeShift = r1(milking.reduce((s, a) => s + (get(a.id, date) ?? 0), 0));
  const centre = collection.find((c) => c.date === date);
  const centreShift = centre ? (shift === "am" ? centre.am : centre.pm) : 0;
  const sel = searchParams?.a && animals.some((a) => a.id === searchParams.a) ? searchParams.a : milking[0]?.id;
  const sh = (s: string) => `/portal/dairy/milk?d=${date}&s=${s}${searchParams?.a ? `&a=${searchParams.a}` : ""}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <Hero title={<>🥛 {L("dy_milk_title")}</>} sub={`${longDate(date, lang)} · ${L("dy_milk_sub")}`}>
        <form className="flex items-center gap-2"><input type="hidden" name="s" value={shift} />
          <input type="date" name="d" defaultValue={date} max={asOf} min={addDays(asOf, -60)} className="rounded-xl border border-white/35 bg-white/15 px-3 py-2 text-sm text-white [color-scheme:dark]" />
          <button className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-green-900">↻</button>
        </form>
      </Hero>
      {searchParams?.n && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{searchParams.n} {L("dy_saved_n")}</p>}
      {searchParams?.ok && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{L("dy_saved")}</p>}
      {searchParams?.e && <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">{L((searchParams.e.startsWith("dy_err_") ? searchParams.e : "dy_err_generic") as TranslationKey)}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <form action={bulkMilkAction}>
            <input type="hidden" name="date" value={date} /><input type="hidden" name="shift" value={shift} />
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_bulk_title" lang={lang} /></h3>
              <Tabs items={[{ href: sh("am"), label: `☀️ ${L("dy_morning")}`, on: shift === "am" }, { href: sh("pm"), label: `🌙 ${L("dy_evening")}`, on: shift === "pm" }]} />
            </div>
            {milking.length === 0 ? (
              <p className="py-8 text-center text-sm text-surface-500">{L("dy_no_milking")} <Link className="font-semibold text-green-700 underline" href="/portal/dairy/animals/new">{L("dy_btn_add")}</Link></p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {milking.map((a) => {
                  const cur = get(a.id, date), y = get(a.id, prev);
                  return (
                    <label key={a.id} className="grid gap-1.5 rounded-2xl border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800">
                      <span className="flex items-center justify-between gap-1 text-sm"><b className="truncate text-surface-900 dark:text-white">{a.name ?? "—"}</b><TagChip tag={a.tag_no} /></span>
                      <input name={`l_${a.id}`} inputMode="decimal" defaultValue={cur ?? ""} placeholder={y !== undefined ? String(y) : "0.0"}
                        className="w-full rounded-xl border border-surface-200 bg-white px-2 py-2 text-center text-lg font-extrabold text-surface-900 outline-none focus:border-green-500 dark:border-surface-600 dark:bg-surface-900 dark:text-white" />
                      <span className="text-[11px] text-surface-500 dark:text-slate-400">{L("dy_yesterday")}: {y !== undefined ? `${y} L` : "—"}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-surface-700 dark:text-slate-200">{L("dy_d_total")} {shift === "am" ? L("dy_morning") : L("dy_evening")}: <b className="text-lg text-surface-900 dark:text-white">{fmtL(homeShift)}</b> · {milking.length} {L("dy_animals_word")}</span>
              <div className="flex gap-2.5">
                <Link href="/portal/dairy" className="rounded-xl border border-surface-200 px-4 py-2.5 text-sm font-semibold text-surface-800 dark:border-surface-700 dark:text-slate-100">{L("dy_cancel")}</Link>
                <button disabled={!milking.length} className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">✓ {L("dy_bulk_save")} ({milking.length})</button>
              </div>
            </div>
          </form>
        </Card>
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_single_title" lang={lang} /></h3>
            <form action={singleMilkAction} className="grid gap-3">
              <Field k="dy_f_animal" lang={lang}><select name="animal_id" defaultValue={sel} required className={inputCls}>{milking.map((a) => <option key={a.id} value={a.id}>#{a.tag_no} {a.name ?? ""}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field k="dy_d_date" lang={lang}><input type="date" name="date" defaultValue={date} max={asOf} min={addDays(asOf, -60)} className={inputCls} /></Field>
                <Field k="dy_f_shift" lang={lang}><Seg name="shift" value={shift} lang={lang} options={[{ v: "am", k: "dy_morning" }, { v: "pm", k: "dy_evening" }]} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field k="dy_f_litres" lang={lang}><input name="liters" required inputMode="decimal" placeholder="7.0" className={inputCls} /></Field>
                <Field k="dy_f_fat" lang={lang}><input name="fat" inputMode="decimal" placeholder="4.1" className={inputCls} /></Field>
              </div>
              <label className="flex items-start gap-2 text-[13px] font-semibold text-surface-800 dark:text-slate-100"><input type="checkbox" name="withheld" value="1" className="mt-1" /><Tri k="dy_f_withheld" lang={lang} /></label>
              <button disabled={!milking.length} className="rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">✓ {L("dy_save")}</button>
            </form>
          </Card>
          <div className="rounded-2xl border border-sky-300/50 bg-sky-50 p-4 text-xs text-surface-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-slate-200">
            🔗 {L("dy_centre_today")}: <b>{fmtL(centreShift)}</b> · {L("dy_home_record")}: <b>{fmtL(homeShift)}</b>. {L("dy_erp_readonly")}
          </div>
        </div>
      </div>
      <Footer lang={lang} />
    </div>
  );
}
