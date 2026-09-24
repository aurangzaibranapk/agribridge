"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * Phone par navigation.
 *
 * PEHLE PHONE PAR KOI NAVIGATION THI HI NAHI. Header ka nav
 * `hidden lg:flex` tha, yani chhoti screen par wo poori tarah gayab ho
 * jata tha -- aur zyada tar kisan phone hi par aate hain. Wahan se
 * sirf logo, Sign in aur Register nazar aate the; baqi poori website
 * tak pahunchne ka koi raasta hi nahi tha.
 *
 * Do baatein jaan boojh kar:
 *
 * 1. **Safha badalte hi menu khud band.** `usePathname` badalne par
 *    band ho jata hai. Bina is ke banda link dabata hai, safha badal
 *    jata hai, magar menu upar khula rehta hai aur wo samajhta hai ke
 *    kuch hua hi nahi.
 *
 * 2. **Menu khula ho to peeche ka safha nahi khisakta.** `overflow
 *    hidden` body par lagta hai -- warna banda menu mein ungli pheerta
 *    hai aur neeche ka safha chalne lagta hai.
 */
export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [khula, setKhula] = useState(false);
  const pathname = usePathname();

  useEffect(() => setKhula(false), [pathname]);

  useEffect(() => {
    if (!khula) return;
    const pehle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = pehle;
    };
  }, [khula]);

  return (
    <>
      <button
        type="button"
        onClick={() => setKhula(true)}
        aria-label="Menu kholein"
        aria-expanded={khula}
        className="rounded-lg p-2 text-surface-700 hover:bg-surface-100 lg:hidden dark:text-surface-200 dark:hover:bg-surface-800"
      >
        <Menu className="h-5 w-5" />
      </button>

      {khula && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Menu band karein"
            onClick={() => setKhula(false)}
            className="absolute inset-0 bg-surface-950/40"
          />
          <nav className="absolute inset-y-0 end-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-white shadow-xl dark:bg-surface-950">
            <div className="flex items-center justify-between border-b border-surface-100 px-4 py-4 dark:border-surface-800">
              <span className="font-display text-sm font-semibold text-surface-900 dark:text-white">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setKhula(false)}
                aria-label="Band karein"
                className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col p-2">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "rounded-lg px-3 py-3 text-sm font-medium transition " +
                    (pathname === item.href
                      ? "bg-[#1E4A2E]/[0.08] text-[#1E4A2E] dark:bg-brand-900/30 dark:text-brand-400"
                      : "text-surface-700 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-900")
                  }
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-auto grid gap-2 border-t border-surface-100 p-4 dark:border-surface-800">
              <Link
                href="/login"
                className="rounded-xl border border-surface-200 px-4 py-2.5 text-center text-sm font-semibold text-surface-900 dark:border-surface-700 dark:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/register/farmer"
                className="rounded-xl bg-[#1E4A2E] px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Register
              </Link>
              <a
                href="https://wa.me/923331116727"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#25D366] px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                WhatsApp
              </a>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
