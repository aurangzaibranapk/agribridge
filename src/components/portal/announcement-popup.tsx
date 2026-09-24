"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { dismissAnnouncement, type ActionState } from "@/actions/announcements";
import { X, Megaphone, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Announcement {
  id: string;
  title: string;
  message: string;
  cta_type: string;
  cta_label: string | null;
  cta_url: string | null;
}

export function AnnouncementPopup({ announcement, farmerId }: { announcement: Announcement; farmerId: string }) {
  const lang = useLang();
  const [dismissed, setDismissed] = useState(false);
  const [state, formAction] = useFormState(dismissAnnouncement, initialState);

  if (dismissed || state.success) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Megaphone className="h-5 w-5" />
          </div>
          {announcement.cta_type !== "vote" && (
            <form action={formAction}>
              <input type="hidden" name="announcement_id" value={announcement.id} />
              <input type="hidden" name="farmer_id" value={farmerId} />
              <button type="submit" onClick={() => setDismissed(true)} className="text-surface-400 hover:text-surface-700">
                <X className="h-5 w-5" />
              </button>
            </form>
          )}
        </div>
        <h3 className="font-display text-base font-semibold text-surface-900">{announcement.title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-surface-600">{announcement.message}</p>

        {announcement.cta_type === "vote" && (
          <div className="mt-4 flex gap-2">
            <form action={formAction} className="flex-1">
              <input type="hidden" name="announcement_id" value={announcement.id} />
              <input type="hidden" name="farmer_id" value={farmerId} />
              <input type="hidden" name="vote" value="yes" />
              <VoteButton label={t("yes_label", lang)} color="bg-green-600 hover:bg-green-700" />
            </form>
            <form action={formAction} className="flex-1">
              <input type="hidden" name="announcement_id" value={announcement.id} />
              <input type="hidden" name="farmer_id" value={farmerId} />
              <input type="hidden" name="vote" value="no" />
              <VoteButton label={t("no_label", lang)} color="bg-surface-200 hover:bg-surface-300 !text-surface-700" />
            </form>
          </div>
        )}

        {announcement.cta_type === "link" && announcement.cta_url && (<a href={announcement.cta_url} className="mt-4 block rounded-lg bg-brand-600 py-2 text-center text-sm font-medium text-white hover:bg-brand-700">{announcement.cta_label ?? "Dekhein"}</a>)}
      </div>
    </div>
  );
}

function VoteButton({ label, color }: { label: string; color: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-60 ${color}`}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </button>
  );
}