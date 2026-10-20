"use client";

import { useState } from "react";
import { LightboxImage } from "@/components/ui/image-lightbox";
import { ComplaintProgress, stageLogFromHistory } from "@/components/support/complaint-progress";
import { AI_DISCONNECTED_LABEL } from "@/lib/support/ai-agent-webhook";
import { decideComplaintStage, COMPLAINT_STAGE_META, complaintStageOf } from "@/lib/support/complaint-stage";
import { forwardGroups, type ForwardPerson } from "@/lib/support/complaint-intake";

export interface QueueEvent {
  at: string;
  event: string;
  from: string | null;
  to: string | null;
  note: string | null;
  actor: string;
}

export interface QueueImage {
  src: string;
  alt: string;
}

export interface QueueTicket {
  id: string;
  ticketNo: number;
  title: string;
  description: string;
  status: string;
  intake: "staff" | "call_center";
  suggested: string | null;
  routed: string | null;
  assignee: string | null;
  assigneeId?: string | null;
  assignedAgent?: string | null;
  reporter: string;
  reporterId?: string | null;
  createdAt: string;
  history: QueueEvent[];
  stage?: string | null;
  percent?: number | null;
  managerForward?: string | null;
  images?: QueueImage[];
}

const DEPTS = [
  { key: "accounts", label: "Accounts / Hisaab" },
  { key: "dairy", label: "Dairy / Doodh" },
  { key: "logistics", label: "Logistics / Delivery" },
  { key: "sales", label: "Sales / Khaad" },
  { key: "general", label: "General / Admin" },
];

export function ComplaintQueue({
  tickets,
  people,
  agents,
  canAssign,
  canSendAi = false,
  aiConnected = false,
  viewerId = "",
  viewerRole = "",
  example,
  notice,
}: {
  tickets: QueueTicket[];
  people: ForwardPerson[];
  agents: { key: string; label: string }[];
  canAssign: boolean;
  canSendAi?: boolean;
  aiConnected?: boolean;
  viewerId?: string;
  viewerRole?: string;
  example?: boolean;
  notice?: string | null;
}) {
  const groups = forwardGroups(people);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [dept, setDept] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  async function forward(ticket: QueueTicket) {
    if (example) return;
    const raw = choice[ticket.id] ?? "";
    const [kind, value] = [raw.slice(0, raw.indexOf(":")), raw.slice(raw.indexOf(":") + 1)];
    if (!value && !dept[ticket.id]) { setMsg("Department, user, agent ya developer chunein."); return; }
    setBusy(ticket.id); setMsg("");
    const body: Record<string, string> = {};
    if (dept[ticket.id]) body.departmentKey = dept[ticket.id];
    if (kind === "person" && value) body.assigneeId = value;
    if (kind === "agent" && value) body.agentKey = value;
    const res = await fetch(`/api/support/tickets/${ticket.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    setMsg(res.ok ? (data.message ?? "Aage bhej di.") : (data.error ?? "Assign nahi hua."));
  }

  async function move(ticket: QueueTicket, stage: string) {
    if (example) return;
    setBusy(ticket.id); setMsg("");
    const res = await fetch(`/api/support/tickets/${ticket.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, note: note[ticket.id] ?? "" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    setMsg(res.ok ? (data.message ?? "Stage update ho gaya.") : (data.error ?? "Stage nahi badla."));
  }

  async function sendAi(ticket: QueueTicket) {
    if (example || !aiConnected) return;
    setBusy(ticket.id); setMsg("");
    const res = await fetch(`/api/support/tickets/${ticket.id}/ai-send`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    setMsg(res.ok ? (data.message ?? "AI agent ko bhej diya.") : (data.message ?? data.error ?? "AI ko nahi gaya."));
  }

  async function upload(ticket: QueueTicket, files: FileList | null) {
    if (example || !files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach((file) => fd.append("images", file));
    setBusy(ticket.id);
    const res = await fetch(`/api/support/tickets/${ticket.id}/attachments`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    setMsg(res.ok ? "Tasveer lag gayi." : (data.error ?? "Tasveer nahi lagi."));
  }

  return (
    <section className="mt-4 rounded-xl border border-surface-200 bg-white shadow-sm">
      <div className="border-b border-surface-100 px-4 py-3">
        <h2 className="text-sm font-semibold">Complaint queue / Shikayat</h2>
        <p className="mt-0.5 text-xs text-surface-500">
          Call center (CMP) aur staff complaints yahin aati hain. Staff khud department nahi chunta. Assign Owner, super admin aur Admin karte hain. Manager sirf tab jab ijazat on ho.
        </p>
      </div>
      {notice && <p className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{notice}</p>}
      {msg && <p className="mx-4 mt-3 rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-700">{msg}</p>}
      <div className="divide-y divide-surface-100">
        {tickets.map((ticket) => {
          const stage = ticket.stage ?? (ticket.status === "new" ? "received" : ticket.status);
          const current = complaintStageOf(stage) ?? "received";
          const who = ticket.assignee ?? (ticket.assignedAgent === "ai_webhook" ? "AI agent" : null);
          const moveInput = {
            actorId: viewerId,
            submitterId: ticket.reporterId ?? "",
            actorRole: viewerRole,
            assigneeId: ticket.assigneeId ?? null,
            from: current,
          };
          const nextKey = current === "received" ? "assigned" : current === "assigned" ? "in_progress" : current === "in_progress" ? "review" : current === "review" ? "completed" : null;
          const canStep = Boolean(nextKey && nextKey !== "completed" && decideComplaintStage({ ...moveInput, to: nextKey }).ok);
          const canFinish = decideComplaintStage({ ...moveInput, to: "completed" }).ok;
          const canReject = decideComplaintStage({ ...moveInput, to: "rejected" }).ok && current !== "rejected";
          const log = stageLogFromHistory(ticket.history);
          return (
            <article key={ticket.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-surface-900">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] ${ticket.intake === "call_center" ? "bg-[#e8eeff] text-[#1a3f86]" : "bg-amber-50 text-amber-800"}`}>
                      {ticket.intake === "call_center" ? "Caller CMP" : "Staff"}
                    </span>
                    {ticket.title}
                  </p>
                  <p className="mt-1 text-[11px] text-surface-500">{ticket.reporter} · {ticket.createdAt} · {ticket.status}</p>
                  {ticket.managerForward && <p className="mt-1 text-[11px] font-semibold text-[#1a3f86]">{ticket.managerForward}</p>}
                </div>
                <p className="text-[11px] text-surface-600">
                  {ticket.intake === "call_center" ? `Tajweez: ${ticket.suggested ?? "—"}` : "Koi auto-assign nahi"}
                  {ticket.routed ? ` · Ab: ${ticket.routed}` : ""}
                  {who ? ` · ${who}` : " · Unassigned"}
                </p>
              </div>
              <p className="mt-2 text-xs text-surface-700">{ticket.description}</p>
              {(ticket.images?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ticket.images!.map((image) => (
                    <LightboxImage key={image.src} src={image.src} alt={image.alt} className="h-16 w-16 rounded-lg border object-cover" />
                  ))}
                </div>
              )}
              <ComplaintProgress stage={stage} percent={ticket.percent ?? null} log={log} />
              <ol className="mt-2 space-y-1 border-l border-surface-200 pl-3 text-[11px] text-surface-600">
                {ticket.history.map((event, i) => (
                  <li key={`${ticket.id}-${i}`}>
                    <b>{event.actor}</b> · {event.event}: {event.from ?? "—"} → {event.to ?? "—"}
                    {event.note ? ` — ${event.note}` : ""} <span className="text-surface-400">{event.at}</span>
                  </li>
                ))}
                {ticket.history.length === 0 && <li>Abhi koi status history nahi.</li>}
              </ol>
              {!example && viewerId && viewerId !== ticket.reporterId && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input value={note[ticket.id] ?? ""} onChange={(e) => setNote((o) => ({ ...o, [ticket.id]: e.target.value }))} placeholder="Note" className="min-w-[160px] flex-1 rounded border px-2 py-1 text-[11px]" />
                  {canStep && nextKey && (
                    <button disabled={busy === ticket.id} onClick={() => void move(ticket, nextKey)} className="rounded bg-[#101a4a] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40">
                      {COMPLAINT_STAGE_META[nextKey].rm}
                    </button>
                  )}
                  {canFinish && <button disabled={busy === ticket.id} onClick={() => void move(ticket, "completed")} className="rounded bg-[#1d8a4e] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40">Mukammal</button>}
                  {canReject && <button disabled={busy === ticket.id} onClick={() => void move(ticket, "rejected")} className="rounded border border-[#c03636] px-3 py-1 text-[11px] text-[#c03636]">Wapas</button>}
                  <label className="cursor-pointer rounded border px-2 py-1 text-[11px] text-surface-600">
                    Tasveer
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => void upload(ticket, e.target.files)} />
                  </label>
                </div>
              )}
              {canSendAi && current !== "completed" && (
                <button
                  type="button"
                  disabled={!aiConnected || example || busy === ticket.id}
                  onClick={() => void sendAi(ticket)}
                  className="mt-2 rounded border border-[#1a3f86] px-3 py-1 text-[11px] font-semibold text-[#1a3f86] disabled:opacity-60"
                >
                  {aiConnected ? "AI ko bhejein / Send to AI agent" : AI_DISCONNECTED_LABEL}
                </button>
              )}
              {canAssign && ticket.status !== "resolved" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <select aria-label="Department" value={dept[ticket.id] ?? ""} onChange={(e) => setDept((o) => ({ ...o, [ticket.id]: e.target.value }))} className="rounded border px-2 py-1 text-[11px]">
                    <option value="">Department (tajweez badal sakte hain)</option>
                    {DEPTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                  <select aria-label="Forward to" value={choice[ticket.id] ?? ""} onChange={(e) => setChoice((o) => ({ ...o, [ticket.id]: e.target.value }))} className="min-w-[220px] rounded border px-2 py-1 text-[11px]">
                    <option value="">User / agent / developer</option>
                    <optgroup label="Call center agent">{groups.callCenter.map((p) => <option key={p.id} value={`person:${p.id}`}>{p.full_name}</option>)}</optgroup>
                    <optgroup label="Department user">{groups.department.map((p) => <option key={p.id} value={`person:${p.id}`}>{p.full_name} · {p.role}</option>)}</optgroup>
                    <optgroup label="Developer">{groups.developer.map((p) => <option key={p.id} value={`person:${p.id}`}>{p.full_name} · {p.role}</option>)}</optgroup>
                    {agents.length > 0 && <optgroup label="Developer (AI)">{agents.map((a) => <option key={a.key} value={`agent:${a.key}`}>{a.label}</option>)}</optgroup>}
                  </select>
                  <button disabled={busy === ticket.id} onClick={() => void forward(ticket)} className="rounded bg-[#101a4a] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40">Aage bhejein</button>
                </div>
              )}
            </article>
          );
        })}
        {tickets.length === 0 && !notice && <p className="p-6 text-center text-xs text-surface-400">Queue khali hai.</p>}
      </div>
    </section>
  );
}

export function StaffComplaintForm({ example = false }: { example?: boolean }) {
  const [sent, setSent] = useState("");
  const thumb = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect fill="#dbe7ff" width="160" height="120"/><text x="16" y="68" font-size="16" fill="#1a3f86">Rate</text></svg>');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (example) return;
    const fd = new FormData(event.currentTarget);
    fd.set("page_url", "/admin/my-work/staff-complaint");
    const res = await fetch("/api/support/tickets", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setSent(res.ok ? "Admin queue mein chali gayi. Department nahi chuna gaya." : (data.error ?? "Nahi gayi."));
  }
  return (
    <form className="mx-auto max-w-xl space-y-3 rounded-2xl border border-surface-200 bg-white p-5 shadow-sm" onSubmit={submit}>
      <h1 className="font-display text-xl font-semibold">Staff complaint</h1>
      <p className="text-sm text-surface-500">Seedha Admin ke paas jayegi. Aap department ya assignee nahi chun sakte — sirf apni shikayat aur us ka status dikhega.</p>
      <label className="block text-xs text-surface-500">Title
        <input name="title" defaultValue={example ? "Rate list purani hai" : ""} readOnly={example} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" />
      </label>
      <label className="block text-xs text-surface-500">Tafseel
        <textarea name="description" readOnly={example} defaultValue={example ? "Aaj ki urea rate update nahi hui. Check karein." : ""} className="mt-1 h-28 w-full rounded-xl border p-3 text-sm" />
      </label>
      <label className="block text-xs text-surface-500">Priority
        <select name="priority" defaultValue="normal" className="mt-1 h-11 w-full rounded-xl border px-3 text-sm">
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
          <option value="work_stopped">Kaam ruk gaya</option>
        </select>
      </label>
      <label className="block text-xs text-surface-500">Tasveer / screenshots
        <input name="images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="mt-1 block w-full text-sm" />
      </label>
      <p className="text-[11px] text-surface-400">PNG, JPEG, WEBP, GIF · 8MB · 6 tak. Sirf jis ko ye ticket dikhe.</p>
      <button className="rounded-xl bg-[#101a4a] px-4 py-2 text-sm font-semibold text-white">{example ? "Admin queue (example)" : "Admin ko bhejein"}</button>
      {sent && <p className="text-sm text-emerald-700">{sent}</p>}
      {example && (
        <div className="rounded-xl bg-surface-50 p-3 text-xs text-surface-600">
          <b>Aap ki shikayat</b>
          <p className="mt-1">Rate list purani hai · stage: Mila / Received · 10% · Unassigned</p>
          <div className="mt-2">
            <LightboxImage src={thumb} alt="Rate list" className="h-16 w-16 rounded-lg border object-cover" />
          </div>
        </div>
      )}
    </form>
  );
}
