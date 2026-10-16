"use client";
import { useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, HandCoins, Lock, ReceiptText, X } from "lucide-react";
import { STAFF_MAX_PROMISE_DAYS, TERMS, promiseFormError, rsPk } from "@/lib/recovery/credit-report";
import type { CreditBlockInfo } from "@/lib/recovery/credit-position";
import { CreditPositionStrip } from "@/components/recovery/credit-position-strip";

export type OverdueChoice =
  | { kind: "cancel" }
  | { kind: "cash" }
  | { kind: "recovery" }
  | { kind: "promise" }
  | { kind: "promised"; promiseDate: string; amount: number | null }
  | { kind: "override"; reason: string };

/** window.prompt ki jagah: POS par purane baqaye ki rok ka saaf dialog (538). */
export function OverdueCreditDialog({ info, fallbackText, onChoose }: { info: CreditBlockInfo | null; fallbackText: string; onChoose: (c: OverdueChoice) => void }) {
  const reasons = info?.overrideReasons ?? ["Purana bharosemand gahak", "Doosri wajah"];
  const [preset, setPreset] = useState(reasons[0] ?? "");
  const [detail, setDetail] = useState("");
  const canOverride = Boolean(info?.canOverride);
  const reason = [preset, detail.trim()].filter(Boolean).join(" — ");
  const valid = detail.trim().length >= 3 || (preset && preset !== "Doosri wajah");
  const [step, setStep] = useState<"choose" | "promise" | "done">("choose");
  if (step !== "choose" && info) return <InlinePromise info={info} isAdmin={canOverride} step={step} setStep={setStep} onChoose={onChoose} />;

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
          <button type="button" onClick={() => (info ? setStep("promise") : onChoose({ kind: "promise" }))} className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-orange-400 py-3 text-sm font-semibold text-orange-700"><HandCoins className="h-4 w-4" /> Naya waada{info?.promiseState === "broken" && !canOverride ? " (Admin)" : ""}</button>
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

const pkDate = (offset: number) => { const t = new Date(Date.now() + 5 * 3600_000); t.setUTCDate(t.getUTCDate() + offset); return t.toISOString().slice(0, 10); };
const daysUntil = (iso: string) => Math.round((Date.parse(iso) - Date.parse(pkDate(0))) / 86400000);

/** 541: waada isi popup mein (naya URL nahi). Zubani sharaait -- staff checkbox. */
export function InlinePromise({ info, isAdmin, step, setStep, onChoose }: {
  info: CreditBlockInfo; isAdmin: boolean; step: "promise" | "done";
  setStep: (s: "choose" | "promise" | "done") => void; onChoose: (c: OverdueChoice) => void;
}) {
  const [date, setDate] = useState(pkDate(15));
  const [amount, setAmount] = useState(String(Math.round(info.lateAmount || info.kulBaqaya || 0)));
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const days = daysUntil(date);
  const formErr = promiseFormError({ days, isAdmin, termsAccepted: terms });
  const amt = amount.trim() === "" ? null : Number(amount);
  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/recovery", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "promise", parties: [{ type: "customer", id: info.customerId }], promiseDate: date, amount: amt, notes: notes || null, termsAccepted: terms }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) throw new Error(j.error || "Waada save nahi hua.");
      setStep("done");
    } catch (e) { setErr(e instanceof Error ? e.message : "Waada save nahi hua."); } finally { setBusy(false); }
  }
  const K = ({ l, v, c }: { l: string; v: string; c?: string }) => <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><div className="text-xs text-slate-500 dark:text-slate-400">{l}</div><div className={`mt-1 text-lg font-bold tabular-nums ${c ?? ""}`}>{v}</div></div>;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="promise-title" className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#24324a] dark:text-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-white/10">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><HandCoins className="h-5 w-5" /></div>
          <div className="flex-1"><h2 id="promise-title" className="text-lg font-bold">{info.name} — {step === "done" ? "waada darj" : "naya waada"}</h2><p className="text-xs text-slate-500 dark:text-slate-400">Isi screen par · sale ruki hui hai</p></div>
          <button type="button" aria-label="Band karein" onClick={() => onChoose({ kind: "cancel" })} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">
          <div className="mb-4 flex gap-2">{[0, 1, 2].map((i) => <div key={i} className={`h-1 flex-1 rounded ${i < (step === "done" ? 3 : 2) ? "bg-teal-700 dark:bg-teal-400" : "bg-slate-200 dark:bg-white/10"}`} />)}</div>
          {step === "done" && <div className="mb-4 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /><div className="mt-2 text-lg font-bold">Waada darj ho gaya</div><div className="text-xs text-slate-500">Tareekh {date} · {days} din · sharaait zubani maani gayin</div></div>}
          <div className="mb-4 grid grid-cols-3 gap-2">
            <K l="Kul baqaya" v={rsPk(info.kulBaqaya)} />
            <K l="Late raqam" v={rsPk(info.lateAmount)} c="text-red-600 dark:text-red-400" />
            <K l={step === "done" ? "Waade ki raqam" : "Abhi itna dein to udhaar bahal"} v={rsPk(step === "done" ? amt : info.bahaliAmount)} c={step === "done" ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-400"} />
          </div>
          {step === "promise" ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Waade ki tareekh</label>
                  <input type="date" value={date} min={pkDate(1)} max={isAdmin ? pkDate(365) : pkDate(STAFF_MAX_PROMISE_DAYS)} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-[#1c2940]" />
                  <div className="mt-2 flex gap-1.5">{[7, 15, 30].map((d) => <button key={d} type="button" onClick={() => setDate(pkDate(d))} className={`rounded-full border px-3 py-1 text-xs ${days === d ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 dark:border-white/10"}`}>{d} din</button>)}</div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Staff zyada se zyada {STAFF_MAX_PROMISE_DAYS} din. Is se lamba sirf Admin.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Waade ki raqam</label>
                  <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm tabular-nums dark:border-white/10 dark:bg-[#1c2940]" />
                  <label className="mb-1 mt-3 block text-xs font-semibold text-slate-500 dark:text-slate-400">Note / raabta</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Customer ne kya kaha" className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-[#1c2940]" />
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12.5px] leading-6 dark:border-white/10 dark:bg-white/5">
                <b>Sharaait (Terms &amp; Conditions)</b>
                <ol className="ml-4 list-decimal">{TERMS.map((t) => <li key={t}>{t}</li>)}</ol>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-teal-700" /> Customer ne sharaait zubani sun kar maan li hain (staff ne parh kar sunayi). Aap ka naam aur waqt darj hoga.</label>
              {(err || (terms && formErr)) && <p className="mt-2 text-sm text-red-600">{err || formErr}</p>}
            </>
          ) : (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">Agar {date} tak paisa na aaya: udhaar band + credit report mein &quot;Default&quot;.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-white/5">
          {step === "promise" ? (
            <>
              <button type="button" onClick={() => setStep("choose")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold dark:border-white/10 dark:bg-transparent">Wapas</button>
              <button type="button" disabled={busy || Boolean(formErr)} onClick={save} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Save ho raha..." : "Waada darj karein"}</button>
            </>
          ) : (
            <button type="button" onClick={() => onChoose({ kind: "promised", promiseDate: date, amount: amt })} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Sale jari rakhein</button>
          )}
        </div>
      </div>
    </div>
  );
}
