"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PushNotificationToggle() {
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed">("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "unsubscribed");
    }).catch(() => setState("unsubscribed"));
  }, []);

  const subscribe = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });
      setState("subscribed");
    } catch {
      setState("unsubscribed");
    }
  };

  const unsubscribe = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch {
      setState("subscribed");
    }
  };

  if (state === "unsupported" || state === "denied") return null;

  return (
    <button
      onClick={state === "subscribed" ? unsubscribe : subscribe}
      disabled={state === "loading"}
      title={state === "subscribed" ? "Notifications band karein" : "Notifications chalayein"}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-surface-600 hover:bg-surface-100 disabled:opacity-50 dark:text-surface-400 dark:hover:bg-surface-800"
    >
      {state === "subscribed" ? (
        <Bell className="h-4 w-4 text-brand-600 dark:text-brand-400" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      <span className="hidden sm:inline text-xs">
        {state === "subscribed" ? "Notifications on" : "Notifications off"}
      </span>
    </button>
  );
}
