import Link from "next/link";
import { notFound } from "next/navigation";
import { payrollViewer } from "@/lib/payroll/access";
import { aajKaKhana } from "@/lib/utils/format";
import { acceptedOfferForStaff } from "@/lib/payroll/offer-for-staff";
import { loadUpcomingIncrements } from "@/lib/payroll/increments-data";
import { CHANGE_REASONS, fmtDate } from "@/lib/payroll/salary-offer";
import { MONTHS_RU } from "@/lib/payroll/compute";
import { pkr } from "@/lib/recovery/credit-report";
import { Chip, PageTop, SO_BTN, SO_BTN2, SO_CARD, SO_H3, SO_MUTED, SO_PAGE, SO_TD, StatCard, Timeline, type ChipTone } from "@/components/payroll/salary-ui";
import { IncrementForm } from "@/components/payroll/salary-forms";

export const dynamic = "force-dynamic";
/* eslint-disable @typescript-eslint/no-explicit-any */

const REASON_TONE: Record<string, ChipTone> = { joining: "bl", annual: "gr", performance: "am", promotion: "am", inflation: "gr", correction: "gy" };

/** 691 (mockup 3): Staff ki tankhwah ka khulasa -- barhotri ki tareekh + "Barhotri tay karein". */
export default async function StaffSalarySummaryPage({ params }: { params: { profileId: string } }) {
  const v = await payrollViewer();
  if (!v?.writer) return <div className="p-8 text-center text-slate-500">Ijazat nahi -- sirf HR, Finance, Admin ya Owner.</div>;
  const sb = v.sb;
  const today = aajKaKhana();
  const id = params.profileId;
  const [{ data: prof }, { data: sd }, { data: structs }, { data: comps }, { data: lines }] = await Promise.all([
    sb.from("profiles").select("id, full_name, role").eq("id", id).maybeSingle(),
    sb.from("staff_details").select("*").eq("profile_id", id).maybeSingle(),
    sb.from("staff_salary_structures").select("*, staff_salary_structure_items(component_id, amount, pct)").eq("profile_id", id).order("effective_from", { ascending: true }),
    sb.from("salary_components").select("*"),
    sb.from("payroll_lines").select("id, run_id, net, gross, payroll_runs(pay_year, pay_month, status)").eq("profile_id", id),
  ]);
  if (!prof) notFound();
  const bharti = await acceptedOfferForStaff(sb, id);
  const { rows } = await loadUpcomingIncrements(sb, today);
  const up = rows.find((r) => r.profile_id === id);
  const cm = new Map<string, any>((comps ?? []).map((c: any) => [c.id, c]));
  const kul = (s: any) => Number(s.basic) + (s.staff_salary_structure_items ?? []).reduce((t: number, it: any) => {
    const c = cm.get(it.component_id);
    if (!c || c.kind !== "earning") return t;
    return t + (c.calc === "pct_basic" ? Math.round((Number(s.basic) * Number(it.pct ?? c.default_pct ?? 0)) / 100) : Number(it.amount ?? 0));
  }, 0);
  const approved = (structs ?? []).filter((s: any) => s.status === "approved");
  const names = new Map<string, string>();
  const ids = [...new Set(approved.map((s: any) => s.approved_by).filter(Boolean))];
  if (ids.length) { const { data } = await sb.from("profiles").select("id, full_name").in("id", ids); (data ?? []).forEach((p: any) => names.set(p.id, p.full_name)); }
  const current = [...approved].reverse().find((s: any) => s.effective_from <= today) ?? null;
  const designation = sd?.designation ?? prof.role;
  const joining = sd?.hire_date ?? bharti?.offer?.joining_date ?? null;
  const slips = (lines ?? []).filter((l: any) => ["approved", "paid"].includes(l.payroll_runs?.status))
    .sort((a: any, b: any) => (b.payroll_runs.pay_year * 100 + b.payroll_runs.pay_month) - (a.payroll_runs.pay_year * 100 + a.payroll_runs.pay_month));

  return (
    <div className={SO_PAGE}>
      <PageTop title={`${prof.full_name} — Tankhwah ka khulasa`} sub={`${designation ?? "Staff"} · Joining ${fmtDate(joining)}`}>
        <Link href="/admin/hr/increments" className="text-sm text-gray-500 hover:underline">← Aane wali barhotriyan</Link>
      </PageTop>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Maangi thi" value={bharti?.expected != null ? pkr(bharti.expected) : "—"} tone="blue" />
        <StatCard label="Qubool shuda (shuru)" value={bharti?.acceptedTotal != null ? pkr(bharti.acceptedTotal) : "—"} tone="green" />
        <StatCard label="Mojooda basic / kul" value={current ? `${pkr(current.basic)} / ${pkr(kul(current))}` : "—"} />
        <StatCard label="Agli barhotri" value={fmtDate(up?.due_date)}
          extra={up?.days_left != null ? <Chip tone={up.days_left < 0 ? "rd" : "am"}>⏰ {up.days_left < 0 ? `${Math.abs(up.days_left)} din late` : `${up.days_left} din baqi`}</Chip> : null} />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className={SO_CARD}>
          <h3 className={SO_H3}>Barhotri ki tareekh</h3>
          {approved.length ? (
            <Timeline items={approved.map((s: any, i: number) => {
              const reason = s.change_reason ?? (i === 0 ? "joining" : "annual");
              const prev = approved[i - 1];
              const inc = s.increment_amount != null ? Number(s.increment_amount) : prev ? Number(s.basic) - Number(prev.basic) : null;
              const pct = s.increment_pct != null ? Number(s.increment_pct) : prev && Number(prev.basic) > 0 && inc != null ? Math.round((inc / Number(prev.basic)) * 1000) / 10 : null;
              const chip = reason === "joining" ? "Joining" : reason === "performance" || reason === "promotion" ? `${CHANGE_REASONS[reason]} ${inc != null && inc >= 0 ? "+" : ""}${inc != null ? pkr(inc) : ""}` : `${CHANGE_REASONS[reason] ?? reason} ${pct != null ? `${pct >= 0 ? "+" : ""}${pct}%` : ""}`;
              const appr = s.approved_by ? ` · appr. ${names.get(s.approved_by) ?? "—"}` : "";
              const body = reason === "joining" || !prev
                ? `Basic ${pkr(s.basic)} · kul ${pkr(kul(s))}${s.source_offer_id ? " · Qubool offer se" : ""}${appr}`
                : `${pkr(prev.basic)} → ${pkr(s.basic)} (${inc != null && inc >= 0 ? "+" : ""}${reason === "performance" && pct != null ? `${pct}%` : pkr(inc)})${s.notes ? ` · ${s.notes}` : ""}${appr}`;
              return <div key={s.id} className="text-sm"><div><b className="text-[15px]">{fmtDate(s.effective_from)}</b> <Chip tone={REASON_TONE[reason] ?? "gy"}>{chip.trim()}</Chip></div><div className="text-gray-700 dark:text-slate-300">{body}</div></div>;
            })} />
          ) : <p className="text-sm text-gray-500">Abhi koi manzoor structure nahi.</p>}
          {bharti && <p className={`mt-3 text-[11px] text-gray-500`}>Bonus: {bharti.offer.bonus ?? "—"} · Inaam: {bharti.offer.incentive_pct != null ? `${Number(bharti.offer.incentive_pct)}% ` : ""}{bharti.offer.incentive_rule ?? ""}</p>}
        </div>
        <div className={SO_CARD}>
          <h3 className={SO_H3}>Barhotri tay karein</h3>
          <IncrementForm profileId={id} current={current ? Number(current.basic) : 0} dueDate={up?.due_date ?? null} canWrite={id !== v.id} />
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className={SO_CARD} id="slips">
          <h3 className={SO_H3}>Staff profile — {prof.full_name}</h3>
          <p className={`mb-3 ${SO_MUTED}`}>{designation ?? "Staff"} · Joining {fmtDate(joining)}</p>
          <div className="flex flex-wrap gap-2">
            {slips[0] ? <Link href={`/admin/hr/payslip/${slips[0].id}`} className={SO_BTN}>🧾 Salary Slip</Link> : <span className={SO_MUTED}>Abhi koi manzoor slip nahi.</span>}
            {slips.length > 0 && <a href="#saari-slips" className={SO_BTN2}>Saari slips</a>}
          </div>
          {slips.length > 0 && (
            <table id="saari-slips" className="mt-3 w-full border-collapse">
              <tbody>{slips.map((l: any) => (
                <tr key={l.id}><td className={SO_TD}>{MONTHS_RU[l.payroll_runs.pay_month - 1]} {l.payroll_runs.pay_year}</td><td className={`${SO_TD} tabular-nums`}>Rs {pkr(l.net)}</td>
                  <td className={SO_TD}><Link href={`/admin/hr/payslip/${l.id}`} className="text-xs font-semibold text-green-700 hover:underline">Dekhein</Link> · <a href={`/api/hr/payslip/${l.id}/pdf`} className="text-xs font-semibold text-green-700 hover:underline">⬇ PDF</a></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
