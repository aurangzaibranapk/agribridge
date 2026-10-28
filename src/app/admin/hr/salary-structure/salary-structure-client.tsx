"use client";
import Link from "next/link";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { addSalaryComponent, decideSalaryStructure, saveSalaryStructure, savePayrollSettings, toggleSalaryComponent, type PayrollState } from "@/actions/payroll";
import { pkr } from "@/lib/recovery/credit-report";
import { BTN, CARD, INPUT, Msg, PAGE, Pill, STATUS_TONE, Submit, TD, TH, rs } from "@/components/payroll/ui";
import { aajKaKhana } from "@/lib/utils/format";
import { Chip, MoneyBox, PageTop, SO_BTN, SO_CARD, SO_H3, SO_INPUT, SO_LABEL, SO_MUTED, SO_TD } from "@/components/payroll/salary-ui";
import { fmtDate, fmtDayMonth } from "@/lib/payroll/salary-offer";

const init: PayrollState = {};
const CALC: Record<string, string> = { fixed: "Fixed raqam", pct_basic: "Basic ka %", system: "System (khud)" };
const SYSTEM_RULE: Record<string, string> = { BASIC: "Structure se", ABSENT: "Basic ÷ 30 × absent din (half day = ½)", ADV_QIST: "Qist Plan se khud" };
const STATUS: Record<string, string> = { draft: "Manzoori baqi", approved: "Manzoor", rejected: "Rad" };

export default function SalaryStructureClient({ me, components, people, selected, structures, settings, bharti, prefillFromOffer }: any) {
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
  const prefill = Boolean(prefillFromOffer && bharti?.offer?.basic);
  const OFFER_CODE: Record<string, string> = { HOUSE_RENT: "house_rent", TRAVEL: "travel", MOBILE: "mobile" };
  const offerAmountFor = (code: string) => (OFFER_CODE[code] && bharti?.offer?.[OFFER_CODE[code]] != null ? Number(bharti.offer[OFFER_CODE[code]]) : null);
  const missingComps = prefill ? Object.entries(OFFER_CODE).filter(([code, k]) => Number(bharti.offer[k] ?? 0) > 0 && !optional.some((c: any) => c.code === code)).map(([code]) => components.find((c: any) => c.code === code)?.name ?? code) : [];
  const allowances = current ? optional.filter((c: any) => c.kind === "earning").reduce((t: number, c: any) => t + amountOf(current, c), 0) : 0;

  return (
    <div className={PAGE}>
      <PageTop title="Tankhwah ka Dhancha" sub="Components aur staff ka mahana dhancha · maker-checker">
        <Link href="/admin/hr/payroll" className={BTN}>Payroll</Link>
        <Link href="/admin/hr/advances" className={BTN}>Staff Advance</Link>
        <Link href="/admin/hr/increments" className={BTN}>Aane wali barhotriyan</Link>
      </PageTop>
      <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className={SO_CARD}>
          <h3 className={SO_H3}>Components</h3>
          <Msg state={cState} />
          <table className="w-full text-sm">
            <thead><tr><th className={TH}>Naam</th><th className={TH}>Qisam</th><th className={TH}>Hisaab</th><th className={TH}></th></tr></thead>
            <tbody>{components.map((c: any) => (
              <tr key={c.id}>
                <td className={TD}><div className="font-medium">{c.name}</div><div className="text-xs text-slate-500">{c.code}</div></td>
                <td className={TD}><Chip tone={c.kind === "earning" ? "gr" : "rd"}>{c.kind === "earning" ? "Kamai" : "Katauti"}</Chip></td>
                <td className={TD}>{c.is_system ? SYSTEM_RULE[c.code] ?? CALC[c.calc] : CALC[c.calc]}{!c.is_system && c.calc === "pct_basic" && c.default_pct != null ? ` (${c.default_pct}%)` : ""}{!c.is_system && c.calc === "fixed" && Number(c.default_amount) > 0 ? ` (${rs(c.default_amount)})` : ""}</td>
                <td className={TD}>{c.is_system ? <Chip tone="gr">Chalu</Chip> : me.approver ? (
                  <form action={cAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={c.id} /><input type="hidden" name="is_active" value={String(!c.is_active)} />
                    <input name={c.calc === "pct_basic" ? "default_pct" : "default_amount"} placeholder={c.calc === "pct_basic" ? "%" : "Rs"} className={`${INPUT} w-20 py-1`} defaultValue={c.calc === "pct_basic" ? c.default_pct ?? "" : Number(c.default_amount) || ""} />
                    <Submit primary={!c.is_active} label={c.is_active ? "Band karein" : "Chalu karein"} />
                  </form>) : <Chip tone={c.is_active ? "gr" : "gy"}>{c.is_active ? "Chalu" : "Band"}</Chip>}
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

        <div className="space-y-4">
          <div className={SO_CARD}>
            <label className={SO_LABEL}>Staff</label>
            <form><select name="staff" defaultValue={selected ?? ""} className={SO_INPUT} onChange={(e) => e.currentTarget.form?.requestSubmit()}>{people.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.designation ? ` — ${p.designation}` : ""}</option>)}</select></form>
            <p className={`mt-3 ${SO_MUTED}`}>Basic: {current ? rs(current.basic) : "— (abhi koi structure nahi)"} · Laagu tareekh: {current ? fmtDate(current.effective_from) : "—"}</p>
            {person && <Link href={`/admin/hr/increments/${person.id}`} className="mt-1 inline-block text-xs font-semibold text-green-700 hover:underline dark:text-green-300">Tankhwah ka khulasa / barhotri →</Link>}
            {person && !person.hireDate && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                Joining date (hire date) darj nahi.{person.probationStart ? ` Advance ki shart ke liye probation shuru (${person.probationStart}) li ja rahi hai.` : " Advance ke liye pehle HR hire date darj kare."}
              </p>
            )}
          </div>

          {bharti && (
            <div className={`${SO_CARD} border-2 !border-green-300 dark:!border-green-400/40`}>
              <h3 className={SO_H3}>🤝 Bharti ke waqt tay hua <Chip tone="gr">Qubool {fmtDayMonth(String(bharti.offer.accepted_at ?? bharti.offer.responded_at ?? "").slice(0, 10))}</Chip></h3>
              <div className="grid grid-cols-3 gap-3">
                <MoneyBox small kind="exp" chip="Expected" value={bharti.expected != null ? pkr(bharti.expected) : "—"} />
                <MoneyBox small kind="off" chip="Offer" value={bharti.firstTotal != null ? pkr(bharti.firstTotal) : "—"} />
                <MoneyBox small kind="acc" chip="Accepted" value={bharti.acceptedTotal != null ? pkr(bharti.acceptedTotal) : "—"} />
              </div>
              <table className="mt-3 w-full border-collapse">
                <tbody>
                  {[
                    ["Basic", bharti.offer.basic != null ? pkr(bharti.offer.basic) : "—"],
                    ["Ghar ka kiraya", bharti.offer.house_rent != null ? pkr(bharti.offer.house_rent) : "—"],
                    ["Safar", bharti.offer.travel != null ? pkr(bharti.offer.travel) : "—"],
                    ["Mobile", bharti.offer.mobile != null ? pkr(bharti.offer.mobile) : "—"],
                    ["Bonus", bharti.offer.bonus ?? "—"],
                    ["Achhe kaam ka inaam", bharti.offer.incentive_pct != null ? `${Number(bharti.offer.incentive_pct)}%${bharti.offer.incentive_rule ? ` — ${bharti.offer.incentive_rule}` : ""}` : bharti.offer.incentive_rule ?? "—"],
                    ["Probation / Joining", `${bharti.offer.probation_months != null ? `${bharti.offer.probation_months} maah` : "—"} · ${fmtDate(bharti.offer.joining_date)}`],
                  ].map(([k, val]) => <tr key={k}><td className={SO_TD}>{k}</td><td className={SO_TD}>{val}</td></tr>)}
                </tbody>
              </table>
              {person && person.id !== me.id && (
                <Link href={`/admin/hr/salary-structure?staff=${person.id}&from_offer=1#naya-structure`} className={`${SO_BTN} mt-3`}>Qubool offer se structure banao</Link>
              )}
              <p className={`mt-3 ${SO_MUTED}`}>Neeche form bhar jayega (Draft). Doosra admin approve karega — maker-checker jaisa aaj hai.</p>
            </div>
          )}

          <div className={SO_CARD}>
            <h3 className={SO_H3}>{person ? `${person.name} — mojooda dhancha` : "Staff chunein"}</h3>
            {current && (
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className={TD}>Basic</td><td className={`${TD} text-right tabular-nums`}>{rs(current.basic)}</td></tr>
                  {optional.map((c: any) => <tr key={c.id}><td className={TD}>{c.name}</td><td className={`${TD} text-right tabular-nums ${c.kind === "deduction" ? "text-red-600 dark:text-red-400" : ""}`}>{c.kind === "deduction" ? "− " : ""}{rs(amountOf(current, c))}</td></tr>)}
                  {optional.length === 0 && <tr><td className={TD}>Allowances</td><td className={`${TD} text-right text-slate-500`}>— koi chalu nahi</td></tr>}
                  <tr><td className={`${TD} font-semibold`}>Kul mahana (gross)</td><td className={`${TD} text-right font-semibold tabular-nums`}>{rs(Number(current.basic) + allowances)}</td></tr>
                </tbody>
              </table>
            )}
            <h4 className="mb-2 mt-4 text-sm font-semibold">History</h4>
            <Msg state={dState} />
            <table className="w-full text-sm">
              <thead><tr><th className={TH}>Laagu</th><th className={`${TH} text-right`}>Basic</th><th className={TH}>Kis ne</th><th className={TH}>Manzoori</th></tr></thead>
              <tbody>
                {structures.map((s: any) => (
                  <tr key={s.id}>
                    <td className={TD}>{s.effective_from}{s.increment_amount != null && Number(s.increment_amount) !== 0 && <div className="text-xs text-green-700">{Number(s.increment_amount) > 0 ? "+" : ""}{pkr(s.increment_amount)}</div>}</td><td className={`${TD} text-right tabular-nums`}>{rs(s.basic)}</td>
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
          </div>

          {person && person.id !== me.id && (
            <form id="naya-structure" action={sAction} className={`${SO_CARD} space-y-3`} key={`${person.id}-${prefill ? "o" : "n"}`}>
              <h3 className={SO_H3}>Naya structure <Chip tone="am">Draft</Chip></h3>
              <input type="hidden" name="profile_id" value={person.id} />
              {prefill && <input type="hidden" name="source_offer_id" value={bharti.offer.id} />}
              {prefill && <input type="hidden" name="change_reason" value="joining" />}
              <div className="grid grid-cols-2 gap-4">
                <div><label className={SO_LABEL}>Basic</label><input name="basic" type="number" min={1} required defaultValue={prefill ? bharti.offer.basic ?? "" : ""} className={SO_INPUT} /></div>
                <div><label className={SO_LABEL}>Laagu tareekh</label><input name="effective_from" type="date" required defaultValue={prefill && bharti.offer.joining_date ? bharti.offer.joining_date : today} className={SO_INPUT} /></div>
                {optional.map((c: any) => (
                  <div key={c.id}><label className={SO_LABEL}>{c.name}{c.calc === "pct_basic" ? " (%)" : ""}</label>
                    <input name={`comp_${c.calc === "pct_basic" ? "pct" : "amount"}_${c.id}`} type="number" step="0.01" min={0}
                      defaultValue={prefill && c.calc !== "pct_basic" ? offerAmountFor(c.code) ?? "" : ""}
                      placeholder={String(c.calc === "pct_basic" ? c.default_pct ?? "" : c.default_amount ?? "")} className={SO_INPUT} />
                  </div>))}
                <div><label className={SO_LABEL}>Note</label><input name="notes" defaultValue={prefill ? `Offer #${String(bharti.offer.id).slice(0, 8).toUpperCase()} se` : ""} className={SO_INPUT} /></div>
              </div>
              {prefill && missingComps.length > 0 && <p className="text-xs text-amber-700">Offer mein {missingComps.join(", ")} hai magar ye component band hai — pehle Components mein chalu karein.</p>}
              <Msg state={sState} />
              <Submit label="Chalu karein — approval ke liye bhejein" />
              <p className={SO_MUTED}>Tabdeeli purani nahi mitati — nayi line nayi tareekh se laagu. HR banaye, doosra Admin/Owner manzoor kare.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
