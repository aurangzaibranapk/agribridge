"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintShiftSlip() {
  useEffect(() => {
    // The successful close navigates here; a short delay lets the receipt
    // finish rendering before the browser opens its print dialog.
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white print:hidden">
      <Printer className="h-4 w-4" /> Slip print karein
    </button>
  );
}
