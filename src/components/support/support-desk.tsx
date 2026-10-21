"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BarChart3, Camera, CheckCircle2, ClipboardPaste, ExternalLink, RefreshCw, Send, ShieldCheck, X } from "lucide-react";
import { LightboxImage } from "@/components/ui/image-lightbox";
import { ComplaintProgress } from "@/components/support/complaint-progress";

type Person = { id: string; full_name: string; role: string };
type Agent = { key: string; label: string };
type Dept = { id: string; name: string; is_default_intake: boolean; notify_scope: string };
type Member = { id: string; department_id: string; member_kind: "person" | "agent"; profile_id: string | null; agent_key: string | null; agent_label: string | null; full_name: string | null };
type Comment = { id: string; body: string; source_label?: string | null; created_at: string; author?: { full_name?: string } | null };
type Ticket = {
  id: string; ticket_no: number; title: string; description: string; priority: string; status: string;
  page_url: string | null; screenshotUrl: string | null; created_at: string; resolution_note: string | null;
  assigned_kind?: "person" | "agent" | null; assigned_agent?: string | null; assignment_status?: string | null;
  external_task_id?: string | null; last_agent_update_at?: string | null;
  reporter?: { full_name?: string }; assignee?: { full_name?: string }; comments?: Comment[];
  department_id?: string | null; handback_department_id?: string | null; handback_note?: string | null; resolved_by_label?: string | null;   reporter_id?: string | null; assigned_to?: string | null;
  intake_source?: "staff" | "call_center" | "support" | null;
  complaint_stage?: string | null;
  stage_percent?: number | null;
  manager_forward_label?: string | null;
  images?: { id: string; url: string }[];
  stageEvents?: { to_value?: string | null; note?: string | null; created_at: string; actor?: { full_name?: string } | null }[];
};

const statusLabel: Record<string, string> = { new: "Reported", assigned: "Assigned", investigating: "Analysis / Working", testing: "Testing", resolved_pending_verify: "Resolved — Admin verify", resolved: "Verified & Closed", reopened: "Reopened" };
const statusTone: Record<string, string> = { resolved_pending_verify: "bg-emerald-100 text-emerald-800", new: "bg-blue-100 text-blue-800", assigned: "bg-violet-100 text-violet-800", investigating: "bg-amber-100 text-amber-800", testing: "bg-cyan-100 text-cyan-800", resolved: "bg-green-100 text-green-800", reopened: "bg-red-100 text-red-800" };
const stageOrder = ["reported", "analysis", "approval_required", "approved", "working", "testing", "fixed", "verified"];
const stageLabel: Record<string, string> = {
  reported: "Reported",
  analysis_requested: "Analysis Queued",
  analysis: "Analysis",
  approval_required: "Approval Required",
  approved: "Approved",
  queued: "Assigned",
  dispatched: "Analysis Queued",
  working: "Working",
  blocked: "Needs Attention",
  testing: "Testing",
  fixed: "Fixed",
  completed: "Fixed",
  failed: "Failed",
  verified: "Verified",
};

function currentStage(ticket: Ticket) {
  if (ticket.status === "resolved") return "verified";
  if (ticket.status === "new") return "reported";
  const stage = String(ticket.assignment_status ?? "");
  if (stage === "analysis_requested" || stage === "dispatched") return "analysis";
  if (stageOrder.includes(stage)) return stage;
  if (ticket.status === "testing") return "testing";
  return "reported";
}

function agentName(ticket: Ticket) {
  if (ticket.assigned_agent === "codex_subscription") return "ChatGPT / Codex (Subscription)";
  return ticket.assigned_agent;
}

export function SupportDesk({ pathname }: { pathname: string }) {
  const [items, setItems] = useState<Ticket[]>([]), [assignees, setAssignees] = useState<Person[]>([]), [agents, setAgents] = useState<Agent[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({}), [canManage, setCanManage] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [sent, setSent] = useState(""), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false), [busyId, setBusyId] = useState("");
  const [departments, setDepartments] = useState<Dept[]>([]), [members, setMembers] = useState<Member[]>([]), [meId, setMeId] = useState("");
  const [canAssign, setCanAssign] = useState(false), [canCreateAssign, setCanCreateAssign] = useState(false), [viewerRole, setViewerRole] = useState("");
  const [deptChoice, setDeptChoice] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null), fileRef = useRef<HTMLInputElement>(null);

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true);
    const response = await fetch("/api/support/tickets", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setItems(data.items ?? []); setAssignees(data.assignees ?? []); setAgents(data.agents ?? []); setCanManage(Boolean(data.canManage)); setCanAssign(Boolean(data.canAssign)); setCanCreateAssign(Boolean(data.canCreateAssign)); setViewerRole(String(data.viewerRole ?? "")); setDepartments(data.departments ?? []); setMembers(data.members ?? []); setMeId(data.meId ?? ""); setError(""); }
    else setError(data.error ?? "Tickets load nahi huay.");
    if (showSpinner) setLoading(false);
  }
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(false); }, 15000);
    const visible = () => { if (document.visibilityState === "visible") void load(false); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, []);
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
    if (response.ok) { setSent(data.message ?? "Issue update ho gaya."); await load(false); } else setError(data.error ?? "Issue update nahi hua."); setBusyId("");
  }
  async function update(id: string, status: string) { const note = status === "resolved" ? prompt("Fix verification/solution note likhein:") ?? "" : ""; await patch(id, { status, note, assignToMe: status === "assigned" }); }
  async function assignDept(ticket: Ticket) {
    const dept = deptChoice[ticket.id] || ticket.department_id || "";
    if (!dept) { setError("Department chunein."); return; }
    const [kind, value] = (choices[ticket.id] ?? "").split(":", 2);
    await patch(ticket.id, { departmentId: dept, ...(kind === "agent" && value ? { agentKey: value } : {}), ...(kind === "person" && value ? { assigneeId: value } : {}) });
  }
  async function resolveHandback(ticket: Ticket) {
    const note = prompt("Kya theek kiya? (Resolved note -- Admin verify karega)") ?? "";
    if (note.trim().length < 3) return;
    const admin = departments.find((d) => d.name === "Admin");
    await patch(ticket.id, { workflowAction: "resolve_handback", note, returnToDepartmentId: admin?.id ?? "" });
  }
  async function assign(ticket: Ticket) { const [kind, value] = (choices[ticket.id] ?? "").split(":", 2); if (!value) { setError("Is ticket ke saath wali list se developer/staff ya agent chunein, phir Assign dabayein."); return; } await patch(ticket.id, kind === "agent" ? { agentKey: value } : { assigneeId: value }); }
  async function requestChanges(ticket: Ticket) {
    const note = prompt("Agent ko kya change/recheck karna hai?")?.trim();
    if (!note) return;
    await patch(ticket.id, { workflowAction: "request_changes", note });
  }

  return <div className="flex-1 overflow-y-auto p-3">
    <form ref={formRef} onSubmit={submit} className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900 dark:bg-brand-950/20">
      <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-brand-700"/><p className="text-xs font-semibold text-surface-900 dark:text-white">Issue Report Karein</p></div>
      <input name="title" required minLength={3} maxLength={160} placeholder="Maslay ka chhota title" className="w-full rounded-lg border border-surface-200 px-2.5 py-2 text-xs dark:border-surface-700 dark:bg-surface-800"/>
      <textarea name="description" required minLength={3} maxLength={5000} rows={3} placeholder="Kya issue aa raha hai? Kya karte waqt aaya?" className="w-full resize-none rounded-lg border border-surface-200 px-2.5 py-2 text-xs dark:border-surface-700 dark:bg-surface-800"/>
      {canCreateAssign && <select name="assign" defaultValue="" className="w-full rounded-lg border border-surface-200 px-2.5 py-2 text-xs dark:border-surface-700 dark:bg-surface-800"><option value="">Admin triage karega (unassigned)</option><optgroup label="Call center agent">{assignees.filter((p) => p.role === "call_center_agent").map((person) => <option key={person.id} value={`person:${person.id}`}>{person.full_name}</option>)}</optgroup><optgroup label="Department user">{assignees.filter((p) => ["finance", "sales_staff", "warehouse", "milk_collection", "hr", "procurement", "machinery"].includes(p.role)).map((person) => <option key={person.id} value={`person:${person.id}`}>{person.full_name} · {person.role}</option>)}</optgroup><optgroup label="Developer">{assignees.filter((p) => ["owner", "super_admin", "admin", "admin_assistant", "manager"].includes(p.role)).map((person) => <option key={person.id} value={`person:${person.id}`}>{person.full_name} · {person.role}</option>)}</optgroup>{agents.length > 0 && <optgroup label="Developer (AI)">{agents.map((agent) => <option key={agent.key} value={`agent:${agent.key}`}>{agent.label}</option>)}</optgroup>}</select>}
      {!canCreateAssign && <p className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-surface-600">Seedha Admin ke paas jayegi. Aap department ya assignee nahi chun sakte — sirf apni shikayat aur us ka status dikhega.</p>}
      <select name="priority" className="w-full rounded-lg border border-surface-200 px-2.5 py-2 text-xs dark:border-surface-700 dark:bg-surface-800"><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="work_stopped">Kaam ruk gaya</option></select>
      {preview && <div className="relative"><img src={preview} alt="Screenshot preview" className="max-h-36 w-full rounded-lg border object-contain"/><button type="button" onClick={() => { setFile(null); setPreview(""); }} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3"/></button></div>}
      <div className="flex gap-2"><button type="button" onClick={() => fileRef.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-surface-300 bg-white px-2 py-2 text-[11px] dark:bg-surface-800"><Camera className="h-3.5 w-3.5"/> Screenshot</button><span className="flex items-center gap-1 text-[10px] text-surface-500"><ClipboardPaste className="h-3.5 w-3.5"/> Ctrl+V bhi chalega</span></div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(event) => choose(event.target.files?.[0] ?? null)}/>
      <button disabled={saving} className="flex w-full items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Send className="h-3.5 w-3.5"/>{saving ? "Report ho raha hai…" : "Admin/Developer ko bhejein"}</button>
    </form>
    {error && <p className="mt-2 rounded bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}{sent && <p className="mt-2 rounded bg-green-50 p-2 text-[11px] text-green-700">{sent}</p>}
    <div className="mt-3 flex items-center justify-between gap-2"><p className="text-[11px] font-semibold uppercase text-surface-500">{canManage ? "Tamam Issues" : "Mere Issues"}</p><div className="flex items-center gap-2">{canManage && <a href="/admin/support-center" className="flex items-center gap-1 rounded border border-brand-200 bg-brand-50 px-2 py-1 text-[9px] font-semibold text-brand-800"><BarChart3 className="h-3 w-3"/> Support Center</a>}<button onClick={() => void load()} className="text-surface-500"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}/></button></div></div>
    <div className="mt-2 space-y-2">{!loading && items.length === 0 && <p className="py-4 text-center text-xs text-surface-400">Abhi koi issue report nahi hua.</p>}{items.map((ticket) => {
      const activeStage = currentStage(ticket);
      const activeIndex = stageOrder.indexOf(activeStage);
      const canClose = ticket.assigned_kind !== "agent" || ["testing", "fixed", "completed"].includes(String(ticket.assignment_status));
      return <article key={ticket.id} className="rounded-lg border border-surface-200 p-2.5 dark:border-surface-700">
      <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-surface-900 dark:text-white">ISS-{new Date(ticket.created_at).getFullYear()}-{String(ticket.ticket_no).padStart(5, "0")} · {ticket.title}</p><p className="mt-0.5 text-[10px] text-surface-400">{ticket.reporter?.full_name ?? "Staff"} · {new Date(ticket.created_at).toLocaleString()}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${statusTone[ticket.status] ?? "bg-surface-100"}`}>{statusLabel[ticket.status] ?? ticket.status}</span></div>
      <p className="mt-2 whitespace-pre-wrap text-[11px] text-surface-600 dark:text-surface-300">{ticket.description}</p>{ticket.manager_forward_label && <p className="mt-1 text-[10px] font-semibold text-brand-800">{ticket.manager_forward_label}</p>}{(ticket.intake_source === "staff" || ticket.intake_source === "call_center") && <ComplaintProgress stage={ticket.complaint_stage ?? "received"} percent={ticket.stage_percent ?? null} log={(ticket.stageEvents ?? []).filter((event) => event.to_value).map((event) => ({ stage: String(event.to_value), actor: event.actor?.full_name ?? "System", at: new Date(event.created_at).toLocaleString(), note: event.note ?? null }))} />}{ticket.screenshotUrl && <LightboxImage src={ticket.screenshotUrl} alt="Issue screenshot" className="mt-2 max-h-28 w-full rounded border object-contain"/>}{ticket.images?.map((image) => <LightboxImage key={image.id} src={image.url} alt="Complaint image" className="mt-2 h-16 w-16 rounded border object-cover" />)}
      {ticket.assigned_kind === "agent" && <div className="mt-2 rounded-lg border border-surface-200 bg-surface-50 p-2 dark:border-surface-700 dark:bg-surface-800">
        <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold">Professional Fix Workflow</p><span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-semibold text-brand-800">{stageLabel[String(ticket.assignment_status)] ?? activeStage}</span></div>
        <div className="mt-2 grid grid-cols-4 gap-1">{stageOrder.map((stage, index) => <div key={stage} className="text-center"><div className={`mx-auto h-1.5 rounded-full ${index <= activeIndex ? "bg-brand-600" : "bg-surface-200 dark:bg-surface-700"}`}/><p className={`mt-1 text-[8px] ${index === activeIndex ? "font-semibold text-brand-700" : "text-surface-400"}`}>{stageLabel[stage]}</p></div>)}</div>
      </div>}
      {(ticket.assignee?.full_name || ticket.assigned_agent) && <div className="mt-2 flex items-center justify-between gap-2 rounded bg-violet-50 px-2 py-1 text-[10px] text-violet-800"><span>Assigned: {ticket.assignee?.full_name ?? agentName(ticket)} · {stageLabel[String(ticket.assignment_status)] ?? ticket.assignment_status ?? ""}</span>{ticket.external_task_id?.startsWith("https://") && <a href={ticket.external_task_id} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 font-semibold underline">GitHub/Codex <ExternalLink className="h-3 w-3"/></a>}</div>}
      {ticket.comments?.map((comment) => <div key={comment.id} className="mt-2 rounded bg-surface-50 p-2 text-[10px] dark:bg-surface-800"><div className="flex justify-between gap-2"><b>{comment.author?.full_name ?? comment.source_label ?? "System"}</b><span className="text-[8px] text-surface-400">{new Date(comment.created_at).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap">{comment.body}</p></div>)}
      {ticket.resolution_note && <p className="mt-2 rounded bg-green-50 p-2 text-[10px] text-green-800"><CheckCircle2 className="mr-1 inline h-3 w-3"/>{ticket.resolution_note}</p>}
      {canManage && ticket.assignment_status === "approval_required" && ticket.status !== "resolved" && <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2"><p className="text-[10px] font-semibold text-amber-900">Agent ki analysis tayar hai۔ Fix start karne se pehle aapki approval zaroori hai.</p><div className="mt-2 flex gap-2"><button disabled={busyId === ticket.id} onClick={() => void patch(ticket.id, { workflowAction: "approve_fix" })} className="flex flex-1 items-center justify-center gap-1 rounded bg-green-700 px-2 py-1.5 text-[10px] font-semibold text-white"><ShieldCheck className="h-3 w-3"/> Fix Approve Karein</button><button disabled={busyId === ticket.id} onClick={() => void requestChanges(ticket)} className="rounded border border-amber-500 px-2 py-1.5 text-[10px] text-amber-900">Changes Mangwain</button></div></div>}
      {ticket.status === "resolved_pending_verify" && <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-[10px] text-emerald-900"><b>Resolved{ticket.resolved_by_label ? ` · ${ticket.resolved_by_label}` : ""}</b> → {departments.find((d) => d.id === ticket.handback_department_id)?.name ?? "Admin"} verify karega.{ticket.handback_note ? <div className="mt-1">{ticket.handback_note}</div> : null}</div>}
      {canAssign && departments.length > 0 && !["resolved", "resolved_pending_verify"].includes(ticket.status) && (() => {
        const dept = deptChoice[ticket.id] || ticket.department_id || "";
        const deptMembers = members.filter((m) => m.department_id === dept);
        return <div className="mt-2 space-y-1">
          <div className="flex gap-1">
            <select aria-label="Department" value={dept} onChange={(e) => { setDeptChoice((o) => ({ ...o, [ticket.id]: e.target.value })); setChoices((o) => ({ ...o, [ticket.id]: "" })); }} className="min-w-0 flex-1 rounded border border-surface-200 px-1.5 py-1 text-[10px] dark:bg-surface-800"><option value="">Department chunein</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_default_intake ? " (intake)" : ""}</option>)}</select>
            <select aria-label="Member" value={choices[ticket.id] ?? ""} onChange={(e) => setChoices((o) => ({ ...o, [ticket.id]: e.target.value }))} className="min-w-0 flex-1 rounded border border-surface-200 px-1.5 py-1 text-[10px] dark:bg-surface-800"><option value="">Poori team (member baad mein)</option>{deptMembers.map((m) => <option key={m.id} value={m.member_kind === "agent" ? `agent:${m.agent_key}` : `person:${m.profile_id}`}>{m.member_kind === "agent" ? `🤖 ${m.agent_label ?? m.agent_key}` : `👤 ${m.full_name ?? "Staff"}`}</option>)}{agents.filter((a) => !deptMembers.some((m) => m.member_kind === "agent" && m.agent_key === a.key)).map((a) => <option key={`ai-${a.key}`} value={`agent:${a.key}`}>🤖 {a.label}</option>)}</select>
            <button disabled={busyId === ticket.id || !dept} onClick={() => void assignDept(ticket)} className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50">Assign</button>
          </div>
          {ticket.department_id && <p className="text-[9px] text-surface-400">Abhi: {departments.find((d) => d.id === ticket.department_id)?.name ?? "—"}</p>}
        </div>;
      })()}
      {(canManage || ticket.assigned_to === meId) && ticket.assigned_kind && !["resolved", "resolved_pending_verify", "new"].includes(ticket.status) && <button disabled={busyId === ticket.id} onClick={() => void resolveHandback(ticket)} className="mt-2 w-full rounded border border-emerald-500 bg-emerald-50 px-2 py-1.5 text-[10px] font-semibold text-emerald-800">Resolved — Admin ko verify ke liye bhejein</button>}
      {canAssign && departments.length === 0 && ticket.status !== "resolved" && <div className="mt-2 flex gap-1"><select value={choices[ticket.id] ?? ""} onChange={(event) => setChoices((old) => ({ ...old, [ticket.id]: event.target.value }))} className="min-w-0 flex-1 rounded border border-surface-200 px-1.5 py-1 text-[10px] dark:bg-surface-800"><option value="">Call center / department / developer</option><optgroup label="Call center agent">{assignees.filter((p) => p.role === "call_center_agent").map((person) => <option key={person.id} value={`person:${person.id}`}>{person.full_name}</option>)}</optgroup><optgroup label="Department user">{assignees.filter((p) => ["finance", "sales_staff", "warehouse", "milk_collection", "hr", "procurement", "machinery"].includes(p.role)).map((person) => <option key={person.id} value={`person:${person.id}`}>{person.full_name} · {person.role}</option>)}</optgroup><optgroup label="Developer">{assignees.filter((p) => ["owner", "super_admin", "admin", "admin_assistant", "manager"].includes(p.role)).map((person) => <option key={person.id} value={`person:${person.id}`}>{person.full_name} · {person.role}</option>)}</optgroup>{agents.length > 0 && <optgroup label="Developer (AI)">{agents.map((agent) => <option key={agent.key} value={`agent:${agent.key}`}>{agent.label}</option>)}</optgroup>}</select><button disabled={busyId === ticket.id || !choices[ticket.id]} onClick={() => void assign(ticket)} className="rounded bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50">Assign</button></div>}
      <div className="mt-2 flex flex-wrap gap-1">{canAssign && ticket.status === "new" && <button onClick={() => void update(ticket.id, "assigned")} className="rounded bg-violet-100 px-2 py-1 text-[10px] text-violet-800">Mujhe assign</button>}{canManage && ticket.intake_source !== "staff" && ticket.intake_source !== "call_center" && ticket.assigned_kind !== "agent" && !["resolved", "testing"].includes(ticket.status) && <button onClick={() => void update(ticket.id, "investigating")} className="rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-800">Investigation</button>}{(ticket.intake_source === "staff" || ticket.intake_source === "call_center" ? viewerRole !== "call_center_agent" && ticket.reporter_id !== meId && (canAssign || ticket.assigned_to === meId) : canManage && canClose) && ticket.status !== "resolved" && <button onClick={() => void update(ticket.id, "resolved")} className="rounded bg-green-100 px-2 py-1 text-[10px] text-green-800">Verify & Close</button>}{ticket.reporter_id === meId && ["resolved", "resolved_pending_verify"].includes(ticket.status) && <button onClick={() => void update(ticket.id, "reopened")} className="rounded bg-red-100 px-2 py-1 text-[10px] text-red-800">Abhi bhi masla hai</button>}</div>
    </article>;})}</div>
  </div>;
}
