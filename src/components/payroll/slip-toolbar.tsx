"use client";
import Link from "next/link";
import { SO_BTN, SO_BTN2 } from "./salary-ui";

export function SlipToolbar({ back, pdfHref }: { back: string; pdfHref: string }) {
  return (
    <div className="mx-auto flex w-[794px] max-w-full items-center justify-between gap-2 print:hidden">
      <Link href={back} className="text-sm text-gray-500 hover:underline">← Wapas</Link>
      <div className="flex gap-2">
        <button type="button" onClick={() => window.print()} className={SO_BTN}>🖨 Print</button>
        <a href={pdfHref} className={SO_BTN2}>⬇ PDF</a>
      </div>
    </div>
  );
}
