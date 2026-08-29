"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CalendarPlus, Check, X } from "lucide-react";
import { requestLeave, decideLeave, type LeaveState } from "@/actions/leave";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const initial: LeaveState = {};

const TYPE_LABEL: Record<string, TranslationKey> = {
  casual: "lv_type_casual",
  sick: "lv_type_sick",
  annual: "lv_type_annual",
  unpaid: "lv_type_unpaid",
};

const STATUS_LABEL: Record<string, TranslationKey> = {
  pending: "lv_pending",
  approved: "lv_approved",
  rejected: "lv_rejected",
  cancelled: "lv_cancelled",
};

const STATUS_TONE: Record<string, "amber" | "green" | "red" | "gray"> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
  cancelled: "gray",
};

interface Mine {
  id: string;
  fromDate: string;
  toDate: string;
  days: number;
  leaveType: string;
  reason: string;
  status: string;
  decisionNote: string | null;
}

interface Pending extends Omit<Mine, "status" | "decisionNote"> {
  who: string;
}

export function LeaveClient({
  lang,
  canDecide,
  mine,
  pending,
}: {
  lang: Lang;
  canDecide: boolean;
  mine: Mine[];
  pending: Pending[];
}) {
  const [askState, askAction] = useFormState(requestLeave, initial);
  const [decideState, decideAction] = useFormState(decideLeave, initial);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Doosron ki darkhwastein pehle -- inhen faisle ka intezar hai.
          Apni fehrist neeche: wo sirf dekhne ke liye hai. */}
      {canDecide && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between border-b border-surface-100 pb-2 dark:border-surface-800">
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              {t("lv_awaiting_decision", lang)}
            </h2>
            <Badge tone={pending.length > 0 ? "amber" : "gray"}>{pending.length}</Badge>
          </div>

          {decideState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{decideState.error}</p>}
          {decideState.notice && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{decideState.notice}</p>
          )}

          {pending.length === 0 ? (
            <p className="text-sm text-surface-500">{t("lv_none_pending", lang)}</p>
          ) : (
            pending.map((p) => (
              <form key={p.id} action={decideAction} className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                <input type="hidden" name="leave_id" value={p.id} />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-surface-900 dark:text-surface-100">{p.who}</p>
                  <Badge tone="gray">{t(TYPE_LABEL[p.leaveType] ?? "lv_type_casual", lang)}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-surface-600 dark:text-surface-300">
                  {p.fromDate} — {p.toDate} · {p.days} {t("lv_days", lang)}
                </p>
                <p className="mt-1 text-sm text-surface-700 dark:text-surface-200">{p.reason}</p>

                <div className="mt-2">
                  <Label>{t("lv_decision_note", lang)}</Label>
                  <Input name="decision_note" placeholder={t("lv_decision_note_hint", lang)} />
                </div>

                <div className="mt-2 flex gap-2">
                  <Button type="submit" name="decision" value="approved" size="sm">
                    <Check className="h-4 w-4" /> {t("lv_approve", lang)}
                  </Button>
                  <Button type="submit" name="decision" value="rejected" size="sm" variant="secondary">
                    <X className="h-4 w-4" /> {t("lv_reject", lang)}
                  </Button>
                </div>
              </form>
            ))
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center justify-between border-b border-surface-100 pb-2 dark:border-surface-800">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            {t("lv_my_leave", lang)}
          </h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(!open)}>
            <CalendarPlus className="h-4 w-4" /> {t("lv_ask", lang)}
          </Button>
        </div>

        {askState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{askState.error}</p>}
        {askState.notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{askState.notice}</p>}

        {open && (
          <form action={askAction} className="space-y-3 rounded-lg border border-brand-200 p-3 dark:border-brand-900/40">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("lv_from", lang)}</Label>
                <Input type="date" name="from_date" />
              </div>
              <div>
                <Label>{t("lv_to", lang)}</Label>
                <Input type="date" name="to_date" />
                <p className="mt-1 text-xs text-surface-500">{t("lv_to_hint", lang)}</p>
              </div>
            </div>
            <div>
              <Label>{t("lv_type", lang)}</Label>
              <Select name="leave_type" defaultValue="casual">
                <option value="casual">{t("lv_type_casual", lang)}</option>
                <option value="sick">{t("lv_type_sick", lang)}</option>
                <option value="annual">{t("lv_type_annual", lang)}</option>
                <option value="unpaid">{t("lv_type_unpaid", lang)}</option>
              </Select>
            </div>
            <div>
              <Label>{t("lv_reason", lang)}</Label>
              <Textarea name="reason" rows={2} placeholder={t("lv_reason_hint", lang)} />
            </div>
            <SubmitButton lang={lang} />
          </form>
        )}

        {mine.length === 0 ? (
          <p className="text-sm text-surface-500">{t("lv_no_leave_yet", lang)}</p>
        ) : (
          <div className="space-y-2">
            {mine.map((r) => (
              <div key={r.id} className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-surface-800 dark:text-surface-100">
                    {r.fromDate} — {r.toDate} · {r.days} {t("lv_days", lang)}
                  </span>
                  <div className="flex gap-2">
                    <Badge tone="gray">{t(TYPE_LABEL[r.leaveType] ?? "lv_type_casual", lang)}</Badge>
                    <Badge tone={STATUS_TONE[r.status] ?? "gray"}>
                      {t(STATUS_LABEL[r.status] ?? "lv_pending", lang)}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">{r.reason}</p>
                {r.decisionNote && (
                  <p className="mt-1 text-sm text-surface-500">
                    {t("lv_decision_note", lang)}: {r.decisionNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SubmitButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("lv_sending", lang) : t("lv_send", lang)}
    </Button>
  );
}
