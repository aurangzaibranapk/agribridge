"use client";
import { useMemo, useState } from "react";
import type { KhataResult, KhataCustomer } from "@/lib/desk/customer-khata";
import { Pager } from "@/components/guided/desk-workspace";
const money = (n: number) => `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

export function CustomerKhata({ data, today }: { data: KhataResult; today: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("outstanding");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<KhataCustomer | null>(null);
  const [entryPage, setEntryPage] = useState(0);
  const soon = new Date(`${today}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + 7);
  const until = soon.toISOString().slice(0, 10);
  const status = (c: KhataCustomer) => c.outstanding <= 0 ? "Settled / Advance" : !c.promiseDate ? "Date not recorded" : c.promiseDate < today ? "Overdue promise" : c.promiseDate === today ? "Today" : c.promiseDate <= until ? "Next 7 days" : "Upcoming";
  const filtered = useMemo(() => data.customers.filter(c => `${c.name} ${c.phone || ""}`.toLowerCase().includes(q.toLowerCase()) &&
    (filter === "all" || (c.outstanding > 0 && (filter === "outstanding" || (filter === "overdue" && c.promiseDate && c.promiseDate < today) || (filter === "today" && c.promiseDate === today) || (filter === "soon" && c.promiseDate && c.promiseDate > today && c.promiseDate <= until))))), [data.customers, q, filter, today, until]);
  const actualPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 6) - 1));
  if (data.error) return <div role="alert" className="desk-card text-sm text-amber-800">{data.error}</div>;
  return <div className="flex min-h-0 flex-col gap-3">
    <div className="grid grid-cols-4 gap-2">{[
      ["Total Lena Baqi", money(data.customers.reduce((s,c) => s + Math.max(0,c.outstanding),0))],
      ["Aaj promise due", data.datesAvailable ? String(data.customers.filter(c => c.outstanding > 0 && c.promiseDate === today).length) : "—"],
      ["Agle 7 din", data.datesAvailable ? String(data.customers.filter(c => c.outstanding > 0 && c.promiseDate && c.promiseDate > today && c.promiseDate <= until).length) : "—"],
      ["Overdue promises", data.datesAvailable ? String(data.customers.filter(c => c.outstanding > 0 && c.promiseDate && c.promiseDate < today).length) : "—"],
    ].map(([label,value]) => <div key={label} className="desk-card"><p className="text-xs text-surface-500">{label}</p><p className="desk-metric">{value}</p></div>)}</div>
    <div className="desk-card">
      <div className="mb-3 flex items-center gap-2"><input aria-label="Search customer" value={q} onChange={e => {setQ(e.target.value);setPage(0);}} placeholder="Customer / mobile search" className="min-w-0 flex-1 rounded-lg border p-2 text-sm dark:bg-surface-900"/><select aria-label="Filter customer dues" value={filter} onChange={e => {setFilter(e.target.value);setPage(0);}} className="rounded-lg border p-2 text-sm dark:bg-surface-900"><option value="outstanding">Lena baqi</option><option value="today">Aaj due</option><option value="soon">Agle 7 din</option><option value="overdue">Overdue</option><option value="all">All customers</option></select></div>
      <p className="mb-2 text-xs text-surface-500">{data.scope} · Dates are recorded payment promises, not inferred invoice due dates.</p>
      {!data.datesAvailable && <p role="alert" className="text-xs text-amber-700">Payment dates load nahi huin; balances neeche available hain.</p>}
      <table className="desk-table"><thead><tr><th>Customer</th><th>Udhaar / debits</th><th>Wapsi / credits*</th><th>Lena baqi</th><th>Promise date</th><th>Status</th><th>Detail</th></tr></thead><tbody>
        {filtered.slice(actualPage*6,actualPage*6+6).map(c => <tr key={c.id}><td><strong>{c.name}</strong><div className="text-surface-500">{c.phone}</div></td><td>{money(c.debit)}</td><td>{money(c.credit)}</td><td className="font-semibold">{money(c.outstanding)}</td><td>{c.promiseDate || "—"}</td><td>{status(c)}</td><td><button className="rounded border px-2 py-1" onClick={() => {setSelected(c);setEntryPage(0);}}>View</button></td></tr>)}
        {!filtered.length && <tr><td colSpan={7}>Is filter mein koi customer nahi.</td></tr>}
      </tbody></table><Pager page={actualPage} count={filtered.length} size={6} onChange={setPage}/>
      <p className="text-[11px] text-surface-500">*Credits mein payment ke saath returns/adjustments bhi ho sakti hain; View mein har entry ka source dekhein.</p>
    </div>
    {selected && <div className="fixed inset-0 z-[100] bg-black/30" onClick={() => setSelected(null)}><section role="dialog" aria-modal="true" aria-label="Customer ledger" className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col gap-4 overflow-auto bg-white p-5 shadow-xl dark:bg-surface-900" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between"><div><h2 className="text-xl font-semibold">{selected.name} — Khata</h2><p className="text-sm">{selected.phone} · {data.scope}</p></div><button autoFocus onClick={() => setSelected(null)} className="rounded border px-3 py-1">Close</button></div>
      <div className="grid grid-cols-3 gap-3">{[["Total debits",selected.debit],["Total credits",selected.credit],["Lena baqi",selected.outstanding]].map(([label,value]) => <div key={label} className="desk-card"><p className="text-xs">{label}</p><strong>{money(Number(value))}</strong></div>)}</div>
      <p className="text-sm">Agla payment promise: {selected.promiseDate || "Date record nahi hui"}{selected.promiseAmount != null ? ` · ${money(selected.promiseAmount)}` : ""}</p>
      <table className="desk-table"><thead><tr><th>Date</th><th>Reference / source</th><th>Detail</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{selected.entries.slice(entryPage*8,entryPage*8+8).map((e,i) => <tr key={`${e.number}-${i}`}><td>{e.date}</td><td>{e.number}<div>{e.module}</div></td><td>{e.description}</td><td>{money(e.debit)}</td><td>{money(e.credit)}</td></tr>)}</tbody></table>
      <Pager page={entryPage} count={selected.entries.length} size={8} onChange={setEntryPage}/>
      <p className="text-xs text-surface-500">Yeh read-only ledger hai. Payment Receive ke liye Load & Bill ka existing workflow use karein.</p>
    </section></div>}
  </div>;
}
