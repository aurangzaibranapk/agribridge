"use client";

import { useState, useTransition } from "react";
import { Plus, X, Check, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Staff = { id: string; name: string; designation: string; department: string };

type Target = {
  id: string;
  profile_id: string;
  target_name: string;
  target_type: string;
  target_value: number;
  achieved_value: number;
  unit: string;
  period_label: string;
  is_active: boolean;
  notes: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  sales: "Sales",
  attendance: "Hazri",
  performance: "Performance",
  custom: "Custom",
};

const TYPE_COLORS: Record<string, string> = {
  sales: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  attendance: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  performance: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  custom: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

function pct(achieved: number, target: number): number {
  if (!target) return 0;
  return Math.min(100, Math.round((achieved / target) * 100));
}

function ProgressBar({ achieved, target }: { achieved: number; target: number }) {
  const p = pct(achieved, target);
  const color = p >= 100 ? "bg-emerald-500" : p >= 70 ? "bg-blue-500" : p >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-[11px] text-surface-500 mb-0.5">
        <span>{achieved.toLocaleString("en-PK")} / {target.toLocaleString("en-PK")}</span>
        <span className={p >= 100 ? "font-bold text-emerald-600" : ""}>{p}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

const BLANK_FORM = { target_name: "", target_type: "custom", target_value: "", achieved_value: "", unit: "", period_label: "", notes: "" };

export function AchievementClient({ staff, targets: init }: { staff: Staff[]; targets: Target[] }) {
  const [targets, setTargets] = useState<Target[]>(init);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addFor, setAddFor] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK_FORM>(BLANK_FORM);
  const [busy, startT] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState("");

  const sb = createClient() as any;

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function openAdd(profileId: string) {
    setAddFor(profileId);
    setEditId(null);
    setForm(BLANK_FORM);
    setMsg(null);
  }

  function openEdit(t: Target) {
    setEditId(t.id);
    setAddFor(null);
    setForm({
      target_name: t.target_name,
      target_type: t.target_type,
      target_value: String(t.target_value),
      achieved_value: String(t.achieved_value),
      unit: t.unit ?? "",
      period_label: t.period_label ?? "",
      notes: t.notes ?? "",
    });
    setMsg(null);
  }

  async function saveTarget(profileId: string) {
    if (!form.target_name.trim()) { setMsg({ ok: false, text: "Target ka naam bharein." }); return; }
    const tv = parseFloat(form.target_value) || 0;
    const av = parseFloat(form.achieved_value) || 0;

    startT(async () => {
      if (editId) {
        const { error } = await sb.from("staff_targets").update({
          target_name: form.target_name.trim(),
          target_type: form.target_type,
          target_value: tv,
          achieved_value: av,
          unit: form.unit,
          period_label: form.period_label,
          notes: form.notes || null,
        }).eq("id", editId);
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setTargets(prev => prev.map(t => t.id === editId ? { ...t, target_name: form.target_name.trim(), target_type: form.target_type, target_value: tv, achieved_value: av, unit: form.unit, period_label: form.period_label, notes: form.notes || null } : t));
      } else {
        const { data, error } = await sb.from("staff_targets").insert({
          profile_id: profileId,
          target_name: form.target_name.trim(),
          target_type: form.target_type,
          target_value: tv,
          achieved_value: av,
          unit: form.unit,
          period_label: form.period_label,
          notes: form.notes || null,
        }).select().single();
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setTargets(prev => [data as unknown as Target, ...prev]);
      }
      setMsg({ ok: true, text: "Save ho gaya." });
      setAddFor(null);
      setEditId(null);
    });
  }

  async function deleteTarget(id: string) {
    const { error } = await sb.from("staff_targets").delete().eq("id", id);
    if (!error) setTargets(prev => prev.filter(t => t.id !== id));
  }

  async function updateAchieved(id: string, val: number) {
    await sb.from("staff_targets").update({ achieved_value: val }).eq("id", id);
    setTargets(prev => prev.map(t => t.id === id ? { ...t, achieved_value: val } : t));
  }

  const filtered = staff.filter(s => !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.department.toLowerCase().includes(filter.toLowerCase()));

  const inputCls = "w-full rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900";

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <input
          className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
          placeholder="Naam ya department se talaash…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <span className="text-xs text-surface-400">{filtered.length} staff members</span>
      </div>

      {/* Staff cards */}
      {filtered.map(s => {
        const myTargets = targets.filter(t => t.profile_id === s.id && t.is_active);
        const isOpen = expanded.has(s.id);
        const isAdding = addFor === s.id;
        const totalPct = myTargets.length
          ? Math.round(myTargets.reduce((acc, t) => acc + pct(t.achieved_value, t.target_value), 0) / myTargets.length)
          : null;

        return (
          <div key={s.id} className="rounded-xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
            {/* Header */}
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() => toggle(s.id)}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-semibold text-sm">
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{s.name}</div>
                {(s.designation || s.department) && (
                  <div className="text-xs text-surface-400">{[s.designation, s.department].filter(Boolean).join(" · ")}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {totalPct !== null && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${totalPct >= 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : totalPct >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    <Trophy size={11} /> {totalPct}%
                  </span>
                )}
                <span className="text-xs text-surface-400">{myTargets.length} target{myTargets.length !== 1 ? "s" : ""}</span>
                {isOpen ? <ChevronUp size={15} className="text-surface-400" /> : <ChevronDown size={15} className="text-surface-400" />}
              </div>
            </button>

            {/* Expanded: targets list */}
            {isOpen && (
              <div className="border-t border-surface-100 px-4 py-3 space-y-3 dark:border-surface-800">
                {myTargets.length === 0 && !isAdding && (
                  <p className="text-sm text-surface-400">Koi target set nahi. "Target Add" dabain.</p>
                )}

                {myTargets.map(t => {
                  const isEditing = editId === t.id;
                  return (
                    <div key={t.id} className="rounded-lg border border-surface-100 p-3 dark:border-surface-800">
                      {isEditing ? (
                        <TargetForm
                          form={form}
                          setForm={setForm}
                          onSave={() => saveTarget(s.id)}
                          onCancel={() => setEditId(null)}
                          busy={busy}
                          msg={msg}
                          inputCls={inputCls}
                        />
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-sm">{t.target_name}</span>
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[t.target_type] ?? TYPE_COLORS.custom}`}>
                                  {TYPE_LABELS[t.target_type] ?? t.target_type}
                                </span>
                                {t.period_label && <span className="text-[10px] text-surface-400">{t.period_label}</span>}
                              </div>
                              <ProgressBar achieved={t.achieved_value} target={t.target_value} />
                              {t.notes && <p className="mt-1 text-[11px] text-surface-400">{t.notes}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <AchievedEditor value={t.achieved_value} unit={t.unit} onSave={v => updateAchieved(t.id, v)} />
                              <button className="rounded p-1 text-surface-400 hover:text-surface-700" onClick={() => openEdit(t)} title="Edit">✎</button>
                              <button className="rounded p-1 text-red-400 hover:text-red-600" onClick={() => deleteTarget(t.id)} title="Delete"><X size={13} /></button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Add target form */}
                {isAdding ? (
                  <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-3 dark:border-brand-700 dark:bg-brand-900/10">
                    <p className="text-xs font-medium text-brand-700 dark:text-brand-300 mb-2">Naya Target</p>
                    <TargetForm
                      form={form}
                      setForm={setForm}
                      onSave={() => saveTarget(s.id)}
                      onCancel={() => setAddFor(null)}
                      busy={busy}
                      msg={msg}
                      inputCls={inputCls}
                    />
                  </div>
                ) : (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-brand-300 px-3 py-1.5 text-xs text-brand-600 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400"
                    onClick={() => { openAdd(s.id); if (!isOpen) toggle(s.id); }}
                  >
                    <Plus size={13} /> Target Add
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <p className="text-sm text-surface-400 px-1">Koi staff member nahi mila.</p>
      )}
    </div>
  );
}

function AchievedEditor({ value, unit, onSave }: { value: number; unit: string; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  if (!editing) return (
    <button className="rounded px-1.5 py-0.5 text-xs text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700" onClick={() => { setV(String(value)); setEditing(true); }}>
      {unit ? `${value.toLocaleString("en-PK")} ${unit}` : value.toLocaleString("en-PK")} ✎
    </button>
  );
  return (
    <span className="flex items-center gap-1">
      <input className="w-20 rounded border border-surface-200 px-1.5 py-0.5 text-xs dark:border-surface-700 dark:bg-surface-900" value={v} onChange={e => setV(e.target.value)} autoFocus />
      <button className="text-emerald-600" onClick={() => { onSave(parseFloat(v) || 0); setEditing(false); }}><Check size={13} /></button>
      <button className="text-surface-400" onClick={() => setEditing(false)}><X size={13} /></button>
    </span>
  );
}

function TargetForm({ form, setForm, onSave, onCancel, busy, msg, inputCls }: {
  form: any; setForm: any; onSave: () => void; onCancel: () => void; busy: boolean; msg: any; inputCls: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-[11px] text-surface-500">Target ka naam *</label>
          <input className={inputCls} value={form.target_name} onChange={e => setForm((p: any) => ({ ...p, target_name: e.target.value }))} placeholder="e.g. Monthly Sales Target" />
        </div>
        <div>
          <label className="text-[11px] text-surface-500">Qism</label>
          <select className={inputCls} value={form.target_type} onChange={e => setForm((p: any) => ({ ...p, target_type: e.target.value }))}>
            <option value="sales">Sales</option>
            <option value="attendance">Hazri</option>
            <option value="performance">Performance</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-surface-500">Period</label>
          <input className={inputCls} value={form.period_label} onChange={e => setForm((p: any) => ({ ...p, period_label: e.target.value }))} placeholder="e.g. October 2026" />
        </div>
        <div>
          <label className="text-[11px] text-surface-500">Target adad *</label>
          <input className={inputCls} type="number" value={form.target_value} onChange={e => setForm((p: any) => ({ ...p, target_value: e.target.value }))} placeholder="100000" />
        </div>
        <div>
          <label className="text-[11px] text-surface-500">Hasil (achieved)</label>
          <input className={inputCls} type="number" value={form.achieved_value} onChange={e => setForm((p: any) => ({ ...p, achieved_value: e.target.value }))} placeholder="0" />
        </div>
        <div>
          <label className="text-[11px] text-surface-500">Unit</label>
          <input className={inputCls} value={form.unit} onChange={e => setForm((p: any) => ({ ...p, unit: e.target.value }))} placeholder="Rs / % / din" />
        </div>
        <div>
          <label className="text-[11px] text-surface-500">Notes</label>
          <input className={inputCls} value={form.notes} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Ikhtiyari" />
        </div>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      <div className="flex gap-2">
        <button className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs text-white disabled:opacity-50" onClick={onSave} disabled={busy}>
          <Check size={12} /> Save
        </button>
        <button className="rounded-lg border px-3 py-1.5 text-xs text-surface-500" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
