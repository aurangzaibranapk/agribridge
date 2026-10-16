"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Support Center se developer/staff ya connected agent ko assign -- wahi PATCH jo chatbot desk chalata hai. */
export function SupportAssignForm({ ticketId, people, agents }: {
  ticketId: string;
  people: { id: string; full_name: string; role: string }[];
  agents: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function assign() {
    if (!choice) return;
    const [kind, value] = [choice.slice(0, choice.indexOf(":")), choice.slice(choice.indexOf(":") + 1)];
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/support/tickets/${ticketId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(kind === "agent" ? { agentKey: value } : { assigneeId: value }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error ?? "Error"); return; }
    setMsg(j.message ?? "Assign ho gaya"); setChoice(""); router.refresh();
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
      <select value={choice} onChange={(e) => setChoice(e.target.value)} className="max-w-[180px] rounded border px-1 py-0.5">
        <option value="">Assign: developer / agent…</option>
        <optgroup label="Staff / Developer">{people.map((p) => <option key={p.id} value={`person:${p.id}`}>{p.full_name} · {p.role}</option>)}</optgroup>
        {agents.length > 0 && <optgroup label="Connected Agents">{agents.map((a) => <option key={a.key} value={`agent:${a.key}`}>{a.label}</option>)}</optgroup>}
      </select>
      <button disabled={busy || !choice} onClick={assign} className="rounded bg-surface-800 px-2 py-0.5 font-semibold text-white disabled:opacity-40">Assign</button>
      {msg && <span className="text-surface-600">{msg}</span>}
    </div>
  );
}
