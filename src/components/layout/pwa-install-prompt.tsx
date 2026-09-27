"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISSED_KEY = "agribridge-pwa-install-dismissed";
const DISMISS_DAYS = 7; // itne din baad dobara poochna

export function PwaInstallPrompt() {
  const [prompt, setPrompt] = useState<Event | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Agar pehle dismiss kar diya tha aur abhi bhi waqt nahi hua to mat dikhao
    try {
      const ts = localStorage.getItem(DISMISSED_KEY);
      if (ts && Date.now() - Number(ts) < DISMISS_DAYS * 86_400_000) return;
    } catch {}

    // Pehle se install ho chuki ho to bhi nahi dikhani
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !prompt) return null;

  const handleInstall = async () => {
    setVisible(false);
    try {
      // @ts-expect-error — BeforeInstallPromptEvent browser-specific
      await prompt.prompt();
    } catch {}
  };

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
  };

  return (
    <div className="no-print fixed bottom-16 left-0 right-0 z-50 mx-3 mb-safe sm:bottom-4 sm:left-auto sm:right-4 sm:mx-0 sm:w-80">
      <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-lg dark:border-brand-800/40 dark:bg-surface-900">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950/50">
          <Download className="h-4.5 w-4.5 text-brand-600 dark:text-brand-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-surface-900 dark:text-white">
            AgriBridge install karein
          </p>
          <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
            Phone par seedha khule, internet ke baghair bhi
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={handleInstall}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800"
            aria-label="Band karein"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
