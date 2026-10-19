"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, MessageCircle, ShieldOff, ShieldCheck, Trash2, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { type PortalAccount, filterAccounts, roleLabel, DELETE_CONFIRM_WORD, deleteNeedsChecker } from "@/lib/portal-accounts/core";
import {
  setPortalSuspended, deletePortalAccount, decidePortalDelete, previewPortalWhatsApp, sendPortalWhatsApp, type WaPreview,
} from "@/actions/portal-accounts";

const STATUS = {
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  suspended: { label: "Suspended", cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  no_profile: { label: "No profile", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
} as const;
const ROLE_CLS: Record<string, string> = {
  farmer: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  customer: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  dealer: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30",
  machinery_vendor: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/30",
};
const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "—";
const btn = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50";
const input = "w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-surface-700 dark:bg-surface-950 dark:text-white";

export function PortalAccountsTable({ accounts, meId, templateReady, templateName }: { accounts: PortalAccount[]; meId: string; templateReady: boolean; templateName: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState(""); const [role, setRole] = useState("all"); const [status, setStatus] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [modal, setModal] = useState<null | { kind: "suspend" | "delete"; a: PortalAccount } | { kind: "wa"; preview: WaPreview; ids: string[] }>(null);
  const [pending, start] = useTransition();
  const list = useMemo(() => filterAccounts(accounts, { q, role, status }), [accounts, q, role, status]);
  const done = (r: { ok: boolean; message?: string; error?: string }) => { setMsg({ ok: r.ok, text: (r.ok ? r.message : r.error) ?? "" }); if (r.ok) { setModal(null); router.refresh(); } };
  const openWa = (ids: string[]) => start(async () => { const r = await previewPortalWhatsApp(ids); r.ok ? setModal({ kind: "wa", preview: r.preview, ids }) : setMsg({ ok: false, text: r.error }); });
  const pendingReqs = accounts.filter((a) => a.pending_delete_id);

  return (
    <div className="space-y-4">
      {msg && <div role={msg.ok ? "status" : "alert"} className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"}`}>{msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{msg.text}</div>}
      {!templateReady && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />WhatsApp template <b className="mx-1">WHATSAPP_ACCOUNT_TEMPLATE</b> abhi server par set nahi. Preview dekh sakte hain, bhejna band rahega.</div>}
      {pendingReqs.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
          <p className="mb-2 text-sm font-bold text-rose-800 dark:text-rose-300">Delete ki darkhwastein (doosre Admin ki manzoori)</p>
          {pendingReqs.map((a) => (
            <div key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm text-surface-800 dark:text-surface-200">
              <span><b>{a.name}</b> · {a.loginId}</span>
              {a.pending_delete_by === meId ? <span className="text-xs text-surface-500">Aap ki darkhwast — doosra Admin manzoor karega</span> : (
                <span className="flex gap-2">
                  <button disabled={pending} onClick={() => start(async () => done(await decidePortalDelete(a.pending_delete_id!, true)))} className={`${btn} border-rose-600 bg-rose-600 text-white`}>Manzoor</button>
                  <button disabled={pending} onClick={() => start(async () => done(await decidePortalDelete(a.pending_delete_id!, false)))} className={`${btn} border-surface-300 dark:border-surface-700 dark:text-surface-200`}>Rad</button>
                </span>)}
            </div>))}
        </div>)}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-surface-400" /><input aria-label="Talash" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naam, code, phone ya email talash karein" className={`${input} pl-9`} /></div>
        <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className={`${input.replace("w-full ", "")} w-auto`}><option value="all">Role: Sab</option><option value="farmer">Kisan</option><option value="customer">Customer</option><option value="dealer">Dealer</option><option value="machinery_vendor">Vendor</option><option value="none">Bina role</option></select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${input.replace("w-full ", "")} w-auto`}><option value="all">Status: Sab</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="no_profile">No profile</option></select>
        <button disabled={!sel.length || pending} onClick={() => openWa(sel)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-40"><MessageCircle className="h-4 w-4" />WhatsApp bhejein ({sel.length} chune)</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 text-left text-[11px] uppercase tracking-wider text-surface-500 dark:bg-surface-950/60 dark:text-surface-400">
            <tr><th className="p-3"><input type="checkbox" aria-label="Sab chunein" checked={list.length > 0 && list.every((a) => sel.includes(a.user_id))} onChange={(e) => setSel(e.target.checked ? list.map((a) => a.user_id) : [])} /></th>
              {["Naam / Code", "Phone", "Login ID", "Role", "Linked record", "Bana", "Last login", "Status", "Actions"].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.user_id} className="border-t border-surface-100 text-surface-800 hover:bg-surface-50/60 dark:border-surface-800 dark:text-surface-200 dark:hover:bg-surface-800/40">
                <td className="p-3"><input type="checkbox" aria-label={`Chunein ${a.loginId}`} checked={sel.includes(a.user_id)} onChange={(e) => setSel(e.target.checked ? [...sel, a.user_id] : sel.filter((x) => x !== a.user_id))} /></td>
                <td className="p-3"><p className="font-semibold text-surface-900 dark:text-white">{a.name}</p><p className="text-xs text-surface-500">{a.record_code ?? "—"}</p></td>
                <td className="p-3 tabular-nums">{a.phone ?? <span className="text-surface-400">—</span>}</td>
                <td className="p-3 text-xs">{a.loginId}</td>
                <td className="p-3">{a.role ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${ROLE_CLS[a.role] ?? "bg-surface-100 text-surface-700 ring-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:ring-surface-700"}`}>{roleLabel(a.role)}</span> : <span className="text-surface-400">—</span>}</td>
                <td className="p-3 text-xs">{a.record_type ? <span className="text-surface-700 dark:text-surface-300">{roleLabel(a.record_type === "vendor" ? "machinery_vendor" : a.record_type)} · {a.record_code ?? a.name}</span> : <span className="text-amber-600 dark:text-amber-400">Juda nahi</span>}</td>
                <td className="p-3 text-xs text-surface-500">{fmt(a.created_at)}</td>
                <td className="p-3 text-xs text-surface-500">{fmt(a.last_sign_in_at)}</td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span></td>
                <td className="whitespace-nowrap p-3">
                  <div className="flex gap-1.5">
                    {a.user_id === meId ? <span className="text-xs text-surface-400">Aap ka account</span> : <>
                      <button onClick={() => setModal({ kind: "suspend", a })} className={`${btn} border-surface-200 text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800`}>{a.status === "suspended" ? <><ShieldCheck className="h-3.5 w-3.5" />Activate</> : <><ShieldOff className="h-3.5 w-3.5" />Suspend</>}</button>
                      <button disabled={!!a.pending_delete_id} onClick={() => setModal({ kind: "delete", a })} className={`${btn} border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40`}><Trash2 className="h-3.5 w-3.5" />Delete</button>
                      {a.phone && <button onClick={() => openWa([a.user_id])} className={`${btn} border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600`}><MessageCircle className="h-3.5 w-3.5" />WhatsApp</button>}
                    </>}
                  </div>
                </td>
              </tr>))}
            {!list.length && <tr><td colSpan={10} className="p-8 text-center text-surface-500">Koi account nahi mila.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && <Modal onClose={() => setModal(null)}>
        {modal.kind === "suspend" && <SuspendBox a={modal.a} pending={pending} onGo={(reason) => start(async () => done(await setPortalSuspended(modal.a.user_id, modal.a.status !== "suspended", reason)))} />}
        {modal.kind === "delete" && <DeleteBox a={modal.a} pending={pending} onGo={(typed, reason) => start(async () => done(await deletePortalAccount(modal.a.user_id, typed, reason)))} />}
        {modal.kind === "wa" && <WaBox preview={modal.preview} templateReady={templateReady} templateName={templateName} pending={pending} onGo={(ok) => start(async () => done(await sendPortalWhatsApp(modal.preview.items.filter((i) => !i.skip).map((i) => i.userId), modal.preview.token, ok)))} />}
      </Modal>}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal>
    <div className="relative w-full max-w-lg rounded-2xl border border-surface-200 bg-white p-6 shadow-2xl dark:border-surface-700 dark:bg-surface-900">
      <button aria-label="Band karein" onClick={onClose} className="absolute right-4 top-4 text-surface-400 hover:text-surface-700 dark:hover:text-white"><X className="h-5 w-5" /></button>{children}</div></div>;
}

function SuspendBox({ a, pending, onGo }: { a: PortalAccount; pending: boolean; onGo: (r: string) => void }) {
  const on = a.status !== "suspended"; const [r, setR] = useState("");
  return <div className="space-y-3"><h2 className="text-lg font-bold text-surface-900 dark:text-white">{on ? "Account band karein?" : "Account dobara chaalu karein?"}</h2>
    <p className="text-sm text-surface-600 dark:text-surface-300"><b>{a.loginId}</b> · {a.name}</p>
    <label className="block text-xs font-semibold text-surface-500">Wajah (zaroori)<input value={r} onChange={(e) => setR(e.target.value)} className={`${input} mt-1`} /></label>
    <div className="flex justify-end gap-2 pt-2"><button disabled={pending || !r.trim()} onClick={() => onGo(r)} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${on ? "bg-amber-600" : "bg-emerald-600"}`}>{on ? "Haan, band karein" : "Haan, chaalu karein"}</button></div></div>;
}

function DeleteBox({ a, pending, onGo }: { a: PortalAccount; pending: boolean; onGo: (t: string, r: string) => void }) {
  const [t, setT] = useState(""); const [r, setR] = useState(""); const checker = deleteNeedsChecker(a);
  return <div className="space-y-3"><h2 className="text-lg font-bold text-rose-600 dark:text-rose-400">Account mitayein?</h2>
    <p className="text-sm text-surface-700 dark:text-surface-200"><b>{a.loginId}</b> · {STATUS[a.status].label} · aakhri login {fmt(a.last_sign_in_at)}</p>
    <ul className="list-disc space-y-1 pl-5 text-sm text-surface-600 dark:text-surface-300">
      <li>Sirf login account mitega; khata aur hisaab mehfooz rahega.</li>
      <li>Mitana na ho saka to account khud <b>Suspend</b> ho jayega.</li>
      {checker && <li className="text-rose-700 dark:text-rose-300">Is account se khata juda hai — doosra Admin manzoor karega (maker-checker).</li>}
      <li>Ye amal Audit log mein darj hoga.</li></ul>
    <label className="block text-xs font-semibold text-surface-500">Tasdeeq ke liye <b>{DELETE_CONFIRM_WORD}</b> likhein<input aria-label="Tasdeeq" value={t} onChange={(e) => setT(e.target.value)} className={`${input} mt-1`} /></label>
    <label className="block text-xs font-semibold text-surface-500">Wajah (zaroori)<input aria-label="Wajah" value={r} onChange={(e) => setR(e.target.value)} className={`${input} mt-1`} /></label>
    <div className="flex justify-end pt-2"><button disabled={pending || t.trim() !== DELETE_CONFIRM_WORD || r.trim().length < 3} onClick={() => onGo(t, r)} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{checker ? "Darkhwast bhejein" : "Haan, mita dein"}</button></div></div>;
}

function WaBox({ preview, templateReady, templateName, pending, onGo }: { preview: WaPreview; templateReady: boolean; templateName: string | null; pending: boolean; onGo: (ok: boolean) => void }) {
  const [ok, setOk] = useState(false); const sendable = preview.items.filter((i) => !i.skip); const skipped = preview.items.length - sendable.length;
  return <div className="space-y-3"><h2 className="text-lg font-bold text-surface-900 dark:text-white">WhatsApp bhejein — Preview</h2>
    <p className="text-sm text-surface-500">{sendable.length} ko jayega{skipped ? ` · ${skipped} chhor diye gaye` : ""}</p>
    <div className="max-h-72 space-y-2 overflow-y-auto">{preview.items.map((i) => <div key={i.userId} className="rounded-xl border border-surface-200 p-3 dark:border-surface-700">
      <p className="text-sm font-semibold text-surface-900 dark:text-white">{i.name} <span className="font-normal text-surface-500">· {i.phone ?? "—"}</span></p>
      {i.text ? <p className="mt-2 rounded-lg rounded-tl-none bg-[#dcf8c6] p-3 text-[13px] leading-relaxed text-slate-900">{i.text}</p> : <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Nahi jayega: {i.skip}</p>}</div>)}</div>
    <p className="text-xs text-surface-500">Template: <b>{templateName ?? "account_created_notice (abhi set nahi)"}</b> · har message log mein darj hoga</p>
    <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-200"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />Main tasdeeq karta hoon ke ye message bhejna hai</label>
    <div className="flex justify-end pt-1"><button disabled={pending || !ok || !sendable.length || !templateReady} onClick={() => onGo(ok)} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{templateReady ? `${sendable.length} message bhejein` : "Template set nahi — bhejna band"}</button></div></div>;
}
