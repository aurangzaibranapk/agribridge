"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitComplaint, updateComplaintStatus, submitFeedback, type ActionState } from "@/actions/agri-complaints";
import { AlertCircle, X, Star, MessageSquareWarning } from "lucide-react";
import type { OrderPermissions } from "@/lib/order-permissions";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

const COMPLAINT_TYPES = [
  "Short Quantity", "Damaged Product", "Wrong Product", "Expired Product", "Price Issue",
  "Payment Issue", "Delivery Delay", "Quality Issue", "Missing Item", "Other",
];

interface Complaint {
  id: string;
  complaint_number: string;
  complaint_type: string;
  description: string;
  status: string;
  resolution_notes: string | null;
}

function statusColor(status: string) {
  if (status === "resolved" || status === "closed") return "bg-green-100 text-green-700";
  if (status === "assigned") return "bg-blue-100 text-blue-700";
  if (status === "under_review") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

const STATUS_FLOW = ["open", "under_review", "assigned", "resolved", "closed"];

export function ComplaintFeedbackSection({
  orderId,
  orderStatus,
  complaints,
  hasFeedback,
  permissions,
}: {
  orderId: string;
  orderStatus: string;
  complaints: Complaint[];
  hasFeedback: boolean;
  permissions: OrderPermissions;
}) {
  const [showComplaint, setShowComplaint] = useState(false);
  const lang = useLang();
  const [showFeedback, setShowFeedback] = useState(false);
  // Only HQ staff (not the branch that placed the order) process/advance a
  // complaint's status — the branch's job is to file it, not resolve it.
  const canManageComplaint = !permissions.isOwnerBranch;

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
          <MessageSquareWarning className="h-4 w-4" />{t("at_complaints", lang)}</h3>
        <div className="flex gap-2">
          {permissions.canSubmitComplaint && (
            <button onClick={() => setShowComplaint(true)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">{t("at_submit_complaint", lang)}</button>
          )}
          {["delivered", "completed"].includes(orderStatus) && !hasFeedback && permissions.canSubmitComplaint && (
            <button onClick={() => setShowFeedback(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">{t("ac_give_feedback", lang)}</button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {complaints.map((c) => (
          <div key={c.id} className="rounded-lg border border-surface-100 p-3 dark:border-surface-800">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-xs text-surface-500">{c.complaint_number}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(c.status)}`}>{c.status.replace(/_/g, " ")}</span>
            </div>
            <p className="text-sm font-medium text-surface-700 dark:text-surface-300">{c.complaint_type}</p>
            <p className="text-xs text-surface-500">{c.description}</p>
            {c.resolution_notes && <p className="mt-1 text-xs text-green-700">Resolution: {c.resolution_notes}</p>}
            {c.status !== "closed" && canManageComplaint && <ComplaintStatusAdvance orderId={orderId} complaintId={c.id} currentStatus={c.status} />}
          </div>
        ))}
        {complaints.length === 0 && <p className="text-center text-xs text-surface-400">{t("ac_no_complaint", lang)}</p>}
      </div>

      {showComplaint && <SubmitComplaintModal orderId={orderId} onClose={() => setShowComplaint(false)} />}
      {showFeedback && <SubmitFeedbackModal orderId={orderId} onClose={() => setShowFeedback(false)} />}
    </div>
  );
}

function ComplaintStatusAdvance({ orderId, complaintId, currentStatus }: { orderId: string; complaintId: string; currentStatus: string }) {
  const lang = useLang();
  const [state, formAction] = useFormState(updateComplaintStatus, initialState);
  const currentIdx = STATUS_FLOW.indexOf(currentStatus);
  const nextStatus = STATUS_FLOW[currentIdx + 1];
  if (!nextStatus) return null;

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="complaint_id" value={complaintId} />
      <input type="hidden" name="new_status" value={nextStatus} />
      {nextStatus === "resolved" && <input name="resolution_notes" placeholder={t("ac_resolution_notes", lang)} className="mb-1 w-full rounded border border-surface-200 p-1.5 text-xs" />}
      <button type="submit" className="rounded-lg bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600 hover:bg-surface-200 dark:bg-surface-800">
        Move to: {nextStatus.replace(/_/g, " ")}
      </button>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function SubmitComplaintModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(submitComplaint, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-display text-base font-semibold text-surface-900">
            <AlertCircle className="h-4 w-4" />{t("at_submit_complaint", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="order_id" value={orderId} />
          <select name="complaint_type" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Complaint Type Select Karein -</option>
            {COMPLAINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea name="description" required rows={3} placeholder={t("ac_write_full_detail", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label={t("ac_submit", lang)} />
        </form>
      </div>
    </div>
  );
}

function SubmitFeedbackModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(submitFeedback, initialState);
  const [ratings, setRatings] = useState({ delivery: 0, quality: 0, packaging: 0, service: 0, overall: 0 });
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("ac_give_feedback", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="delivery_experience_rating" value={ratings.delivery} />
          <input type="hidden" name="product_quality_rating" value={ratings.quality} />
          <input type="hidden" name="packaging_rating" value={ratings.packaging} />
          <input type="hidden" name="service_rating" value={ratings.service} />
          <input type="hidden" name="overall_rating" value={ratings.overall} />

          <StarField label={t("ac_delivery_experience", lang)} value={ratings.delivery} onChange={(v) => setRatings({ ...ratings, delivery: v })} />
          <StarField label={t("ac_product_quality", lang)} value={ratings.quality} onChange={(v) => setRatings({ ...ratings, quality: v })} />
          <StarField label={t("ac_packaging", lang)} value={ratings.packaging} onChange={(v) => setRatings({ ...ratings, packaging: v })} />
          <StarField label={t("c_service", lang)} value={ratings.service} onChange={(v) => setRatings({ ...ratings, service: v })} />
          <StarField label={t("ac_overall_rating", lang)} value={ratings.overall} onChange={(v) => setRatings({ ...ratings, overall: v })} />

          <textarea name="comments" rows={2} placeholder={t("ac_comments", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label={t("ac_submit_feedback", lang)} />
        </form>
      </div>
    </div>
  );
}

function StarField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-surface-600">{label}</label>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}>
            <Star className={`h-5 w-5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-surface-300"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}