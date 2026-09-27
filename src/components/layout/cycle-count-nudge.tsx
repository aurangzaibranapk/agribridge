"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardCheck, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getTodaySession } from "@/actions/cycle-stock-count";

const SNOOZE_KEY = "cycle_nudge_snoozed_until";
const SNOOZE_MS = 15 * 60 * 1000; // 15 min
const POLL_MS = 2 * 60 * 1000;    // har 2 min check

export function CycleCountNudge() {
  const [show, setShow] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      // Snooze check
      const snoozedUntil = (() => {
        try { return parseInt(localStorage.getItem(SNOOZE_KEY) ?? "0"); }
        catch { return 0; }
      })();
      if (Date.now() < snoozedUntil) { setShow(false); return; }

      const session = await getTodaySession();
      if (session && session.status !== "submitted") {
        setSessionId(session.id);
        setShow(true);
      } else {
        setShow(false);
        setSessionId(null);
      }
    } catch {
      // Network fail — khamoshi se chhoR do
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [check]);

  function snooze() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); }
    catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-xl border border-amber-300 bg-amber-50 shadow-xl dark:border-amber-700 dark:bg-amber-950"
    >
      {/* Blinking top bar */}
      <div className="h-1 w-full animate-pulse bg-amber-400 dark:bg-amber-600" />

      <div className="flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800">
          <ClipboardCheck className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
            Aaj ki Maal Ginti Baqi Hai
          </p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
            Product Cycles ki ginti abhi tak submit nahi hui. Jald maal gino aur
            submit karo.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/admin/product-cycles"
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-600 active:scale-95"
              onClick={() => setShow(false)}
            >
              Ab Ginti Karo
            </Link>
            <button
              onClick={snooze}
              className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800 active:scale-95"
            >
              <RefreshCw className="h-3 w-3" />
              15 min Baad
            </button>
          </div>
        </div>

        <button
          onClick={snooze}
          className="shrink-0 rounded p-1 text-amber-500 hover:bg-amber-200 dark:text-amber-400 dark:hover:bg-amber-800"
          aria-label="Band karo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
