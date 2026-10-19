"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { t, type Lang } from "@/lib/i18n/translations";

/** Asal log out (session khatam) -- "Website par wapas" se alag. */
export function PortalLogout({ lang, className = "" }: { lang: Lang; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function out() {
    if (busy) return;
    setBusy(true);
    try { await createClient().auth.signOut(); } finally {
      router.push("/login");
      router.refresh();
    }
  }
  return (
    <button type="button" onClick={out} disabled={busy} aria-busy={busy}
      className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm font-medium text-rose-200/90 hover:bg-white/10 hover:text-white disabled:opacity-60 ${className}`}>
      <LogOut className="h-4 w-4 shrink-0 rtl:-scale-x-100" aria-hidden />
      <span className="leading-tight">{t(busy ? "ph6_logging_out" : "ph6_logout", lang)}</span>
    </button>
  );
}
