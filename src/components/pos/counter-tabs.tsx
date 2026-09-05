"use client";

import Link from "next/link";
import { ShoppingCart, Smartphone, FileText } from "lucide-react";

/**
 * Counter ke teen kaam, ek hi qatar mein.
 *
 * Malik ne karyana shop ka naqsha bheja jis mein POS ke upar teen khane
 * the: Products, Mobile Load, Bill Payment. Wohi yahan hain.
 *
 * -------------------------------------------------------------------
 * YE TEEN ALAG SAFHE HAIN, EK SAFHE KE TEEN TAB NAHI -- jaan boojh kar.
 *
 * Ek hi safhe par teenon daalne ka matlab hota ke bikri ka poora
 * checkout aur load/bill ka darj karna ek hi component mein rehte. Wo
 * checkout is nizam ka sab se hassas raasta hai: stock ghatta hai, khata
 * barhta hai, ledger banti hai. Us ke aas paas ka har badlav khatra hai,
 * aur ek chhoti si UI ki ghalti bhi counter band kar deti hai.
 *
 * Dekhne wale ke liye farq koi nahi -- teen khane, ek click. Magar
 * kharabi ki soorat mein ek kaam doosre ko nahi le doobta.
 */
export function CounterTabs({ active }: { active: "products" | "load" | "bill" }) {
  const khane = [
    {
      key: "products" as const,
      href: "/admin/pos",
      icon: ShoppingCart,
      title: "Products",
      sub: "Dukan ka maal bechein",
    },
    {
      key: "load" as const,
      href: "/admin/load-bill?kind=load",
      icon: Smartphone,
      title: "Mobile Load",
      sub: "Mobile load karein",
    },
    {
      key: "bill" as const,
      href: "/admin/load-bill?kind=bill",
      icon: FileText,
      title: "Bill Payment",
      sub: "Bijli, gas, internet",
    },
  ];

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-3">
      {khane.map((k) => {
        const on = k.key === active;
        const Icon = k.icon;
        return (
          <Link
            key={k.key}
            href={k.href}
            aria-current={on ? "page" : undefined}
            className={
              "flex items-center gap-3 rounded-xl border px-4 py-3 transition " +
              (on
                ? "border-brand-500 bg-brand-50 dark:border-brand-600 dark:bg-brand-950/30"
                : "border-surface-200 bg-white hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-900 dark:hover:bg-surface-800/50")
            }
          >
            <span
              className={
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " +
                (on ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 dark:bg-surface-800")
              }
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-surface-900 dark:text-white">
                {k.title}
              </span>
              <span className="block truncate text-[11px] text-surface-500">{k.sub}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
