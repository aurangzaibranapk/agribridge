"use client";

import { useEffect } from "react";
import { MessageCircle, Printer } from "lucide-react";

export function PrintShiftSlip({ autoPrint = true, shareText }: { autoPrint?: boolean; shareText: string }) {
  useEffect(() => {
    if (!autoPrint) return;
    // The successful close navigates here; a short delay lets the receipt
    // finish rendering before the browser opens its print dialog.
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
        <Printer className="h-4 w-4" /> Slip print karein
      </button>
      <button type="button" onClick={shareWhatsApp} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </button>
    </span>
  );
}
