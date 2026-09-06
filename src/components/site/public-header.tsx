"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Menu, MessageCircle, X } from "lucide-react";

/**
 * Website ka header -- malik ka final design (6 September).
 *
 * Das unwan, aur do baatein jaan boojh kar:
 *
 * 1. **Marketplace `/marketplace` par jata hai, koi naya safha nahi.**
 *    Wo safha pehle se maujood hai. Spec khud kehti hai "REUSE IT".
 *
 * 2. **Kisan AI `/kisan-ai` par hai magar Crop Doctor `/ai-crop-doctor`
 *    par hi rehta hai.** Naya safha us ka darwaza hai, us ki jagah
 *    nahi -- chalta hua Crop Doctor kisi soorat nahi chhera ja raha.
 */
const navigation = [
  { label: "Home", href: "/" },
  { label: "Agriculture", href: "/agriculture" },
  { label: "Kisan Services", href: "/kisan-services" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Grain", href: "/grain" },
  { label: "Machinery", href: "/machinery" },
  { label: "Dairy", href: "/dairy" },
  { label: "Kisan AI", href: "/kisan-ai" },
  { label: "AgriBridge ERP", href: "/erp" },
  { label: "Partner", href: "/partner" },
];

export function PublicHeader({ whatsapp }: { whatsapp: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      {/* TOP STRIP */}
      <div className="hidden bg-[#0c2d22] text-white lg:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-6 text-xs">
          <p className="text-emerald-50/80">Al Rana Traders • ART AgriBridge</p>
          <p className="font-semibold text-emerald-100">Beej se Bazaar tak — Business se AI tak</p>
        </div>
      </div>

      {/* MAIN HEADER */}
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:h-[72px] lg:px-8">
        {/* LOGO */}
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 font-black text-white">
            ART
          </div>
          <div className="leading-tight">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Al Rana Traders
            </p>
            <p className="text-lg font-black tracking-tight text-slate-950">
              Agri<span className="text-emerald-700">Bridge</span>
            </p>
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="ml-auto hidden items-center gap-0.5 xl:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-2 text-[13px] font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* DESKTOP ACTIONS */}
        <div className="ml-auto hidden items-center gap-2 lg:flex xl:ml-4">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Login
          </Link>
          <Link
            href="/erp"
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800"
          >
            ERP Demo
          </Link>
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Contact AgriBridge on WhatsApp"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-700/20 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
        </div>

        {/* MOBILE BUTTON */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-800 lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* MOBILE NAV */}
      {open && (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <nav className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="grid gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {item.label}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold"
              >
                Login
              </Link>
              <Link
                href="/erp"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white"
              >
                ERP Demo
              </Link>
            </div>

            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#0c2d22] px-4 py-3 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp AgriBridge
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
