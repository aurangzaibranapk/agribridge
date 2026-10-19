"use client";
export function PrintButton({ label }: { label: string }) {
  return <button type="button" onClick={() => window.print()} className="rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-surface-700 hover:bg-surface-50 print:hidden dark:border-surface-700 dark:bg-surface-900 dark:text-slate-200">⬇ {label}</button>;
}
