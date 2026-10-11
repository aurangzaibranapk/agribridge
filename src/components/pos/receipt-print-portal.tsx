"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Keep receipts outside the dashboard's scroll, transform and flex containers. */
export function ReceiptPrintPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div data-pos-receipt-root className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <style>{`
        @media print {
          body > :not([data-pos-receipt-root]) { display: none !important; }
          [data-pos-receipt-root] {
            display: block !important;
            position: static !important;
            inset: auto !important;
            transform: none !important;
            width: 80mm !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          /* Global report printing hides the last Actions column. On a
             receipt that column is the line total, so restore every cell. */
          [data-pos-receipt-root] table td,
          [data-pos-receipt-root] table th { display: table-cell !important; }
          [data-pos-receipt-root] table { width: 100%; table-layout: fixed; }
          [data-pos-receipt-root] td { overflow-wrap: anywhere; }
          [data-pos-receipt-root] td:first-child { width: 43%; }
          [data-pos-receipt-root] td:nth-child(2) { width: 11%; }
          [data-pos-receipt-root] td:nth-child(3) { width: 22%; }
          [data-pos-receipt-root] td:nth-child(4) { width: 24%; }
        }
      `}</style>
      {children}
    </div>,
    document.body,
  );
}
