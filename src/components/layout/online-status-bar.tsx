"use client";
import { useEffect, useState } from "react";
import { queueCounts, type QueueCounts } from "@/lib/offline/queue";

type NetStatus = "online" | "offline" | "restored";

export function OnlineStatusBar() {
  const [status, setStatus] = useState<NetStatus>("online");
  const [queue, setQueue] = useState<QueueCounts>({ pending: 0, syncing: 0, needsAttention: 0, total: 0 });

  useEffect(() => {
    if (!navigator.onLine) setStatus("offline");
    const refreshQueue = () => { void queueCounts().then(setQueue).catch(() => undefined); };
    refreshQueue();
    const goOffline = () => setStatus("offline");
    const goOnline = () => {
      setStatus("restored");
      refreshQueue();
      const t = setTimeout(() => setStatus("online"), 4000);
      return () => clearTimeout(t);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    window.addEventListener("agribridge:offline-queue-changed", refreshQueue);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("agribridge:offline-queue-changed", refreshQueue);
    };
  }, []);

  if (status === "online" && queue.pending === 0 && queue.needsAttention === 0) return null;

  if (status === "offline") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white print:hidden">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white/80" />
        <span>Offline Mode — internet nahi hai۔ Nayi entries device par save hongi۔</span>
        {queue.pending > 0 && <span className="rounded bg-white/20 px-1.5 py-0.5">{queue.pending} pending</span>}
        {queue.needsAttention > 0 && <span className="rounded bg-red-700/40 px-1.5 py-0.5">{queue.needsAttention} attention</span>}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs font-semibold text-white print:hidden ${queue.needsAttention > 0 ? "bg-red-600" : "bg-brand-600"}`}>
      <span className="h-2 w-2 rounded-full bg-white" />
      <span>{status === "restored" ? "Online Mode — internet wapas aa gaya, sync khud chal rahi hai" : "Online Mode"}</span>
      {queue.pending > 0 && <span className="rounded bg-white/20 px-1.5 py-0.5">{queue.pending} sync pending</span>}
      {queue.needsAttention > 0 && <span className="rounded bg-white/20 px-1.5 py-0.5">{queue.needsAttention} attention required</span>}
    </div>
  );
}
