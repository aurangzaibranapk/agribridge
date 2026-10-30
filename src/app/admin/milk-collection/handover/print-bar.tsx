"use client";

import { useState } from "react";
import { Button } from "@/components/ui/form";

export function CertificatePrintBar({ editHref }: { editHref: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
      <Button type="button" onClick={() => window.print()}>Print</Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          const url = window.location.href;
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
            });
          }
        }}
      >
        Link copy
      </Button>
      {copied && <span className="text-xs text-green-700">Link copy ho gaya.</span>}
      <a href={editHref} className="inline-flex h-10 items-center px-2 text-sm text-brand-700 underline">
        Wapas form par
      </a>
    </div>
  );
}
