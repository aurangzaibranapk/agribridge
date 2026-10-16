import Link from "next/link";
import { payrollViewer } from "@/lib/payroll/access";
import { pkr } from "@/lib/recovery/credit-report";
import { PARTY_LABEL, SOURCE_LABEL, type QistParty, type QistSource } from "@/lib/qist/schedule";
import QistApproveButton from "./approve-button";

export const dynamic = "force-dynamic";
const CARD = "rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#111c33]";
const TH = "px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400";
const TD = "px-3 py-2.5 border-t border-slate-100 dark:border-white/[0.06]";
const rs = (n: any) => `Rs ${pkr(Number(n))}`;
const pill = (t: string, c: string) => <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{t}</span>;
const RED = "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300", AMB = "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  BLU = "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300", GRY = "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300";

/** 558: Qist Dashboard -- aaj wajib, overdue, source ke hisaab se, manzoori ka intezar. */
export default async function QistDashboard() {
  const v = await payrollViewer();
  if (!v?.qistMaker) return <div className="p-8 text-center text-slate-500">Ijazat nahi.</div>;
  const sb = v.sb;
  const [{ data: plans }, { data: inst }, { data: profs }] = await Promise.all([
    sb.from("v_qist_plan_summary").select("*").order("created_at", { ascending: false }).limit(1000),
    sb.from("v_qist_installment_status").select("*").in("state", ["overdue", "due_today"]).in("plan_status", ["active", "paused"]).order("due_date").limit(500),
    sb.from("profiles").select("id, full_name"),
  ]);
  const pm = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.full_name]));
  const all = plans ?? [];
  const live = all.filter((p: any) => p.status === "active" || p.status === "paused");
  const due = (inst ?? []).filter((i: any) => i.state === "due_today");
  const over = (inst ?? []).filter((i: any) => i.state === "overdue");
  const sum = (a: any[], k: string) => a.reduce((s, x) => s + Number(x[k] ?? 0), 0);
  const ym = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);
  const { data: monthDed } = await sb.from("qist_deductions").select("amount").gte("created_at", `${ym}-01`);
  const pending = all.filter((p: any) => p.status === "submitted");
  const sources: QistSource[] = ["milk", "salary", "grain", "supplier_bill", "cash"];
  const planOf = new Map<string, any>(all.map((p: any) => [p.id, p]));
  return (
    <div className="space-y-5 bg-[#F6F7FB] p-1 text-slate-900 dark:bg-[#0b1324] dark:text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="text-xs text-slate-500">Admin › Khata › Qist Plans</div><h1 className="text-xl font-bold">Qist Dashboard</h1></div>
        <Link href="/admin/khata/qist/new" className="rounded-xl bg-[#0f6e4f] px-4 py-2 text-sm font-semibold text-white dark:bg-emerald-400 dark:text-[#062a1e]">+ Naya Qist Plan</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className={CARD}><div className="text-xs text-slate-500">Aaj wajib</div><div className="mt-1 text-2xl font-bold tabular-nums">{rs(sum(due, "remaining"))}</div><div className="text-xs text-slate-500">{due.length} qistein</div></div>
        <div className={CARD}><div className="text-xs text-slate-500">Overdue</div><div className="mt-1 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{rs(sum(over, "remaining"))}</div><div className="text-xs text-slate-500">{over.length} qistein</div></div>
        <div className={CARD}><div className="text-xs text-slate-500">Is mahine wasool</div><div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{rs(sum(monthDed ?? [], "amount"))}</div></div>
        <div className={CARD}><div className="text-xs text-slate-500">Chalu plans</div><div className="mt-1 text-2xl font-bold tabular-nums">{live.length}</div><div className="text-xs text-slate-500">manzoori baqi: {pending.length}</div></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={CARD}>
          <h3 className="mb-2 font-semibold">Source ke hisaab se</h3>
          <table className="w-full text-sm"><thead><tr><th className={TH}>Source</th><th className={`${TH} text-right`}>Plans</th><th className={`${TH} text-right`}>Baqaya</th><th className={`${TH} text-right`}>Overdue</th></tr></thead>
            <tbody>{sources.map((s) => { const ps = live.filter((p: any) => p.deduct_source === s); const ov = over.filter((i: any) => i.deduct_source === s); return (
              <tr key={s}><td className={TD}>{SOURCE_LABEL[s]}</td><td className={`${TD} text-right tabular-nums`}>{ps.length}</td><td className={`${TD} text-right tabular-nums`}>{pkr(sum(ps, "outstanding"))}</td><td className={`${TD} text-right tabular-nums`}>{pkr(sum(ov, "remaining"))}</td></tr>); })}
              <tr className="font-bold"><td className={TD}>Kul</td><td className={`${TD} text-right`}>{live.length}</td><td className={`${TD} text-right tabular-nums`}>{pkr(sum(live, "outstanding"))}</td><td className={`${TD} text-right tabular-nums`}>{pkr(sum(over, "remaining"))}</td></tr>
            </tbody></table>
        </div>
        <div className={CARD}>
          <h3 className="mb-2 font-semibold">Manzoori ka intezar</h3>
          <table className="w-full text-sm"><thead><tr><th className={TH}>Member</th><th className={`${TH} text-right`}>Raqam</th><th className={TH}>Banaya</th><th className={TH} /></tr></thead>
            <tbody>{pending.map((p: any) => (
              <tr key={p.id}><td className={TD}><Link className="font-medium hover:underline" href={`/admin/khata/qist/${p.id}`}>{p.party_name ?? p.code}</Link><div className="text-xs text-slate-500">{p.code} · {PARTY_LABEL[p.party_type as QistParty]}</div></td>
                <td className={`${TD} text-right tabular-nums`}>{pkr(p.total)}</td><td className={TD}>{pm.get(p.created_by) ?? "—"}</td>
                <td className={TD}>{v.approver && p.created_by !== v.id ? <QistApproveButton planId={p.id} /> : pill("Admin/Owner", AMB)}</td></tr>))}
              {pending.length === 0 && <tr><td className={TD} colSpan={4}><span className="text-slate-500">Koi plan manzoori ke intezar mein nahi.</span></td></tr>}
            </tbody></table>
        </div>
      </div>
      <div className={`${CARD} overflow-auto`}>
        <h3 className="mb-2 font-semibold">Overdue / aaj wajib</h3>
        <table className="w-full min-w-[820px] text-sm"><thead><tr>{["Member", "Qism", "Source", "Qist", "Raqam", "Din", "Halat"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{[...over, ...due].map((i: any) => { const p = planOf.get(i.plan_id); return (
            <tr key={i.id}><td className={TD}><Link className="font-medium hover:underline" href={`/admin/khata/qist/${i.plan_id}`}>{i.party_name ?? i.code}</Link></td>
              <td className={TD}>{PARTY_LABEL[i.party_type as QistParty]}</td><td className={TD}>{SOURCE_LABEL[i.deduct_source as QistSource]}</td>
              <td className={TD}>{i.is_carry ? "Jama (akhri)" : `${i.seq}/${p?.installments_count ?? "?"}`}</td><td className={`${TD} tabular-nums`}>{pkr(i.remaining)}</td>
              <td className={TD}>{i.state === "due_today" ? "aaj" : `${i.days_late} din`}</td>
              <td className={TD}>{i.plan_status === "paused" ? pill("Rok diya · Admin", GRY) : i.state === "due_today" ? pill(i.deduct_source === "cash" ? "Aaj wasool karein" : "Agli adaigi mein katega", AMB) : i.deduct_source === "salary" ? pill("Payroll mein", BLU) : pill("Overdue", RED)}</td></tr>); })}
            {over.length + due.length === 0 && <tr><td className={TD} colSpan={7}><span className="text-slate-500">Aaj koi qist wajib ya overdue nahi.</span></td></tr>}
          </tbody></table>
      </div>
      <div className={`${CARD} overflow-auto`}>
        <h3 className="mb-2 font-semibold">Sab plans</h3>
        <table className="w-full min-w-[820px] text-sm"><thead><tr>{["Plan", "Member", "Source", "Kul", "Ada", "Baqaya", "Agli", "Halat"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{all.map((p: any) => (
            <tr key={p.id}><td className={TD}><Link className="font-semibold hover:underline" href={`/admin/khata/qist/${p.id}`}>{p.code}</Link></td><td className={TD}>{p.party_name ?? "—"}<div className="text-xs text-slate-500">{PARTY_LABEL[p.party_type as QistParty]}</div></td>
              <td className={TD}>{SOURCE_LABEL[p.deduct_source as QistSource]}</td><td className={`${TD} tabular-nums`}>{pkr(p.total)}</td><td className={`${TD} tabular-nums`}>{pkr(p.paid_amount)}</td><td className={`${TD} tabular-nums`}>{pkr(p.outstanding)}</td>
              <td className={TD}>{p.next_due_date ?? "—"}</td><td className={TD}>{p.status}</td></tr>))}
            {all.length === 0 && <tr><td className={TD} colSpan={8}><span className="text-slate-500">Abhi koi qist plan nahi.</span></td></tr>}
          </tbody></table>
      </div>
    </div>
  );
}
