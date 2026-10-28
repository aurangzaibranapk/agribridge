"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function SlipPrint({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);
  return (
    <button type="button" onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">
      <Printer className="h-3.5 w-3.5" /> Print
    </button>
  );
}
