import { createClient } from "@/lib/supabase/server";
import { saveJoinExit } from "@/actions/hr-kpi";
import { EXIT_REASONS, EXIT_REASON_LABEL, GENDERS } from "@/lib/hr-kpi/core";
import { Flash, HrSubHeader, NoAccess, cardCls, requireHr } from "@/components/hr-kpi/hr-form-bits";

export const dynamic = "force-dynamic";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };
const sm = "rounded border border-surface-200 px-1.5 py-1 text-xs dark:border-surface-700 dark:bg-surface-900";

export default async function JoiningExitPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  if (!(await requireHr())) return <NoAccess />;
  const db = createClient() as unknown as Db;
  const { data } = await db.from("staff_details").select("id,profile_id,gender,hire_date,exit_date,exit_reason,designation,profiles!staff_details_profile_id_fkey(full_name)");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).sort((a, b) => String(a.profiles?.full_name).localeCompare(String(b.profiles?.full_name)));
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <HrSubHeader title="Joining / Exit" sub="Gender, joining date, aur chhorne ki tareekh/wajah. Headcount, new hires aur attrition isi se bante hain. Har tabdeeli audit mein." />
      <Flash sp={searchParams} />
      <div className={`${cardCls} overflow-x-auto`}>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-500"><th>Staff</th><th>Gender</th><th>Joining</th><th>Exit</th><th>Wajah</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="py-1.5 pr-2">{r.profiles?.full_name ?? "—"}<span className="block text-[11px] text-surface-400">{r.designation ?? ""}</span></td>
                  <td colSpan={5}>
                    <form action={saveJoinExit} className="flex flex-wrap items-center gap-1.5">
                      <input type="hidden" name="id" value={r.id} />
                      <select name="gender" defaultValue={r.gender ?? ""} className={sm} aria-label="Gender"><option value="">—</option>{GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}</select>
                      <input type="date" name="hire_date" defaultValue={r.hire_date ?? ""} className={sm} aria-label="Joining" />
                      <input type="date" name="exit_date" defaultValue={r.exit_date ?? ""} className={sm} aria-label="Exit" />
                      <select name="exit_reason" defaultValue={r.exit_reason ?? ""} className={sm} aria-label="Wajah"><option value="">—</option>{EXIT_REASONS.map((x) => <option key={x} value={x}>{EXIT_REASON_LABEL[x]}</option>)}</select>
                      <button className="rounded bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="py-6 text-center text-sm text-surface-400">Koi HR file nahi.</p>}
      </div>
    </div>
  );
}
