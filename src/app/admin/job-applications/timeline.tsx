"use client";
import { Clock } from "lucide-react";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface ActivityEntry {
  id: string;
  event_type: string;
  event_description: string;
  created_at: string;
}

export interface TimelineMessage {
  id: string;
  channel: "email" | "sms" | "whatsapp";
  to_address: string | null;
  subject: string | null;
  body: string | null;
  link_url: string | null;
  attachment_name: string | null;
  status: "sent" | "failed";
  error: string | null;
  triggered_name: string | null;
  created_at: string;
}

const EVENT_COLORS: Record<string, string> = {
  application_received: "bg-blue-500",
  under_review: "bg-surface-400",
  shortlisted: "bg-brand-500",
  rejected: "bg-red-500",
  interview_scheduled: "bg-amber-500",
  interview_rescheduled: "bg-amber-500",
  interview_completed: "bg-purple-500",
  offer_sent: "bg-indigo-500",
  offer_resent: "bg-indigo-400",
  offer_accepted: "bg-green-500",
  offer_declined: "bg-red-500",
  joined: "bg-green-600",
};

const CHANNEL_KEY: Record<TimelineMessage["channel"], TranslationKey> = {
  email: "ja_msg_email",
  sms: "ja_msg_sms",
  whatsapp: "ja_msg_whatsapp",
};

function when(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function ApplicationTimeline({ events, messages = [] }: { events: ActivityEntry[]; messages?: TimelineMessage[] }) {
  const lang = useLang();
  const rows = [
    ...events.map((event) => ({ id: `e-${event.id}`, at: event.created_at, kind: "event" as const, event })),
    ...messages.map((mail) => ({ id: `m-${mail.id}`, at: mail.created_at, kind: "mail" as const, mail })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  if (rows.length === 0) return null;

  return (
    <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-surface-400">
        <Clock className="h-3.5 w-3.5" />{t("at_application_timeline", lang)}</p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.id} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-2 w-2 rounded-full ${row.kind === "event" ? EVENT_COLORS[row.event.event_type] ?? "bg-surface-400" : row.mail.status === "sent" ? "bg-brand-500" : "bg-red-500"}`} />
              <span className="mt-1 w-px flex-1 bg-surface-200 dark:bg-surface-700" />
            </div>
            {row.kind === "event" ? (
              <div className="pb-2">
                <p className="text-xs text-surface-700 dark:text-surface-300">{row.event.event_description}</p>
                <p className="text-[11px] text-surface-400">{when(row.event.created_at)}</p>
              </div>
            ) : (
              <div className="min-w-0 pb-2 text-xs text-surface-700 dark:text-surface-300">
                <p className="font-semibold">
                  {t(CHANNEL_KEY[row.mail.channel], lang)}
                  <span className={`ml-1 font-medium ${row.mail.status === "sent" ? "text-brand-700" : "text-red-600"}`}>
                    {t(row.mail.status === "sent" ? "ja_msg_sent" : "ja_msg_failed", lang)}
                  </span>
                </p>
                <p>{t("ja_msg_to", lang)}: {row.mail.to_address || "—"}</p>
                {row.mail.subject && <p>{row.mail.subject}</p>}
                {row.mail.link_url && (
                  <p className="truncate">{t("ja_msg_link", lang)}: <a className="text-brand-700 underline" href={row.mail.link_url}>{row.mail.link_url}</a></p>
                )}
                {row.mail.attachment_name && <p>{t("ja_msg_attachment", lang)}: {row.mail.attachment_name}</p>}
                {row.mail.status === "failed" && row.mail.error && (
                  <p className="text-red-700" role="status">{row.mail.error}</p>
                )}
                {row.mail.body && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-brand-700">{t("ja_msg_view", lang)}</summary>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface-50 p-2 text-[11px] text-surface-600 dark:bg-surface-800 dark:text-surface-300">{row.mail.body}</pre>
                  </details>
                )}
                <p className="text-[11px] text-surface-400">
                  {when(row.mail.created_at)} · {t("ja_msg_by", lang)}: {row.mail.triggered_name || t("ja_msg_system", lang)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
