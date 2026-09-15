"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { reviewSubmission, type ActionState } from "@/actions/whatsapp-submissions";
import { COMMENT_MAX, COMMENT_MIN } from "@/lib/whatsapp-submissions";
import { partiesForKind, BILL_CATEGORIES } from "@/lib/bill-cash";
import { Check, X, CornerUpLeft, Paperclip, Info } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

const DECISIONS = [
  { value: "approved", label: "Approve", Icon: Check, tone: "border-green-600 bg-green-50 text-green-700 dark:bg-green-950/30" },
  { value: "sent_back", label: "Wapas Bhejein", Icon: CornerUpLeft, tone: "border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950/30" },
  { value: "rejected", label: "Reject", Icon: X, tone: "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/30" },
] as const;

interface FinanceAccount {
  id: string;
  name: string;
  account_type: string;
}

export function ReviewForm({
  submissionId,
  kind,
  originalAmount,
  suggestedParty,
  accounts,
}: {
  submissionId: string;
  kind: string;
  originalAmount: number | null;
  suggestedParty: string;
  accounts: FinanceAccount[];
}) {
  const [state, formAction] = useFormState(reviewSubmission, initialState);
  const [decision, setDecision] = useState<string>("");
  const [comment, setComment] = useState("");
  const [partyType, setPartyType] = useState("");

  const isCash = kind === "cash_paid" || kind === "cash_received";
  const lang = useLang();
  const isBill = kind === "expense";
  const parties = partiesForKind(kind);
  const chosenParty = parties.find((p) => p.value === partyType) ?? null;
  const approving = decision === "approved";

  const tooShort = comment.trim().length > 0 && comment.trim().length < COMMENT_MIN;
  const cashReady = !isCash || !approving || partyType !== "";
  const ready = decision !== "" && comment.trim().length >= COMMENT_MIN && cashReady;

  return (
    <form action={formAction} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <input type="hidden" name="submission_id" value={submissionId} />
      <input type="hidden" name="decision" value={decision} />

      <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{t("sb_your_decision", lang)}</h3>

      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DECISIONS.map(({ value, label, Icon, tone }) => {
          const selected = decision === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setDecision(value)}
              aria-pressed={selected}
              className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium transition ${
                selected ? `${tone} ring-1` : "border-surface-200 text-surface-600 hover:border-surface-300 dark:border-surface-700"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          );
        })}
      </div>

      <div className="mb-3">
        <label className="text-xs font-medium text-surface-600">{t("sb_comment_req", lang)}<span className="text-surface-400">(lazmi — wajah likhein)</span>
        </label>
        <textarea
          name="manager_comment"
          rows={3}
          maxLength={COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("sb_decision_eg", lang)}
          className={`mt-1 w-full rounded-lg border p-2 text-sm ${tooShort ? "border-red-400" : "border-surface-200"}`}
        />
        <div className="mt-1 flex justify-between text-xs">
          <span className={tooShort ? "text-red-600" : "text-surface-400"}>
            {tooShort ? `Kam az kam ${COMMENT_MIN} haroof` : "Ye comment hamesha ke liye record mein rahega"}
          </span>
          <span className="text-surface-400">{comment.length} / {COMMENT_MAX}</span>
        </div>
      </div>

      {isBill && approving && (
        <div className="mb-3">
          <label className="text-xs font-medium text-surface-600">{t("sb_which_bill", lang)}</label>
          <select
            name="bill_category"
            defaultValue="utility_bill"
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          >
            {BILL_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-surface-400">{t("sb_bill_goes_where", lang)}</p>
        </div>
      )}

      {isCash && approving && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cash bahar jane ka matlab kharcha nahi hota. Batayein ye kis qism ka len-den hai — warna
            nafa ghalat nazar aayega aur khata kam nahi hoga.
          </p>

          <label className="text-xs font-medium text-surface-700 dark:text-surface-300">{t("sb_which_txn", lang)}</label>
          <select
            name="party_type"
            value={partyType}
            onChange={(e) => setPartyType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          >
            <option value="">— chunein —</option>
            {parties.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {chosenParty && <p className="mt-1 text-xs text-surface-600 dark:text-surface-400">{chosenParty.hint}</p>}

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-surface-700 dark:text-surface-300">
                {kind === "cash_paid" ? "Kis ko diya? *" : "Kis se mila? *"}
              </label>
              <input
                name="party_name"
                defaultValue={suggestedParty}
                placeholder={t("c_enter_name", lang)}
                className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-700 dark:text-surface-300">{t("sb_khata_req", lang)}</label>
              <select name="finance_account_id" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                {accounts.length === 0 && <option value="">{t("sb_no_khata", lang)}</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-surface-600">{t("sb_fix_amount", lang)}</label>
          <input
            name="corrected_amount"
            type="number"
            step="0.01"
            min={0}
            placeholder={originalAmount == null ? "—" : String(originalAmount)}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
          <p className="mt-1 text-xs text-surface-400">{t("sb_leave_blank", lang)}</p>
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-surface-600">
            <Paperclip className="h-3 w-3" />{t("sb_can_attach", lang)}</label>
          <input
            name="manager_media"
            type="file"
            accept="image/*"
            multiple
            className="mt-1 w-full rounded-lg border border-surface-200 p-1.5 text-xs"
          />
        </div>
      </div>

      <SubmitButton ready={ready} />
      <p className="mt-2 text-xs text-surface-500">{t("sb_final_note", lang)}</p>
    </form>
  );
}

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !ready}
      className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Ho raha hai..." : ready ? "Faisla Mahfooz Karein" : "Pehle faisla, qism aur comment likhein"}
    </button>
  );
}
