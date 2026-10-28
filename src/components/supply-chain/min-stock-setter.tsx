"use client";

import { useState, useTransition } from "react";
import { setMinStock } from "@/actions/supply-chain";

/** Ek product ki min-stock hadd -- seedha yahin se. */
export function MinStockSetter({ productId }: { productId: string }) {
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg === "ok") return <span className="chip ok">Lag gayi</span>;
  return (
    <span className="minrow" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="number" min={1} step={1} value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. 10" aria-label="Min stock" />
      <button type="button" disabled={pending || !(Number(val) > 0)} onClick={() => start(async () => {
        const r = await setMinStock(productId, Number(val));
        setMsg(r.error ?? "ok");
      })}>{pending ? "..." : "Lagao"}</button>
      {msg && msg !== "ok" && <span className="neg" style={{ fontSize: 11 }}>{msg}</span>}
    </span>
  );
}
