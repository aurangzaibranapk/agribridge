"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, ClipboardPaste, RefreshCw, Send, X } from "lucide-react";

type Person = { id: string; full_name: string; role: string };
type Agent = { key: string; label: string };
type Comment = { id: string; body: string; source_label?: string | null; created_at: string; author?: { full_name?: string } | null };
type Ticket = {
  id: string; ticket_no: number; title: string; description: string; priority: string; status: string;
  page_url: string | null; screenshotUrl: string | null; created_at: string; resolution_note: string | null;
  assigned_kind?: "person" | "agent" | null; assigned_agent?: string | null; assignment_status?: string | null;
  reporter?: { full_name?: string }; assignee?: { full_name?: string }; comments?: Comment[];
};

const statusLabel: Record<string, string> = { new: "New", assigned: "Assigned", investigating: "Investigation", testing: "Testing", resolved: "Resolved", reopened: "Reopened" };
const statusTone: Record<string, string> = { new: "bg-blue-100 text-blue-800", assigned: "bg-violet-100 text-violet-800", investigating: "bg-amber-100 text-amber-800", testing: "bg-cyan-100 text-cyan-800", resolved: "bg-green-100 text-green-800", reopened: "bg-red-100 text-red-800" };

export function SupportDesk({ pathname }: { pathname: string }) {
  const [items, setItems] = useState<Ticket[]>([]), [assignees, setAssignees] = useState<Person[]>([]), [agents, setAgents] = useState<Agent[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({}), [canManage, setCanManage] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [sent, setSent] = useState(""), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false), [busyId, setBusyId] = useState("");
  const formRef = useRef<HTMLFormElement>(null), fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/support/tickets", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setItems(data.items ?? []); setAssignees(data.assignees ?? []); setAgents(data.agents ?? []); setCanManage(Boolean(data.canManage)); setError(""); }
    else setError(data.error ?? "Tickets load nahi huay.");
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => { const image = Array.from(event.clipboardData?.files ?? []).find((candidate) => candidate.type.startsWith("image/")); if (image) { event.preventDefault(); choose(image); } };
    window.addEventListener("paste", paste); return () => window.removeEventListener("paste", paste);
  }, []);
  function choose(next: File | null) { if (!next) return; if (!next.type.startsWith("image/")) { setError("Sirf screenshot image lagayein."); return; } setFile(next); setPreview(URL.createObjectURL(next)); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSent(""); const fd = new FormData(event.currentTarget); if (file) fd.set("screenshot", file);
    fd.set("page_url", location.href || pathname); fd.set("device_info", JSON.stringify({ browser: navigator.userAgent, screen: `${screen.width}x${screen.height}`, language: navigator.language, online: navigator.onLine }));
    const response = await fetch("/api/support/tickets", { method: "POST", body: fd }); const data = await response.json();
    if (response.ok) { setSent(`Issue ISS-${new Date().getFullYear()}-${String(data.ticket.ticket_no).padStart(5, "0")} report ho gaya.`); formRef.current?.reset(); setFile(null); setPreview(""); await load(); }
    else setError(data.error ?? "Issue report nahi hua."); setSaving(false);
  }
  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id); setError(""); setSent(""); const response = await fetch(`/api/support/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json();
    if (response.ok) { setSent(data.message ?? "Issue update ho gaya."); await load(); } else setError(data.error ?? "Issue update nahi hua."); setBusyId("");
  }
  async function update(id: string, status: string) { const note = status === "resolved" ? prompt("Fix/solution note likhein:") ?? "" : ""; await patch(id, { status, note, assignToMe: status === "assigned" }); }
  async function assign(ticket: Ticket) { const [kind, value] = (choices[ticket.id] ?? "").split(":", 2); if (!value) { setError("Pehle developer/staff ya connected agent chunein."); return; } await patch(ticket.id, kind === "agent" ? { agentKey: value } : { assigneeId: value }); }

  return <div className="flex-1 overflow-y-auto p-3">
    <form ref={formRef} onSubmit={submit} className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900 dark:bg-brand-950/20">
      <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-brand-700"/><p className="text-xs font-semibold text-surface-900 dark:text-white">Issue Report Karein</p></div>
      <input name="title" required minLength={3} maxLength={160} placeholder="Maslay ka chhota title" className="w-full rounded-lg border border-surface-200 px-2.5 py-2 text-xs dark:border-surface-700 dark:bg-surface-800"/>
      <textarea name="description" required minLength={3} maxLength={5000} rows={3} placeholder="Kya issue aa raha hai? Kya karte waqt aaya?" className="w-full resize-none rounded-lg border border-surface-200 px-2.5 py-2 text-xs dark:border-surface-700 dark:bg-surface-800"/>
      <select name="priority" className="w-full rounded-lg border border-surface-200 px-2.5 py-2 text-xs dark:border-surface-700 dark:bg-surface-800"><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="work_stopped">Kaam ruk gaya</option></select>
      {preview && <div className="relative"><img src={preview} alt="Screenshot preview" className="max-h-36 w-full rounded-lg border object-contain"/><button type="button" onClick={() => { setFile(null); setPreview(""); }} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3"/></button></div>}
      <div className="flex gap-2"><button type="button" onClick={() => fileRef.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-surface-300 bg-white px-2 py-2 text-[11px] dark:bg-surface-800"><Camera className="h-3.5 w-3.5"/> Screenshot</button><span className="flex items-center gap-1 text-[10px] text-surface-500"><ClipboardPaste className="h-3.5 w-3.5"/> Ctrl+V bhi chalega</span></div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => choose(event.target.files?.[0] ?? null)}/>
      <button disabled={saving} className="flex w-full items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Send className="h-3.5 w-3.5"/>{saving ? "Report ho raha hai…" : "Admin/Developer ko bhejein"}</button>
    </form>
    {error && <p className="mt-2 rounded bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}{sent && <p className="mt-2 rounded bg-green-50 p-2 text-[11px] text-green-700">{sent}</p>}
    <div className="mt-3 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase text-surface-500">{canManage ? "Tamam Issues" : "Mere Issues"}</p><button onClick={() => void load()} className="text-surface-500"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}/></button></div>
    <div className="mt-2 space-y-2">{!loading && items.length === 0 && <p className="py-4 text-center text-xs text-surface-400">Abhi koi issue report nahi hua.</p>}{items.map((ticket) => <article key={ticket.id} className="rounded-lg border border-surface-200 p-2.5 dark:border-surface-700">
      <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-surface-900 dark:text-white">ISS-{new Date(ticket.created_at).getFullYear()}-{String(ticket.ticket_no).padStart(5, "0")} · {ticket.title}</p><p className="mt-0.5 text-[10px] text-surface-400">{ticket.reporter?.full_name ?? "Staff"} · {new Date(ticket.created_at).toLocaleString()}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${statusTone[ticket.status] ?? "bg-surface-100"}`}>{statusLabel[ticket.status] ?? ticket.status}</span></div>
      <p className="mt-2 whitespace-pre-wrap text-[11px] text-surface-600 dark:text-surface-300">{ticket.description}</p>{ticket.screenshotUrl && <a href={ticket.screenshotUrl} target="_blank" rel="noreferrer"><img src={ticket.screenshotUrl} alt="Issue screenshot" className="mt-2 max-h-28 w-full rounded border object-contain"/></a>}
      {(ticket.assignee?.full_name || ticket.assigned_agent) && <p className="mt-2 rounded bg-violet-50 px-2 py-1 text-[10px] text-violet-800">Assigned: {ticket.assignee?.full_name ?? ticket.assigned_agent} {ticket.assignment_status ? `· ${ticket.assignment_status}` : ""}</p>}
      {ticket.comments?.map((comment) => <div key={comment.id} className="mt-2 rounded bg-surface-50 p-2 text-[10px] dark:bg-surface-800"><b>{comment.author?.full_name ?? comment.source_label ?? "System"}:</b> {comment.body}</div>)}
      {ticket.resolution_note && <p className="mt-2 rounded bg-green-50 p-2 text-[10px] text-green-800"><CheckCircle2 className="mr-1 inline h-3 w-3"/>{ticket.resolution_note}</p>}
      {canManage && ticket.status !== "resolved" && <div className="mt-2 flex gap-1"><select value={choices[ticket.id] ?? ""} onChange={(event) => setChoices((old) => ({ ...old, [ticket.id]: event.target.value }))} className="min-w-0 flex-1 rounded border border-surface-200 px-1.5 py-1 text-[10px] dark:bg-surface-800"><option value="">Developer / Agent chunein</option><optgroup label="Staff / Developer">{assignees.map((person) => <option key={person.id} value={`person:${person.id}`}>{person.full_name} · {person.role}</option>)}</optgroup>{agents.length > 0 && <optgroup label="Connected AI Agents">{agents.map((agent) => <option key={agent.key} value={`agent:${agent.key}`}>{agent.label}</option>)}</optgroup>}</select><button disabled={busyId === ticket.id} onClick={() => void assign(ticket)} className="rounded bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50">Assign</button></div>}
      {canManage && agents.length === 0 && ticket.status !== "resolved" && <p className="mt-1 text-[9px] text-surface-400">AI agent secure webhook connect hone par yahan nazar aayega.</p>}
      <div className="mt-2 flex flex-wrap gap-1">{canManage && ticket.status === "new" && <button onClick={() => void update(ticket.id, "assigned")} className="rounded bg-violet-100 px-2 py-1 text-[10px] text-violet-800">Mujhe assign</button>}{canManage && !["resolved", "testing"].includes(ticket.status) && <button onClick={() => void update(ticket.id, "investigating")} className="rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-800">Investigation</button>}{canManage && ticket.status !== "resolved" && <button onClick={() => void update(ticket.id, "resolved")} className="rounded bg-green-100 px-2 py-1 text-[10px] text-green-800">Resolved</button>}{!canManage && ticket.status === "resolved" && <button onClick={() => void update(ticket.id, "reopened")} className="rounded bg-red-100 px-2 py-1 text-[10px] text-red-800">Issue abhi baqi hai</button>}</div>
    </article>)}</div>
  </div>;
}
