"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, HandCoins, MessageCircle } from "lucide-react";

export type RecoveryParty = { type: string; id: string; name: string; phone: string | null; email: string | null; outstanding: number; lastActivity: string | null };

export function RecoveryClient({ parties }: { parties: RecoveryParty[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"schedule"|"promise"|null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const chosen = useMemo(() => parties.filter((p) => selected.has(`${p.type}:${p.id}`)), [parties, selected]);
  const toggle = (key: string) => setSelected((old) => { const next=new Set(old); next.has(key)?next.delete(key):next.add(key); return next; });
  const statementHref = (p: RecoveryParty) => p.type === "customer" ? `/admin/crm/${p.id}/statement` : p.type === "farmer" ? `/admin/farmers/${p.id}/statement` : p.type === "dealer" ? `/admin/dealers/${p.id}/statement` : `/admin/suppliers/${p.id}/statement`;

  async function submit(form: FormData) {
    if (!chosen.length) return setNotice("Pehle account select karein.");
    setBusy(true); setNotice("");
    const action = String(form.get("action"));
    const payload = { action, parties: chosen, channel: "whatsapp", dueDate: form.get("dueDate"), scheduledAt: form.get("scheduledAt"), promiseDate: form.get("promiseDate"), amount: form.get("amount"), notes: form.get("notes") };
    const res = await fetch("/api/recovery", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    const json = await res.json(); setBusy(false);
    if (!res.ok) return setNotice(json.error || "Kaam mukammal nahi hua.");
    setNotice(`${json.count} account update ho gaye${json.sent !== undefined ? `; ${json.sent} WhatsApp sent` : ""}.`); setMode(null);
  }

  return <>
    <div className="flex flex-wrap items-center gap-2 border-b border-surface-100 p-3 dark:border-surface-800">
      <span className="mr-auto text-sm font-medium">{chosen.length} selected</span>
      <button disabled={!chosen.length||busy} onClick={()=>{const f=new FormData();f.set("action","send");submit(f)}} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-40"><MessageCircle className="h-4 w-4"/>Send WhatsApp</button>
      <button disabled={!chosen.length||busy} onClick={()=>setMode("schedule")} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><CalendarClock className="h-4 w-4"/>Schedule</button>
      <button disabled={!chosen.length||busy} onClick={()=>setMode("promise")} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><HandCoins className="h-4 w-4"/>Promise to Pay</button>
      {notice && <p className="w-full text-xs text-surface-600">{notice}</p>}
    </div>
    <div className="max-h-[calc(100vh-24rem)] overflow-auto">
      <table className="w-full min-w-[850px] text-sm"><thead className="sticky top-0 bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800"><tr><th className="px-3 py-3"><input type="checkbox" checked={selected.size===parties.length&&parties.length>0} onChange={(e)=>setSelected(e.target.checked?new Set(parties.map(p=>`${p.type}:${p.id}`)):new Set())}/></th><th className="px-3 py-3">Party</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Last Activity</th><th className="px-3 py-3 text-right">Outstanding</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
      <tbody>{parties.map(p=><tr key={`${p.type}:${p.id}`} className="border-t border-surface-100 dark:border-surface-800"><td className="px-3 py-3"><input type="checkbox" checked={selected.has(`${p.type}:${p.id}`)} onChange={()=>toggle(`${p.type}:${p.id}`)}/></td><td className="px-3 py-3 font-medium">{p.name}</td><td className="px-3 py-3 capitalize text-surface-500">{p.type}</td><td className="px-3 py-3 text-surface-500">{p.phone||"Phone missing"}</td><td className="px-3 py-3 text-surface-500">{p.lastActivity||"—"}</td><td className="px-3 py-3 text-right font-semibold text-red-700">Rs {Math.round(p.outstanding).toLocaleString("en-PK")}</td><td className="px-3 py-3 text-right"><Link href={statementHref(p)} className="rounded-lg border px-3 py-1.5">Statement</Link></td></tr>)}</tbody></table>
    </div>
    {mode && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><form action={submit} className="w-full max-w-md space-y-3 rounded-card bg-white p-5 shadow-xl dark:bg-surface-900"><h2 className="text-lg font-semibold">{mode==="schedule"?"Schedule Reminder":"Promise to Pay"}</h2><input type="hidden" name="action" value={mode}/>{mode==="schedule"?<><label className="block text-sm">Due date<input name="dueDate" type="date" className="mt-1 w-full rounded-lg border p-2"/></label><label className="block text-sm">Send date & time<input required name="scheduledAt" type="datetime-local" className="mt-1 w-full rounded-lg border p-2"/></label></>:<><label className="block text-sm">Promised amount<input required name="amount" type="number" min="1" className="mt-1 w-full rounded-lg border p-2"/></label><label className="block text-sm">Promise date<input required name="promiseDate" type="date" className="mt-1 w-full rounded-lg border p-2"/></label><textarea name="notes" placeholder="Notes" className="w-full rounded-lg border p-2"/></>}<div className="flex gap-2"><button type="button" onClick={()=>setMode(null)} className="flex-1 rounded-lg border p-2">Cancel</button><button disabled={busy} className="flex-1 rounded-lg bg-emerald-600 p-2 text-white">{busy?"Saving...":"Save"}</button></div></form></div>}
  </>;
}
