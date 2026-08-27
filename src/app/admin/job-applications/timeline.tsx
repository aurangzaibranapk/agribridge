import { Clock } from "lucide-react";

interface ActivityEntry {
  id: string;
  event_type: string;
  event_description: string;
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
  offer_accepted: "bg-green-500",
  offer_declined: "bg-red-500",
  joined: "bg-green-600",
};

export function ApplicationTimeline({ events }: { events: ActivityEntry[] }) {
  if (events.length === 0) return null;

  return (
    <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-surface-400">
        <Clock className="h-3.5 w-3.5" /> Application Timeline
      </p>
      <div className="space-y-2.5">
        {events.map((e) => (
          <div key={e.id} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-2 w-2 rounded-full ${EVENT_COLORS[e.event_type] ?? "bg-surface-400"}`} />
              <span className="mt-1 w-px flex-1 bg-surface-200 dark:bg-surface-700" />
            </div>
            <div className="pb-2">
              <p className="text-xs text-surface-700 dark:text-surface-300">{e.event_description}</p>
              <p className="text-[11px] text-surface-400">
                {new Date(e.created_at).toLocaleDateString()} {new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}