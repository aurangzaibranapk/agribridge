"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const STORAGE_KEY = "agribridge-theme";

export function ThemeToggle() {
  const lang = useLang();
  // Starts null so we render nothing meaningful until mounted — avoids a
  // client/server markup mismatch, since the real value depends on
  // localStorage which only exists in the browser.
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function apply(next: boolean) {
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    setIsDark(next);
  }

  // Gol daira (mockup manzoor, 21 Oct): click ki jagah se rang phailta
  // hai. Jis browser mein View Transitions nahi, ya jis ne "kam harkat"
  // chuna ho, wahan seedha badal jata hai.
  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = !document.documentElement.classList.contains("dark");
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduce) return apply(next);
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || 0;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    doc.startViewTransition(() => apply(next)).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => {});
  }

  return (
    <button
      onClick={toggle}
      aria-label={t("sh_toggle_dark", lang)}
      className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
    >
      {isDark === null ? (
        <span className="block h-5 w-5" />
      ) : isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
