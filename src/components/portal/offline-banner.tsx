"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

/** Internet band ho to saaf batayein -- safha purana ho sakta hai, nayi entry baad mein. */
export function OfflineBanner({ lang }: { lang: Lang }) {
  const [off, setOff] = useState(false);
  useEffect(() => {
    const up = () => setOff(!navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", up); };
  }, []);
  if (!off) return null;
  return (
    <div role="status" className="print:hidden flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:px-6">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />{t("ph6_offline", lang)}
    </div>
  );
}
