"use client";
import Link from "next/link";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { addSalaryComponent, decideSalaryStructure, saveSalaryStructure, savePayrollSettings, toggleSalaryComponent, type PayrollState } from "@/actions/payroll";
import { BTN, CARD, Header, INPUT, Kpi, Msg, PAGE, Pill, STATUS_TONE, Submit, TD, TH, rs } from "@/components/payroll/ui";
import { aajKaKhana } from "@/lib/utils/format";

const init: PayrollState = {};
const CALC: Record<string, string> = { fixed: "Fixed raqam", pct_basic: "Basic ka %", system: "System (khud)" };
const SYSTEM_RULE: Record<string, string> = { BASIC: "Structure se", ABSENT: "Basic ÷ 30 × absent din (half day = ½)", ADV_QIST: "Qist Plan se khud" };
const STATUS: Record<string, string> = { draft: "Manzoori baqi", approved: "Manzoor", rejected: "Rad" };

export default function SalaryStructureClient({ me, components, people, selected, structures, settings }: any) {
  const [cState, cAction] = useFormState(toggleSalaryComponent, init);
  const [aState, aAction] = useFormState(addSalaryComponent, init);
  const [sState, sAction] = useFormState(saveSalaryStructure, init);
  const [dState, dAction] = useFormState(decideSalaryStructure, init);
  const [setState, setAction] = useFormState(savePayrollSettings, init);
  const person = people.find((p: any) => p.id === selected);
  const today = aajKaKhana();
  const current = structures.find((s: any) => s.status === "approved" && s.effective_from <= today);
  const optional = components.filter((c: any) => !c.is_system && c.is_active);
  const itemFor = (s: any, cid: string) => s?.staff_salary_structure_items?.find((i: any) => i.component_id === cid);
  const amountOf = (s: any, c: any) => {
    const it = itemFor(s, c.id);
    return c.calc === "pct_basic" ? Math.round((Number(s.basic) * Number(it?.pct ?? c.default_pct ?? 0)) / 100) : Number(it?.amount ?? c.default_amount ?? 0);
  };
  const allowances = current ? optional.filter((c: any) => c.kind === "earning").reduce((t: number, c: any) => t + amountOf(current, c), 0) : 0;

  return (
    <div className={PAGE}>
      <Header crumb="Admin › HR › Salary Structure" title="Tankhwah ka Dhancha">
        <Link href="/admin/hr/payroll" className={BTN}>Payroll</Link>
        <Link href="/admin/hr/advances" className={BTN}>Staff Advance</Link>
      </Header>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={CARD}>
          <h3 className="mb-3 font-semibold">Components (hissay)</h3>
          <Msg state={cState} />
          <table className="w-full text-sm">
            <thead><tr><th className={TH}>Naam</th><th className={TH}>Qism</th><th className={TH}>Hisaab</th><th className={TH}>Halat</th></tr></thead>
            <tbody>{components.map((c: any) => (
              <tr key={c.id}>
                <td className={TD}><div className="font-medium">{c.name}</div><div className="text-xs text-slate-500">{c.code}</div></td>
                <td className={TD}><Pill tone={c.kind === "earning" ? "blue" : "red"}>{c.kind === "earning" ? "Kamai" : "Kattauti"}</Pill></td>
                <td className={TD}>{c.is_system ? SYSTEM_RULE[c.code] ?? CALC[c.calc] : CALC[c.calc]}{!c.is_system && c.calc === "pct_basic" && c.default_pct != null ? ` (${c.default_pct}%)` : ""}{!c.is_system && c.calc === "fixed" && Number(c.default_amount) > 0 ? ` (${rs(c.default_amount)})` : ""}</td>
                <td className={TD}>{c.is_system ? <Pill tone="green">Chalu (lazmi)</Pill> : me.approver ? (
                  <form action={cAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={c.id} /><input type="hidden" name="is_active" value={String(!c.is_active)} />
                    <input name={c.calc === "pct_basic" ? "default_pct" : "default_amount"} placeholder={c.calc === "pct_basic" ? "%" : "Rs"} className={`${INPUT} w-20 py-1`} defaultValue={c.calc === "pct_basic" ? c.default_pct ?? "" : Number(c.default_amount) || ""} />
                    <Submit primary={!c.is_active} label={c.is_active ? "Band karein" : "Chalu karein"} />
                  </form>) : <Pill tone={c.is_active ? "green" : "gray"}>{c.is_active ? "Chalu" : "Band"}</Pill>}
                </td>
              </tr>))}</tbody>
          </table>
          {me.approver && (
            <form action={aAction} className="mt-4 flex flex-wrap items-center gap-2">
              <input name="name" placeholder="Naya component (maslan Khana allowance)" className={`${INPUT} flex-1`} />
              <select name="kind" className={INPUT}><option value="earning">Kamai</option><option value="deduction">Kattauti</option></select>
              <select name="calc" className={INPUT}><option value="fixed">Fixed</option><option value="pct_basic">Basic ka %</option></select>
              <Submit primary={false} label="+ Naya component" />
            </form>
          )}
          <Msg state={aState} />
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
            <h4 className="mb-2 text-sm font-semibold">Advance ki shartein</h4>
            <form action={setAction} className="flex flex-wrap items-end gap-3 text-sm">
              <label>Kam az kam mulazmat (mahine)<br /><input name="advance_min_service_months" type="number" min={0} defaultValue={settings.advance_min_service_months} className={`${INPUT} w-28`} disabled={!me.approver} /></label>
              <label>Qist ki had (basic ka %, khali = koi had nahi)<br /><input name="advance_cap_pct" type="number" step="0.1" min={0} max={100} defaultValue={settings.advance_cap_pct ?? ""} className={`${INPUT} w-28`} disabled={!me.approver} /></label>
              {me.approver && <Submit primary={false} label="Save" />}
            </form>
            <Msg state={setState} />
          </div>
        </div>

        <div className={CARD}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{person ? `${person.name} — ${person.designation}` : "Staff chunein"}</h3>
            <form><select name="staff" defaultValue={selected ?? ""} className={INPUT} onChange={(e) => e.currentTarget.form?.requestSubmit()}>{people.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></form>
          </div>
          {person && !person.hireDate && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
              Joining date (hire date) darj nahi.{person.probationStart ? ` Advance ki shart ke liye probation shuru (${person.probationStart}) li ja rahi hai.` : " Advance ke liye pehle HR hire date darj kare."}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Basic (laagu)" value={current ? rs(current.basic) : "—"} />
            <Kpi label="Laagu tareekh" value={current?.effective_from ?? "—"} />
          </div>
          {current && (
            <table className="mt-3 w-full text-sm">
              <tbody>
                <tr><td className={TD}>Basic</td><td className={`${TD} text-right tabular-nums`}>{rs(current.basic)}</td></tr>
                {optional.map((c: any) => <tr key={c.id}><td className={TD}>{c.name}</td><td className={`${TD} text-right tabular-nums ${c.kind === "deduction" ? "text-red-600 dark:text-red-400" : ""}`}>{c.kind === "deduction" ? "− " : ""}{rs(amountOf(current, c))}</td></tr>)}
                {optional.length === 0 && <tr><td className={TD}>Allowances</td><td className={`${TD} text-right text-slate-500`}>— koi chalu nahi</td></tr>}
                <tr><td className={`${TD} font-semibold`}>Kul mahana (gross)</td><td className={`${TD} text-right font-semibold tabular-nums`}>{rs(Number(current.basic) + allowances)}</td></tr>
              </tbody>
            </table>
          )}
          <h4 className="mb-2 mt-5 text-sm font-semibold">History</h4>
          <Msg state={dState} />
          <table className="w-full text-sm">
            <thead><tr><th className={TH}>Laagu</th><th className={`${TH} text-right`}>Basic</th><th className={TH}>Kis ne</th><th className={TH}>Manzoori</th></tr></thead>
            <tbody>
              {structures.map((s: any) => (
                <tr key={s.id}>
                  <td className={TD}>{s.effective_from}</td><td className={`${TD} text-right tabular-nums`}>{rs(s.basic)}</td>
                  <td className={TD}>{s.creator?.full_name ?? "—"}</td>
                  <td className={TD}>
                    <Pill tone={STATUS_TONE[s.status] ?? (s.status === "draft" ? "amber" : "gray")}>{STATUS[s.status]}{s.approver?.full_name && s.status !== "draft" ? ` · ${s.approver.full_name}` : ""}</Pill>
                    {s.status === "draft" && me.approver && s.created_by !== me.id && s.profile_id !== me.id && (
                      <form action={dAction} className="mt-2 flex gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <input name="reason" placeholder="Wajah (rad ke liye)" className={`${INPUT} w-36 py-1`} />
                        <Submit label="Manzoor" name="decision" value="approve" />
                        <Submit primary={false} label="Rad" name="decision" value="reject" />
                      </form>
                    )}
                  </td>
                </tr>))}
              {structures.length === 0 && <tr><td className={TD} colSpan={4}><span className="text-slate-500">Pehle kuch set nahi tha.</span></td></tr>}
            </tbody>
          </table>
          {person && person.id !== me.id && (
            <form action={sAction} className="mt-5 space-y-3 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
              <h4 className="text-sm font-semibold">Naya structure (nayi tareekh se)</h4>
              <input type="hidden" name="profile_id" value={person.id} />
              <div className="flex flex-wrap gap-3 text-sm">
                <label>Basic (Rs)<br /><input name="basic" type="number" min={1} required className={`${INPUT} w-36`} /></label>
                <label>Laagu tareekh<br /><input name="effective_from" type="date" required defaultValue={today} className={INPUT} /></label>
              </div>
              {optional.length > 0 && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {optional.map((c: any) => (
                    <label key={c.id}>{c.name} ({c.calc === "pct_basic" ? "%" : "Rs"})<br />
                      <input name={`comp_${c.calc === "pct_basic" ? "pct" : "amount"}_${c.id}`} type="number" step="0.01" min={0} placeholder={String(c.calc === "pct_basic" ? c.default_pct ?? "" : c.default_amount ?? "")} className={`${INPUT} w-full`} />
                    </label>))}
                </div>
              )}
              <input name="notes" placeholder="Note (ikhtiyari)" className={`${INPUT} w-full`} />
              <Msg state={sState} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Tabdeeli purani nahi mitati — nayi line nayi tareekh se laagu. HR banaye, Admin/Owner manzoor kare.</span>
                <Submit label="Structure save (draft)" />
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
