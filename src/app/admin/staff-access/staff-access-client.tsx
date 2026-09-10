"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { Check, ChevronRight, Search, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { ACTIONS, ACTION_LABEL, DATA_SCOPES, SCOPE_LABEL, type Action } from "@/lib/access/types";
import { DEPARTMENTS } from "@/lib/departments";
import { removeFeatureAccess, saveStaffAccessSetup, setFeatureAccess, type ActionState } from "@/actions/staff-access";

interface Banda { id: string; full_name: string; role: string; is_active: boolean; branch_id: string | null; shop_id: string | null }
interface Feature { key: string; label: string; route: string; is_sensitive: boolean }
interface Qatar { feature_key: string; actions: string[]; data_scope: string; expires_at: string | null; reason: string | null }
interface Branch { id: string; name: string }
interface Shop { id: string; name: string; branch_id: string | null }
const KHALI: ActionState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"><Check className="h-4 w-4" />{pending ? "Mehfooz ho raha hai..." : "Save Access"}</button>;
}
function MiniButton({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-surface-200 text-surface-700 hover:bg-surface-50"}`}>{pending ? "..." : children}</button>;
}

export function StaffAccessClient({ staff, features, templates, chunaHua, uskiIjazat, branches, shops }: {
  staff: Banda[]; features: Feature[]; templates: { role: string; ginti: number }[]; chunaHua: string | null; uskiIjazat: Qatar[]; branches: Branch[]; shops: Shop[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [extraFeature, setExtraFeature] = useState("");
  const [saveState, saveAction] = useFormState(saveStaffAccessSetup, KHALI);
  const [setState, setAction] = useFormState(setFeatureAccess, KHALI);
  const [removeState, removeAction] = useFormState(removeFeatureAccess, KHALI);
  const banda = staff.find((s) => s.id === chunaHua) ?? null;
  const selectedBranch = branchId || banda?.branch_id || "";
  const visibleStaff = useMemo(() => { const q = query.trim().toLowerCase(); return q ? staff.filter((s) => `${s.full_name} ${s.role}`.toLowerCase().includes(q)) : staff; }, [query, staff]);
  const featureByKey = useMemo(() => new Map(features.map((f) => [f.key, f])), [features]);
  const granted = useMemo(() => new Map(uskiIjazat.map((r) => [r.feature_key, r])), [uskiIjazat]);
  const remaining = features.filter((f) => !granted.has(f.key));
  const dept = DEPARTMENTS.find((d) => d.role === banda?.role);
  const message = saveState.message ?? setState.message ?? removeState.message;
  const error = saveState.error ?? setState.error ?? removeState.error;
  const location = banda?.shop_id ? shops.find((s) => s.id === banda.shop_id)?.name : banda?.branch_id ? branches.find((b) => b.id === banda.branch_id)?.name : "tamam assigned locations";

  function choose(id: string) {
    setBranchId("");
    const p = new URLSearchParams(searchParams.toString());
    p.set("banda", id);
    router.push(`/admin/staff-access?${p}`);
  }

  return <div className="mt-4 space-y-4">
    <div className="grid grid-cols-3 rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      {["Banda Chunein", "Role & Jagah", "Access Confirm"].map((label, i) => <div key={label} className="flex items-center gap-3 px-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${(!banda && i === 0) || (banda && i < 2) ? "bg-brand-700 text-white" : "border border-brand-600 text-brand-700"}`}>{i + 1}</span><div><p className="text-sm font-semibold">{label}</p><p className="hidden text-[11px] text-surface-400 md:block">{i === 0 ? "Staff member select karein" : i === 1 ? "Department, branch aur shop" : "Dekhein aur save karein"}</p></div>{i < 2 && <ChevronRight className="ml-auto hidden h-4 w-4 text-surface-300 sm:block" />}</div>)}
    </div>
    <div className="grid min-h-[34rem] grid-cols-1 gap-4 lg:grid-cols-[19rem_1fr]">
      <aside className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold">Staff Members ({staff.length})</h2>
        <label className="mb-2 flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 dark:border-surface-700"><Search className="h-4 w-4 text-surface-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Naam ya role..." className="w-full bg-transparent text-sm outline-none" /></label>
        <div className="max-h-[64vh] space-y-1 overflow-y-auto pr-1">{visibleStaff.map((s) => <button key={s.id} onClick={() => choose(s.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${s.id === chunaHua ? "bg-brand-50 text-brand-900 dark:bg-brand-950/30 dark:text-brand-200" : "hover:bg-surface-50 dark:hover:bg-surface-800"}`}><UserRound className="h-4 w-4 shrink-0" /><span className="min-w-0"><span className={`block truncate text-sm font-medium ${s.is_active ? "" : "line-through opacity-60"}`}>{s.full_name}</span><span className="block text-[11px] text-surface-400">{DEPARTMENTS.find((d) => d.role === s.role)?.label ?? s.role}</span></span><ChevronRight className="ml-auto h-4 w-4 text-surface-300" /></button>)}</div>
      </aside>
      {!banda ? <div className="grid place-items-center rounded-card border border-dashed border-surface-300 bg-white p-10 text-center dark:border-surface-700 dark:bg-surface-900"><div><UserRound className="mx-auto mb-3 h-10 w-10 text-surface-300" /><p className="font-semibold">Bayein taraf se staff member chunein</p><p className="mt-1 text-sm text-surface-400">Us ka poora access ek hi screen par nazar aa jayega.</p></div></div> :
      <main className="space-y-4">
        {(message || error) && <div className={`rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ?? message}</div>}
        <form action={saveAction} className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <input type="hidden" name="profile_id" value={banda.id} />
          <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Configure Access for {banda.full_name}</h2><p className="text-xs text-surface-400">Role, jagah aur access template ek sath save karein.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${banda.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{banda.is_active ? "Active" : "Suspended"}</span></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-medium text-surface-600">Department / Role<select name="role" defaultValue={banda.role} className="mt-1 h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-900">{DEPARTMENTS.map((d) => <option key={d.role} value={d.role}>{d.label}</option>)}</select></label>
            <label className="text-xs font-medium text-surface-600">Branch<select name="branch_id" defaultValue={banda.branch_id ?? ""} onChange={(e) => setBranchId(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-900"><option value="">All assigned branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="text-xs font-medium text-surface-600">Shop<select name="shop_id" defaultValue={banda.shop_id ?? ""} disabled={!selectedBranch} className="mt-1 h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm disabled:bg-surface-50 dark:border-surface-700 dark:bg-surface-900"><option value="">All shops in branch</option>{shops.filter((s) => s.branch_id === selectedBranch).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="text-xs font-medium text-surface-600">Access Template<select name="template" defaultValue={banda.role} className="mt-1 h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-900">{templates.map((t) => <option key={t.role} value={t.role}>{DEPARTMENTS.find((d) => d.role === t.role)?.label ?? t.role} ({t.ginti})</option>)}</select></label>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <section className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 dark:border-surface-700 dark:bg-surface-800"><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-brand-700" />Automatic Access</h3><p className="mt-1 text-xs text-surface-500">{dept?.summary ?? "Template ke mutabiq access."}</p><div className="mt-3 flex flex-wrap gap-2">{uskiIjazat.slice(0, 8).map((r) => <span key={r.feature_key} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs shadow-sm dark:bg-surface-900"><Check className="h-3 w-3 text-brand-700" />{featureByKey.get(r.feature_key)?.label ?? r.feature_key}</span>)}{uskiIjazat.length > 8 && <span className="px-2 py-1 text-xs text-surface-500">+{uskiIjazat.length - 8} aur</span>}</div></section>
            <section className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><h3 className="text-sm font-semibold">Access Summary</h3><p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-300"><b>{banda.full_name}</b> ko <b>{dept?.label ?? banda.role}</b> ka access hai. Data ki hadd <b>{location ?? "assigned location"}</b> hai. Is waqt <b>{uskiIjazat.length}</b> features khulte hain.</p></section>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-surface-100 pt-4 dark:border-surface-800"><button type="button" onClick={() => setAdvanced((v) => !v)} className="text-sm font-medium text-brand-700 underline">{advanced ? "Advanced band karein" : "Extra Access (Optional)"}</button><SaveButton /></div>
        </form>
        {advanced && <section className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="font-display text-base font-semibold">Individual Permission Changes</h2><p className="mb-4 mt-1 text-xs text-surface-400">Aam tor par template kafi hai. Sirf khaas surat mein access kam ya zyada karein.</p>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">{uskiIjazat.map((r) => { const f = featureByKey.get(r.feature_key); return <div key={r.feature_key} className="rounded-lg border border-surface-100 p-3 dark:border-surface-800"><div className="mb-2 flex items-center justify-between"><div><p className="text-sm font-medium">{f?.label ?? r.feature_key}{f?.is_sensitive && <span className="ml-2 text-[10px] text-red-600">HASSAS</span>}</p><p className="text-[11px] text-surface-400">{f?.route}</p></div><form action={removeAction}><input type="hidden" name="profile_id" value={banda.id} /><input type="hidden" name="feature_key" value={r.feature_key} /><MiniButton danger><Trash2 className="mr-1 inline h-3 w-3" />Band karein</MiniButton></form></div><form action={setAction} className="flex flex-wrap items-end gap-3"><input type="hidden" name="profile_id" value={banda.id} /><input type="hidden" name="feature_key" value={r.feature_key} /><input type="hidden" name="actions" value="view" /><div className="flex flex-wrap gap-2">{ACTIONS.map((a) => <label key={a} className="text-xs"><input type="checkbox" name="actions" value={a} defaultChecked={r.actions.includes(a)} disabled={a === "view"} className="mr-1" />{ACTION_LABEL[a as Action]}</label>)}</div><select name="data_scope" defaultValue={r.data_scope} className="rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900">{DATA_SCOPES.map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}</select><MiniButton>Update</MiniButton></form></div>; })}</div>
          {remaining.length > 0 && <form action={setAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-surface-100 pt-4"><input type="hidden" name="profile_id" value={banda.id} /><input type="hidden" name="actions" value="view" /><label className="text-xs text-surface-500">Extra feature<select name="feature_key" value={extraFeature} onChange={(e) => setExtraFeature(e.target.value)} className="mt-1 block rounded-lg border border-surface-200 px-2 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"><option value="">— chunein —</option>{remaining.map((f) => <option key={f.key} value={f.key}>{f.label}{f.is_sensitive ? " (hassas)" : ""}</option>)}</select></label><label className="text-xs text-surface-500">Data ki hadd<select name="data_scope" defaultValue="own_shop" className="mt-1 block rounded-lg border border-surface-200 px-2 py-2 text-sm dark:border-surface-700 dark:bg-surface-900">{DATA_SCOPES.map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}</select></label><MiniButton>Sirf dekhna dein</MiniButton></form>}
        </section>}
      </main>}
    </div>
  </div>;
}
