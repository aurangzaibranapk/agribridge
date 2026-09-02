"use client";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, MessageSquare, Undo2, X, XCircle } from "lucide-react";
import { commentPurchase, reviewPurchase, type ActionState } from "@/actions/purchases";
import { Badge, Button, Textarea } from "@/components/ui/form";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export interface PurchaseComment {
  id: string;
  kind: string;
  body: string;
  author: string;
  created_at: string;
}

const STATUS_KEY: Record<string, TranslationKey> = {
  submitted: "pu_rv_submitted",
  sent_back: "pu_rv_sent_back",
  approved: "pu_rv_approved",
  rejected: "pu_rv_rejected",
};
const KIND_KEY: Record<string, TranslationKey> = {
  submit: "pu_rv_k_submit",
  send_back: "pu_rv_k_send_back",
  approve: "pu_rv_k_approve",
  reject: "pu_rv_k_reject",
  resubmit: "pu_rv_k_resubmit",
  comment: "pu_rv_k_comment",
};

export function ReviewBadge({ status }: { status: string }) {
  const lang = useLang();
  const tone = status === "approved" ? "green" : status === "sent_back" ? "amber" : status === "rejected" ? "red" : "gray";
  return <Badge tone={tone}>{t(STATUS_KEY[status] ?? "pu_rv_submitted", lang)}</Badge>;
}

/**
 * Manzoori ka darwaza (259). Owner/Admin: manzoor / wapas / radd, wajah
 * ke sath. Baqi staff: jawab likhna, aur wapas aayi purchase dobara
 * bhejna. Poori baat ek jagah, kabhi mitti nahi.
 */
export function ReviewPanel({
  purchaseId,
  purchaseNumber,
  reviewStatus,
  comments,
  canApprove,
}: {
  purchaseId: string;
  purchaseNumber: string;
  reviewStatus: string;
  comments: PurchaseComment[];
  canApprove: boolean;
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [rvState, rvAction] = useFormState(reviewPurchase, initialState);
  const [cmState, cmAction] = useFormState(commentPurchase, initialState);
  const done = rvState.success || cmState.success;

  useEffect(() => {
    if (done) {
      const id = setTimeout(() => setOpen(false), 900);
      return () => clearTimeout(id);
    }
  }, [done]);

  const unread = comments.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
      >
        <MessageSquare className="h-3.5 w-3.5" /> {t("pu_rv_open", lang)}
        {unread > 0 && <span className="rounded-full bg-surface-100 px-1.5 text-[10px] text-surface-600 dark:bg-surface-800 dark:text-surface-300">{unread}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">
                {t("pu_rv_title", lang)} — {purchaseNumber}
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <ReviewBadge status={reviewStatus} />
              {reviewStatus !== "approved" && <span className="text-xs text-surface-500">{t("pu_rv_not_approved", lang)}</span>}
            </div>

            {/* Baat ka silsila */}
            <div className="mb-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-surface-200 p-3 dark:border-surface-800">
              {comments.length === 0 ? (
                <p className="text-xs text-surface-400">{t("pu_rv_thread_empty", lang)}</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="text-sm">
                    <p className="text-xs text-surface-500">
                      <span className="font-medium text-surface-700 dark:text-surface-300">{c.author}</span>{" "}
                      {t(KIND_KEY[c.kind] ?? "pu_rv_k_comment", lang)}
                      <span className="ml-1 text-surface-400">{new Date(c.created_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </p>
                    <p className="whitespace-pre-wrap text-surface-800 dark:text-surface-200">{c.body}</p>
                  </div>
                ))
              )}
            </div>

            {done ? (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("pu_rv_done", lang)}</p>
            ) : canApprove ? (
              <form action={rvAction} className="space-y-3">
                <input type="hidden" name="purchase_id" value={purchaseId} />
                <p className="text-xs text-surface-500">{t("pu_rv_hint", lang)}</p>
                <Textarea name="comment" rows={3} placeholder={t("pu_rv_comment", lang)} />
                {rvState.error && <p className="text-sm text-red-600 dark:text-red-400">{rvState.error}</p>}
                <div className="flex flex-wrap gap-2">
                  <Decision value="approve" label={t("pu_rv_approve", lang)} icon={<Check className="h-4 w-4" />} />
                  <Decision value="send_back" label={t("pu_rv_send_back", lang)} icon={<Undo2 className="h-4 w-4" />} variant="secondary" />
                  <Decision value="reject" label={t("pu_rv_reject", lang)} icon={<XCircle className="h-4 w-4" />} variant="danger" />
                </div>
              </form>
            ) : (
              <form action={cmAction} className="space-y-3">
                <input type="hidden" name="purchase_id" value={purchaseId} />
                <Textarea name="comment" rows={3} placeholder={t("pu_rv_comment", lang)} required />
                {cmState.error && <p className="text-sm text-red-600 dark:text-red-400">{cmState.error}</p>}
                <div className="flex flex-wrap gap-2">
                  <ReplyButton resubmit={false} label={t("pu_rv_reply", lang)} />
                  {reviewStatus === "sent_back" && <ReplyButton resubmit label={t("pu_rv_resubmit", lang)} />}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Decision({ value, label, icon, variant = "primary" }: { value: string; label: string; icon: React.ReactNode; variant?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="decision" value={value} variant={variant} disabled={pending}>
      <span className="inline-flex items-center gap-1.5">{icon} {label}</span>
    </Button>
  );
}

function ReplyButton({ resubmit, label }: { resubmit: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="resubmit" value={resubmit ? "1" : "0"} variant={resubmit ? "primary" : "secondary"} disabled={pending}>
      {label}
    </Button>
  );
}
