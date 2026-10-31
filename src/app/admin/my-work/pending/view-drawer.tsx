"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Eye, Loader2, X } from "lucide-react";
import { MarkReadLink } from "@/components/notifications/mark-read";
import { ProductPendingSummary } from "@/components/pending/product-diff-ui";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { catLabelKey, type PendingItem } from "@/lib/pending/categories";
import type { PendingPopupData, PopupField } from "@/lib/pending/popup";
import { commitPendingPopup, loadPendingPopup } from "./popup-server";
import { statusOf, usePendingLive } from "./live-state";

const STATUS_KEY: Record<string, TranslationKey> = {
  pending: "apb_pst_pending",
  verified: "apb_pst_verified",
  approving: "apb_pst_approving",
  approved: "apb_pst_approved",
  rejected: "apb_pst_rejected",
  open: "apb_pst_open",
  sent: "apb_pst_sent",
  failed: "apb_pst_failed",
  skipped: "apb_pst_skipped",
  processing: "apb_pst_processing",
};

function fieldLabel(key: string, lang: ReturnType<typeof useLang>): string {
  switch (key) {
    case "status":
      return t("apb_f_status", lang);
    case "amount":
      return t("apb_f_amount", lang);
    case "date":
      return t("apb_f_date", lang);
    case "kind":
      return t("apb_f_kind", lang);
    case "category":
      return t("apb_f_category", lang);
    case "detail":
      return t("apb_f_detail", lang);
    case "party":
      return t("apb_f_party", lang);
    case "account":
      return t("apb_f_account", lang);
    case "ref":
      return t("apb_f_ref", lang);
    case "method":
      return t("apb_f_method", lang);
    case "notes":
      return t("apb_f_notes", lang);
    case "slip":
      return t("apb_f_slip", lang);
    case "doc":
      return t("apb_f_doc", lang);
    case "message":
      return t("apb_f_message", lang);
    case "route":
      return t("apb_f_route", lang);
    case "record":
      return t("apb_f_record", lang);
    case "alert":
      return t("apb_f_alert", lang);
    case "error":
      return t("apb_f_error", lang);
    case "module":
      return t("apb_f_module", lang);
    case "work":
      return t("apb_f_work", lang);
    case "qty":
      return t("apb_f_qty", lang);
    case "title":
      return t("apb_f_title", lang);
    case "with":
      return t("apb_f_with", lang);
    case "hstatus":
      return t("apb_f_hstatus", lang);
    default:
      return key;
  }
}

function hintKey(hint: PendingPopupData["hint"]): TranslationKey | null {
  if (hint === "txn") return "apb_hint_txn";
  if (hint === "handoff") return "apb_hint_handoff";
  if (hint === "summary") return "apb_hint_summary";
  if (hint === "approving") return "apb_hint_approving";
  if (hint === "linked") return "apb_hint_linked";
  return null;
}

function FieldValue({ field }: { field: PopupField }) {
  const lang = useLang();
  const raw = (field.key === "status" || field.key === "hstatus") && STATUS_KEY[field.value] ? t(STATUS_KEY[field.value], lang) : field.value;
  const link = (field.key === "slip" || field.key === "doc") && /^https?:\/\//.test(field.value);
  if (link) {
    return (
      <a href={field.value} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline dark:text-brand-300">
        {t(field.key === "slip" ? "apb_f_slip" : "apb_f_doc", lang)}
      </a>
    );
  }
  return <span className="whitespace-pre-wrap font-semibold text-surface-900 dark:text-white">{raw}</span>;
}

function inputClass() {
  return "mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5";
}

export function PendingViewButton({ item, href, dialogExtra }: { item: PendingItem; href: string; dialogExtra?: ReactNode }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-pending-view={item.category}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white hover:bg-brand-700"
      >
        <Eye className="h-3 w-3" />
        {t("apb_view", lang)}
      </button>
      {open && <PendingViewDrawer item={item} href={href} dialogExtra={dialogExtra} onClose={() => setOpen(false)} />}
    </>
  );
}

function PendingViewDrawer({
  item,
  href,
  dialogExtra,
  onClose,
}: {
  item: PendingItem;
  href: string;
  dialogExtra?: ReactNode;
  onClose: () => void;
}) {
  const lang = useLang();
  const live = usePendingLive();
  const [data, setData] = useState<PendingPopupData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | "approve" | "reject" | "verify">(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function reload() {
    setLoadError(null);
    const res = await loadPendingPopup(item.category, item.item_id);
    if (!res.ok) {
      setData(null);
      setLoadError(res.error);
      return;
    }
    setData(res.data);
    setEdit(res.data.edit ?? {});
    setAccountId(res.data.edit?.finance_account_id || res.data.edit?.paid_from_account_id || "");
  }

  useEffect(() => {
    let alive = true;
    loadPendingPopup(item.category, item.item_id).then((res) => {
      if (!alive) return;
      if (!res.ok) setLoadError(res.error);
      else {
        setData(res.data);
        setEdit(res.data.edit ?? {});
        setAccountId(res.data.edit?.finance_account_id || res.data.edit?.paid_from_account_id || "");
      }
    });
    return () => {
      alive = false;
    };
  }, [item.category, item.item_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function commit(decision: "approve" | "reject" | "verify" | "edit") {
    if (!data || busy) return;
    if ((decision === "reject" || (decision === "approve" && data.caps.needsComment)) && note.trim().length < 1) {
      setError(t("apb_comment", lang));
      return;
    }
    if (decision === "approve" && data.caps.needsAccount && !accountId) {
      setError(t("apb_need_account", lang));
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("category", data.actionCategory);
    fd.set("id", data.actionId);
    fd.set("decision", decision);
    if (note.trim()) fd.set("note", note.trim());
    if (accountId) fd.set("finance_account_id", accountId);
    if (decision === "edit") {
      for (const [k, v] of Object.entries(edit)) fd.set(k, v);
    }
    const res = await commitPendingPopup(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      live.notifyError(res.error);
      return;
    }
    setInfo(res.message);
    setAsk(null);
    setEditing(false);
    setNote("");
    if (res.effect === "done" && data.actionCategory === item.category && data.actionId === item.item_id) {
      live.mark(item, statusOf(res.decision));
      onClose();
      return;
    }
    await reload();
  }

  const hint = data && !(dialogExtra && data.hint === "summary") ? hintKey(data.hint) : null;
  const caps = data?.caps;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => { if (!busy) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-view-title"
        data-pending-popup={item.category}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-surface-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f1b3d] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-surface-100 px-4 py-3 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">{t(catLabelKey(item.category), lang)}</p>
            <h2 id="pending-view-title" className="truncate font-display text-lg font-extrabold text-surface-900 dark:text-white">
              {data?.headline || item.ref || item.title || t("apb_view", lang)}
            </h2>
            <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">{t("apb_popup_sub", lang)}</p>
          </div>
          <button type="button" aria-label={t("apb_close", lang)} disabled={busy} onClick={onClose} className="rounded-lg p-1 text-surface-500 hover:bg-surface-100 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {item.product_extra && <ProductPendingSummary extra={item.product_extra} lang={lang} />}
          {!data && !loadError && (
            <p className="flex items-center gap-2 text-sm text-surface-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("apb_loading", lang)}
            </p>
          )}
          {loadError && <p role="alert" className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200">{loadError}</p>}
          {hint && <p className="rounded-xl bg-surface-100 px-3 py-2 text-sm text-surface-700 dark:bg-white/5 dark:text-surface-200">{t(hint, lang)}</p>}
          {data && (
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {data.fields.map((f) => (
                <div key={f.key + f.value} className={f.key === "detail" || f.key === "message" || f.key === "work" ? "sm:col-span-2" : ""}>
                  <dt className="text-[10.5px] font-bold uppercase tracking-wide text-surface-400">{fieldLabel(f.key, lang)}</dt>
                  <dd className="mt-0.5"><FieldValue field={f} /></dd>
                </div>
              ))}
            </dl>
          )}

          {editing && data?.editKind === "expense" && (
            <div className="space-y-2 rounded-xl border border-surface-200 p-3 dark:border-white/10">
              {data.status === "verified" && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t("apb_edit_reset_hint", lang)}</p>}
              <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                {t("apb_edit_detail", lang)}
                <textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={2} className={inputClass()} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                  {t("apb_edit_amount", lang)}
                  <input value={edit.amount ?? ""} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} inputMode="decimal" className={inputClass()} />
                </label>
                <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                  {t("apb_edit_date", lang)}
                  <input type="date" value={edit.expense_date ?? ""} onChange={(e) => setEdit({ ...edit, expense_date: e.target.value })} className={inputClass()} />
                </label>
              </div>
              <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                {t("apb_edit_party", lang)}
                <input value={edit.party_name ?? ""} onChange={(e) => setEdit({ ...edit, party_name: e.target.value })} className={inputClass()} />
              </label>
              <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                {t("apb_edit_category", lang)}
                <input value={edit.category ?? ""} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className={inputClass()} />
              </label>
              <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                {t("apb_edit_account", lang)}
                <select value={edit.paid_from_account_id ?? ""} onChange={(e) => setEdit({ ...edit, paid_from_account_id: e.target.value })} className={inputClass()}>
                  <option value="">{t("apb_account_empty", lang)}</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {editing && data?.editKind === "supplier" && (
            <div className="space-y-2 rounded-xl border border-surface-200 p-3 dark:border-white/10">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                  {t("apb_edit_amount", lang)}
                  <input value={edit.amount ?? ""} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} inputMode="decimal" className={inputClass()} />
                </label>
                <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                  {t("apb_edit_date", lang)}
                  <input type="date" value={edit.payment_date ?? ""} onChange={(e) => setEdit({ ...edit, payment_date: e.target.value })} className={inputClass()} />
                </label>
              </div>
              <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                {t("apb_edit_method", lang)}
                <input value={edit.payment_method ?? ""} onChange={(e) => setEdit({ ...edit, payment_method: e.target.value })} className={inputClass()} />
              </label>
              <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                {t("apb_edit_notes", lang)}
                <textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} className={inputClass()} />
              </label>
              <label className="block text-xs font-bold text-surface-600 dark:text-surface-300">
                {t("apb_edit_account", lang)}
                <select value={edit.finance_account_id ?? ""} onChange={(e) => setEdit({ ...edit, finance_account_id: e.target.value })} className={inputClass()}>
                  <option value="">{t("apb_account_empty", lang)}</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {ask && (
            <div className="space-y-2 rounded-xl border border-surface-200 p-3 dark:border-white/10" data-popup-ask={ask}>
              <p className="text-sm font-extrabold text-surface-900 dark:text-white">
                {t(ask === "approve" ? "apb_ask_approve" : ask === "reject" ? "apb_ask_reject" : "apb_ask_verify", lang)}
              </p>
              <p className="text-xs text-surface-500">{t("apb_rules", lang)}</p>
              {(ask === "reject" || (ask === "approve" && caps?.needsComment)) && (
                <input
                  value={note}
                  autoFocus
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t(caps?.needsComment && ask === "approve" ? "apb_comment" : "apb_reason", lang)}
                  className={inputClass()}
                />
              )}
              {ask === "approve" && caps?.needsAccount && (
                <label className="block text-xs font-bold">
                  {t("apb_need_account", lang)}
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass()}>
                    <option value="">{t("apb_account_empty", lang)}</option>
                    {(data?.accounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 dark:text-rose-300">{error}</p>}
          {info && <p role="status" className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">{info}</p>}
          {dialogExtra}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-1.5 border-t border-surface-100 px-4 py-3 dark:border-white/10">
          {caps?.verify && !ask && !editing && (
            <button type="button" data-popup-verify disabled={busy} onClick={() => { setError(null); setAsk("verify"); }} className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-[11.5px] font-bold text-sky-800">{t("apb_verify", lang)}</button>
          )}
          {caps?.approve && !ask && !editing && (
            <button type="button" data-popup-approve disabled={busy} onClick={() => { setError(null); setNote(""); setAsk("approve"); }} className="rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white">{t("apb_approve", lang)}</button>
          )}
          {caps?.reject && !ask && !editing && (
            <button type="button" data-popup-reject disabled={busy} onClick={() => { setError(null); setNote(""); setAsk("reject"); }} className="rounded-lg border border-surface-200 px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 dark:border-white/10">{t("apb_reject", lang)}</button>
          )}
          {caps?.edit && !ask && !editing && (
            <button type="button" data-popup-edit disabled={busy} onClick={() => { setError(null); setEditing(true); }} className="rounded-lg border border-surface-200 px-2.5 py-1.5 text-[11.5px] font-bold text-surface-800 dark:border-white/10 dark:text-surface-100">{t("apb_edit", lang)}</button>
          )}
          {ask && (
            <>
              <button type="button" disabled={busy} onClick={() => setAsk(null)} className="rounded-lg border border-surface-200 px-2.5 py-1.5 text-[11.5px] font-bold dark:border-white/10">{t("apb_cancel", lang)}</button>
              <button type="button" data-popup-confirm={ask} disabled={busy} onClick={() => void commit(ask)} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-60">
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                {t(ask === "approve" ? "apb_approve" : ask === "reject" ? "apb_reject" : "apb_verify", lang)}
              </button>
            </>
          )}
          {editing && (
            <>
              <button type="button" disabled={busy} onClick={() => setEditing(false)} className="rounded-lg border border-surface-200 px-2.5 py-1.5 text-[11.5px] font-bold dark:border-white/10">{t("apb_cancel", lang)}</button>
              <button type="button" data-popup-save disabled={busy} onClick={() => void commit("edit")} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-60">
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                {t("apb_save_edit", lang)}
              </button>
            </>
          )}
          <MarkReadLink href={href} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2.5 py-1.5 text-[11.5px] font-semibold text-surface-600 dark:border-white/10 dark:text-surface-300">
            {t("apb_open", lang)}
          </MarkReadLink>
        </footer>
      </div>
    </div>
  );
}
