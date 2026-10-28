/**
 * Ghanti ki "parh li" pehchan — sirf `notifications.is_read`.
 *
 * Pending approvals (laal 130) alag hain: wo `fn_admin_pending_counts`
 * se aate hain aur yahan chhooTe nahi. Kholna approve nahi karta.
 *
 * Ek notice tab match karti hai jab us ka path wahi ho jo khula, aur
 * notice ke query params khule hue URL par maujood hon.
 * `/admin/my-work/pending?f=escalated` aur `?f=mine` alag hain.
 * Notices jin ka link ek hi screen hai, ek kholne par saath parh li
 * hoti hain — record par item id nahi, sirf link hai.
 */

export const NOTIFICATIONS_READ_EVENT = "agribridge:notifications-read";

export type NotificationsReadDetail = { ids: string[] };

export type NoticeRef = {
  id: string;
  link_url: string | null;
  is_read: boolean;
};

export type MarkReadResult =
  | { ok: true; updated: number; ids: string[] }
  | { ok: false; updated: number; ids: string[]; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isNotificationId(id: string | null | undefined): id is string {
  return !!id && UUID_RE.test(id.trim());
}

export function parseAppHref(raw: string | null | undefined): { path: string; params: URLSearchParams } | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.startsWith("//") || /^javascript:/i.test(trimmed)) return null;
  try {
    const absolute = /^https?:\/\//i.test(trimmed);
    const u = absolute
      ? new URL(trimmed)
      : new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, "https://agribridge.local");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return { path, params: u.searchParams };
  } catch {
    return null;
  }
}

/** Notice ka link isi khuli screen ki taraf hai? */
export function notificationLinkMatches(linkUrl: string | null | undefined, openedHref: string | null | undefined): boolean {
  const link = parseAppHref(linkUrl);
  const opened = parseAppHref(openedHref);
  if (!link || !opened) return false;
  if (link.path !== opened.path) return false;
  for (const [key, value] of link.params.entries()) {
    if (opened.params.get(key) !== value) return false;
  }
  return true;
}

/**
 * Kaun si unread qatarein is kholne par read hon.
 * `rows` sirf isi user ki unread hon — caller RLS ke baad bhejta hai.
 * Click ki hui id, chahe list mein na ho, shamil rehti hai taake update ki koshish ho.
 */
export function notificationIdsForOpen(
  rows: NoticeRef[],
  opened: { id?: string | null; href?: string | null }
): string[] {
  const wanted = new Set<string>();
  const id = opened.id?.trim() || null;
  const href = opened.href?.trim() || null;
  if (id && isNotificationId(id)) wanted.add(id);
  if (href) {
    for (const row of rows) {
      if (row.is_read) continue;
      if (notificationLinkMatches(row.link_url, href)) wanted.add(row.id);
    }
  }
  return [...wanted];
}

export function isPlainClick(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
