"use client";
import { useEffect, useRef } from "react";

/**
 * Phone (< 640px) par table card list ban jati hai -- side mein scroll nahi.
 * Har khane ka label <thead> ke `th` se aata hai (data-label), is liye
 * har safhe ko alag se kuch nahi likhna parta. Badi screen par wahi purani table.
 * CSS: globals.css `table.rt-cards`.
 */
export function ResponsiveTable({ className = "", children, titleCol = 0, caption }: { className?: string; children: React.ReactNode; titleCol?: number | null; caption?: string }) {
  const ref = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const label = () => {
      const heads = Array.from(table.querySelectorAll("thead tr:last-child th")).map((th) => (th.textContent ?? "").trim());
      table.querySelectorAll("tbody tr, tfoot tr").forEach((tr) => {
        let col = 0;
        Array.from(tr.children).forEach((cell) => {
          const el = cell as HTMLTableCellElement;
          const h = heads[col];
          if (h && !el.hasAttribute("data-label")) el.setAttribute("data-label", h);
          if (titleCol !== null && col === titleCol && tr.parentElement?.tagName === "TBODY") el.classList.add("rt-title");
          col += el.colSpan || 1;
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(table, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [titleCol]);
  return (
    <div className="rt-wrap overflow-x-auto">
      <table ref={ref} className={`rt-cards ${className}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}
