"use client";
import { useEffect } from "react";
import { Printer } from "lucide-react";

/**
 * Browser ka print / "Save as PDF". Print ke waqt navy dark theme hata
 * dete hain taa ke kaghaz par safed safha aaye, phir wapas laga dete hain.
 */
export function PrintButton({ label, auto = false, className = "" }: { label: string; auto?: boolean; className?: string }) {
  useEffect(() => {
    const html = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = html.classList.contains("dark");
      if (wasDark) html.classList.remove("dark");
    };
    const after = () => {
      if (wasDark) html.classList.add("dark");
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    const id = auto ? setTimeout(() => window.print(), 600) : undefined;
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      if (id) clearTimeout(id);
    };
  }, [auto]);
  return (
    <button type="button" onClick={() => window.print()} className={`inline-flex items-center gap-2 print:hidden ${className}`}>
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
