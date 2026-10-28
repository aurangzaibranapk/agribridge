import Link from "next/link";
import { payrollViewer } from "@/lib/payroll/access";
import { aajKaKhana } from "@/lib/utils/format";
import { loadUpcomingIncrements, type UpcomingRow } from "@/lib/payroll/increments-data";
import { fmtDate } from "@/lib/payroll/salary-offer";
import { pkr } from "@/lib/recovery/credit-report";
import { Chip, PageTop, SO_BTN2, SO_CARD, SO_H3, SO_PAGE, SO_TD, SO_TH, StatCard } from "@/components/payroll/salary-ui";

export const dynamic = "force-dynamic";

const ORDER: Record<string, number> = { this_month: 0, next_month: 1, late: 2 };
function StatusChip({ r }: { r: UpcomingRow }) {
  if (r.bucket === "late") return <Chip tone="rd">Waqt guzar gaya</Chip>;
  if (r.bucket === "next_month") return <Chip tone="bl">Agle maah</Chip>;
  return <Chip tone="am">{r.days_left} din</Chip>;
}

/** 691 (mockup 4): Aane wali barhotriyan -- joining ki saalgirah ke hisaab se. */
export default async function UpcomingIncrementsPage() {
  const v = await payrollViewer();
  if (!v?.writer) return <div className="p-8 text-center text-slate-500">Ijazat nahi -- sirf HR, Finance, Admin ya Owner.</div>;
  const today = aajKaKhana();
  const { rows } = await loadUpcomingIncrements(v.sb, today);
  const list = rows.filter((r) => r.bucket in ORDER).sort((a, b) => ORDER[a.bucket] - ORDER[b.bucket] || String(a.due_date).localeCompare(String(b.due_date)));
  const count = (b: string) => rows.filter((r) => r.bucket === b).length;
  const drafts = rows.reduce((s, r) => s + (r.drafts_pending > 0 ? 1 : 0), 0);
  return (
    <div className={SO_PAGE}>
      <PageTop title="Aane wali barhotriyan" sub="Joining ki saalgirah ke hisaab se · is maah aur agle maah">
        <Link href="/admin/hr/salary-structure" className={SO_BTN2}>Tankhwah ka Dhancha</Link>
      </PageTop>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Is maah" value={count("this_month")} />
        <StatCard label="Agle maah" value={count("next_month")} />
        <StatCard label="Late" value={count("late")} tone="red" />
        <StatCard label="Draft approval baqi" value={drafts} tone="amber" />
      </div>
      <div className={`${SO_CARD} overflow-x-auto`}>
        <h3 className={SO_H3}>Fehrist</h3>
        <table className="w-full min-w-[720px] border-collapse">
          <thead><tr><th className={SO_TH}>Staff</th><th className={SO_TH}>Ohda</th><th className={SO_TH}>Barhotri due</th><th className={SO_TH}>Mojooda basic</th><th className={SO_TH}>Status</th><th className={SO_TH}></th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.profile_id}>
                <td className={`${SO_TD} font-bold`}>{r.full_name}</td>
                <td className={SO_TD}>{r.designation ?? "—"}</td>
                <td className={SO_TD}>{fmtDate(r.due_date)}</td>
                <td className={`${SO_TD} tabular-nums`}>{r.current_basic != null ? pkr(r.current_basic) : "—"}</td>
                <td className={SO_TD}><StatusChip r={r} />{r.drafts_pending > 0 && <span className="ml-1"><Chip tone="gy">Draft baqi</Chip></span>}</td>
                <td className={SO_TD}>{r.profile_id !== v.id && <Link href={`/admin/hr/increments/${r.profile_id}`} className={`${SO_BTN2} !px-3 !py-1.5 !text-xs`}>Barhotri tay karein</Link>}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td className={SO_TD} colSpan={6}><span className="text-gray-500">Is maah aur agle maah koi barhotri nahi. (Joining date darj na ho to staff yahan nahi aata.)</span></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
