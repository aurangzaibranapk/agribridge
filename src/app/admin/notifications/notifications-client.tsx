"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { markNotificationRead, sendBroadcast, type ActionState } from "@/actions/notifications";
import { Bell, Send, X, Check } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface MyNotification {
  id: string;
  title: string;
  message: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface AllNotification {
  id: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  recipient_name: string | null;
  recipient_role: string | null;
}

export function NotificationsClient({
  myNotifications,
  allNotifications,
  canBroadcast,
  canViewAll,
}: {
  myNotifications: MyNotification[];
  allNotifications: AllNotification[];
  canBroadcast: boolean;
  canViewAll: boolean;
}) {
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const lang = useLang();
  const [showBroadcast, setShowBroadcast] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        {canViewAll ? (
          <div className="flex gap-1 rounded-lg border border-surface-200 p-1 dark:border-surface-800">
            <button onClick={() => setTab("mine")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === "mine" ? "bg-brand-600 text-white" : "text-surface-500"}`}>{t("nt_mine", lang)}</button>
            <button onClick={() => setTab("all")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === "all" ? "bg-brand-600 text-white" : "text-surface-500"}`}>{t("nt_all_activity", lang)}</button>
          </div>
        ) : (
          <div />
        )}
        {canBroadcast && (
          <button onClick={() => setShowBroadcast(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700">
            <Send className="h-3.5 w-3.5" />{t("nt_send_announcement", lang)}</button>
        )}
      </div>

      {tab === "mine" && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          {myNotifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-surface-400">{t("nt_none", lang)}</p>
          ) : (
            myNotifications.map((n) => <MyNotificationRow key={n.id} notification={n} />)
          )}
        </div>
      )}

      {tab === "all" && canViewAll && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          {allNotifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-surface-400">{t("nt_none", lang)}</p>
          ) : (
            allNotifications.map((n) => (
              <div key={n.id} className="flex items-center justify-between border-b border-surface-100 px-4 py-3 last:border-0 dark:border-surface-800">
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{n.title}</p>
                  <p className="text-xs text-surface-500">{n.message}</p>
                  <p className="text-xs text-surface-400">To: {n.recipient_name ?? "User"} ({n.recipient_role ?? "-"}) | {new Date(n.created_at).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${n.is_read ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {n.is_read ? "Read" : "Unread"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {showBroadcast && <BroadcastModal onClose={() => setShowBroadcast(false)} />}
    </div>
  );
}

function MyNotificationRow({ notification }: { notification: MyNotification }) {
  const lang = useLang();
  const [, formAction] = useFormState(markNotificationRead, initialState);
  const content = (
    <div className={`flex items-start justify-between gap-3 border-b border-surface-100 px-4 py-3 last:border-0 dark:border-surface-800 ${!notification.is_read ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}>
      <div className="flex items-start gap-2">
        <Bell className={`mt-0.5 h-4 w-4 ${!notification.is_read ? "text-brand-600" : "text-surface-300"}`} />
        <div>
          <p className="text-sm font-medium text-surface-900 dark:text-white">{notification.title}</p>
          <p className="text-xs text-surface-500 whitespace-pre-line">{notification.message}</p>
          <p className="text-xs text-surface-400">{new Date(notification.created_at).toLocaleString()}</p>
        </div>
      </div>
      {!notification.is_read && (
        <form action={formAction}>
          <input type="hidden" name="notification_id" value={notification.id} />
          <button type="submit" className="flex items-center gap-1 rounded-lg bg-surface-100 px-2 py-1 text-xs text-surface-600 hover:bg-surface-200">
            <Check className="h-3 w-3" />{t("nt_mark_read", lang)}</button>
        </form>
      )}
    </div>
  );

  if (notification.link_url) {
    return <Link href={notification.link_url}>{content}</Link>;
  }
  return content;
}

function BroadcastModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(sendBroadcast, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("nt_send_announcement", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <select name="audience" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Kise Bhejna Hai -</option>
            <option value="all_staff">{t("nt_all_staff_hq", lang)}</option>
            <option value="all_branches">{t("nt_all_shops", lang)}</option>
          </select>
          <input name="title" required placeholder={t("c_title", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="message" required rows={4} placeholder={t("nt_write_message", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Bhejein"}</button>;
}