import { createClient } from "@/lib/supabase/server";
import { addTraining } from "@/actions/hr-kpi";
import { TRAINING_TYPES, TRAINING_LABEL } from "@/lib/hr-kpi/core";
import { aajKaKhana } from "@/lib/utils/format";
import { Flash, Field, HrSubHeader, NoAccess, btnCls, cardCls, inputCls, requireHr, staffOptions } from "@/components/hr-kpi/hr-form-bits";

export const dynamic = "force-dynamic";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export default async function TrainingPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  if (!(await requireHr())) return <NoAccess />;
  const db = createClient() as unknown as Db;
  const [staff, { data }] = await Promise.all([
    staffOptions(),
    db.from("hr_training_records").select("id,profile_id,training_type,title,training_date,hours,cost").order("training_date", { ascending: false }).limit(100),
  ]);
  const name = new Map(staff.map((s) => [s.id, s.name]));
  const rows = (data ?? []) as { id: string; profile_id: string; training_type: keyof typeof TRAINING_LABEL; title: string; training_date: string; hours: number; cost: number }[];
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <HrSubHeader title="Training & Development" sub="Har training ka record: staff, qism, tareekh, ghante, kharcha" />
      <Flash sp={searchParams} />
      <form action={addTraining} className={`${cardCls} grid gap-3 sm:grid-cols-3`}>
        <Field label="Staff"><select name="profile_id" required className={inputCls}><option value="">Chunein</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Qism"><select name="training_type" required className={inputCls}>{TRAINING_TYPES.map((t) => <option key={t} value={t}>{TRAINING_LABEL[t]}</option>)}</select></Field>
        <Field label="Training ka naam"><input name="title" required minLength={2} maxLength={200} className={inputCls} /></Field>
        <Field label="Tareekh"><input type="date" name="training_date" required max={aajKaKhana()} defaultValue={aajKaKhana()} className={inputCls} /></Field>
        <Field label="Ghante"><input type="number" name="hours" required min={0.5} max={500} step={0.5} className={inputCls} /></Field>
        <Field label="Kharcha (Rs)"><input type="number" name="cost" min={0} step={1} defaultValue={0} className={inputCls} /></Field>
        <div className="sm:col-span-3"><button className={btnCls}>Darj karein</button></div>
      </form>
      <div className={cardCls}>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-500"><th>Tareekh</th><th>Staff</th><th>Qism</th><th>Naam</th><th className="text-right">Ghante</th><th className="text-right">Kharcha</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800"><td className="py-1.5">{r.training_date}</td><td>{name.get(r.profile_id) ?? "—"}</td><td>{TRAINING_LABEL[r.training_type]}</td><td>{r.title}</td><td className="text-right">{r.hours}</td><td className="text-right">Rs {Number(r.cost).toLocaleString("en-PK")}</td></tr>)}</tbody>
          </table>
        ) : <p className="py-6 text-center text-sm text-surface-400">Abhi koi training darj nahi.</p>}
      </div>
    </div>
  );
}
