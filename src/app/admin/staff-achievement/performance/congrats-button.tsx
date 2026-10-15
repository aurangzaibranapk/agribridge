"use client";
import { useState } from "react";

export function CongratsButton({ period, label }: { period: string; label: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <button disabled={busy} className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" onClick={async () => {
        setBusy(true);
        const r = await fetch("/api/staff-achievement/congratulate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ period }) });
        const j = await r.json().catch(() => ({}));
        setBusy(false); setMsg(r.ok ? `✓ ${j.staff}` : j.error ?? "Error");
      }}>{label}</button>
      {msg && <span className="text-xs text-surface-600">{msg}</span>}
    </span>
  );
}
