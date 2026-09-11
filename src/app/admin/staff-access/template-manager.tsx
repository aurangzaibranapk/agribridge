"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Bot, Check, Search, ShieldCheck, Trash2 } from "lucide-react";
import { ACTIONS, ACTION_LABEL, DATA_SCOPES, SCOPE_LABEL, type Action, type DataScope } from "@/lib/access/types";
import { clearRoleTemplate, saveRoleTemplate, suggestRoleTemplate, type TemplateActionState, type TemplatePermissionDraft } from "@/actions/staff-access";

interface Feature { key: string; label: string; route: string; is_sensitive: boolean }
interface Template { role: string; label: string; summary: string; permissions: TemplatePermissionDraft[] }
const EMPTY: TemplateActionState = {};

function ActionButton({ kind }: { kind: "save" | "ai" | "zero" }) {
  const { pending } = useFormStatus();
  const style = kind === "zero" ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100" : kind === "ai" ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100" : "border-brand-700 bg-brand-700 text-white hover:bg-brand-800";
  return <button disabled={pending} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${style}`}>{kind === "zero" ? <Trash2 className="h-3.5 w-3.5" /> : kind === "ai" ? <Bot className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{pending ? "Kaam ho raha hai..." : kind === "zero" ? "Template Zero Karein" : kind === "ai" ? "AI Suggestion" : "Template Save Karein"}</button>;
}

export function TemplateManager({ templates, features }: { templates: Template[]; features: Feature[] }) {
  const [role, setRole] = useState(templates[0]?.role ?? "");
  const selected = templates.find((t) => t.role === role);
  const [rows, setRows] = useState<TemplatePermissionDraft[]>(selected?.permissions ?? []);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saveState, saveAction] = useFormState(saveRoleTemplate, EMPTY);
  const [clearState, clearAction] = useFormState(clearRoleTemplate, EMPTY);
  const [aiState, aiAction] = useFormState(suggestRoleTemplate, EMPTY);
  const rowMap = useMemo(() => new Map(rows.map((r) => [r.feature_key, r])), [rows]);
  const visible = useMemo(() => { const q = query.trim().toLowerCase(); return q ? features.filter((f) => `${f.label} ${f.route}`.toLowerCase().includes(q)) : features; }, [features, query]);

  useEffect(() => { setRows(templates.find((t) => t.role === role)?.permissions ?? []); }, [role, templates]);
  useEffect(() => { if (aiState.suggestion) { setRows(aiState.suggestion); setOpen(true); } }, [aiState.suggestion]);
  useEffect(() => { if (clearState.success) setRows([]); }, [clearState.success]);

  function toggle(key: string) {
    setRows((before) => before.some((r) => r.feature_key === key)
      ? before.filter((r) => r.feature_key !== key)
      : [...before, { feature_key: key, actions: ["view"], data_scope: "own_branch" }]);
  }
  function toggleAction(key: string, action: Action) {
    if (action === "view") return;
    setRows((before) => before.map((r) => r.feature_key !== key ? r : ({ ...r, actions: r.actions.includes(action) ? r.actions.filter((a) => a !== action) : [...r.actions, action] })));
  }
  function setScope(key: string, data_scope: DataScope) { setRows((before) => before.map((r) => r.feature_key === key ? { ...r, data_scope } : r)); }
  const message = saveState.message ?? clearState.message ?? aiState.message;
  const error = saveState.error ?? clearState.error ?? aiState.error;

  return <section className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div><h2 className="font-display text-base font-semibold">Access Template Management</h2><p className="mt-1 text-xs text-surface-400">Template dekhein, edit karein, zero karein ya AI se least-privilege suggestion lein.</p></div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg border border-surface-200 px-3 py-2 text-xs font-semibold hover:bg-surface-50 dark:border-surface-700">{open ? "Template band karein" : "Templates edit karein"}</button>
    </div>
    {open && <div className="border-t border-surface-100 p-4 dark:border-surface-800">
      {(message || error) && <div className={`mb-3 rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ?? message}</div>}
      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,20rem)_1fr]">
        <div className="space-y-3">
          <label className="block text-xs font-medium text-surface-600">Template / Department<select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-900">{templates.map((t) => <option key={t.role} value={t.role}>{t.label} ({t.permissions.length})</option>)}</select></label>
          <div className="rounded-lg border border-surface-100 bg-surface-50 p-3 text-xs leading-5 text-surface-600 dark:border-surface-800 dark:bg-surface-950">{selected?.summary}<div className="mt-2 font-semibold text-brand-700">Abhi {rows.length} features selected hain.</div></div>
          <form action={aiAction}><input type="hidden" name="role" value={role} /><ActionButton kind="ai" /></form>
          <form action={clearAction} onSubmit={(e) => { if (!window.confirm(`${selected?.label ?? role} template ki tamam access zero karni hai? Pehle se staff ko di hui access nahi badlegi.`)) e.preventDefault(); }}><input type="hidden" name="role" value={role} /><ActionButton kind="zero" /></form>
        </div>
        <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-brand-700" />Template Permissions ({rows.length})</h3><label className="flex items-center gap-2 rounded-lg border border-surface-200 px-2 py-1.5"><Search className="h-3.5 w-3.5 text-surface-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Permission search..." className="bg-transparent text-xs outline-none" /></label></div>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">{visible.map((f) => { const row = rowMap.get(f.key); return <div key={f.key} className={`rounded-lg border p-3 ${row ? "border-emerald-200 bg-emerald-50/40" : "border-surface-100"}`}>
            <label className="flex cursor-pointer items-start gap-2"><input type="checkbox" checked={Boolean(row)} onChange={() => toggle(f.key)} className="mt-0.5" /><span><span className="text-sm font-medium">{f.label}</span>{f.is_sensitive && <span className="ml-2 text-[10px] font-semibold text-red-600">HASSAS</span>}<span className="block text-[10px] text-surface-400">{f.route}</span></span></label>
            {row && <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-emerald-100 pt-2">{ACTIONS.map((a) => <label key={a} className="text-[11px]"><input type="checkbox" checked={row.actions.includes(a)} disabled={a === "view"} onChange={() => toggleAction(f.key, a)} className="mr-1" />{ACTION_LABEL[a]}</label>)}<select value={row.data_scope} onChange={(e) => setScope(f.key, e.target.value as DataScope)} className="ml-auto rounded-md border border-surface-200 bg-white px-2 py-1 text-[11px] dark:border-surface-700 dark:bg-surface-900">{DATA_SCOPES.map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}</select></div>}
          </div>; })}</div>
          <form action={saveAction} className="mt-3 flex justify-end border-t border-surface-100 pt-3" onSubmit={(e) => { if (!window.confirm(`${selected?.label ?? role} template mein ${rows.length} permissions save karni hain?`)) e.preventDefault(); }}><input type="hidden" name="role" value={role} /><input type="hidden" name="permissions" value={JSON.stringify(rows)} /><ActionButton kind="save" /></form>
        </div>
      </div>
    </div>}
  </section>;
}
