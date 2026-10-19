"use client";
import { useState } from "react";

/**
 * "Ek screen" portal ke chhote hisse (malik ki manzoori, 19 Oct).
 * Asal kaam CSS karta hai (globals.css `.pf-*`, Tailwind `fit:`):
 *   .pf-fit   -- safha screen jitna, andar column
 *   .pf-grow  -- bachi hui oonchai le
 *   .pf-panel -- card; is ka .pf-body andar scroll kare (sticky table sar)
 * Ye component sirf tabs deta hai: ek panel mein do-teen cheezein
 * (maslan Khata / Doodh / Maweshi chart) taake safha lamba na ho.
 */
export function PanelTabs({ tabs, className = "", title }: {
  tabs: { key: string; label: string; content: React.ReactNode }[];
  className?: string;
  title?: React.ReactNode;
}) {
  const [on, setOn] = useState(tabs[0]?.key);
  const cur = tabs.find((t) => t.key === on) ?? tabs[0];
  return (
    <div className={`pf-panel rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {title && <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white">{title}</h3>}
        <div role="tablist" className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={t.key === cur?.key} onClick={() => setOn(t.key)}
              className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition ${t.key === cur?.key ? "bg-green-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-slate-300 dark:hover:bg-surface-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="pf-body">{cur?.content}</div>
    </div>
  );
}
