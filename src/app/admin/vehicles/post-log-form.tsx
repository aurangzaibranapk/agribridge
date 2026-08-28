"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { postVehicleDailyLog, type ActionState } from "@/actions/vehicle-logs";
import { COMMENT_MAX, COMMENT_MIN } from "@/lib/whatsapp-submissions";

const initialState: ActionState = {};

/** Nishan lage log par comment thoda tafseeli chahiye — server bhi yahi check karta hai. */
const FLAGGED_MIN = 15;

export function PostLogForm({ logId, hasFlags }: { logId: string; hasFlags: boolean }) {
  const [state, formAction] = useFormState(postVehicleDailyLog, initialState);
  const [comment, setComment] = useState("");

  const min = hasFlags ? FLAGGED_MIN : COMMENT_MIN;
  const ready = comment.trim().length >= min;

  return (
    <form action={formAction} className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      <input type="hidden" name="log_id" value={logId} />

      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <label className="text-xs font-medium text-surface-600">
        Manager ka comment * <span className="text-surface-400">(lazmi — accounts mein bhejne se pehle)</span>
      </label>
      <textarea
        name="manager_comment"
        rows={2}
        maxLength={COMMENT_MAX}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={hasFlags ? "Nishan ke bawajood ise theek kyun mana — wajah likhein" : "Misal: Meter aur bill dono mila kar dekh liye, durust hain."}
        className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
      />
      <div className="mt-1 flex justify-between text-xs">
        <span className={ready || comment.length === 0 ? "text-surface-400" : "text-red-600"}>
          {hasFlags ? `Nishan lage hain — kam az kam ${FLAGGED_MIN} haroof` : `Kam az kam ${min} haroof`}
        </span>
        <span className="text-surface-400">{comment.length} / {COMMENT_MAX}</span>
      </div>

      <PostButton ready={ready} />
    </form>
  );
}

function PostButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !ready}
      className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Ho raha hai..." : ready ? "Verify Kar ke Accounts Mein Bhejein" : "Pehle comment likhein"}
    </button>
  );
}
