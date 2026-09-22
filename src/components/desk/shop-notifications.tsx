"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notice = { id: string; title: string; message: string; created_at: string };

export function ShopNotifications({ userId }: { userId: string }) {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const db = createClient();
    let active = true;
    const refresh = async () => {
      const { data, error } = await db.from("notifications").select("id,title,message,created_at")
        .eq("recipient_user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (active && !error) setNotices(data ?? []);
    };
    void refresh();
    const channel = db.channel(`desk-notices-tab-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${userId}` }, refresh)
      .subscribe(status => { if (active) setLive(status === "SUBSCRIBED"); });
    const timer = setInterval(refresh, 45000);
    return () => { active = false; clearInterval(timer); db.removeChannel(channel); };
  }, [userId]);

  return <section className="desk-card mx-auto w-full max-w-4xl">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-semibold">Live Notifications</h2>
      <span className="text-xs text-brand-700">{live ? "Live" : "Periodic refresh"}</span>
    </div>
    {notices === null ? <p className="text-sm text-surface-500">Notifications load ho rahi hain…</p>
      : notices.length ? notices.map(n => <article key={n.id} className="border-t py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">{n.title}</h3>
          <time className="text-xs text-surface-500" dateTime={n.created_at}>{new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(n.created_at))}</time>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-surface-600">{n.message}</p>
      </article>) : <p className="text-sm text-surface-500">Koi notification nahi.</p>}
  </section>;
}
