"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { confirmSendWhatsAppReply, dismissUnknownSender, dismissWhatsAppReply, type ReplyActionState } from "@/actions/whatsapp-replies";

const BTN = "rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60";

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`${BTN} ${className}`}>{pending ? "..." : label}</button>;
}

function Msg({ s }: { s: ReplyActionState }) {
  if (s.error) return <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{s.error}</p>;
  if (s.notice) return <p role="status" className="mt-2 text-sm text-brand-700 dark:text-brand-300">{s.notice}</p>;
  return null;
}

export function ReplyCard(p: { id: string; farmer: string; phone: string; inbound: string; suggestion: string; aiError: string | null; unsigned: boolean; createdAt: string }) {
  const [text, setText] = useState(p.suggestion);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendState, sendAction] = useFormState(confirmSendWhatsAppReply, {} as ReplyActionState);
  const [dropState, dropAction] = useFormState(dismissWhatsAppReply, {} as ReplyActionState);
  if (sendState.success || dropState.success) {
    return <div className="rounded-card border border-surface-200 p-4 text-sm dark:border-surface-800"><Msg s={sendState.success ? sendState : dropState} /></div>;
  }
  return (
    <div data-testid="wa-reply-card" className="rounded-card border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-surface-900 dark:text-white">{p.farmer}</span>
        <span className="text-surface-500" dir="ltr">{p.phone} · {new Date(p.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</span>
      </div>
      {p.unsigned && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">⚠ Signature check band tha (WHATSAPP_APP_SECRET set nahi) — bhejne se pehle number tasdeeq karein.</p>}
      <p className="mt-2 rounded-lg bg-surface-50 p-2 text-sm text-surface-800 dark:bg-surface-800/60 dark:text-surface-100"><b>Kisan:</b> {p.inbound || "—"}</p>
      <label className="mt-3 block text-xs font-medium text-surface-600 dark:text-surface-300">AI ka mashwara (staff theek kar sakta hai)</label>
      {p.aiError && <p className="text-xs text-red-600">AI: {p.aiError}</p>}
      <textarea value={text} onChange={(e) => { setText(e.target.value); setPreview(false); }} rows={4} maxLength={4000}
        className="mt-1 w-full rounded-lg border border-surface-200 bg-white p-2 text-sm dark:border-surface-700 dark:bg-surface-950 dark:text-white" />
      {preview && (
        <div data-testid="wa-preview" className="mt-2 rounded-lg border border-brand-300 bg-brand-50 p-3 text-sm dark:border-brand-700 dark:bg-brand-900/20">
          <p className="mb-1 text-xs font-semibold text-brand-800 dark:text-brand-200">Preview — {p.phone} ko ye jayega:</p>
          <p className="whitespace-pre-wrap text-surface-900 dark:text-white">{text}</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={`${BTN} border border-surface-200 dark:border-surface-700 dark:text-white`}
          onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); } }}>
          {copied ? "Copy ho gaya" : "Copy"}
        </button>
        {!preview ? (
          <button type="button" disabled={!text.trim()} className={`${BTN} bg-blue-600 text-white`} onClick={() => setPreview(true)}>Preview</button>
        ) : (
          <form action={sendAction}>
            <input type="hidden" name="request_id" value={p.id} />
            <input type="hidden" name="reply" value={text} />
            <input type="hidden" name="confirm" value="yes" />
            <Submit label="Confirm send" className="bg-brand-600 text-white" />
          </form>
        )}
        <form action={dropAction}>
          <input type="hidden" name="request_id" value={p.id} />
          <Submit label="Bina jawab band karein" className="text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800" />
        </form>
      </div>
      <Msg s={sendState} />
      <Msg s={dropState} />
    </div>
  );
}

export function UnknownSenderRow(p: { phoneKey: string; phone: string; name: string | null; createdAt: string }) {
  const [s, action] = useFormState(dismissUnknownSender, {} as ReplyActionState);
  if (s.success) return null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="text-surface-800 dark:text-surface-100"><span dir="ltr">{p.phone}</span>{p.name ? ` · ${p.name}` : ""} <span className="text-surface-500">· {new Date(p.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}</span></span>
      <form action={action}>
        <input type="hidden" name="phone_key" value={p.phoneKey} />
        <Submit label="Hata dein" className="text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800" />
      </form>
      <Msg s={s} />
    </li>
  );
}
