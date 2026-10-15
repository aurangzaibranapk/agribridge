"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SupportStatusForm({ ticketId, status, priority, module, labels }: {
  ticketId: string; status: string; priority: string; module: string;
  labels: { update: string; note: string; statuses: string[]; priorities: string[] };
}) {
  const router = useRouter();
  const [s, setS] = useState(status);
  const [p, setP] = useState(priority);
  const [m, setM] = useState(module);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/support/center", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket_id: ticketId, status: s !== status ? s : undefined, priority: p !== priority ? p : undefined, module: m !== module ? m : undefined, note }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error ?? "Error"); return; }
    setNote(""); router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      <select value={s} onChange={(e) => setS(e.target.value)} className="rounded border px-1 py-0.5">{labels.statuses.map((x) => <option key={x}>{x}</option>)}</select>
      <select value={p} onChange={(e) => setP(e.target.value)} className="rounded border px-1 py-0.5">{labels.priorities.map((x) => <option key={x}>{x}</option>)}</select>
      <input value={m} onChange={(e) => setM(e.target.value)} className="w-24 rounded border px-1 py-0.5" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={labels.note} className="w-40 rounded border px-1 py-0.5" />
      <button disabled={busy} onClick={submit} className="rounded bg-brand-700 px-2 py-0.5 font-semibold text-white disabled:opacity-50">{labels.update}</button>
      {msg && <span className="text-red-600">{msg}</span>}
    </div>
  );
}
