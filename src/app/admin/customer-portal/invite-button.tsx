"use client";
import { useState } from "react";

/**
 * Invite: sirf namoona (preview). "Bhejein" jaan boojh kar BAND hai -- owner ki
 * manzoori ke baghair koi WhatsApp / SMS / email nahi jata. Koi server call nahi.
 */
export function InviteButton({ label, title, preview, offNote, confirmLabel, noPhone }: {
  label: string; title: string; preview: string; offNote: string; confirmLabel: string; noPhone: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="gl-act rounded-full px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-900 dark:text-emerald-100">{label}</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="gl-panel w-full max-w-md p-5 text-start" onClick={(e) => e.stopPropagation()}>
            <b className="text-[14px] text-surface-900 dark:text-white">{title}</b>
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-surface-50 p-3 text-[13px] text-surface-800 dark:bg-[#0d1a3a] dark:text-slate-100">{preview}</p>
            {noPhone && <p className="mt-2 text-[11.5px] font-semibold text-rose-600">{noPhone}</p>}
            <p className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-2.5 text-[11.5px] text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200" data-testid="invite-off">🔒 {offNote}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-surface-200 px-3.5 py-2 text-[12px] font-bold dark:border-[#1e3160] dark:text-slate-100">✕</button>
              <button type="button" disabled aria-disabled="true" className="cursor-not-allowed rounded-xl bg-gradient-to-r from-emerald-700 to-[#16356e] px-4 py-2 text-[12px] font-bold text-white opacity-40">{confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
