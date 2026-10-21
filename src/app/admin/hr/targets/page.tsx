import { createClient } from "@/lib/supabase/server";
import { addTarget, decideTarget, updateTargetActual } from "@/actions/hr-kpi";
import { aajKaKhana } from "@/lib/utils/format";
import { Flash, Field, HrSubHeader, NoAccess, btnCls, cardCls, inputCls, requireHr } from "@/components/hr-kpi/hr-form-bits";

export const dynamic = "force-dynamic";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export default async function TargetsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const access = await requireHr();
  if (!access) return <NoAccess />;
  const db = createClient() as unknown as Db;
  const [{ data: depts }, { data }] = await Promise.all([
    db.from("departments").select("key,label").eq("is_active", true).order("sort_order"),
    db.from("hr_department_targets").select("id,department_key,period_month,target_amount,actual_manual,status,created_by").order("period_month", { ascending: false }).limit(200),
  ]);
  const dl = (depts ?? []) as { key: string; label: string }[];
  const label = new Map(dl.map((d) => [d.key, d.label]));
  const rows = (data ?? []) as { id: string; department_key: string; period_month: string; target_amount: number; actual_manual: number | null; status: string; created_by: string }[];
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <HrSubHeader title="Department Targets" sub="Mahana target. Sales ka actual khud POS bikri se; baqi departments ka actual yahan darj karein." />
      <Flash sp={searchParams} />
      <form action={addTarget} className={`${cardCls} grid gap-3 sm:grid-cols-4`}>
        <Field label="Department"><select name="department_key" required className={inputCls}>{dl.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select></Field>
        <Field label="Mahina"><input type="month" name="period_month" required defaultValue={aajKaKhana().slice(0, 7)} className={inputCls} /></Field>
        <Field label="Target (Rs)"><input type="number" name="target_amount" required min={1} className={inputCls} /></Field>
        <Field label="Actual (sales ke ilawa)"><input type="number" name="actual_manual" min={0} className={inputCls} /></Field>
        <div className="sm:col-span-4"><button className={btnCls}>Manzoori ke liye bhejein</button></div>
      </form>
      <div className={cardCls}>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-500"><th>Mahina</th><th>Department</th><th className="text-right">Target</th><th>Actual</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="py-1.5">{r.period_month.slice(0, 7)}</td><td>{label.get(r.department_key) ?? r.department_key}</td>
                  <td className="text-right">Rs {Number(r.target_amount).toLocaleString("en-PK")}</td>
                  <td>
                    {r.department_key === "sales" ? <span className="text-xs text-surface-500">POS se khud</span> : (
                      <form action={updateTargetActual} className="flex gap-1"><input type="hidden" name="id" value={r.id} /><input type="number" name="actual_manual" min={0} defaultValue={r.actual_manual ?? ""} className="w-28 rounded border border-surface-200 px-1 py-0.5 text-xs dark:border-surface-700 dark:bg-surface-900" /><button className="rounded bg-surface-200 px-2 text-xs dark:bg-surface-700">Save</button></form>
                    )}
                  </td>
                  <td className="capitalize">{r.status}</td>
                  <td className="text-right">
                    {r.status === "pending" && r.created_by !== access.me ? (
                      <form action={decideTarget} className="inline-flex gap-1"><input type="hidden" name="id" value={r.id} /><button name="decision" value="approved" className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Manzoor</button><button name="decision" value="rejected" className="rounded bg-red-600 px-2 py-1 text-xs text-white">Rad</button></form>
                    ) : r.status === "pending" ? <span className="text-xs text-surface-400">Doosra manzoor karega</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="py-6 text-center text-sm text-surface-400">Abhi koi target nahi.</p>}
      </div>
    </div>
  );
}
