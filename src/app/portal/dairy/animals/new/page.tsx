import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { dairyContext, loadDairy, loadFarms, todayPk } from "@/lib/portal/dairy-load";
import { ACTIVE_STATUSES, BREEDS, nextTag, sortByTag } from "@/lib/portal/dairy";
import { Card } from "@/components/portal/khata/khata-parts";
import { Footer, Hero, Tri } from "@/components/portal/dairy/dairy-parts";
import { Field, Seg, inputCls } from "@/components/portal/dairy/form-parts";
import { PhotoPicker } from "@/components/portal/dairy/photo-picker";
import { ErrorNote } from "@/components/portal/dairy/dairy-parts";
import { addAnimalAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewAnimal({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const asOf = todayPk();
  const [ctx, { animals }, farms] = await Promise.all([dairyContext(), loadDairy(asOf, 1), loadFarms()]);
  const tag = nextTag(animals);
  const females = sortByTag(animals.filter((a) => a.sex === "F" && a.status !== "sold" && a.status !== "dead"));
  const herd = (ctx?.farmer?.cow_count ?? 0) + (ctx?.farmer?.buffalo_count ?? 0);
  const err = searchParams?.e;

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      <Hero title={<>➕ {L("dy_add_title")}</>} sub={L("dy_add_sub")} />
      <ErrorNote e={err} lang={lang} />
      <form action={addAnimalAction} className="pf-grow pf-grid grid gap-4 lg:grid-cols-[1.6fr_1fr] fit:gap-2.5">
        <Card className="pf-scroll space-y-4 fit:p-3.5">
          <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_add_details" lang={lang} /></h3>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field k="dy_f_tag" lang={lang}><input name="tag_no" required maxLength={30} defaultValue={tag} className={inputCls} /></Field>
            <Field k="dy_f_rfid" lang={lang}><input name="rfid_tag" maxLength={40} placeholder="9820-0041-…" className={inputCls} /></Field>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field k="dy_f_name" lang={lang}><input name="name" maxLength={60} className={inputCls} /></Field>
            <Field k="dy_f_species" lang={lang}><Seg name="species" value="cow" lang={lang} options={[{ v: "cow", k: "sp_cow", icon: "🐄" }, { v: "buffalo", k: "sp_buffalo", icon: "🐃" }, { v: "goat", k: "sp_goat", icon: "🐐" }]} /></Field>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field k="dy_f_breed" lang={lang}><select name="breed" defaultValue="Sahiwal" className={inputCls}>{BREEDS.map((b) => <option key={b}>{b}</option>)}</select></Field>
            <Field k="dy_f_sex" lang={lang}><Seg name="sex" value="F" lang={lang} options={[{ v: "F", k: "sx_F" }, { v: "M", k: "sx_M" }]} /></Field>
            <Field k="dy_f_dob" lang={lang}><input type="date" name="dob" max={asOf} className={inputCls} /></Field>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field k="dy_f_status" lang={lang}><select name="status" defaultValue="milking" className={inputCls}>{ACTIVE_STATUSES.map((s) => <option key={s} value={s}>{L(`st_${s}` as TranslationKey)}</option>)}</select></Field>
            <Field k="dy_f_dam" lang={lang}><select name="dam_id" defaultValue="" className={inputCls}><option value="">{L("dy_f_none")}</option>{females.map((a) => <option key={a.id} value={a.id}>#{a.tag_no} {a.name ?? ""}</option>)}</select></Field>
            <Field k="dy_f_source" lang={lang}><select name="source" defaultValue="born" className={inputCls}><option value="born">{L("src_born")}</option><option value="purchased">{L("src_purchased")}</option></select></Field>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field k="dy_f_price" lang={lang}><input name="purchase_price" inputMode="numeric" placeholder="2,40,000" className={inputCls} /></Field>
            <Field k="dy_f_farm" lang={lang}><select name="farm_id" defaultValue={farms[0]?.id ?? ""} className={inputCls}><option value="">{L("dy_f_none")}</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
          </div>
          <div className="flex justify-end gap-2.5">
            <Link href="/portal/dairy/animals" className="rounded-xl border border-surface-200 px-4 py-2.5 text-sm font-semibold text-surface-800 dark:border-surface-700 dark:text-slate-100">{L("dy_cancel")}</Link>
            <button className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">✓ {L("dy_save_animal")}</button>
          </div>
        </Card>
        <div className="pf-scroll space-y-4 fit:space-y-2.5">
          <Card className="fit:p-3.5">
            <h3 className="mb-3 text-[15px] font-semibold text-surface-900 dark:text-white"><Tri k="dy_photo" lang={lang} /></h3>
            <PhotoPicker title={L("dy2_photo_new")} hint={L("dy2_photo_hint")} shrunkWord={L("dy2_photo_shrunk")} />
            <p className="mt-2 text-[11px] text-surface-500 dark:text-slate-400">🔒 {L("dy2_photo_private")}</p>
          </Card>
          <Card className="space-y-3 fit:p-3.5">
            <div className="rounded-xl border border-dashed border-violet-400 bg-violet-500/5 p-3 text-xs text-surface-700 dark:text-slate-200">🧬 {L("dy_hook_p4")}</div>
            <div className="rounded-xl border border-sky-300/50 bg-sky-50 p-3 text-xs text-surface-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-slate-200">
              💡 {L("dy_hint_count").replace("{n}", String(herd)).replace("{k}", String(animals.length)).replace("{t}", tag)}
            </div>
          </Card>
        </div>
      </form>
      <Footer lang={lang} />
    </div>
  );
}
