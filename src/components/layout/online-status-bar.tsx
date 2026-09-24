"use client";
import { useEffect, useState } from "react";

type NetStatus = "online" | "offline" | "restored";

export function OnlineStatusBar() {
  const [status, setStatus] = useState<NetStatus>("online");

  useEffect(() => {
    if (!navigator.onLine) setStatus("offline");
    const goOffline = () => setStatus("offline");
    const goOnline = () => {
      setStatus("restored");
      const t = setTimeout(() => setStatus("online"), 4000);
      return () => clearTimeout(t);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (status === "online") return null;

  if (status === "offline") {
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white print:hidden">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white/80" />
        Offline Mode — Internet nahi hai. Bill ka data save ho raha hai, wapas aate hi submit karein.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white print:hidden">
      <span className="h-2 w-2 rounded-full bg-white" />
      Online Mode — Internet wapas aa gaya
    </div>
  );
}
