"use client";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, MessageSquare, Pencil, ShieldCheck, Undo2, X, XCircle } from "lucide-react";
import { commentPurchase, reviewPurchase, verifyPurchase, updatePurchaseItem, type ActionState } from "@/actions/purchases";
import { Badge, Button, Input, Textarea } from "@/components/ui/form";
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

export interface PurchaseReviewItem {
  id: string;
  name: string;
  pack_size: string | null;
  quantity: number;
  unit_cost: number;
  units_per_pack?: number | null;
}

const STATUS_KEY: Record<string, TranslationKey> = {
  submitted: "pu_rv_submitted",
  verified: "pu_rv_verified",
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
  edit: "pu_rv_k_edit",
  verify: "pu_rv_k_verify",
};

export function ReviewBadge({ status }: { status: string }) {
  const lang = useLang();
  const tone =
    status === "approved" ? "green" : status === "verified" ? "blue" : status === "sent_back" ? "amber" : status === "rejected" ? "red" : "gray";
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
  items,
  canApprove,
  canVerify = false,
  discountAmount,
  taxAmount,
}: {
  purchaseId: string;
  purchaseNumber: string;
  reviewStatus: string;
  comments: PurchaseComment[];
  items: PurchaseReviewItem[];
  canApprove: boolean;
  /** Branch Manager: sirf apni branch ki tasdeeq -- final manzoori nahi. */
  canVerify?: boolean;
  discountAmount?: number | null;
  taxAmount?: number | null;
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [rvState, rvAction] = useFormState(reviewPurchase, initialState);
  const [vrState, vrAction] = useFormState(verifyPurchase, initialState);
  const [cmState, cmAction] = useFormState(commentPurchase, initialState);
  const done = rvState.success || vrState.success || cmState.success;
  const showVerify = canVerify && !canApprove && reviewStatus === "submitted";

  useEffect(() => {
    if (done) {
      const id = setTimeout(() => setOpen(false), 900);
      return () => clearTimeout(id);
    }
  }, [done]);

  const unread = comments.length;

  return (
    <>
      <button data-guide="purchase-review"
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

            {/* Products -- malik (7 September): "approval deni hai to
                products ko view to karna chahiye, kisi ka rate to nahi
                ghalat." Pehle Review sirf comment thread aur
                approve/reject tha -- jo cheez manzoor ki ja rahi thi wo
                yahan kabhi dikhi hi nahi. */}
            <p className="mb-1.5 text-xs font-medium text-surface-600 dark:text-surface-400">{t("pu_rv_items_title", lang)}</p>
            <div className="mb-2 space-y-1.5">
              {items.length === 0 ? (
                <p className="text-xs text-surface-400">{t("pu_rv_items_empty", lang)}</p>
              ) : (
                items.map((it) => (
                  <ItemRow key={it.id} purchaseId={purchaseId} item={it} editable={canApprove} />
                ))
              )}
            </div>
            {items.length > 0 && (() => {
              const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_cost, 0);
              const disc = discountAmount ?? 0;
              const taxAmt = taxAmount ?? 0;
              const grandTotal = subtotal - disc + taxAmt;
              return (
                <div className="mb-4 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-xs dark:border-surface-700 dark:bg-surface-800">
                  <div className="flex justify-between text-surface-500"><span>Subtotal</span><span className="tabular-nums font-medium text-surface-700 dark:text-surface-300">Rs {subtotal.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div>
                  {disc > 0 && <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Discount (Bach)</span><span className="tabular-nums">− Rs {disc.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div>}
                  {taxAmt > 0 && <div className="flex justify-between text-surface-500"><span>Tax</span><span className="tabular-nums">+ Rs {taxAmt.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div>}
                  <div className="mt-1.5 flex justify-between border-t border-surface-200 pt-1.5 font-semibold text-surface-800 dark:border-surface-600 dark:text-surface-100"><span>Total</span><span className="tabular-nums">Rs {grandTotal.toLocaleString("en-PK", { maximumFractionDigits: 2 })}</span></div>
                </div>
              );
            })()}


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
            ) : showVerify ? (
              <form action={vrAction} className="space-y-3">
                <input type="hidden" name="purchase_id" value={purchaseId} />
                <p className="text-xs text-surface-500">{t("pu_rv_waiting_approval", lang)}</p>
                {vrState.error && <p className="text-sm text-red-600 dark:text-red-400">{vrState.error}</p>}
                <div className="flex flex-wrap gap-2">
                  <VerifyButton label={t("pu_rv_verify", lang)} />
                </div>
              </form>
            ) : (
              <>
                {canVerify && reviewStatus === "verified" && (
                  <p className="mb-3 text-xs text-surface-500">{t("pu_rv_waiting_approval", lang)}</p>
                )}
                <form action={cmAction} className="space-y-3">
                  <input type="hidden" name="purchase_id" value={purchaseId} />
                  <Textarea name="comment" rows={3} placeholder={t("pu_rv_comment", lang)} required />
                  {cmState.error && <p className="text-sm text-red-600 dark:text-red-400">{cmState.error}</p>}
                  <div className="flex flex-wrap gap-2">
                    <ReplyButton resubmit={false} label={t("pu_rv_reply", lang)} />
                    {reviewStatus === "sent_back" && <ReplyButton resubmit label={t("pu_rv_resubmit", lang)} />}
                  </div>
                </form>
              </>
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

function VerifyButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4" /> {pending ? "…" : label}
      </span>
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

/**
 * Ek line -- quantity aur rate, editable jab tak koi faisla nahi hua.
 * Badalne ka nishan (Pencil) tabhi jab kuch waqai badla ho, taake khali
 * yun hi dabana kisi cheez ki "history" na bana de.
 */
function ItemRow({ purchaseId, item, editable }: { purchaseId: string; item: PurchaseReviewItem; editable: boolean }) {
  const lang = useLang();
  const [state, action] = useFormState(updatePurchaseItem, initialState);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitCost, setUnitCost] = useState(String(item.unit_cost));
  const changed = Number(quantity) !== item.quantity || Number(unitCost) !== item.unit_cost;

  const upp = item.units_per_pack && item.units_per_pack > 1 ? item.units_per_pack : null;
  const bottleRate = upp ? item.unit_cost / upp : null;

  if (!editable) {
    return (
      <div className="rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs dark:border-surface-700">
        <div className="flex items-center justify-between">
          <span className="text-surface-700 dark:text-surface-300">
            {item.name}{item.pack_size ? ` (${item.pack_size})` : ""}
          </span>
          <span className="tabular-nums text-surface-500">
            {item.quantity} × Rs {item.unit_cost.toLocaleString()} = Rs {(item.quantity * item.unit_cost).toLocaleString()}
          </span>
        </div>
        {bottleRate && (
          <div className="mt-0.5 text-right text-[10px] text-brand-700 dark:text-brand-400">
            Bottle rate: Rs {bottleRate.toLocaleString("en-PK", { maximumFractionDigits: 2 })} / bottle
          </div>
        )}
      </div>
    );
  }

  const currentCost = Number(unitCost);
  const currentBottleRate = upp && currentCost ? currentCost / upp : null;

  return (
    <form action={action} className="rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs dark:border-surface-700">
      <div className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="purchase_id" value={purchaseId} />
        <input type="hidden" name="item_id" value={item.id} />
        <span className="min-w-0 flex-1 truncate text-surface-700 dark:text-surface-300">
          {item.name}{item.pack_size ? ` (${item.pack_size})` : ""}
        </span>
        <Input
          name="quantity"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="h-7 w-16 text-right text-xs"
        />
        <span className="text-surface-400">×</span>
        <Input
          name="unit_cost"
          inputMode="decimal"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          className="h-7 w-20 text-right text-xs"
        />
        {changed && <ItemUpdateButton label={t("pu_rv_update", lang)} />}
        {state.error && <span className="w-full text-[11px] text-red-600 dark:text-red-400">{state.error}</span>}
      </div>
      {currentBottleRate && (
        <div className="mt-0.5 text-right text-[10px] text-brand-700 dark:text-brand-400">
          Bottle rate: Rs {currentBottleRate.toLocaleString("en-PK", { maximumFractionDigits: 2 })} / bottle
        </div>
      )}
    </form>
  );
}

function ItemUpdateButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      <span className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> {pending ? "…" : label}</span>
    </Button>
  );
}
