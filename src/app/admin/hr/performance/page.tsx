import { createClient } from "@/lib/supabase/server";
import { addReview, decideReview } from "@/actions/hr-kpi";
import { RATINGS, RATING_LABEL } from "@/lib/hr-kpi/core";
import { aajKaKhana } from "@/lib/utils/format";
import { Flash, Field, HrSubHeader, NoAccess, btnCls, cardCls, inputCls, requireHr, staffOptions } from "@/components/hr-kpi/hr-form-bits";

export const dynamic = "force-dynamic";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export default async function PerformancePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const access = await requireHr();
  if (!access) return <NoAccess />;
  const db = createClient() as unknown as Db;
  const [staff, { data }, { data: profs }] = await Promise.all([
    staffOptions(),
    db.from("hr_performance_reviews").select("id,profile_id,period_month,rating,comment,status,reviewed_by,decided_by").order("period_month", { ascending: false }).limit(200),
    db.from("profiles").select("id,full_name"),
  ]);
  const name = new Map(((profs ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const rows = (data ?? []) as { id: string; profile_id: string; period_month: string; rating: keyof typeof RATING_LABEL; comment: string | null; status: string; reviewed_by: string; decided_by: string | null }[];
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <HrSubHeader title="Performance Reviews" sub="Mahana rating. Maker-checker: review karne wala khud manzoor nahi kar sakta." />
      <Flash sp={searchParams} />
      <form action={addReview} className={`${cardCls} grid gap-3 sm:grid-cols-4`}>
        <Field label="Staff"><select name="profile_id" required className={inputCls}><option value="">Chunein</option>{staff.filter((s) => s.id !== access.me).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Mahina"><input type="month" name="period_month" required defaultValue={aajKaKhana().slice(0, 7)} className={inputCls} /></Field>
        <Field label="Rating"><select name="rating" required className={inputCls}>{RATINGS.map((r) => <option key={r} value={r}>{RATING_LABEL[r]}</option>)}</select></Field>
        <Field label="Tabsara"><input name="comment" maxLength={500} className={inputCls} /></Field>
        <div className="sm:col-span-4"><button className={btnCls}>Manzoori ke liye bhejein</button></div>
      </form>
      <div className={cardCls}>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-500"><th>Mahina</th><th>Staff</th><th>Rating</th><th>Review by</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="py-1.5">{r.period_month.slice(0, 7)}</td><td>{name.get(r.profile_id) ?? "—"}</td><td>{RATING_LABEL[r.rating]}</td><td>{name.get(r.reviewed_by) ?? "—"}</td><td className="capitalize">{r.status}</td>
                  <td className="text-right">
                    {r.status === "pending" && r.reviewed_by !== access.me && r.profile_id !== access.me ? (
                      <form action={decideReview} className="inline-flex gap-1"><input type="hidden" name="id" value={r.id} /><button name="decision" value="approved" className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Manzoor</button><button name="decision" value="rejected" className="rounded bg-red-600 px-2 py-1 text-xs text-white">Rad</button></form>
                    ) : r.status === "pending" ? <span className="text-xs text-surface-400">Doosra manzoor karega</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="py-6 text-center text-sm text-surface-400">Abhi koi review nahi.</p>}
      </div>
    </div>
  );
}
