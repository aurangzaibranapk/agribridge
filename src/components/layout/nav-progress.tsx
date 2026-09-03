"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Upar chalti hui hari patti -- "safha khul raha hai".
 *
 * App Router mein click aur naye safhe ke darmiyan kuch waqt lagta hai
 * (server par safha banta hai; dev mein pehli dafa compile bhi hota
 * hai). Us dauran screen par kuch nahi hilta, aur banda samajhta hai ke
 * button kaam hi nahi kar raha -- phir wo dobara, teesri dafa click
 * karta hai.
 *
 * Ye patti sirf batati hai ke kaam ho raha hai. Ye asal raftaar nahi
 * naapti (wo kisi ko maloom nahi hoti); 90% tak barhti hai aur naya
 * safha aate hi poori ho kar gayab ho jati hai. Jaan boojh kar: 100% par
 * ruk kar intezar karna jhoot hota -- jab tak safha nahi aaya, kaam poora
 * nahi hua.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopTimers() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (hide.current) { clearTimeout(hide.current); hide.current = null; }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Sirf aam sa baayan click -- Ctrl/Shift/naya tab wala nahi.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || a.target === "_blank" || a.hasAttribute("download")) return;
      // Usi safhe par ja rahe hain to patti bekar hai.
      const url = new URL(href, window.location.origin);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      stopTimers();
      setVisible(true);
      setWidth(8);
      timer.current = setInterval(() => {
        // Aage ja kar dheemi -- taake 90% par ruk jaye, khatam na ho.
        setWidth((w) => (w >= 90 ? 90 : w + Math.max(0.6, (90 - w) / 12)));
      }, 120);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      stopTimers();
    };
  }, []);

  // Naya safha aa gaya -- patti poori kar ke hata dein.
  useEffect(() => {
    if (!visible) return;
    stopTimers();
    setWidth(100);
    hide.current = setTimeout(() => { setVisible(false); setWidth(0); }, 280);
    return stopTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5" aria-hidden="true">
      <div
        className="h-full bg-brand-500 shadow-[0_0_8px_rgba(34,197,94,0.7)] transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
