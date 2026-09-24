"use client";

import { useState } from "react";
import { Download, Mail, MessageCircle, Printer } from "lucide-react";

export function StatementActions({ customerId, start, end }: { customerId: string; start?: string; end?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(channel: "download" | "whatsapp" | "email") {
    setBusy(channel);
    setMessage(null);
    try {
      const res = await fetch(`/api/customer-statements/${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, start: start || null, end: end || null }),
      });
      if (channel === "download" && res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Al-Rana-Traders-Khata-Statement.pdf";
        a.click();
        URL.revokeObjectURL(url);
        setMessage({ ok: true, text: "Statement PDF download ho gaya." });
      } else {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Kaam mukammal nahi hua.");
        setMessage({ ok: true, text: channel === "email" ? "Statement email ho gaya." : "Statement WhatsApp par bhej diya gaya." });
      }
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Kaam mukammal nahi hua." });
    } finally {
      setBusy(null);
    }
  }

  const base = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50";
  return (
    <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex flex-wrap items-center gap-2">
        <button className={`${base} border-surface-200`} disabled={!!busy} onClick={() => run("download")}><Download className="h-4 w-4" /> Download PDF</button>
        <button className={`${base} border-surface-200`} disabled={!!busy} onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
        <button className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`} disabled={!!busy} onClick={() => run("whatsapp")}><MessageCircle className="h-4 w-4" /> WhatsApp</button>
        <button className={`${base} border-blue-200 bg-blue-50 text-blue-700`} disabled={!!busy} onClick={() => run("email")}><Mail className="h-4 w-4" /> Email</button>
        {busy && <span className="text-xs text-surface-500">Statement tayar ho raha hai...</span>}
      </div>
      {message && <p className={`mt-2 text-xs ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>}
    </div>
  );
}
