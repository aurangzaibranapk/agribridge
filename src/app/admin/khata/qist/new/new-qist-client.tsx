"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { createQistPlan, searchQistMembers, type QistState } from "@/actions/qist";
import { BTN, CARD, Header, INPUT, Msg, PAGE, Pill, Submit, TD, TH, pkr } from "@/components/payroll/ui";
import { buildSchedule, scheduleError, FREQ_LABEL, PARTY_LABEL, SOURCE_LABEL, type QistFrequency, type QistParty, type QistSource, type ScheduleRow } from "@/lib/qist/schedule";

const ORIGIN: Record<string, string> = { advance: "Advance (naqad)", goods_credit: "Maal udhaar par", loan: "Qarz", opening: "Purana baqaya", other: "Deegar" };
const DEFAULT_SOURCE: Record<QistParty, QistSource> = { staff: "salary", farmer: "milk", customer: "cash", dealer: "cash", supplier: "supplier_bill" };
const today = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const chip = (on: boolean) => `rounded-lg border px-3 py-2 text-sm ${on ? "border-emerald-600 bg-emerald-50 font-semibold text-emerald-700 dark:border-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-300" : "border-slate-200 dark:border-white/10"}`;

export default function NewQistClient({ preset }: { preset: { type: string; id: string; name: string } | null }) {
  const router = useRouter();
  const [state, action] = useFormState(createQistPlan, {} as QistState);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [member, setMember] = useState<{ type: QistParty; id: string; name: string } | null>(preset as any);
  const [source, setSource] = useState<QistSource>(preset ? DEFAULT_SOURCE[preset.type as QistParty] : "milk");
  const [origin, setOrigin] = useState("advance");
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(4);
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [freq, setFreq] = useState<QistFrequency>("milk_weekly");
  const [start, setStart] = useState(today());
  const [capPct, setCapPct] = useState("");
  const [capAmt, setCapAmt] = useState("");
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  useEffect(() => { if (term.trim().length < 2) return setHits([]); const t = setTimeout(async () => setHits(await searchQistMembers(term)), 300); return () => clearTimeout(t); }, [term]);
  useEffect(() => { if (mode === "equal" || rows.length !== count) setRows(total > 0 && count > 0 ? buildSchedule({ total, count, frequency: freq, start }) : []); }, [total, count, freq, start, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (state.planId && state.success) router.push(`/admin/khata/qist/${state.planId}`); }, [state, router]);
  const problem = useMemo(() => (rows.length ? scheduleError(total, rows) : null), [rows, total]);
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  const left = (i: number) => total - rows.slice(0, i + 1).reduce((s, r) => s + r.amount, 0);
  const edit = (i: number, k: "amount" | "dueDate", v: string) => { setMode("custom"); setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === "amount" ? Number(v) : v } : r))); };

  return (
    <div className={PAGE}>
      <form action={action} className="space-y-5">
        <Header crumb="Admin › Khata › Qist Plan › Naya" title="Naya Qist Plan">
          <Submit primary={false} label="Draft save" name="submit" value="no" />
          <Submit label="Manzoori ke liye bhejein" name="submit" value="yes" />
        </Header>
        <Msg state={state} />
        <input type="hidden" name="party_type" value={member?.type ?? ""} /><input type="hidden" name="party_id" value={member?.id ?? ""} /><input type="hidden" name="party_name" value={member?.name ?? ""} />
        <input type="hidden" name="deduct_source" value={source} /><input type="hidden" name="origin" value={origin} /><input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="frequency" value={freq} /><input type="hidden" name="rows" value={JSON.stringify(rows)} />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className={CARD}>
            <h3 className="mb-3 font-semibold">Member</h3>
            {member ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10">
                <div><div className="font-semibold">{member.name}</div><Pill tone="blue">{PARTY_LABEL[member.type]}</Pill></div>
                <button type="button" className={BTN} onClick={() => setMember(null)}>Badlein</button>
              </div>
            ) : (
              <div>
                <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="🔍 Naam likhein — staff, kisan, customer, dealer, supplier" className={`${INPUT} w-full`} />
                <div className="mt-2 max-h-56 overflow-auto">{hits.map((h) => (
                  <button type="button" key={`${h.type}-${h.id}`} onClick={() => { setMember(h); setSource(DEFAULT_SOURCE[h.type as QistParty]); setFreq(h.type === "farmer" ? "milk_weekly" : "monthly"); }} className="flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                    <span>{h.name}{h.code ? <span className="text-slate-500"> · {h.code}</span> : null}</span><Pill>{PARTY_LABEL[h.type as QistParty]}</Pill>
                  </button>))}</div>
              </div>
            )}
            <label className="mt-4 block text-sm">Kis cheez ka<br /><select value={origin} onChange={(e) => setOrigin(e.target.value)} className={`${INPUT} w-full`}>{Object.entries(ORIGIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <h4 className="mb-2 mt-4 text-sm font-semibold">Kahan se katega</h4>
            <div className="flex flex-wrap gap-2">{(Object.keys(SOURCE_LABEL) as QistSource[]).map((s) => (
              <button type="button" key={s} disabled={s === "salary" && member?.type !== "staff"} onClick={() => setSource(s)} className={`${chip(source === s)} disabled:opacity-40`}>{SOURCE_LABEL[s]}</button>))}</div>
            <p className="mt-2 text-xs text-slate-500">Adaigi qist se kam ho to jitni adaigi utna katega; kami akhir mein ek jama qist ban jati hai.</p>
            <label className="mt-4 block text-sm">Note (ikhtiyari)<br /><input name="notes" className={`${INPUT} w-full`} /></label>
          </div>
          <div className={CARD}>
            <h3 className="mb-3 font-semibold">Plan</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label>Kul raqam (Rs)<br /><input name="total" type="number" min={1} value={total || ""} onChange={(e) => setTotal(Number(e.target.value))} className={`${INPUT} w-full`} required /></label>
              <label>Qiston ki tadaad<br /><input name="count" type="number" min={1} max={520} value={count} onChange={(e) => setCount(Number(e.target.value))} className={`${INPUT} w-full`} /></label>
            </div>
            <div className="mt-3 text-sm">Qist</div>
            <div className="mt-1 flex gap-2"><button type="button" className={chip(mode === "equal")} onClick={() => setMode("equal")}>Barabar{rows[0] ? `: Rs ${pkr(rows[0].amount)}` : ""}</button><button type="button" className={chip(mode === "custom")} onClick={() => setMode("custom")}>Har qatar alag</button></div>
            <div className="mt-3 text-sm">Schedule</div>
            <div className="mt-1 flex flex-wrap gap-2">{(Object.keys(FREQ_LABEL) as QistFrequency[]).map((f) => <button type="button" key={f} className={chip(freq === f)} onClick={() => setFreq(f)}>{FREQ_LABEL[f]}</button>)}</div>
            <label className="mt-3 block text-sm">Pehli qist<br /><input name="start_date" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} /></label>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <label>Had: adaigi ka % (ikhtiyari)<br /><input name="cap_pct" type="number" step="0.1" min={0} max={100} value={capPct} onChange={(e) => setCapPct(e.target.value)} placeholder="koi had nahi" className={`${INPUT} w-full`} /></label>
              <label>Had: zyada se zyada Rs (ikhtiyari)<br /><input name="cap_amount" type="number" min={0} value={capAmt} onChange={(e) => setCapAmt(e.target.value)} placeholder="koi had nahi" className={`${INPUT} w-full`} /></label>
            </div>
          </div>
        </div>
        <div className={CARD}>
          <h3 className="mb-2 font-semibold">Schedule (qatar badli ja sakti hai ✎)</h3>
          <table className="w-full text-sm">
            <thead><tr><th className={TH}>#</th><th className={TH}>Tareekh</th><th className={`${TH} text-right`}>Qist</th><th className={`${TH} text-right`}>Baqaya</th><th className={TH}>Halat</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.seq}><td className={TD}>{r.seq}</td>
                <td className={TD}><input type="date" value={r.dueDate} onChange={(e) => edit(i, "dueDate", e.target.value)} className={`${INPUT} py-1`} /></td>
                <td className={`${TD} text-right`}><input type="number" min={1} value={r.amount} onChange={(e) => edit(i, "amount", e.target.value)} className={`${INPUT} w-32 py-1 text-right`} /></td>
                <td className={`${TD} text-right tabular-nums`}>{pkr(left(i))}</td><td className={TD}><Pill>Draft</Pill></td></tr>))}
              {rows.length === 0 && <tr><td className={TD} colSpan={5}><span className="text-slate-500">Kul raqam aur tadaad likhein.</span></td></tr>}
            </tbody>
          </table>
          <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold dark:border-white/[0.06]">
            <span>Jama</span><span className={problem ? "text-red-600" : "text-emerald-700 dark:text-emerald-300"}>Rs {pkr(sum)} {problem ? `— ${problem}` : "✓ kul raqam ke barabar"}</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Banane wala khud manzoor nahi kar sakta — Admin/Owner manzoor kare.</div>
        </div>
      </form>
    </div>
  );
}
