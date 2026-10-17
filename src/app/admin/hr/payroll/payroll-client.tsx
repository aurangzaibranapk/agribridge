"use client";
import Link from "next/link";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { createPayrollRun, payPayrollRun, payrollTransition, type PayrollState } from "@/actions/payroll";
import { BTN, CARD, Header, INPUT, Kpi, Msg, PAGE, Pill, Submit, TD, TH, rs, pkr } from "@/components/payroll/ui";
import { MONTHS_RU, chargeableAbsentDays, payrollApprovalLines } from "@/lib/payroll/compute";

const init: PayrollState = {};
const STEPS = [["draft", "1. Draft"], ["submitted", "2. Manzoori ke liye bheja"], ["approved", "3. Manzoor (Journal)"], ["paid", "4. Ada (Cash/Bank)"]] as const;

export default function PayrollClient({ me, year, month, branch, branches, accounts, run, lines }: any) {
  const [cState, cAction] = useFormState(createPayrollRun, init);
  const [tState, tAction] = useFormState(payrollTransition, init);
  const [pState, pAction] = useFormState(payPayrollRun, init);
  const label = `${MONTHS_RU[month - 1]} ${year}`;
  const status = run?.status ?? "none";
  const idx = STEPS.findIndex(([k]) => k === status);
  const totals = payrollApprovalLines(lines.map((l: any) => ({ gross: +l.gross, absentDeduction: +l.absent_deduction, otherDeductions: +l.other_deductions, advance: +l.advance_deduction, net: +l.net })));
  const gross = lines.reduce((s: number, l: any) => s + +l.gross, 0);
  const missingTotal = lines.reduce((s: number, l: any) => s + (+l.missing_days || 0), 0);
  const notFinal = lines.filter((l: any) => !l.attendance_finalized || l.open_items > 0);
  const canApprove = me.approver && run && run.created_by !== me.id && run.submitted_by !== me.id && !lines.some((l: any) => l.profile_id === me.id);

  return (
    <div className={PAGE}>
      <Header crumb="Admin › HR › Payroll" title={`Payroll — ${label}`}>
        <Link href="/admin/hr/salary-structure" className={BTN}>Salary Structure</Link>
        {status === "submitted" && (
          <form action={tAction} className="flex gap-2">
            <input type="hidden" name="run_id" value={run.id} />
            <Submit primary={false} label="Wapas draft" name="action" value="back_to_draft" />
            {canApprove && <Submit label="Manzoor karein" name="action" value="approve" />}
          </form>
        )}
      </Header>
      <div className={`${CARD} flex flex-wrap items-center gap-3`}>
        <form className="flex flex-wrap items-center gap-3">
          <input type="month" name="m" defaultValue={`${year}-${String(month).padStart(2, "0")}`} className={INPUT} />
          <select name="branch" defaultValue={branch ?? ""} className={INPUT}><option value="">Branch: Sab</option>{branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <button className={BTN}>Dikhao</button>
        </form>
        {(status === "none" || status === "draft") && (
          <form action={cAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="year" value={year} /><input type="hidden" name="month" value={month} /><input type="hidden" name="branch_id" value={branch ?? ""} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ack_unfinalized" value="yes" /> Hazri adhoori hai, phir bhi banayein <span className="text-xs text-slate-500 dark:text-slate-400">(bina record din ghair-hazir gin kar katenge)</span></label>
            <Submit label="Hisaab chalayein" />
          </form>
        )}
        {run && (notFinal.length === 0 ? <Pill tone="green">Hazri ka mahina band ✓</Pill> : <Pill tone="amber">Hazri adhoori: {notFinal.length} staff</Pill>)}
      </div>
      {missingTotal > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          <span className="font-semibold">{missingTotal} din bina hazri record</span> — ye ghair-hazir gine gaye hain aur basic ÷ 30 ke hisaab se tankhwah se kat rahe hain. Ghalat ho to pehle hazri theek karein, phir "Hisaab chalayein".
        </div>
      )}
      <Msg state={cState} /><Msg state={tState} /><Msg state={pState} />
      <div className="grid gap-2 md:grid-cols-4">
        {STEPS.map(([k, t], i) => (
          <div key={k} className={`rounded-xl border px-3 py-2.5 text-center text-sm font-semibold ${i === idx ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-300" : i < idx ? "border-slate-200 text-emerald-700 dark:border-white/10 dark:text-emerald-300" : "border-slate-200 text-slate-400 dark:border-white/10"}`}>{t}{i < idx ? " ✓" : ""}</div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Staff" value={lines.length} />
        <Kpi label="Kul gross" value={rs(gross)} />
        <Kpi label="Kul kattauti" value={rs(gross - totals.payable)} />
        <Kpi label="Kul ada karna" value={rs(totals.payable)} tone="green" />
      </div>
      <div className={`${CARD} overflow-auto`}>
        <h3 className="mb-2 font-semibold">Review</h3>
        <table className="w-full min-w-[1120px] text-sm">
          <thead><tr>{["Staff", "Basic", "Hazir", "Absent", "Bina record (absent)", "Kul ghair-hazir", "Half day", "Chhutti (paid)", "Ghair-hazri kattauti", "Advance qist", "Net", ""].map((h, i) => <th key={h + i} className={`${TH} ${i > 0 && i < 11 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>
            {lines.map((l: any) => (
              <tr key={l.id}>
                <td className={TD}><div className="font-semibold">{l.name}</div><div className="text-xs text-slate-500">{l.designation}</div></td>
                <td className={`${TD} text-right tabular-nums`}>{pkr(l.basic)}</td>
                <td className={`${TD} text-right tabular-nums`}>{l.present_days}</td>
                <td className={`${TD} text-right tabular-nums`}>{l.absent_days + l.unpaid_leave_days}</td>
                <td className={`${TD} text-right tabular-nums`}>{l.missing_days > 0 ? <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">{l.missing_days}</span> : "—"}</td>
                <td className={`${TD} text-right font-semibold tabular-nums`}>{chargeableAbsentDays(l)}</td>
                <td className={`${TD} text-right tabular-nums`}>{l.half_days}</td>
                <td className={`${TD} text-right tabular-nums`}>{l.paid_leave_days}</td>
                <td className={`${TD} text-right tabular-nums text-red-600 dark:text-red-400`}>{+l.absent_deduction ? `− ${pkr(l.absent_deduction)}` : "—"}</td>
                <td className={`${TD} text-right tabular-nums text-red-600 dark:text-red-400`}>{+l.advance_deduction ? `− ${pkr(l.advance_deduction)}` : "—"}</td>
                <td className={`${TD} text-right font-bold tabular-nums`}>{rs(l.net)}</td>
                <td className={TD}>{(status === "approved" || status === "paid") && <Link className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300" href={`/admin/hr/payslip/${l.id}`}>Payslip</Link>}</td>
              </tr>))}
            {lines.length === 0 && <tr><td className={TD} colSpan={12}><span className="text-slate-500">Abhi hisaab nahi chala. Sirf manzoor shuda salary structure wale staff run mein aate hain.</span></td></tr>}
          </tbody>
        </table>
        <div className="mt-2 text-xs text-slate-500">Hisaab: basic ÷ 30 × (absent + unpaid chhutti + bina record din + half day × ½) · Jis din hazri darj nahi wo ghair-hazir · Overtime nahi · 31 din ka mahina bhi 30 par ginta hai</div>
        {status === "draft" && lines.length > 0 && (
          <form action={tAction} className="mt-3 text-right"><input type="hidden" name="run_id" value={run.id} /><Submit label="Manzoori ke liye bhejein" name="action" value="submit" /></form>
        )}
      </div>
      {run && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className={CARD}>
            <h3 className="mb-2 font-semibold">Maker-checker</h3>
            <Row k="Banaya" v={run.creator ?? "—"} />
            <Row k="Manzoori" v={run.approved_by ? `${run.approverName ?? ""} · manzoor` : <Pill tone="amber">Admin/Owner ka intezar</Pill>} />
            {run.paid_by && <Row k="Ada" v={`${run.payer ?? ""} · ${String(run.paid_at).slice(0, 10)}`} />}
            <Row k="Qaida" v="Banane wala manzoor/ada nahi kar sakta" />
            {run.ack_unfinalized && <Row k="Nishan" v={<Pill tone="amber">Hazri adhoori par banaya</Pill>} />}
            {status === "approved" && me.approver && run.created_by !== me.id && (
              <form action={pAction} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="run_id" value={run.id} />
                <select name="account_id" required className={INPUT}><option value="">Khata chunein…</option>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                <Submit label={`Ada karein (${rs(totals.payable)})`} />
              </form>
            )}
          </div>
          <div className={CARD}>
            <h3 className="mb-2 font-semibold">Manzoori par Journal</h3>
            <table className="w-full text-sm">
              <thead><tr><th className={TH}>Khata</th><th className={`${TH} text-right`}>Debit</th><th className={`${TH} text-right`}>Credit</th></tr></thead>
              <tbody>
                <tr><td className={TD}>6000 Tankhwahein</td><td className={`${TD} text-right tabular-nums`}>{pkr(totals.salaries)}</td><td className={TD} /></tr>
                {totals.advance > 0 && <tr><td className={TD}>1130 Staff Advance</td><td className={TD} /><td className={`${TD} text-right tabular-nums`}>{pkr(totals.advance)}</td></tr>}
                {totals.statutory > 0 && <tr><td className={TD}>2027 EOBI / Tax</td><td className={TD} /><td className={`${TD} text-right tabular-nums`}>{pkr(totals.statutory)}</td></tr>}
                <tr><td className={TD}>2025 Tankhwah wajib-ul-ada</td><td className={TD} /><td className={`${TD} text-right tabular-nums`}>{pkr(totals.payable)}</td></tr>
              </tbody>
            </table>
            <div className="mt-2 text-xs text-slate-500">Ada karne par: 2025 Dr / Cash-Bank Cr</div>
          </div>
        </div>
      )}
    </div>
  );
}
function Row({ k, v }: { k: string; v: any }) {
  return <div className="flex items-center justify-between border-b border-dashed border-slate-200 py-2 text-sm dark:border-white/10"><span>{k}</span><span>{v}</span></div>;
}
