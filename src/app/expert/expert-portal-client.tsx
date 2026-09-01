"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { respondToEscalation, type ActionState } from "@/actions/expert-portal";
import { Stethoscope, MessageCircleQuestion, Send, Loader2, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Escalation {
  id: string;
  question: string;
  reason: string;
  status: string;
  createdAt: string;
  farmerName: string | null;
  farmerCode: string | null;
}

export function ExpertPortalClient({ expertName, escalations }: { expertName: string; escalations: Escalation[] }) {
  const lang = useLang();
  const pending = escalations.filter((e) => e.status === "pending");
  const resolved = escalations.filter((e) => e.status !== "pending");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Stethoscope className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-surface-900">{t("ou_expert_portal", lang)}</h1>
          <p className="text-sm text-surface-500">Khush Aamdeed, {expertName}</p>
        </div>
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
        <MessageCircleQuestion className="h-4 w-4" /> Pending Sawal ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p className="mb-8 rounded-card border border-surface-200 bg-white p-6 text-center text-sm text-surface-400">{t("ou_no_escalation", lang)}</p>
      ) : (
        <div className="mb-8 space-y-3">
          {pending.map((e) => (
            <EscalationCard key={e.id} escalation={e} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-700">
            <CheckCircle2 className="h-4 w-4" />{t("ou_answers_given", lang)}</h2>
          <div className="space-y-2">
            {resolved.slice(0, 10).map((e) => (
              <div key={e.id} className="rounded-lg border border-surface-100 bg-surface-50 p-3 text-sm">
                <p className="font-medium text-surface-700">{e.farmerName ?? "Farmer"} - {e.question}</p>
                <p className="mt-1 text-xs text-green-600">{t("ou_answered", lang)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EscalationCard({ escalation }: { escalation: Escalation }) {
  const lang = useLang();
  const [state, formAction] = useFormState(respondToEscalation, initialState);
  const [responded, setResponded] = useState(false);

  if (state.success && !responded) setResponded(true);

  if (responded) {
    return (
      <div className="rounded-card border border-green-200 bg-green-50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4" />{t("ou_answer_sent", lang)}</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-surface-900">{escalation.farmerName ?? "Farmer"}</span>
        <span className="text-xs text-surface-400">{escalation.farmerCode}</span>
      </div>
      <p className="text-sm text-surface-800">{escalation.question}</p>
      <p className="mt-1 text-xs text-amber-700">Wajah: {escalation.reason}</p>

      {state.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {/* Jawab mehfooz ho gaya magar kisan tak nahi pahuncha -- ye laal
          nahi hai (kaam hua hai) magar chhupa hua bhi nahi, warna expert
          ye samajh kar aage barh jata hai ke kisan ko bata diya gaya. */}
      {state.notice && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{state.notice}</p>}

      <form action={formAction} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="request_id" value={escalation.id} />
        <input
          name="response"
          required
          placeholder={t("ou_write_answer", lang)}
          className="h-10 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm"
        />
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
    </button>
  );
}