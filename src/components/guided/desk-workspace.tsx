"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "./desk-workspace.css";

/** Route-local viewport ownership. Other admin pages retain their existing layout. */
export function DeskWorkspace({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const main = ref.current?.closest("main");
    main?.classList.add("desk-main");
    return () => main?.classList.remove("desk-main");
  }, []);
  return <div ref={ref} className={`desk-workspace ${className}`}>{children}</div>;
}

export function DeskTabs({ items }: { items: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  return <div className="desk-tabs">
    <div role="tablist" aria-label="Workspace sections" className="flex shrink-0 gap-2 border-b pb-2">
      {items.map(item => <button key={item.id} type="button" role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={active === item.id} onClick={() => setActive(item.id)} className={`rounded-lg px-4 py-2 text-sm font-medium ${active === item.id ? "bg-brand-700 text-white" : "border bg-white text-surface-700 dark:bg-surface-900 dark:text-surface-200"}`}>{item.label}</button>)}
    </div>
    {items.map(item => <section key={item.id} role="tabpanel" id={`panel-${item.id}`} aria-labelledby={`tab-${item.id}`} hidden={active !== item.id} className="desk-tab-panel">{item.content}</section>)}
  </div>;
}

export function Pager({ page, count, size, onChange }: { page: number; count: number; size: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / size));
  return <div className="flex shrink-0 items-center justify-end gap-3 py-2 text-xs">
    <span>{count} records · {page + 1} / {pages}</span>
    <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => onChange(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
    <button type="button" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
  </div>;
}
