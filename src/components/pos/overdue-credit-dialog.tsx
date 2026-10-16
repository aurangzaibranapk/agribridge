"use client";
import { useState } from "react";
import { AlertTriangle, Banknote, HandCoins, Lock, ReceiptText, X } from "lucide-react";
import type { CreditBlockInfo } from "@/lib/recovery/credit-position";
import { CreditPositionStrip } from "@/components/recovery/credit-position-strip";

export type OverdueChoice =
  | { kind: "cancel" }
  | { kind: "cash" }
  | { kind: "recovery" }
  | { kind: "promise" }
  | { kind: "override"; reason: string };

/** window.prompt ki jagah: POS par purane baqaye ki rok ka saaf dialog (538). */
export function OverdueCreditDialog({ info, fallbackText, onChoose }: { info: CreditBlockInfo | null; fallbackText: string; onChoose: (c: OverdueChoice) => void }) {
  const reasons = info?.overrideReasons ?? ["Purana bharosemand gahak", "Doosri wajah"];
  const [preset, setPreset] = useState(reasons[0] ?? "");
  const [detail, setDetail] = useState("");
  const canOverride = Boolean(info?.canOverride);
  const reason = [preset, detail.trim()].filter(Boolean).join(" — ");
  const valid = detail.trim().length >= 3 || (preset && preset !== "Doosri wajah");

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="overdue-title" className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-surface-900">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-600"><AlertTriangle className="h-5 w-5" /></div>
          <div className="flex-1">
            <h2 id="overdue-title" className="text-lg font-bold text-surface-900 dark:text-white">Naya udhaar band hai{info ? ` — ${info.name}` : ""}</h2>
            <p className="text-sm text-surface-500">{info ? `Is bill ka udhaar: Rs ${Math.round(info.billKhata).toLocaleString("en-PK")}` : "Purana baqaya hadd se purana hai"}</p>
          </div>
          <button type="button" aria-label="Band karein" onClick={() => onChoose({ kind: "cancel" })} className="rounded p-1 text-surface-400 hover:bg-surface-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 rounded-xl border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800">
          {info ? <CreditPositionStrip position={info} compact /> : <p className="text-sm">{fallbackText}</p>}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => onChoose({ kind: "cash" })} className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700"><Banknote className="h-4 w-4" /> Naqad mein badlein</button>
          <button type="button" onClick={() => onChoose({ kind: "recovery" })} className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-emerald-600 py-3 text-sm font-semibold text-emerald-700"><ReceiptText className="h-4 w-4" /> Wasooli darj karein</button>
          <button type="button" onClick={() => onChoose({ kind: "promise" })} className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-orange-400 py-3 text-sm font-semibold text-orange-700"><HandCoins className="h-4 w-4" /> Naya waada{info?.promiseState === "broken" && !canOverride ? " (Admin)" : ""}</button>
        </div>

        {canOverride ? (
          <div className="mt-4 border-t border-surface-200 pt-4 dark:border-surface-700">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Sirf Admin/Owner</span> Override se udhaar dein</div>
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="mb-2 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800">
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Tafseel likhein (kam az kam 3 huroof)" className="h-16 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800" />
            <p className="mt-1 text-xs text-surface-500">Ye override aap ke naam se Override Log mein darj hoga.</p>
          </div>
        ) : (
          <div className="mt-4 flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><Lock className="mt-0.5 h-4 w-4 shrink-0" /> Override sirf Admin/Owner kar sakta hai. Admin ko bulayein, ya bill naqad mein badlein / wasooli darj karein.</div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => onChoose({ kind: "cancel" })} className="rounded-lg border border-surface-200 px-4 py-2 text-sm">Wapas</button>
          {canOverride && (
            <button type="button" disabled={!valid} onClick={() => onChoose({ kind: "override", reason })} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Override karke bill banayein</button>
          )}
        </div>
      </div>
    </div>
  );
}
