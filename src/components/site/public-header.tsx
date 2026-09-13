"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Menu, X } from "lucide-react";

/**
 * Website ka header.
 *
 * -------------------------------------------------------------------
 * MALIK KI TABDEELIYAN (6 September)
 *
 *   *"ye top bara hona chahiye. WhatsApp message hai wo mita dein. Book
 *   demo mita dein. Kisan AI ke backend AI Doctor laga dein. Ooper jo
 *   'Al Rana Traders' aur 'Beej se Beej' se wo bhi hata dein. Top bar
 *   ko thora bara karein aur khoobsurat bana dein."*
 *
 * Chaar cheezein nikal gayin:
 *
 * 1. Ooper wali kaali patti (Al Rana Traders • Beej se Bazaar tak).
 * 2. WhatsApp ka gol button.
 * 3. "ERP Demo" ka button (yehi wo "book demo" hai).
 * 4. Un ke sath jane wala `whatsapp` prop -- ab header ko us number ki
 *    zaroorat hi nahi rahi. Footer apna number khud lata hai.
 *
 * -------------------------------------------------------------------
 * KISAN AI KA DARWAZA AB SEEDHA CROP DOCTOR HAI
 *
 * Malik ne do dafa yehi baat kahi: *"yahan Kisan AI se murad hai Crop
 * Doctor"*, aur *"jo chal nahi rahi wo honi hi nahi chahiye"*.
 *
 * Pehle ye `/kisan-ai` par jata tha -- ek darwaza jo aage ek aur darwaze
 * par le jata tha. Ab seedha `/ai-crop-doctor` par, jo asal mein chalta
 * hai. Beech ka safha maujood rehta hai; sirf header us se guzarta
 * nahi.
 */
const navigation = [
  { label: "Home", href: "/" },
  { label: "Agriculture", href: "/agriculture" },
  { label: "Kisan Services", href: "/kisan-services" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Grain", href: "/grain" },
  { label: "Machinery", href: "/machinery" },
  { label: "Dairy", href: "/dairy" },
  { label: "Kisan AI", href: "/ai-crop-doctor" },
  { label: "AgriBridge ERP", href: "/erp" },
  { label: "Partner", href: "/partner" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Kaunsa unwan is waqt khula hai. "/" sirf apne aap par lagta hai --
  // warna har safhe par Home bhi chamakta rehta.
  function khula(href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center px-4 sm:px-6 lg:h-[104px] lg:px-8">
        {/* LOGO */}
        <Link href="/" className="group flex shrink-0 items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-lg font-black text-white shadow-sm shadow-emerald-900/20 transition group-hover:shadow-md lg:h-14 lg:w-14 lg:text-xl">
            ART
          </div>
          <div className="leading-tight">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 lg:text-[11px]">
              Al Rana Traders
            </p>
            <p className="text-xl font-black tracking-tight text-slate-950 lg:text-[26px]">
              Agri<span className="text-emerald-700">Bridge</span>
            </p>
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="ml-auto hidden items-center gap-1 xl:flex">
          {navigation.map((item) => {
            const on = khula(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`relative rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  on ? "text-emerald-800" : "text-slate-600 hover:bg-emerald-50/70 hover:text-emerald-800"
                }`}
              >
                {item.label}
                {/* Khule unwan ke neeche patli lakeer -- rang par bharosa
                    na karne wale ke liye bhi nishan maujood rehta hai. */}
                <span
                  className={`absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-emerald-600 transition-opacity ${
                    on ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* DESKTOP ACTION */}
        <div className="ml-auto hidden items-center lg:flex xl:ml-6">
          <Link
            href="/login"
            className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-900/20 transition hover:bg-emerald-800 hover:shadow-md"
          >
            Login
          </Link>
        </div>

        {/* MOBILE BUTTON */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-800 lg:hidden"
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
                  aria-current={khula(item.href) ? "page" : undefined}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition ${
                    khula(item.href)
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-800 hover:bg-emerald-50 hover:text-emerald-800"
                  }`}
                >
                  {item.label}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white"
              >
                Login
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
