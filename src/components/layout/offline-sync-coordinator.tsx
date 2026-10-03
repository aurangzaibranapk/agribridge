"use client";

import { useEffect } from "react";
import { syncQueue } from "@/lib/offline/sync";

/**
 * Staff shell ka aik markazi sync engine.
 *
 * Module apna sender register karta hai; ye component kisi module ke safhe
 * par depend kiye baghair reconnect, tab wapas aane aur chhote interval par
 * pending qatar ko bhejta rehta hai. Single-flight lock `sync.ts` mein hai,
 * is liye multiple browser events duplicate server writes nahi banate.
 */
export function OfflineSyncCoordinator() {
  useEffect(() => {
    let timer: number | undefined;
    let queued = false;

    const run = () => {
      if (queued || navigator.onLine === false) return;
      queued = true;
      void syncQueue().finally(() => { queued = false; });
    };

    const onOnline = () => run();
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    const onQueueChange = () => run();

    run();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("agribridge:offline-queue-changed", onQueueChange);
    timer = window.setInterval(run, 15000);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("agribridge:offline-queue-changed", onQueueChange);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, []);

  return null;
}
