import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { SPECIES_EMOJI } from "@/lib/portal/dairy";
import { CALVING_EASE, EVENT_ICON, EVENT_TYPES, HEAT_SIGNS, PD_METHODS, PD_RESULTS, SEMEN_COMPANIES } from "@/lib/portal/breeding";
import { linkableVetExpenses, loadBreeding } from "@/lib/portal/breeding-load";
import { loadSuggestions } from "@/lib/portal/dairy-pl-load";
import { rs } from "@/lib/portal/dairy-pl";
import { Card, shortDate } from "@/components/portal/khata/khata-parts";
import { Footer, HeroBtn } from "@/components/portal/dairy/dairy-parts";
import { Field, Seg, inputCls } from "@/components/portal/dairy/form-parts";
import { BErrorNote, BHero, H3, Pill, TLItem } from "@/components/portal/breeding/breed-parts";
import { BreedPicker } from "@/components/portal/breeding/breed-preview";
import { LinkCost } from "@/components/portal/breeding/link-cost";
import { addBreedingAction, addCalvingAction } from "../actions";

export const dynamic = "force-dynamic";
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_UR = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"];

export default async function NewBreeding({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const yr = Number(asOf.slice(0, 4));
  const type = (EVENT_TYPES as readonly string[]).includes(searchParams?.type ?? "") ? searchParams!.type! : "ai";
  const [{ animals }, { events, repro }, shop, existing] = await Promise.all([loadDairy(asOf, 1), loadBreeding({ from: undefined }), loadSuggestions(), linkableVetExpenses()]);
  const females = animals.filter((a) => a.sex === "F" && a.status !== "sold" && a.status !== "dead" && (type !== "calving" || a.status !== "calf"));
  const pool = type === "natural" ? animals.filter((a) => a.status !== "sold" && a.status !== "dead" && a.sex === "F") : females;
  const animal = pool.some((a) => a.id === searchParams?.animal) ? searchParams!.animal! : "";
  const sel = animals.find((a) => a.id === animal);
  const r = repro.find((x) => x.animal_id === animal);
  const services = events.filter((e) => e.animal_id === animal && (e.event_type === "ai" || e.event_type === "natural")).sort((a, b) => (a.event_date < b.event_date ? 1 : -1));
  const history = events.filter((e) => e.animal_id === animal).sort((a, b) => (a.event_date < b.event_date ? 1 : -1)).slice(0, 6);
  const dd = (x: string | null) => (x ? shortDate(x, lang, yr) : "—");
  const base = `/portal/dairy/breeding/new?type=${type}`;
  const tabs = EVENT_TYPES.map((k) => ({ k, href: `/portal/dairy/breeding/new?type=${k}${animal ? `&animal=${animal}` : ""}` }));
  const costFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field k="bh_f_cost" lang={lang}><input name="cost" inputMode="decimal" placeholder="0" className={inputCls} /></Field>
      <Field k="bh_f_payment" lang={lang}><Seg name="payment" value="cash" lang={lang} options={[{ v: "cash", k: "bh_pay_cash" }, { v: "udhaar", k: "bh_pay_udhaar" }, { v: "bank", k: "bh_pay_bank" }]} /></Field>
    </div>
  );
  const serviceSelect = (required: boolean) => (
    <Field k="bh_f_service" lang={lang}>
      <select name="service_id" required={required} defaultValue={(type === "pd" ? r?.last_service_id : r?.preg_service_id ?? r?.last_service_id) ?? services[0]?.id ?? ""} className={inputCls}>
        {!required && <option value="">{L("bh_f_service_none")}</option>}
        {services.map((s) => <option key={s.id} value={s.id}>{s.event_type === "ai" ? "AI" : L("bh_ev_natural")} · {dd(s.event_date)} · {s.bull_name ?? ""}</option>)}
      </select>
    </Field>
  );

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <BHero title={<>➕ {L("bh_new_title")} {lang !== "ur" && <>· <span dir="rtl">{t("bh_new_title", "ur")}</span></>}</>} sub={L("bh_new_sub")}>
        <HeroBtn href="/portal/dairy/breeding">← {L("bh_back")}</HeroBtn>
      </BHero>
      <BErrorNote e={searchParams?.e} lang={lang} />
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map((x) => (
          <Link key={x.k} href={x.href} role="tab" aria-selected={x.k === type} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${x.k === type ? "border-green-600 bg-green-600 text-white" : "border-surface-200 bg-white text-surface-700 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-200"}`}>
            {EVENT_ICON[x.k]} {L(`bh_ty_${x.k}` as TranslationKey)}
          </Link>
        ))}
      </div>
      <form action={type === "calving" ? addCalvingAction : addBreedingAction} className="pf-grow pf-grid grid gap-4 lg:grid-cols-[1.5fr_1fr] fit:gap-2.5">
        <input type="hidden" name="event_type" value={type} />
        <Card className="pf-scroll fit:p-3.5">
          <H3 k={`bh_ty_${type}` as TranslationKey} lang={lang} />
          <div className="grid gap-3.5">
            <BreedPicker animals={pool.map((a) => ({ id: a.id, species: a.species, label: `${SPECIES_EMOJI[a.species]} #${a.tag_no} ${a.name ?? ""} · ${L(`st_${a.status}` as TranslationKey)}` }))}
              animal={animal} date={asOf} max={asOf} inputCls={inputCls} basePath={base} showPreview={type === "ai" || type === "natural"}
              labels={{ animal: L("bh_f_animal"), date: L("bh_f_date"), pick: L("bh_f_pick"), title: L("bh_pv_title"), heat: L("bh_pv_heat"), pd: L("bh_pv_pd"), dry: L("bh_pv_dry"), calving: L("bh_pv_calving"), days: L("bh_days"), mon: lang === "ur" ? MON_UR : MON_EN }} />
            {type === "heat" && <>
              <Field k="bh_f_time" lang={lang}><input type="time" name="event_time" className={inputCls} /></Field>
              <Field k="bh_signs" lang={lang}>
                <div className="flex flex-wrap gap-1.5">{HEAT_SIGNS.map((s) => (
                  <label key={s} className="cursor-pointer"><input type="checkbox" name="heat_signs" value={s} className="peer sr-only" /><span className="block rounded-full border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-700 peer-checked:border-rose-500 peer-checked:bg-rose-500 peer-checked:text-white dark:border-surface-700 dark:text-slate-200">{L(`bh_sign_${s}` as TranslationKey)}</span></label>
                ))}</div>
              </Field>
              <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-surface-700 dark:text-slate-200">💡 {L("bh_heat_tip")}</p>
            </>}
            {(type === "ai" || type === "natural") && <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field k="bh_f_semen_breed" lang={lang}><input name="semen_breed" placeholder="Sahiwal / Nili-Ravi / HF" className={inputCls} /></Field>
                <Field k="bh_f_bull" lang={lang}><input name="bull_name" required={type === "ai"} placeholder={type === "ai" ? "SPU-4410" : L("bh_f_bull_ph")} className={inputCls} /></Field>
              </div>
              {type === "ai" && <div className="grid gap-3 sm:grid-cols-2">
                <Field k="bh_f_company" lang={lang}><select name="semen_company" className={inputCls}><option value="">—</option>{SEMEN_COMPANIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field k="bh_f_straw" lang={lang}><input name="straw_no" className={inputCls} /></Field>
                <Field k="bh_f_tech" lang={lang}><input name="technician" className={inputCls} /></Field>
                <Field k="bh_f_tech_phone" lang={lang}><input name="technician_phone" inputMode="tel" placeholder="03xx-xxxxxxx" className={inputCls} /></Field>
              </div>}
              {type === "ai" && <label className="flex items-center gap-2 text-[13px] text-surface-800 dark:text-slate-200"><input type="checkbox" name="sexed" value="1" /> {L("bh_f_sexed")}</label>}
              {costFields}
            </>}
            {type === "pd" && <>
              {serviceSelect(true)}
              <Field k="bh_f_pd_result" lang={lang}><Seg name="pd_result" value="positive" lang={lang} options={PD_RESULTS.map((p) => ({ v: p, k: `bh_pd_${p}` as TranslationKey }))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field k="bh_f_pd_method" lang={lang}><select name="pd_method" className={inputCls}>{PD_METHODS.map((m) => <option key={m} value={m}>{L(`bh_pdm_${m}` as TranslationKey)}</option>)}</select></Field>
                <Field k="bh_f_tech" lang={lang}><input name="technician" className={inputCls} /></Field>
              </div>
              {costFields}
            </>}
            {type === "calving" && <>
              {serviceSelect(false)}
              <Field k="bh_f_ease" lang={lang}><Seg name="calving_ease" value="easy" lang={lang} options={CALVING_EASE.map((p) => ({ v: p, k: `bh_ease_${p}` as TranslationKey }))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field k="bh_f_calf_alive" lang={lang}><Seg name="calf_alive" value="1" lang={lang} options={[{ v: "1", k: "bh_alive" }, { v: "0", k: "bh_calf_dead" }]} /></Field>
                <Field k="bh_f_calf_sex" lang={lang}><Seg name="calf_sex" value="F" lang={lang} options={[{ v: "F", k: "bh_calf_f" }, { v: "M", k: "bh_calf_m" }]} /></Field>
                <Field k="bh_f_calf_tag" lang={lang}><input name="calf_tag" placeholder="133" className={inputCls} /></Field>
                <Field k="bh_f_calf_name" lang={lang}><input name="calf_name" className={inputCls} /></Field>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-surface-800 dark:text-slate-200"><input type="checkbox" name="twins" value="1" /> {L("bh_f_twins")}</label>
              <p className="rounded-xl bg-violet-500/10 p-3 text-xs text-surface-700 dark:text-slate-200">🍼 {L("bh_calving_tip")}</p>
            </>}
            {(type === "dry_off" || type === "abortion") && <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-surface-700 dark:text-slate-200">{L(type === "dry_off" ? "bh_dry_tip" : "bh_abort_tip")}</p>}
            <Field k="bh_f_notes" lang={lang}><textarea name="notes" rows={2} maxLength={300} className={inputCls} /></Field>
            <div className="flex gap-2">
              <button className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">✓ {L("bh_save")}</button>
              <Link href={animal ? `/portal/dairy/breeding/animal/${animal}` : "/portal/dairy/breeding"} className="rounded-xl border border-surface-200 px-5 py-2.5 text-sm font-semibold text-surface-700 dark:border-surface-700 dark:text-slate-200">{L("bh_cancel")}</Link>
            </div>
          </div>
        </Card>
        <div className="pf-scroll grid content-start gap-4 fit:gap-2.5">
          <Card className="fit:p-3.5">
            <H3 k="bh_hist_title" lang={lang} right={sel ? <Pill tone="slate">#{sel.tag_no} {sel.name ?? ""}</Pill> : undefined} />
            {!sel && <p className="py-4 text-center text-sm text-surface-500">{L("bh_hist_pick")}</p>}
            {sel && history.length === 0 && <p className="py-4 text-center text-sm text-surface-500">{L("bh_tl_empty")}</p>}
            {sel && history.length > 0 && (
              <div className="relative ps-6 before:absolute before:bottom-1.5 before:start-[9px] before:top-1.5 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-800">
                {history.map((e) => <TLItem key={e.id} color={e.event_type === "pd" ? "#0ea5e9" : e.event_type === "heat" ? "#f43f5e" : "#6366f1"} date={dd(e.event_date)} title={`${EVENT_ICON[e.event_type]} ${L(`bh_ty_${e.event_type}` as TranslationKey)}${e.bull_name ? ` · ${e.bull_name}` : ""}${e.pd_result ? ` · ${L(`bh_pd_${e.pd_result}` as TranslationKey)}` : ""}`} sub={e.cost ? rs(e.cost) : undefined} />)}
              </div>
            )}
            {r?.repeat_breeder && <p className="mt-2 rounded-xl border border-dashed border-violet-400 p-2.5 text-xs text-surface-700 dark:text-slate-200">💡 {L("bh_munshi_repeat")}</p>}
          </Card>
          {(type === "ai" || type === "natural" || type === "pd") && <LinkCost shop={shop} existing={existing} lang={lang} />}
        </div>
      </form>
      <Footer lang={lang} />
    </div>
  );
}
