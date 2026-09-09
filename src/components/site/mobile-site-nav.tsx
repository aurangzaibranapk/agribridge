"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu, X } from "lucide-react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/#services", label: "Agriculture" },
  { href: "/#services", label: "Kisan Services" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/#services", label: "Grain" },
  { href: "/book-machinery", label: "Machinery" },
  { href: "/#services", label: "Dairy" },
  { href: "/#farm-products", label: "Farm Products" },
  { href: "/ai-crop-doctor", label: "Kisan AI" },
  { href: "/contact", label: "Partner" },
] as const;

export function MobileSiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="mobile-site-navigation"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-white text-surface-800 shadow-sm transition hover:bg-emerald-50 dark:border-surface-800 dark:bg-surface-950 dark:text-white"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-[2px]" role="presentation" onClick={() => setOpen(false)}>
          <div
            id="mobile-site-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl dark:bg-surface-950"
          >
            <div className="flex items-center justify-between border-b border-surface-200 px-5 py-5 dark:border-surface-800">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-xl font-black text-white shadow-sm">ART</div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-surface-500">Al Rana Traders</span>
                  <span className="block font-display text-2xl font-bold leading-tight text-surface-950 dark:text-white">Agri<span className="text-emerald-700">Bridge</span></span>
                </div>
              </Link>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-200 text-surface-700 transition hover:bg-surface-50 dark:border-surface-800 dark:text-white dark:hover:bg-surface-900"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="flex-1 px-5 py-6">
              <div className="space-y-2">
                {NAV.map((item, index) => (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-2xl px-5 py-4 text-[17px] font-semibold transition ${index === 0 ? "bg-emerald-50 text-emerald-800" : "text-surface-800 hover:bg-surface-50 hover:text-emerald-800 dark:text-surface-200 dark:hover:bg-surface-900"}`}
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="h-5 w-5" />
                  </Link>
                ))}
              </div>
            </nav>

            <div className="border-t border-surface-200 p-5 dark:border-surface-800">
              <div className="grid grid-cols-2 gap-3">
                <Link href="/contact" onClick={() => setOpen(false)} className="rounded-2xl border border-emerald-600 px-4 py-3 text-center text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:text-emerald-300">Contact Us</Link>
                <Link href="/login" onClick={() => setOpen(false)} className="rounded-2xl bg-emerald-700 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800">Login</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
