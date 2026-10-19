import Link from "next/link";
import { notFound } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadDairy, todayPk } from "@/lib/portal/dairy-load";
import { SPECIES_EMOJI, ageText, daysBetween, addDays } from "@/lib/portal/dairy";
import { EVENT_COLOR, EVENT_ICON, gestationDays, type BreedEvent, type HealthEvent } from "@/lib/portal/breeding";
import { healthEventIdsFor, loadBreeding } from "@/lib/portal/breeding-load";
import { signedUrls } from "@/lib/portal/dairy-pl-load";
import { rs } from "@/lib/portal/dairy-pl";
import { Card, shortDate } from "@/components/portal/khata/khata-parts";
import { Footer, HeroBtn, TagChip, Thumb } from "@/components/portal/dairy/dairy-parts";
import { BHero, H3, Pill, TLItem , BErrorNote } from "@/components/portal/breeding/breed-parts";
import { Chips } from "@/components/portal/dairy/pl-parts";
import { dryOffAction, voidBreedingAction } from "../../actions";

export const dynamic = "force-dynamic";

type Item = { id: string; kind: "breed" | "health"; date: string; color: string; title: string; sub: string };

export default async function BreedTimeline({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const yr = Number(asOf.slice(0, 4));
  const { animals, yields } = await loadDairy(asOf, 7);
  const a = animals.find((x) => x.id === params.id);
  if (!a) notFound(); // RLS: doosre ka janwar milta hi nahi
  const [{ events, health, repro }, inHerd] = await Promise.all([loadBreeding({ animalId: a.id }), healthEventIdsFor(a.id)]);
  const r = repro.find((x) => x.animal_id === a.id) ?? null;
  const myHealth = health.filter((h) => h.animal_id === a.id || inHerd.has(h.id));
  const dd = (x: string | null) => (x ? shortDate(x, lang, yr) : "—");
  const dam = a.dam_id ? animals.find((x) => x.id === a.dam_id) : null;
  const calves = animals.filter((x) => x.dam_id === a.id).sort((x, y) => ((x.dob ?? "") < (y.dob ?? "") ? -1 : 1));
  const mine = yields.filter((y) => y.animal_id === a.id);
  const lastDay = mine.reduce((m, y) => (y.yield_date > m ? y.yield_date : m), "");
  const todayL = lastDay ? mine.filter((y) => y.yield_date === lastDay).reduce((s, y) => s + y.liters, 0) : 0;
  const servicesLact = r?.services_lactation ?? 0;
  const g = gestationDays(a.species);
  const urls = await signedUrls([a.photo_thumb_path ?? a.photo_path]);
  const photo = urls[(a.photo_thumb_path ?? a.photo_path) ?? ""] ?? null;

  const bTitle = (e: BreedEvent) => {
    switch (e.event_type) {
      case "heat": return `${EVENT_ICON.heat} ${L("bh_ev_heat")}`;
      case "ai": case "natural": return `${EVENT_ICON.ai} ${e.event_type === "ai" ? "AI" : L("bh_ev_natural")} · ${e.semen_breed ?? ""} "${e.bull_name ?? ""}"`;
      case "pd": return `${EVENT_ICON.pd} PD ${e.pd_result === "positive" ? `${L("bh_pd_positive")} · ${L("bh_pd_confirmed")}` : e.pd_result === "negative" ? L("bh_pd_negative") : L("bh_pd_doubtful")}`;
      case "calving": return `${EVENT_ICON.calving} ${L("bh_ev_calving")}`;
      case "abortion": return `${EVENT_ICON.abortion} ${L("bh_ev_abortion")}`;
      case "dry_off": return `${EVENT_ICON.dry_off} ${L("bh_ev_dry")}`;
    }
  };
  const bSub = (e: BreedEvent) => {
    const calf = e.calf_animal_id ? animals.find((x) => x.id === e.calf_animal_id) : null;
    const parts: (string | null)[] =
      e.event_type === "heat" ? [e.heat_signs.length ? `${L("bh_signs")}: ${e.heat_signs.map((s) => L(`bh_sign_${s}` as TranslationKey)).join(", ")}` : null, e.notes]
      : e.event_type === "ai" || e.event_type === "natural" ? [e.semen_company ? `${L("bh_f_company")}: ${e.semen_company}` : null, e.straw_no ? `straw ${e.straw_no}` : null, e.technician ? `Tech: ${e.technician}` : null, e.cost ? rs(e.cost) : null, e.notes]
      : e.event_type === "pd" ? [e.technician, e.pd_method ? L(`bh_pdm_${e.pd_method}` as TranslationKey) : null, e.cost ? rs(e.cost) : null, e.notes]
      : e.event_type === "calving" ? [calf ? `${calf.sex === "F" ? L("bh_calf_f") : L("bh_calf_m")} #${calf.tag_no}${calf.name ? ` ${calf.name}` : ""}` : e.calf_alive === false ? L("bh_calf_dead") : null, e.calving_ease ? L(`bh_ease_${e.calving_ease}` as TranslationKey) : null, e.notes]
      : [e.notes];
    return parts.filter(Boolean).join(" · ");
  };
  const hTitle = (h: HealthEvent) => `${EVENT_ICON[h.kind]} ${h.kind === "vaccine" ? `${h.vaccine_code} ${L("bh_vaccine")}` : h.kind === "treatment" ? `${L("bh_k_treatment")} · ${h.medicine ?? ""}` : h.kind === "deworm" ? `${L("bh_k_deworm")} · ${h.medicine ?? ""}` : L("bh_k_vet_visit")}`;
  const hSub = (h: HealthEvent) => [h.vet_name, h.diagnosis, h.cost ? rs(h.cost) : null, h.withdrawal_until ? `${L("bh_milk_stop")} ${dd(h.withdrawal_until)}` : h.kind === "treatment" ? L("bh_no_withdrawal") : null, h.next_due ? `${L("bh_next")} ${dd(h.next_due)}` : null, h.animal_id ? null : L("bh_herd_event")].filter(Boolean).join(" · ");
  const f = ["breed", "health"].includes(searchParams?.f ?? "") ? searchParams!.f! : "all";
  let items: Item[] = [
    ...events.map((e) => ({ id: e.id, kind: "breed" as const, date: e.event_date, color: EVENT_COLOR[e.event_type], title: bTitle(e), sub: bSub(e) })),
    ...myHealth.map((h) => ({ id: h.id, kind: "health" as const, date: h.event_date, color: EVENT_COLOR[h.kind], title: hTitle(h), sub: hSub(h) })),
  ].sort((x, y) => (x.date < y.date ? 1 : -1));
  if (r?.pregnant && !r.dried && r.dry_off_due && r.dry_off_due <= addDays(asOf, 30) && a.status !== "dry")
    items.unshift({ id: "sys-dry", kind: "breed", date: r.dry_off_due, color: EVENT_COLOR.dry_off, title: L("bh_sys_dry"), sub: L("bh_sys_dry_sub") });
  if (f !== "all") items = items.filter((i) => i.kind === f);
  const pct = r?.pregnant && r.days_pregnant !== null ? Math.min(100, (r.days_pregnant / g) * 100) : 0;
  const dryLate = r?.pregnant && !r.dried && a.status !== "dry" && r.dry_off_due && r.dry_off_due < asOf ? daysBetween(r.dry_off_due, asOf) : 0;
  const statusBadge = r?.pregnant ? <Pill tone="violet">{L("bh_hs_pregnant")} · {r.days_pregnant} {L("bh_days")}</Pill> : r?.pd_pending ? <Pill tone="indigo">{L("bh_hs_pd")}</Pill> : <Pill tone="slate">{L(`st_${a.status}` as TranslationKey)}</Pill>;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <BHero title={<span className="flex flex-wrap items-center gap-2">{SPECIES_EMOJI[a.species]} #{a.tag_no} {a.name ?? ""} · {L("bh_tl_title")} {lang !== "ur" && <>· <span dir="rtl">{t("bh_tl_title", "ur")}</span></>}</span>}
        sub={[a.breed, `${ageText(a.dob, asOf)}`, `lactation ${a.lactation_no}`, r?.pregnant ? L("bh_hs_pregnant") : L(`st_${a.status}` as TranslationKey)].filter(Boolean).join(" · ")}>
        <HeroBtn href={`/portal/dairy/breeding/new?animal=${a.id}${r?.pd_pending ? "&type=pd" : r?.pregnant ? "&type=calving" : "&type=ai"}`} primary>➕ {L("bh_new_event")}</HeroBtn>
        <HeroBtn href={`/portal/dairy/animals/${a.id}`}>🐄 {L("bh_animal_page")}</HeroBtn>
      </BHero>
      {searchParams?.ok && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{L("bh_saved")}</p>}
      <BErrorNote e={searchParams?.e} lang={lang} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.7fr]">
        <Card>
          <div className="flex items-center gap-4">
            <Thumb url={photo} emoji={SPECIES_EMOJI[a.species]} size={92} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><TagChip tag={a.tag_no} /><b className="text-lg text-surface-900 dark:text-white">{a.name ?? "—"}</b>{statusBadge}</div>
              <p className="mt-1 text-xs text-surface-500 dark:text-slate-400">{[a.breed, L(`sp_${a.species}` as TranslationKey), a.dob ? `${L("bh_born")} ${dd(a.dob)}${a.dob_estimated ? ` (${L("bh_est")})` : ""}` : null, dam ? `${L("bh_mother")}: #${dam.tag_no} ${dam.name ?? ""}` : null, a.rfid_tag ? `RFID ${a.rfid_tag}` : null].filter(Boolean).join(" · ")}</p>
              <p className="text-xs text-surface-500 dark:text-slate-400">Lactation {a.lactation_no} · {L("bh_last_calving")} {dd(a.last_calving_date)}{r?.dim !== null && r?.dim !== undefined ? ` · DIM ${r.dim}` : ""}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {([["bh_kv_expected", r?.pregnant ? dd(r.expected_calving) : "—"], ["bh_kv_left", r?.pregnant && r.expected_calving ? String(daysBetween(asOf, r.expected_calving)) : "—"], ["bh_kv_milk", `${Math.round(todayL * 10) / 10} L`], ["bh_kv_ai", String(servicesLact)]] as [TranslationKey, string][]).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-surface-200 bg-surface-50 p-2.5 text-[11.5px] text-surface-500 dark:border-surface-700 dark:bg-surface-800/60 dark:text-slate-400">{L(k)}<b className="mt-0.5 block text-[15px] text-surface-900 dark:text-white">{v}</b></div>
            ))}
          </div>
          {r?.pregnant && r.preg_service_date && r.expected_calving && (
            <div className="mt-4">
              <b className="text-[13px] text-surface-900 dark:text-white">{L("bh_gest_title")}</b>
              <div className="relative mx-1 mt-7 h-3.5 rounded-full bg-surface-100 dark:bg-surface-800">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${pct}%` }} />
                {[(45 / g) * 100, ((g - 60) / g) * 100].map((p, i) => <span key={i} className="absolute top-0 h-full w-0.5 bg-white/80 dark:bg-surface-950/70" style={{ left: `${p}%` }} />)}
                <span className="absolute -top-6 whitespace-nowrap text-[10.5px] font-bold text-violet-600 dark:text-violet-300" style={{ left: `${pct}%`, transform: pct > 80 ? "translateX(-100%)" : "translateX(-50%)" }}>{L("bh_today")} · {L("bh_day")} {r.days_pregnant}/{g} ▼</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-[10.5px] text-surface-500 dark:text-slate-400">
                <span>AI<b className="block text-surface-800 dark:text-slate-200">{dd(r.preg_service_date)}</b></span>
                <span className="text-center">PD<b className="block text-surface-800 dark:text-slate-200">{dd(addDays(r.preg_service_date, 35))}</b></span>
                <span className="text-center">Dry-off<b className="block text-surface-800 dark:text-slate-200">{dd(r.dry_off_due)}</b></span>
                <span className="text-right">{L("bh_ev_calving")}<b className="block text-surface-800 dark:text-slate-200">{dd(r.expected_calving)}</b></span>
              </div>
            </div>
          )}
          {dryLate > 0 && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-[12.5px] dark:border-rose-500/40 dark:bg-rose-500/10">
              <b className="text-rose-700 dark:text-rose-200">⚠️ {L("bh_dry_late")} {dryLate} {L("bh_days_late")}</b>
              <p className="mt-1 text-xs text-surface-600 dark:text-slate-300">{L("bh_dry_late_body")}{todayL > 0 ? ` ${Math.round(todayL * 10) / 10} L/${L("bh_day")}.` : ""}</p>
              <form action={dryOffAction} className="mt-2"><input type="hidden" name="animal_id" value={a.id} /><button className="rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700">✓ {L("bh_dry_record")}</button></form>
            </div>
          )}
          <div className="mt-4 rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
            <H3 k="bh_family" lang={lang} />
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              {dam && <><Link href={`/portal/dairy/breeding/animal/${dam.id}`} className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-center dark:border-surface-700 dark:bg-surface-800">👵 #{dam.tag_no} {dam.name ?? ""}<div className="text-surface-500">{L("bh_mother")}</div></Link><span className="text-surface-400">→</span></>}
              <span className="rounded-xl border-2 border-violet-400 px-3 py-2 font-bold text-surface-900 dark:text-white">#{a.tag_no} {a.name ?? ""}</span>
              {calves.length > 0 && <span className="text-surface-400">→</span>}
              {calves.map((c) => (
                <Link key={c.id} href={`/portal/dairy/animals/${c.id}`} className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-center dark:border-surface-700 dark:bg-surface-800">{c.status === "calf" ? "🐣" : SPECIES_EMOJI[c.species]} #{c.tag_no} {c.name ?? ""}<div className="text-surface-500">{c.sex === "F" ? L("bh_calf_f") : L("bh_calf_m")} {c.dob ? dd(c.dob) : ""}{c.status === "sold" ? ` · ${L("st_sold")}` : ""}</div></Link>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <H3 k="bh_tl_all" lang={lang} right={<Chips items={(["all", "breed", "health"] as const).map((k) => ({ href: `/portal/dairy/breeding/animal/${a.id}${k === "all" ? "" : `?f=${k}`}`, label: L(`bh_f_${k}` as TranslationKey), on: f === k }))} />} />
          <div className="relative pl-6 before:absolute before:bottom-1.5 before:left-[9px] before:top-1.5 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-800">
            {items.map((i) => (
              <div key={i.id} className="group">
                <TLItem color={i.color} date={dd(i.date)} title={i.title} sub={i.sub} />
                {!i.id.startsWith("sys") && (
                  <details className="-mt-3 mb-2 text-[11px] text-surface-400 focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
                    <summary className="cursor-pointer select-none">{L("bh_void")}</summary>
                    <form action={voidBreedingAction} className="mt-1 flex gap-1.5">
                      <input type="hidden" name="id" value={i.id} /><input type="hidden" name="animal_id" value={a.id} /><input type="hidden" name="kind" value={i.kind} />
                      <input name="reason" required minLength={3} placeholder={L("bh_void_reason")} className="flex-1 rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900" />
                      <button className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-600">{L("bh_void_btn")}</button>
                    </form>
                  </details>
                )}
              </div>
            ))}
            {items.length === 0 && <p className="py-8 text-center text-sm text-surface-500">{L("bh_tl_empty")}</p>}
          </div>
        </Card>
      </div>
      <Footer lang={lang} />
    </div>
  );
}
