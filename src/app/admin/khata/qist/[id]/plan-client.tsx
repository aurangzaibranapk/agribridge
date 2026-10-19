"use client";
import Link from "next/link";
import { useState } from "react";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { qistAction, receiveQistCash, type QistState } from "@/actions/qist";
import { BTN, CARD, Header, INPUT, Kpi, Msg, PAGE, Pill, STATUS_TONE, Submit, TD, TH, pkr, rs } from "@/components/payroll/ui";
import { FREQ_LABEL, PARTY_LABEL, PLAN_EVENT_LABEL, PLAN_STATUS_LABEL, SOURCE_LABEL, equalAmounts, type QistFrequency, type QistParty, type QistSource } from "@/lib/qist/schedule";

const STATE: Record<string, [string, any]> = {
  paid: ["Kat gayi", "green"], partial: ["Kam kati · baqi akhir mein", "amber"], overdue: ["Overdue", "red"], due_today: ["Aaj wajib", "amber"],
  upcoming: ["Baqi", "gray"], written_off: ["Maaf", "red"], cancelled: ["Badal di gayi", "gray"],
};
const SRC_TXT: Record<string, string> = { milk_payment_qist: "doodh", payroll_lines: "tankhwah", finance_transactions: "naqad", grain_payment_qist: "anaj", supplier_payment_qist: "supplier bill" };

export default function QistPlanClient({ me, plan, installments, accounts, events, deductions }: any) {
  const [s, act] = useFormState(qistAction, {} as QistState);
  const [cs, cashAct] = useFormState(receiveQistCash, {} as QistState);
  const [mode, setMode] = useState<null | "pause" | "reschedule" | "write_off" | "reject" | "cancel">(null);
  const open = installments.filter((i: any) => i.status === "due");
  const [resRows, setResRows] = useState<{ dueDate: string; amount: number }[]>([]);
  const startReschedule = () => {
    const out = Number(plan.outstanding);
    const n = Math.max(open.length, 1);
    setResRows(equalAmounts(out, n).map((amount, i) => ({ dueDate: open[i]?.due_date ?? open[open.length - 1]?.due_date ?? new Date().toISOString().slice(0, 10), amount })));
    setMode("reschedule");
  };
  const next = open.find((i: any) => i.state !== "upcoming") ?? open[0];
  const regular = installments.filter((i: any) => !i.is_carry && i.status !== "cancelled").length;
  const isOwnStaff = plan.party_type === "staff" && plan.party_id === me.id;
  const live = plan.status === "active" || plan.status === "paused";
  const resSum = resRows.reduce((t, r) => t + Number(r.amount || 0), 0);

  return (
    <div className={PAGE}>
      <Header crumb="Admin › Khata › Qist Plan" title={`${plan.party_name ?? "Member"} — ${plan.code}`}>
        <Link href="/admin/khata/qist" className={BTN}>Qist Dashboard</Link>
      </Header>
      <Msg state={s} /><Msg state={cs} />
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Baqaya (is plan ka)" value={rs(plan.outstanding)} tone="red" />
        <Kpi label="Qist plan" value={<Pill tone={STATUS_TONE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Pill>} sub={`${PARTY_LABEL[plan.party_type as QistParty]} · ${SOURCE_LABEL[plan.deduct_source as QistSource]}`} />
        <Kpi label="Agli qist" value={next ? rs(next.remaining) : "—"} sub={next ? `${next.due_date}${next.is_carry ? " · jama (akhri)" : ""}` : ""} />
        <Kpi label="Ada / kul" value={`${pkr(plan.paid_amount)} / ${pkr(plan.total)}`} sub={plan.written_off_amount > 0 ? `Maaf: ${rs(plan.written_off_amount)}` : undefined} />
      </div>
      <div className={CARD}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Qist Plan {plan.code} · {SOURCE_LABEL[plan.deduct_source as QistSource]} se · {regular} qistein · {FREQ_LABEL[plan.frequency as QistFrequency]}</h3>
          <div className="text-xs text-slate-500">Had: {plan.cap_pct ? `${plan.cap_pct}% adaigi ka` : "koi % nahi"}{plan.cap_amount ? ` · max ${rs(plan.cap_amount)}` : ""} · Banaya: {plan.creator ?? "—"}{plan.approverName ? ` · Manzoor: ${plan.approverName}` : ""}</div>
        </div>
        <table className="w-full text-sm">
          <thead><tr><th className={TH}>#</th><th className={TH}>Tareekh</th><th className={`${TH} text-right`}>Qist</th><th className={`${TH} text-right`}>Kata</th><th className={`${TH} text-right`}>Akhir mein gaya</th><th className={`${TH} text-right`}>Baqi</th><th className={TH}>Halat</th></tr></thead>
          <tbody>{installments.map((i: any) => {
            const [t, tone] = STATE[i.state] ?? [i.state, "gray"];
            return (
              <tr key={i.id} className={i.status === "cancelled" ? "opacity-50" : ""}>
                <td className={TD}>{i.is_carry ? "Jama" : i.seq}</td><td className={TD}>{i.due_date}</td>
                <td className={`${TD} text-right tabular-nums`}>{pkr(i.amount_due)}</td><td className={`${TD} text-right tabular-nums`}>{+i.amount_deducted ? pkr(i.amount_deducted) : "—"}</td>
                <td className={`${TD} text-right tabular-nums`}>{+i.carried_out ? pkr(i.carried_out) : "—"}</td><td className={`${TD} text-right tabular-nums`}>{i.status === "due" ? pkr(i.remaining) : "—"}</td>
                <td className={TD}><Pill tone={tone}>{plan.status === "paused" && i.status === "due" ? "Ruka hua" : t}</Pill></td>
              </tr>);
          })}</tbody>
        </table>

        {me.maker && plan.status === "draft" && (
          <form action={act} className="mt-4 flex justify-end gap-2"><input type="hidden" name="plan_id" value={plan.id} /><input type="hidden" name="action" value="submit" /><Submit label="Manzoori ke liye bhejein" /></form>
        )}
        {me.approver && plan.status === "submitted" && plan.created_by !== me.id && !isOwnStaff && (
          <div className="mt-4 flex justify-end gap-2">
            <form action={act}><input type="hidden" name="plan_id" value={plan.id} /><input type="hidden" name="action" value="approve" /><Submit label="Manzoor karein" /></form>
            <button className={BTN} onClick={() => setMode("reject")}>Rad</button>
          </div>
        )}
        {me.approver && plan.status === "submitted" && plan.created_by === me.id && <p className="mt-3 text-right text-xs text-amber-600">Aap ne banaya hai — koi aur Admin/Owner manzoor kare.</p>}
        {me.approver && live && !isOwnStaff && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={BTN} onClick={() => setMode("pause")}>{plan.status === "paused" ? "▶ Chalu karein" : "⏸ Rokein"}</button>
            <button className={BTN} onClick={startReschedule}>📅 Dobara schedule / had</button>
            <button className={`${BTN} text-red-600`} onClick={() => setMode("write_off")}>Maaf (write-off) — wajah lazmi</button>
          </div>
        )}
        {me.approver && (plan.status === "draft" || plan.status === "submitted") && <button className={`${BTN} mt-3`} onClick={() => setMode("cancel")}>Cancel</button>}

        {mode && mode !== "reschedule" && (
          <form action={act} className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <input type="hidden" name="plan_id" value={plan.id} />
            <input type="hidden" name="action" value={mode === "pause" ? (plan.status === "paused" ? "resume" : "pause") : mode} />
            <input name="reason" required minLength={mode === "write_off" ? 5 : 1} placeholder={mode === "write_off" ? `Wajah — ${rs(plan.outstanding)} maaf hoga (Bad debt 6075 Dr)` : "Wajah"} className={`${INPUT} flex-1`} />
            <Submit label="Tasdeeq" /><button type="button" className={BTN} onClick={() => setMode(null)}>Chhorein</button>
          </form>
        )}
        {mode === "reschedule" && (
          <form action={act} className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
            <input type="hidden" name="plan_id" value={plan.id} /><input type="hidden" name="action" value="reschedule" /><input type="hidden" name="rows" value={JSON.stringify(resRows)} />
            <div className="font-semibold">Naya schedule — jama {rs(resSum)} / baqaya {rs(plan.outstanding)}</div>
            {resRows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input type="date" value={r.dueDate} onChange={(e) => setResRows(resRows.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} className={`${INPUT} py-1`} />
                <input type="number" value={r.amount} onChange={(e) => setResRows(resRows.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} className={`${INPUT} w-32 py-1`} />
                <button type="button" className={BTN} onClick={() => setResRows(resRows.filter((_, j) => j !== i))}>−</button>
              </div>))}
            <button type="button" className={BTN} onClick={() => setResRows([...resRows, { dueDate: resRows[resRows.length - 1]?.dueDate ?? "", amount: 0 }])}>+ Qatar</button>
            <div className="flex flex-wrap gap-2">
              <input name="cap_pct" type="number" step="0.1" defaultValue={plan.cap_pct ?? ""} placeholder="Had % (khali = nahi)" className={`${INPUT} w-40`} />
              <input name="cap_amount" type="number" defaultValue={plan.cap_amount ?? ""} placeholder="Had Rs (khali = nahi)" className={`${INPUT} w-40`} />
              <input name="reason" required placeholder="Wajah" className={`${INPUT} flex-1`} />
              <Submit label="Save" /><button type="button" className={BTN} onClick={() => setMode(null)}>Chhorein</button>
            </div>
          </form>
        )}
        {plan.deduct_source === "cash" && plan.status === "active" && me.maker && (
          <form action={cashAct} className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
            <input type="hidden" name="plan_id" value={plan.id} />
            <span className="text-sm font-semibold">Naqad wasooli</span>
            <input name="amount" type="number" min={1} defaultValue={next ? Number(next.remaining) : ""} className={`${INPUT} w-32`} />
            <select name="account_id" required className={INPUT}><option value="">Khata…</option>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <Submit label="Wasool karein" />
          </form>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={CARD}>
          <h3 className="mb-2 font-semibold">Kattautiyan</h3>
          <table className="w-full text-sm"><thead><tr><th className={TH}>Tareekh</th><th className={TH}>Kahan se</th><th className={`${TH} text-right`}>Raqam</th><th className={TH}>Journal</th></tr></thead>
            <tbody>{deductions.map((d: any) => <tr key={d.id}><td className={TD}>{new Date(d.created_at).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}</td><td className={TD}>{SRC_TXT[d.source_table] ?? d.source_table}</td><td className={`${TD} text-right tabular-nums`}>{pkr(d.amount)}</td><td className={TD}>{d.journal_entry_id ? <Pill tone="green">✓</Pill> : <Pill tone="amber">baqi</Pill>}</td></tr>)}
              {deductions.length === 0 && <tr><td className={TD} colSpan={4}><span className="text-slate-500">Abhi koi kattauti nahi.</span></td></tr>}</tbody></table>
        </div>
        <div className={CARD}>
          <h3 className="mb-2 font-semibold">Record (audit)</h3>
          <table className="w-full text-sm"><tbody>{events.map((e: any) => <tr key={e.id}><td className={TD}>{new Date(e.at).toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" })} PKT</td><td className={TD}>{PLAN_EVENT_LABEL[e.action] ?? e.action}{e.amount != null ? ` · ${pkr(e.amount)}` : ""}</td><td className={TD}>{e.reason ?? ""}</td><td className={TD}>{e.by ?? "—"}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}
