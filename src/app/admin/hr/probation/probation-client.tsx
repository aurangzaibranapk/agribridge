"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CalendarClock, Check, LogOut, Plus } from "lucide-react";
import { decideProbation, startProbation, type ProbState } from "@/actions/hr-probation";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: ProbState = {};

interface Due {
  id: string;
  name: string;
  designation: string | null;
  start: string | null;
  end: string | null;
  daysLeft: number | null;
  isOverdue: boolean | null;
  extensions: number | null;
  canExtend: boolean | null;
}

interface Person {
  id: string;
  name: string;
  designation: string | null;
  status: string | null;
  start: string | null;
  end: string | null;
  confirmedAt: string | null;
}

interface Review {
  profileId: string;
  decision: string;
  extendMonths: number | null;
  comment: string;
  oldEnd: string | null;
  newEnd: string | null;
  at: string;
}

function Submit({ label, icon, name, value }: { label: string; icon?: React.ReactNode; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name={name} value={value} disabled={pending} size="sm">
      <span className="inline-flex items-center gap-1">
        {icon} {pending ? "…" : label}
      </span>
    </Button>
  );
}

function Msg({ state }: { state: ProbState }) {
  if (state.error) return <p className="mt-2 text-xs text-red-700">{state.error}</p>;
  if (state.notice) return <p className="mt-2 text-xs text-emerald-700">{state.notice}</p>;
  return null;
}

const STATUS_TONE: Record<string, "green" | "amber" | "gray"> = {
  confirmed: "green",
  probation: "amber",
  ended: "gray",
};

export function ProbationClient({
  lang,
  canEdit,
  defaultMonths,
  maxMonths,
  due,
  people,
  reviews,
}: {
  lang: Lang;
  canEdit: boolean;
  defaultMonths: number;
  maxMonths: number;
  due: Due[];
  people: Person[];
  reviews: Review[];
}) {
  const [decState, decAction] = useFormState(decideProbation, initial);
  const [startState, startAction] = useFormState(startProbation, initial);
  const [openStart, setOpenStart] = useState(false);

  const statusLabel = (s: string | null) =>
    s === "confirmed"
      ? t("hrp_confirmed", lang)
      : s === "probation"
        ? t("hrp_probation", lang)
        : s === "ended"
          ? t("hrp_ended", lang)
          : "—";

  // Guzri hui tareekh sab se oopar. Wo qatarein jin par kaam ruka hua
  // hai, un ka pehle nazar aana hi is safhe ka maqsad hai.
  const sorted = [...due].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return (a.daysLeft ?? 0) - (b.daysLeft ?? 0);
  });

  const overdue = sorted.filter((d) => d.isOverdue).length;

  return (
    <div className="space-y-4">
      {overdue > 0 && (
        <Card>
          <p className="flex items-start gap-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{overdue}</strong> {t("hrp_overdue", lang)} — {t("hrp_overdue_note", lang)}
            </span>
          </p>
        </Card>
      )}

      {/* ---- Aazmaish shuru karna ---- */}
      {canEdit && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("hrp_start_probation", lang)}</h2>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpenStart(!openStart)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {openStart && (
            <form action={startAction} className="mt-2 grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Label htmlFor="pid">{t("hra_pick_person", lang)}</Label>
                <Select id="pid" name="profile_id" required className="w-full">
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {statusLabel(p.status)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="pstart">{t("hrp_start", lang)}</Label>
                <Input id="pstart" type="date" name="probation_start_date" required />
              </div>
              <div>
                <Label htmlFor="pm">{t("hrp_months", lang)}</Label>
                <Input id="pm" type="number" name="probation_months" min={1} max={maxMonths} defaultValue={defaultMonths} />
              </div>

              {/* Pakka hue bande ko wapas aazmaish par daalna us ki
                  chhutti khatam kar deta hai. Is liye alag nishan. */}
              <label className="flex items-start gap-2 text-xs text-surface-600 sm:col-span-3">
                <input type="checkbox" name="force_back" value="yes" className="mt-0.5" />
                <span>Ye banda pehle se pakka hai — phir bhi wapas aazmaish par daalein (us ki saalana chhutti khatam ho jayegi)</span>
              </label>

              <div className="flex items-end">
                <Submit label={t("hrp_start_probation", lang)} />
              </div>
              <div className="sm:col-span-4">
                <Msg state={startState} />
              </div>
            </form>
          )}
        </Card>
      )}

      {/* ---- Faisle ka intezar ---- */}
      <Card>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="h-4 w-4" /> {t("hrp_title", lang)}
        </h2>

        {sorted.length === 0 ? (
          <p className="text-sm text-surface-500">{t("hrp_nobody_due", lang)}</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((d) => (
              <div
                key={d.id}
                className={`rounded-lg border p-3 ${
                  d.isOverdue ? "border-red-300 bg-red-50/50" : "border-surface-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-surface-500">
                      {d.designation ?? "—"} · {t("hrp_start", lang)}: {d.start ?? "—"} · {t("hrp_end", lang)}: {d.end ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(d.extensions ?? 0) > 0 && (
                      <Badge tone="gray">
                        {d.extensions} {t("hrp_extensions", lang)}
                      </Badge>
                    )}
                    {d.isOverdue ? (
                      <Badge tone="red">{t("hrp_overdue", lang)}</Badge>
                    ) : (
                      <Badge tone="amber">
                        {d.daysLeft} {t("hrp_days_left", lang)}
                      </Badge>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <form action={decAction} className="mt-2 space-y-2">
                    <input type="hidden" name="profile_id" value={d.id} />
                    <Textarea name="comment" rows={2} placeholder={t("hra_manager_comment", lang)} required />

                    <div className="flex flex-wrap items-end gap-2">
                      {d.canExtend ? (
                        <>
                          <div>
                            <Label htmlFor={`em-${d.id}`}>{t("hrp_extend_months", lang)}</Label>
                            <Input
                              id={`em-${d.id}`}
                              type="number"
                              name="extend_months"
                              min={1}
                              max={12}
                              defaultValue={1}
                              className="w-24"
                            />
                          </div>
                          <Submit label={t("hrp_extend", lang)} name="decision" value="extend" />
                        </>
                      ) : (
                        <p className="text-xs text-amber-800">{t("hrp_cannot_extend", lang)}</p>
                      )}

                      <Submit label={t("hrp_confirm", lang)} icon={<Check className="h-3.5 w-3.5" />} name="decision" value="confirm" />
                      <Submit label={t("hrp_end_service", lang)} icon={<LogOut className="h-3.5 w-3.5" />} name="decision" value="end" />
                    </div>
                  </form>
                )}

                {/* Is bande ke pichhle faisle -- comment samet. */}
                {reviews.filter((r) => r.profileId === d.id).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {reviews
                      .filter((r) => r.profileId === d.id)
                      .map((r, i) => (
                        <li key={i} className="rounded bg-surface-50 p-1.5 text-[11px]">
                          <span className="font-semibold">{r.decision}</span>
                          {r.oldEnd && r.newEnd && r.oldEnd !== r.newEnd && (
                            <span className="text-surface-600">
                              {" "}
                              {r.oldEnd} → {r.newEnd}
                            </span>
                          )}
                          <span className="block text-surface-600">{r.comment}</span>
                          <span className="block text-surface-400">{new Date(r.at).toLocaleDateString("en-GB")}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <Msg state={decState} />
      </Card>

      {/* ---- Poori fehrist ---- */}
      <Card>
        <h2 className="mb-2 text-sm font-semibold">{t("hrp_status", lang)}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500">
                <th className="py-2">{t("hra_pick_person", lang)}</th>
                <th className="py-2">{t("hrt_designation", lang)}</th>
                <th className="py-2">{t("hrp_status", lang)}</th>
                <th className="py-2">{t("hrp_end", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-b border-surface-100">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="py-2 text-surface-600">{p.designation ?? "—"}</td>
                  <td className="py-2">
                    {p.status === null ? (
                      <span className="text-xs text-surface-400">— parha nahi ja saka</span>
                    ) : (
                      <Badge tone={STATUS_TONE[p.status] ?? "gray"}>{statusLabel(p.status)}</Badge>
                    )}
                  </td>
                  <td className="py-2 tabular-nums text-surface-600">
                    {p.status === "confirmed" ? p.confirmedAt ?? "—" : p.end ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
