"use client";
import { useState } from "react";
import { HandCoins } from "lucide-react";
import { addDaysIso } from "@/lib/recovery/credit-position";

const QUICK = [3, 7, 15, 30];

/** Promise to Pay darj karna: jaldi din (3/7/15/30) ya tareekh, raqam ikhtiyari (538). */
export function PromiseForm({ customerId, customerName, defaultOpen = false, today }: { customerId: string; customerName: string; defaultOpen?: boolean; today: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const [days, setDays] = useState(15);
  const [date, setDate] = useState(addDaysIso(today, 15));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pick = (d: number) => { setDays(d); setDate(addDaysIso(today, d)); };

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "promise", parties: [{ type: "customer", id: customerId }], promiseDate: date, promisedDays: days, amount: amount ? Number(amount.replace(/,/g, "")) : null, notes }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: data.error ?? "Waada darj nahi ho saka." }); return; }
    setMsg({ ok: true, text: "Waada darj ho gaya. Is tareekh tak udhaar chalu rahe ga." });
    setTimeout(() => window.location.reload(), 900);
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border-2 border-orange-400 px-3 py-2 text-sm font-semibold text-orange-700"><HandCoins className="h-4 w-4" /> Promise to Pay</button>;
  return (
    <div className="space-y-3 rounded-xl border border-orange-200 bg-white p-4 text-sm dark:bg-surface-900">
      <b>Promise to Pay — {customerName}</b>
      <div>Kitne din mein dega?
        <div className="mt-1 flex flex-wrap gap-2">
          {QUICK.map((d) => <button type="button" key={d} onClick={() => pick(d)} className={`rounded-lg border px-3 py-1.5 ${days === d && date === addDaysIso(today, d) ? "border-orange-500 bg-orange-500 text-white" : ""}`}>{d} din</button>)}
          <input type="date" value={date} min={today} onChange={(e) => { setDate(e.target.value); setDays(Math.max(1, Math.round((Date.parse(e.target.value) - Date.parse(today)) / 86400000))); }} className="rounded-lg border px-2" />
        </div>
      </div>
      <label className="block">Raqam (ikhtiyari)<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border p-2" placeholder="Khali = poora late baqaya" /></label>
      <label className="block">Note<input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
      <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">Waade ke dauran naya udhaar khula rahe ga. Tareekh guzarne par adaigi na hui to udhaar khud band — phir sirf Admin. Staff: 1 khula waada, max 30 din.</p>
      {msg && <p className={msg.ok ? "text-emerald-700" : "text-red-600"}>{msg.text}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2">Wapas</button><button type="button" disabled={busy} onClick={save} className="rounded-lg bg-orange-500 px-3 py-2 font-semibold text-white disabled:opacity-50">{busy ? "..." : "Waada darj karein"}</button></div>
    </div>
  );
}
