"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getOpenStockCountForMe } from "@/actions/stock-count";

const SNOOZE_KEY = "stock_count_nudge_snoozed_until";
const SNOOZE_MS = 30 * 60 * 1000; // 30 min
const POLL_MS = 5 * 60 * 1000;    // har 5 min check

export function StockCountNudge() {
  const [show, setShow] = useState(false);
  const [info, setInfo] = useState<{ id: string; warehouseName: string; remaining: number } | null>(null);

  const check = useCallback(async () => {
    try {
      const snoozedUntil = (() => {
        try { return parseInt(localStorage.getItem(SNOOZE_KEY) ?? "0"); }
        catch { return 0; }
      })();
      if (Date.now() < snoozedUntil) { setShow(false); return; }

      const open = await getOpenStockCountForMe();
      if (open && open.remaining > 0) {
        setInfo(open);
        setShow(true);
      } else {
        setShow(false);
        setInfo(null);
      }
    } catch {
      // network fail — khamoshi se
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

  if (!show || !info) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-1/2 z-[9998] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-xl border border-blue-300 bg-blue-50 shadow-xl dark:border-blue-700 dark:bg-blue-950"
    >
      <div className="h-1 w-full animate-pulse bg-blue-400 dark:bg-blue-600" />
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800">
          <ClipboardList className="h-5 w-5 text-blue-700 dark:text-blue-300" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
            Stock Count Baqi Hai — {info.warehouseName}
          </p>
          <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
            {info.remaining} cheezen abhi tak gini nahi gayin. Jaldi ginti mein shaamil hon.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/admin/stock-count"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-700 active:scale-95"
              onClick={() => setShow(false)}
            >
              Ginti Karo
            </Link>
            <button
              onClick={snooze}
              className="flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 active:scale-95"
            >
              <RefreshCw className="h-3 w-3" />
              30 min Baad
            </button>
          </div>
        </div>
        <button
          onClick={snooze}
          className="shrink-0 rounded p-1 text-blue-500 hover:bg-blue-200 dark:text-blue-400 dark:hover:bg-blue-800"
          aria-label="Band karo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
