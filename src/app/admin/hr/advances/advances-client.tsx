"use client";
import Link from "next/link";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { decideStaffAdvance, payStaffAdvance, requestStaffAdvance, type PayrollState } from "@/actions/payroll";
import { BTN, CARD, Header, INPUT, Msg, PAGE, Pill, STATUS_TONE, Submit, TD, TH, rs, pkr } from "@/components/payroll/ui";
import { MONTHS_RU } from "@/lib/payroll/compute";
import { equalAmounts } from "@/lib/qist/schedule";

const init: PayrollState = {};
const ST: Record<string, string> = { requested: "Manzoori baqi", approved: "Manzoor -- adaigi baqi", rejected: "Rad", paid: "Ada -- qiston mein", closed: "Mukammal", cancelled: "Cancel" };

export default function AdvancesClient({ me, people, staff, amount, n, elig, advances, accounts }: any) {
  const [rState, rAction] = useFormState(requestStaffAdvance, init);
  const [dState, dAction] = useFormState(decideStaffAdvance, init);
  const [pState, pAction] = useFormState(payStaffAdvance, init);
  const now = new Date(Date.now() + 5 * 3600 * 1000);
  const firstMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const plan = amount > 0 ? equalAmounts(amount, n) : [];
  const [fy, fm] = firstMonth.split("-").map(Number);
  const person = people.find((p: any) => p.id === staff);
  const checks: [boolean, string][] = elig ? [
    [elig.service_months != null && elig.service_months >= elig.min_months, elig.service_start ? `Mulazmat ${elig.min_months} mahine se zyada — shuru ${elig.service_start}${elig.service_start_is_probation ? " (probation se; hire date darj nahi)" : ""} · ${elig.service_months} mahine` : "Joining date system mein nahi"],
    [Number(elig.open_advances) === 0, "Koi purana advance baqi nahi"],
    [elig.basic != null, elig.basic != null ? `Manzoor shuda basic ${rs(elig.basic)}` : "Manzoor shuda salary structure nahi"],
    [elig.cap_pct == null || !(elig.reasons ?? []).some((r: string) => r.includes("%")), elig.cap_pct == null ? "Qist ki koi had nahi (Admin settings)" : `Qist basic ke ${elig.cap_pct}% ke andar`],
  ] : [];
  return (
    <div className={PAGE}>
      <Header crumb="Admin › HR › Staff Advance" title="Advance ki Darkhwast"><Link href="/admin/hr/payroll" className={BTN}>Payroll</Link></Header>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={CARD}>
          <h3 className="mb-3 font-semibold">Darkhwast</h3>
          <form className="mb-3 flex flex-wrap items-end gap-3 text-sm">
            <label>Staff<br /><select name="staff" defaultValue={staff ?? ""} className={INPUT}>{people.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>Raqam (Rs)<br /><input name="amount" type="number" min={1} defaultValue={amount || ""} className={`${INPUT} w-32`} /></label>
            <label>Qistein<br /><input name="n" type="number" min={1} max={36} defaultValue={n} className={`${INPUT} w-20`} /></label>
            <button className={BTN}>Shart check karein</button>
          </form>
          <h4 className="mb-1 mt-4 text-sm font-semibold">Shart ki jaanch</h4>
          {checks.map(([ok, t]) => <div key={t} className="flex gap-2 py-1 text-sm"><span className={ok ? "font-bold text-emerald-600" : "font-bold text-red-600"}>{ok ? "✓" : "✗"}</span>{t}</div>)}
          {elig && !elig.eligible && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{(elig.reasons ?? []).join(" ")}</div>}
          {elig?.eligible && amount > 0 && person && (
            <form action={rAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm dark:border-white/[0.06]">
              <input type="hidden" name="profile_id" value={staff} /><input type="hidden" name="amount" value={amount} /><input type="hidden" name="installments" value={n} />
              <label className="block">Pehli qist (payroll ka mahina)<br /><input type="month" name="first_month" defaultValue={firstMonth} className={INPUT} /></label>
              <label className="block">Wajah<br /><input name="reason" required minLength={3} className={`${INPUT} w-full`} placeholder="maslan Ghar ki marammat" /></label>
              <Msg state={rState} />
              <div className="flex justify-end"><Submit label="Manzoori ke liye bhejein" /></div>
            </form>
          )}
        </div>
        <div className={CARD}>
          <h3 className="mb-3 font-semibold">Qiston ka plan</h3>
          <table className="w-full text-sm">
            <thead><tr><th className={TH}>#</th><th className={TH}>Payroll</th><th className={`${TH} text-right`}>Qist</th><th className={`${TH} text-right`}>Baqaya</th></tr></thead>
            <tbody>{plan.map((a: number, i: number) => {
              const d = new Date(Date.UTC(fy, fm - 1 + i, 1));
              const left = amount - plan.slice(0, i + 1).reduce((s: number, x: number) => s + x, 0);
              return <tr key={i}><td className={TD}>{i + 1}</td><td className={TD}>{MONTHS_RU[d.getUTCMonth()]} {d.getUTCFullYear()}</td><td className={`${TD} text-right tabular-nums`}>{pkr(a)}</td><td className={`${TD} text-right tabular-nums`}>{pkr(left)}</td></tr>;
            })}{plan.length === 0 && <tr><td className={TD} colSpan={4}><span className="text-slate-500">Raqam likh kar "Shart check karein" dabayein.</span></td></tr>}</tbody>
          </table>
          <div className="mt-3 text-xs text-slate-500">Manzoori: Admin/Owner — darkhwast dene wala ya staff khud manzoor nahi kar sakta. Ada karne par Journal: Staff Advance Dr / Cash-Bank Cr; qistein payroll mein khud katti hain.</div>
        </div>
      </div>
      <div className={`${CARD} overflow-auto`}>
        <h3 className="mb-2 font-semibold">Darkhwastein</h3>
        <Msg state={dState} /><Msg state={pState} />
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr>{["Staff", "Raqam", "Qistein", "Wajah", "Halat", ""].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{advances.map((a: any) => (
            <tr key={a.id}>
              <td className={TD}><div className="font-medium">{a.name}</div><div className="text-xs text-slate-500">{a.requester ? `Darkhwast: ${a.requester}` : ""}</div></td>
              <td className={`${TD} tabular-nums`}>{rs(a.amount)}</td><td className={TD}>{a.installments} × {pkr(a.installment_amount)}</td>
              <td className={TD}>{a.reason}</td>
              <td className={TD}><Pill tone={STATUS_TONE[a.status]}>{ST[a.status]}</Pill></td>
              <td className={TD}>
                {a.status === "requested" && me.approver && a.requested_by !== me.id && a.profile_id !== me.id && (
                  <form action={dAction} className="flex gap-2"><input type="hidden" name="id" value={a.id} /><input name="reason" placeholder="Wajah (rad)" className={`${INPUT} w-28 py-1`} /><Submit label="Manzoor" name="decision" value="approve" /><Submit primary={false} label="Rad" name="decision" value="reject" /></form>
                )}
                {a.status === "approved" && me.approver && a.profile_id !== me.id && (
                  <form action={pAction} className="flex gap-2"><input type="hidden" name="id" value={a.id} /><select name="account_id" required className={`${INPUT} py-1`}><option value="">Khata…</option>{accounts.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><Submit label="Ada karein" /></form>
                )}
                {a.qist_plan_id && <Link href={`/admin/khata/qist/${a.qist_plan_id}`} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Qist plan</Link>}
              </td>
            </tr>))}
            {advances.length === 0 && <tr><td className={TD} colSpan={6}><span className="text-slate-500">Abhi koi darkhwast nahi.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
