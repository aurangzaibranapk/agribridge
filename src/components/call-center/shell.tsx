"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";

/**
 * Wapas ERP (malik ki shikayat, 21 Oct): neeche wala chhota link click par
 * "kuch nahi karta" tha. Shell `fixed inset-0 z-[200]` overlay hai jo admin
 * layout ke upar baitha hai, is liye Next ka client navigation shuru to hota
 * tha magar owner ka /admin/my-work (poora Command Center) server par der se
 * banta hai aur progress bar (z-[60]) is overlay ke neeche chhup jata tha --
 * safha jaisa ka taisa rehta. Ab yeh asal <a> hai (poora document load,
 * browser ka loader nazar aata hai, koi client-router atkao nahi) aur
 * sidebar ke upar saaf button hai.
 */
export const ERP_HOME = "/admin/my-work";

const NAV = [
  { key: "console", live: "/admin/call-center", preview: "/call-center-preview/console", label: "Agent Console" },
  { key: "board", live: "/admin/call-center/complaints", preview: "/call-center-preview/board", label: "Complaints Board" },
  { key: "agents", live: "/admin/call-center/agents", preview: "/call-center-preview/agents", label: "Agent Admin" },
];

export function Shell({
  variant,
  title,
  crumb,
  example,
  children,
}: {
  variant: "live" | "preview";
  title: string;
  crumb: string;
  example: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname() ?? "";
  return (
    <div className="fixed inset-0 z-[200] flex bg-[#f3f6fb] text-[#14233a]">
      <aside className="flex w-[232px] shrink-0 flex-col bg-[#0c1c36] text-white">
        <div className="px-5 pb-6 pt-6">
          <div className="font-display text-[22px] font-bold tracking-tight">AgriBridge</div>
          <div className="mt-0.5 text-[12px] text-white/60">AgriBridge · Call Center</div>
        </div>
        <div className="px-3 pb-4">
          <a
            href={ERP_HOME}
            data-testid="cc-back-erp"
            className="relative z-10 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-[14px] font-semibold text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" /> Wapas ERP
          </a>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => {
            const href = variant === "preview" ? item.preview : item.live;
            const on = item.key === "console"
              ? path === href || path.includes("/party") || path.includes("/complaint")
              : path === href;
            return (
              <Link
                key={item.key}
                href={href}
                className={`rounded-xl px-3 py-2.5 text-[14px] ${on ? "bg-white/10 font-semibold" : "text-white/75 hover:bg-white/5"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-5 py-4 text-[11px] text-white/40">
          <a href={ERP_HOME} className="hover:text-white/70">Wapas ERP</a>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-start justify-between gap-4 px-8 pb-2 pt-6">
          <div>
            <h1 className="font-display text-[28px] font-bold tracking-tight text-[#14233a]">{title}</h1>
            <p className="text-[13px] text-[#7b8798]">{crumb}</p>
          </div>
          <div className="flex items-center gap-2">
            {example && (
              <span className="rounded-full bg-[#f6e7b8] px-3 py-1 text-[12px] font-semibold text-[#8a6a12]">Example data</span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-[#eef0fb] px-3 py-1 text-[12px] font-semibold text-[#3d4d93]">
              <Lock className="h-3.5 w-3.5" /> View only / Sirf dekhna / صرف دیکھنا
            </span>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-10">{children}</div>
      </div>
    </div>
  );
}
