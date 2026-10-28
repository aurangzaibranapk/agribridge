"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markAllNotificationsRead, markNotificationOpened } from "@/actions/notifications";
import {
  NOTIFICATIONS_READ_EVENT,
  isPlainClick,
  type MarkReadResult,
  type NotificationsReadDetail,
} from "@/lib/notifications-read";

function emitRead(ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;
  window.dispatchEvent(new CustomEvent<NotificationsReadDetail>(NOTIFICATIONS_READ_EVENT, { detail: { ids } }));
}

/** DB par is_read likho. Pending approval ko nahi chhoota. */
export async function markOpened(input: { id?: string | null; href?: string | null }): Promise<MarkReadResult> {
  const res = await markNotificationOpened(input);
  if (res.ids.length > 0) emitRead(res.ids);
  return res;
}

export async function markAllRead() {
  return markAllNotificationsRead();
}

function go(href: string) {
  if (href.startsWith("/") && !href.startsWith("//")) {
    return href;
  }
  window.location.assign(href);
  return null;
}

/**
 * Link jis par click pehle notice ko read karta hai, phir screen kholta hai.
 * Ctrl/Shift naya tab: mark chhor kar browser ko jane dete hain, phir bhi save ki koshish.
 */
export function MarkReadLink({
  href,
  notificationId,
  className,
  children,
  onDone,
  bellItem,
}: {
  href: string;
  notificationId?: string | null;
  className?: string;
  children: ReactNode;
  onDone?: () => void;
  /** Ghanti ki pending/new qataar — DOM par wahi nishan. */
  bellItem?: "new" | "pending";
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      data-mark-read="1"
      data-bell-item={bellItem}
      onClick={(e) => {
        if (!isPlainClick(e)) {
          void markOpened({ id: notificationId, href });
          onDone?.();
          return;
        }
        e.preventDefault();
        void (async () => {
          try {
            await markOpened({ id: notificationId, href });
          } finally {
            onDone?.();
            const internal = go(href);
            if (internal) router.push(internal);
          }
        })();
      }}
    >
      {children}
    </Link>
  );
}
