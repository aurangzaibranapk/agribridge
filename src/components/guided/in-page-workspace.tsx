"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, X } from "lucide-react";

/**
 * Staff dashboard workspace shell.
 *
 * Internal admin links opened from the dashboard stay on the same screen:
 * the dashboard does not jump/scroll away and the selected module opens in
 * a full workspace overlay. The iframe itself may scroll when a module has
 * genuinely more content than the viewport, but the dashboard/page behind it
 * never moves.
 */
export function InPageWorkspace({ children }: { children: React.ReactNode }) {
  const [href, setHref] = useState<string | null>(null);
  const [title, setTitle] = useState("Kaam");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!href) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, [href]);

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const a = target.closest("a") as HTMLAnchorElement | null;
    if (!a) return;

    const raw = a.getAttribute("href") || "";
    if (!raw.startsWith("/admin/")) return;
    if (raw.startsWith("/admin/my-work") || raw.startsWith("/admin/notifications")) return;
    if (a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    setTitle((a.textContent || "Kaam").trim().replace(/\s+/g, " ").slice(0, 60) || "Kaam");
    const join = raw.includes("?") ? "&" : "?";
    setHref(`${raw}${join}workspace=1`);
  }

  return (
    <div ref={rootRef} onClick={onClick} className="min-h-full">
      {children}

      {href && (
        <div className="fixed inset-0 z-[100] bg-[#f7faf8] dark:bg-surface-950">
          <div className="flex h-14 items-center gap-2 border-b border-surface-200 bg-white px-3 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <button
              type="button"
              onClick={() => setHref(null)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-surface-200 px-3 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              <ArrowLeft className="h-4 w-4" /> Wapas
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-surface-900 dark:text-white">{title}</p>
              <p className="text-[10px] text-surface-400">AgriBridge workspace</p>
            </div>
            <a
              href={href.replace(/([?&])workspace=1(&|$)/, (_m, p1, p2) => (p2 ? p1 : ""))}
              target="_blank"
              rel="noreferrer"
              className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-surface-500 hover:bg-surface-50 sm:inline-flex dark:hover:bg-surface-800"
            >
              <ExternalLink className="h-4 w-4" /> New tab
            </a>
            <button
              type="button"
              aria-label="Close workspace"
              onClick={() => setHref(null)}
              className="grid h-9 w-9 place-items-center rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <iframe
            key={href}
            src={href}
            title={title}
            className="h-[calc(100vh-56px)] w-full border-0 bg-white dark:bg-surface-950"
          />
        </div>
      )}
    </div>
  );
}
