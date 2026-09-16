"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Mera Kaam par live ittila'at -- poora safha hilaye bina.
 *
 * Malik (16 September): "My Work dashboard ka poora page baar-baar
 * refresh na karein. Sirf bell count aur Live Notifications panel
 * Realtime mein update hon, taa-ke staff ka ongoing kaam disturb na
 * ho."
 *
 * Is liye ye component `router.refresh()` KABHI nahi bulata (jaisa
 * `LiveRefresh` karta hai aur poora server component dobara chalata
 * hai) -- naya notification seedha isi ki apni state mein jaa kar
 * lagta hai. Ghanti (`NotificationBell`) bhi isi tarah khud-mukhtar
 * hai; safha khud kabhi nahi hilta.
 */

interface Item {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

function waqt(iso: string): string {
  const d = new Date(iso);
  const mint = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mint < 1) return "abhi";
  if (mint < 60) return `${mint} min`;
  if (mint < 1440) return `${Math.floor(mint / 60)} ghante`;
  return d.toLocaleDateString();
}

export function LiveNotificationsPanel({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [zinda, setZinda] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      channel = supabase
        .channel(`my-work-notifications:${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as Item;
            // Naya item seedha upar -- na ke poora safha dobara parhna.
            setItems((cur) => [row, ...cur.filter((i) => i.id !== row.id)].slice(0, 8));
          }
        )
        .subscribe((status) => {
          if (!cancelled) setZinda(status === "SUBSCRIBED");
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-center justify-between border-b border-surface-100 px-5 py-3 dark:border-surface-800">
        <h2 className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-wide text-surface-500">
          <Bell className="h-4 w-4" /> Live Notifications
        </h2>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            zinda
              ? "bg-emerald-50 text-emerald-700 dark:bg-surface-800 dark:text-emerald-400"
              : "bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400"
          }`}
          title={zinda ? "Judaav hai — nayi ittila khud yahan aa jayegi." : "Live judaav nahi mila."}
        >
          <Radio className={`h-2.5 w-2.5 ${zinda ? "animate-pulse" : ""}`} />
          {zinda ? "Live" : "Live nahi"}
        </span>
      </div>
      <div className="divide-y divide-surface-100 overflow-y-auto dark:divide-surface-800" style={{ maxHeight: "min(35vh, 300px)" }}>
        {items.length === 0 ? (
          <p className="px-5 py-4 text-sm text-surface-400">Abhi koi ittila nahi.</p>
        ) : (
          items.map((i) => {
            const body = (
              <>
                <p className={`text-sm ${i.is_read ? "text-surface-600 dark:text-surface-400" : "font-semibold text-surface-900 dark:text-white"}`}>
                  {i.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-surface-500">{i.message}</p>
                <p className="mt-0.5 text-[11px] text-surface-400">{waqt(i.created_at)}</p>
              </>
            );
            return i.link_url ? (
              <Link key={i.id} href={i.link_url} className="block px-5 py-3 transition hover:bg-surface-50 dark:hover:bg-surface-800">
                {body}
              </Link>
            ) : (
              <div key={i.id} className="px-5 py-3">
                {body}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
