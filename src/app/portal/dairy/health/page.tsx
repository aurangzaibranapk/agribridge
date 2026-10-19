import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { SPECIES_EMOJI, addDays } from "@/lib/portal/dairy";
import { CORE_VACCINES, EVENT_COLOR, EVENT_ICON, HEALTH_KINDS, VACCINES, coveragePct, type HealthEvent } from "@/lib/portal/breeding";
import { linkableVetExpenses, loadBreeding, loadCoverage } from "@/lib/portal/breeding-load";
import { loadSuggestions } from "@/lib/portal/dairy-pl-load";
import { rs } from "@/lib/portal/dairy-pl";
import { Card, shortDate } from "@/components/portal/khata/khata-parts";
import { Footer, HeroBtn } from "@/components/portal/dairy/dairy-parts";
import { Field, Seg, inputCls } from "@/components/portal/dairy/form-parts";
import { Chips } from "@/components/portal/dairy/pl-parts";
import { BErrorNote, BHero, Bar, H3, Pill, Ring } from "@/components/portal/breeding/breed-parts";
import { LinkCost } from "@/components/portal/breeding/link-cost";
import { addHealthAction } from "../breeding/actions";

export const dynamic = "force-dynamic";
const RING: Record<string, string> = { FMD: "#14b8a6", HS: "#6366f1", LSD: "#f59e0b", BQ: "#e11d48" };

export default async function HealthPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const yr = Number(asOf.slice(0, 4));
  const kind = (HEALTH_KINDS as readonly string[]).includes(searchParams?.kind ?? "") ? searchParams!.kind! : "treatment";
  const f = (HEALTH_KINDS as readonly string[]).includes(searchParams?.f ?? "") ? searchParams!.f! : "all";
  const [{ animals }, { health }, cov, shop, existing] = await Promise.all([loadDairy(asOf, 1), loadBreeding({ from: addDays(asOf, -365) }), loadCoverage(), loadSuggestions(), linkableVetExpenses()]);
  const live = animals.filter((a) => a.status !== "sold" && a.status !== "dead");
  const tag = new Map(animals.map((a) => [a.id, a]));
  const dd = (x: string | null) => (x ? shortDate(x, lang, yr) : "—");
  const recent = health.filter((h) => f === "all" || h.kind === f).slice(0, 8);
  const byKind = HEALTH_KINDS.map((k) => ({ k, v: health.filter((h) => h.kind === k).reduce((s, h) => s + (h.cost ?? 0), 0) }));
  const yearTotal = byKind.reduce((s, x) => s + x.v, 0);
  const maxK = Math.max(1, ...byKind.map((x) => x.v));
  const who = (h: HealthEvent) => (h.animal_id ? `#${tag.get(h.animal_id)?.tag_no ?? "?"} ${tag.get(h.animal_id)?.name ?? ""}` : L("bh_herd_all"));
  const tabs = HEALTH_KINDS.map((k) => ({ k, href: `/portal/dairy/health?kind=${k}#new` }));

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <BHero title={<>💉 {L("bh_health_title")} {lang !== "ur" && <>· <span dir="rtl">{t("bh_health_title", "ur")}</span></>}</>} sub={L("bh_health_sub")}>
        <HeroBtn href="/portal/dairy/health?kind=vaccine#new" primary>💉 {L("bh_btn_vaccine")}</HeroBtn>
        <HeroBtn href="/portal/dairy/health?kind=treatment#new">💊 {L("bh_btn_treatment")}</HeroBtn>
        <HeroBtn href="/portal/dairy/breeding">🧬 {L("bh_dash_title")}</HeroBtn>
      </BHero>
      {searchParams?.ok && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{L("bh_saved")}</p>}
      <BErrorNote e={searchParams?.e} lang={lang} />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {CORE_VACCINES.map((code) => {
          const c = cov.find((x) => x.code === code);
          const pct = c ? coveragePct(c.covered, c.eligible) : null;
          const late = c?.next_due && c.next_due < asOf;
          return (
            <Card key={code}>
              <div className="flex items-center gap-3.5">
                <Ring pct={pct} color={RING[code]} />
                <div className="min-w-0">
                  <b className="text-[14px] text-surface-900 dark:text-white">{code} <span className="text-xs font-normal text-surface-500">{L(`bh_vx_${code}` as TranslationKey)}</span></b>
                  <p className="text-xs text-surface-500 dark:text-slate-400">{c ? `${Math.min(c.covered, c.eligible)}/${c.eligible} ${L("bh_animals")}` : "—"} · {L("bh_d_last")} {dd(c?.last_date ?? null)}</p>
                  <p className={`text-xs font-semibold ${late ? "text-rose-600 dark:text-rose-300" : "text-surface-600 dark:text-slate-300"}`}>{L("bh_next")}: {c?.next_due ? dd(c.next_due) : L("bh_never")}{late ? ` · ${L("bh_overdue")}` : ""}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <form action={addHealthAction} id="new" className="grid content-start gap-4">
          <Card>
            <H3 k="bh_h_new" lang={lang} />
            <div className="mb-3 flex flex-wrap gap-1.5">
              {tabs.map((x) => (
                <Link key={x.k} href={x.href} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${x.k === kind ? "border-green-600 bg-green-600 text-white" : "border-surface-200 text-surface-700 dark:border-surface-700 dark:text-slate-200"}`}>{EVENT_ICON[x.k]} {L(`bh_k_${x.k}` as TranslationKey)}</Link>
              ))}
            </div>
            <input type="hidden" name="kind" value={kind} />
            <div className="grid gap-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field k="bh_f_animal" lang={lang}>
                  <select name="animal_id" defaultValue={searchParams?.animal ?? ""} required={kind === "treatment"} className={inputCls}>
                    <option value="">{kind === "treatment" ? L("bh_f_pick") : `🐮 ${L("bh_herd_all")} (${live.length})`}</option>
                    {live.map((a) => <option key={a.id} value={a.id}>{SPECIES_EMOJI[a.species]} #{a.tag_no} {a.name ?? ""}</option>)}
                  </select>
                </Field>
                <Field k="bh_f_date" lang={lang}><input type="date" name="event_date" required max={asOf} defaultValue={asOf} className={inputCls} /></Field>
              </div>
              {kind === "vaccine" && (
                <Field k="bh_f_vaccine" lang={lang}><select name="vaccine_code" required className={inputCls}>{VACCINES.map((v) => <option key={v} value={v}>{v} — {L(`bh_vx_${v}` as TranslationKey)}</option>)}</select></Field>
              )}
              {kind === "treatment" && <Field k="bh_f_diagnosis" lang={lang}><input name="diagnosis" placeholder={L("bh_f_diagnosis_ph")} className={inputCls} /></Field>}
              {kind !== "vet_visit" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field k="bh_f_medicine" lang={lang}><input name="medicine" required={kind !== "vaccine"} placeholder={kind === "deworm" ? "Albendazole" : kind === "vaccine" ? "LDD" : "Oxytetracycline"} className={inputCls} /></Field>
                  <Field k="bh_f_dose" lang={lang}><input name="dose" placeholder="20 ml" className={inputCls} /></Field>
                  <Field k="bh_f_doses" lang={lang}><input name="doses" type="number" min={1} max={30} defaultValue={1} className={inputCls} /></Field>
                </div>
              )}
              {kind === "vet_visit" && <Field k="bh_f_diagnosis" lang={lang}><input name="diagnosis" className={inputCls} /></Field>}
              <div className="grid gap-3 sm:grid-cols-3">
                {kind !== "vet_visit" && <Field k="bh_f_withdrawal" lang={lang}><input name="withdrawal_days" type="number" min={0} max={60} defaultValue={kind === "treatment" ? 4 : 0} className={inputCls} /></Field>}
                <Field k="bh_f_vet" lang={lang}><input name="vet_name" className={inputCls} /></Field>
                <Field k="bh_f_next" lang={lang}><input name="next_due" type="date" className={inputCls} /></Field>
              </div>
              {kind === "treatment" && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-[12.5px] dark:border-rose-500/40 dark:bg-rose-500/10">
                  <b className="text-rose-700 dark:text-rose-200">🥛 {L("bh_wd_title")}</b>
                  <p className="mt-0.5 text-xs text-surface-600 dark:text-slate-300">{L("bh_wd_body")}</p>
                </div>
              )}
              {kind !== "treatment" && <p className="text-[11.5px] text-surface-500">{L(kind === "vaccine" ? "bh_next_auto" : kind === "deworm" ? "bh_next_deworm" : "bh_vet_tip")}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field k="bh_f_cost" lang={lang}><input name="cost" inputMode="decimal" placeholder="0" className={inputCls} /></Field>
                <Field k="bh_f_payment" lang={lang}><Seg name="payment" value="cash" lang={lang} options={[{ v: "cash", k: "bh_pay_cash" }, { v: "udhaar", k: "bh_pay_udhaar" }, { v: "bank", k: "bh_pay_bank" }]} /></Field>
              </div>
              <Field k="bh_f_notes" lang={lang}><textarea name="notes" rows={2} maxLength={300} className={inputCls} /></Field>
              <div><button className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">✓ {L("bh_save")}</button></div>
            </div>
          </Card>
          <LinkCost shop={shop} existing={existing} lang={lang} />
        </form>
        <div className="grid content-start gap-4">
          <Card>
            <H3 k="bh_h_recent" lang={lang} right={<Chips items={(["all", ...HEALTH_KINDS] as string[]).map((k) => ({ href: `/portal/dairy/health${k === "all" ? "" : `?f=${k}`}`, label: k === "all" ? L("bh_f_all") : L(`bh_k_${k}` as TranslationKey), on: f === k }))} />} />
            {recent.map((h) => (
              <div key={h.id} className="flex items-start gap-3 border-b border-surface-100 py-2.5 last:border-0 dark:border-surface-800">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base" style={{ background: `${EVENT_COLOR[h.kind]}22` }}>{EVENT_ICON[h.kind]}</span>
                <div className="min-w-0 flex-1">
                  <b className="text-[13px] text-surface-900 dark:text-white">{h.kind === "vaccine" ? `${h.vaccine_code} ${L("bh_vaccine")}` : h.medicine ?? L(`bh_k_${h.kind}` as TranslationKey)} · {who(h)}</b>
                  <p className="text-xs text-surface-500 dark:text-slate-400">{[dd(h.event_date), h.diagnosis, h.vet_name, h.cost ? rs(h.cost) : null].filter(Boolean).join(" · ")}</p>
                </div>
                {h.withdrawal_until && h.withdrawal_until >= asOf ? <Pill tone="rose">🥛 {dd(h.withdrawal_until)} {L("bh_until")}</Pill> : h.next_due ? <Pill tone={h.next_due < asOf ? "rose" : "teal"}>{L("bh_next")} {dd(h.next_due)}</Pill> : null}
              </div>
            ))}
            {recent.length === 0 && <p className="py-6 text-center text-sm text-surface-500">{L("bh_h_empty")}</p>}
          </Card>
          <Card>
            <H3 k="bh_h_cost" lang={lang} right={<b className="text-sm text-surface-900 dark:text-white">{rs(yearTotal)}</b>} />
            <div className="grid gap-2.5">
              {byKind.map((x) => (
                <div key={x.k} className="grid grid-cols-[110px_1fr_80px] items-center gap-2 text-[12.5px] text-surface-700 dark:text-slate-200">
                  <span>{EVENT_ICON[x.k]} {L(`bh_k_${x.k}` as TranslationKey)}</span><Bar pct={(x.v / maxK) * 100} color={EVENT_COLOR[x.k]} /><b className="text-right">{rs(x.v)}</b>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-surface-500 dark:text-slate-400">{L("bh_h_cost_note")}</p>
          </Card>
        </div>
      </div>
      <Footer lang={lang} />
    </div>
  );
}
