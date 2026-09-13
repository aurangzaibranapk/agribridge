"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Lightbulb, Users, ExternalLink, Save, MessageSquare } from "lucide-react";
import { submitSuggestionForm, updateSuggestionStatus, addSuggestionComment, type SuggestionState } from "@/actions/suggestions";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const initial: SuggestionState = {};

export interface Row {
  id: string;
  number: string;
  title: string;
  problem: string | null;
  improvement: string | null;
  category: string;
  priority: string;
  status: string;
  department: string | null;
  featureKey: string | null;
  pageRoute: string | null;
  evidenceUrl: string | null;
  duplicateOf: string | null;
  implementedVersion: string | null;
  implementedAt: string | null;
  relatedLink: string | null;
  createdAt: string;
  submittedBy: string;
  mine: boolean;
  reportedBy: number;
}

const STATUS_KEYS: Record<string, TranslationKey> = {
  new: "sg_s_new", under_review: "sg_s_under_review", accepted: "sg_s_accepted", planned: "sg_s_planned",
  in_development: "sg_s_in_development", implemented: "sg_s_implemented", rejected: "sg_s_rejected", duplicate: "sg_s_duplicate",
};
const STATUS_TONE: Record<string, "red" | "amber" | "blue" | "green" | "gray"> = {
  new: "amber", under_review: "blue", accepted: "blue", planned: "blue", in_development: "blue", implemented: "green", rejected: "gray", duplicate: "gray",
};
const CAT_KEYS: Record<string, TranslationKey> = {
  new_feature: "sg_c_new_feature", improvement: "sg_c_improvement", process_problem: "sg_c_process", ui_ux: "sg_c_ui",
  bug: "sg_c_bug", automation: "sg_c_automation", ai_improvement: "sg_c_ai", report: "sg_c_report", training_help: "sg_c_training", other: "sg_c_other",
};
const OPEN = new Set(["new", "under_review", "accepted", "planned", "in_development"]);

function Submit({ label, icon }: { label: string; icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <span className="inline-flex items-center gap-1.5">{icon} {pending ? "…" : label}</span>
    </Button>
  );
}

export function CenterClient({
  lang,
  canReview,
  myDepartment,
  statusFilter,
  selectedId,
  features,
  rows,
  comments,
}: {
  lang: Lang;
  canReview: boolean;
  myDepartment: string | null;
  statusFilter: string;
  selectedId: string | null;
  features: { key: string; label: string; route: string }[];
  rows: Row[];
  comments: { id: string; kind: string; body: string; at: string; by: string }[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [newState, newAction] = useFormState(submitSuggestionForm, initial);
  const [stState, stAction] = useFormState(updateSuggestionStatus, initial);
  const [cmState, cmAction] = useFormState(addSuggestionComment, initial);
  const [status, setStatus] = useState("under_review");

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const shown = rows.filter((r) => (statusFilter === "open" ? OPEN.has(r.status) : statusFilter === "all" ? true : r.status === statusFilter));
  const sel = rows.find((r) => r.id === selectedId) ?? null;
  const byNumber = new Map(rows.map((r) => [r.id, r.number]));

  const tabs: { key: string; label: string; n: number }[] = [
    { key: "open", label: t("sg_open", lang), n: rows.filter((r) => OPEN.has(r.status)).length },
    ...Object.keys(STATUS_KEYS).map((k) => ({ key: k, label: t(STATUS_KEYS[k], lang), n: counts[k] ?? 0 })),
    { key: "all", label: t("sg_all", lang), n: rows.length },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((tb) => (
          <Link key={tb.key} href={`/admin/improvements?s=${tb.key}${selectedId ? `&id=${selectedId}` : ""}`} className={`rounded-full px-3 py-1 text-xs ${statusFilter === tb.key ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300"}`}>
            {tb.label} <span className="tabular-nums opacity-80">{tb.n}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setShowNew((v) => !v)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600">
          <Lightbulb className="h-3.5 w-3.5" /> {t("sg_new", lang)}
        </button>
      </div>

      {showNew && (
        <Card>
          <p className="mb-2 text-sm text-surface-600">{t("sg_new_hint", lang)}</p>
          {newState.error && <p className="mb-2 text-sm text-red-600">{newState.error}</p>}
          {newState.success && <p className="mb-2 text-sm text-emerald-700">{t("sg_submitted", lang).replace("{n}", newState.number ?? "")}</p>}
          <form action={newAction} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t("sg_f_title", lang)} *</Label>
              <Input name="title" required />
            </div>
            <div>
              <Label>{t("sg_f_category", lang)}</Label>
              <Select name="category" defaultValue="improvement">
                {Object.keys(CAT_KEYS).map((k) => (
                  <option key={k} value={k}>{t(CAT_KEYS[k], lang)}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t("sg_f_priority", lang)}</Label>
              <Select name="priority" defaultValue="medium">
                <option value="low">{t("sg_p_low", lang)}</option>
                <option value="medium">{t("sg_p_medium", lang)}</option>
                <option value="high">{t("sg_p_high", lang)}</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("sg_f_feature", lang)}</Label>
              <Select name="feature_key" defaultValue="">
                <option value="">—</option>
                {features.map((f) => (
                  <option key={f.key} value={f.key}>{f.label} · {f.route}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t("sg_f_problem", lang)}</Label>
              <Textarea name="problem" rows={3} />
            </div>
            <div>
              <Label>{t("sg_f_improvement", lang)}</Label>
              <Textarea name="improvement" rows={3} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("sg_f_evidence", lang)}</Label>
              <Input name="evidence_url" placeholder="https://" />
            </div>
            <div className="sm:col-span-2">
              <Submit label={t("sg_submit", lang)} icon={<Lightbulb className="h-4 w-4" />} />
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-5">
        <Card className={`overflow-hidden p-0 ${sel ? "lg:col-span-2" : "lg:col-span-5"}`}>
          {shown.length === 0 ? (
            <p className="p-4 text-sm text-surface-500">{t("sg_empty", lang)}</p>
          ) : (
            <ul className="divide-y divide-surface-100 dark:divide-surface-800">
              {shown.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/improvements?s=${statusFilter}&id=${r.id}`} className={`block px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800 ${r.id === selectedId ? "bg-brand-50 dark:bg-brand-950/30" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-surface-400">{r.number}</span>
                      <Badge tone={STATUS_TONE[r.status] ?? "gray"}>{t(STATUS_KEYS[r.status] ?? "sg_s_new", lang)}</Badge>
                      {r.priority === "high" && <Badge tone="red">{t("sg_p_high", lang)}</Badge>}
                      {r.reportedBy > 1 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          <Users className="h-3 w-3" /> {t("sg_reported_by", lang).replace("{n}", String(r.reportedBy))}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-surface-800 dark:text-surface-200">{r.title}</p>
                    <p className="text-[11px] text-surface-400">
                      {t(CAT_KEYS[r.category] ?? "sg_c_other", lang)} · {r.department ?? "—"} · {r.submittedBy} · {new Date(r.createdAt).toLocaleDateString("en-GB")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {sel && (
          <div className="space-y-3 lg:col-span-3">
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-surface-400">{sel.number}</span>
                <Badge tone={STATUS_TONE[sel.status] ?? "gray"}>{t(STATUS_KEYS[sel.status] ?? "sg_s_new", lang)}</Badge>
                <Badge tone="gray">{t(CAT_KEYS[sel.category] ?? "sg_c_other", lang)}</Badge>
                <Badge tone={sel.priority === "high" ? "red" : sel.priority === "low" ? "gray" : "amber"}>{t(sel.priority === "high" ? "sg_p_high" : sel.priority === "low" ? "sg_p_low" : "sg_p_medium", lang)}</Badge>
                {sel.reportedBy > 1 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    <Users className="h-3 w-3" /> {t("sg_reported_by", lang).replace("{n}", String(sel.reportedBy))}
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-display text-lg font-semibold text-surface-900 dark:text-white">{sel.title}</h2>
              <p className="text-xs text-surface-500">
                {sel.submittedBy} · {sel.department ?? "—"} · {new Date(sel.createdAt).toLocaleString("en-GB")}
                {sel.pageRoute && (
                  <>
                    {" · "}
                    <Link href={sel.pageRoute} className="text-brand-600 underline">{sel.pageRoute}</Link>
                  </>
                )}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-surface-400">{t("sg_f_problem", lang)}</p>
                  <p className="whitespace-pre-line text-surface-700 dark:text-surface-300">{sel.problem ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-surface-400">{t("sg_f_improvement", lang)}</p>
                  <p className="whitespace-pre-line text-surface-700 dark:text-surface-300">{sel.improvement ?? "—"}</p>
                </div>
              </div>
              {sel.evidenceUrl && (
                <a href={sel.evidenceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 underline">
                  <ExternalLink className="h-3.5 w-3.5" /> {t("sg_f_evidence", lang)}
                </a>
              )}
              {sel.duplicateOf && (
                <p className="mt-2 text-xs text-surface-500">
                  {t("sg_dup_of", lang)}{" "}
                  <Link href={`/admin/improvements?s=all&id=${sel.duplicateOf}`} className="font-mono text-brand-600 underline">{byNumber.get(sel.duplicateOf) ?? sel.duplicateOf}</Link>
                </p>
              )}
              {sel.status === "implemented" && (
                <p className="mt-2 text-xs text-emerald-700">
                  {t("sg_s_implemented", lang)}: {sel.implementedVersion ?? "—"} · {sel.implementedAt ? new Date(sel.implementedAt).toLocaleDateString("en-GB") : "—"}
                  {sel.relatedLink && (
                    <>
                      {" · "}
                      <a href={sel.relatedLink} className="underline" target="_blank" rel="noreferrer">{t("sg_related", lang)}</a>
                    </>
                  )}
                </p>
              )}
            </Card>

            {canReview && (
              <Card>
                <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("sg_decide", lang)}</h3>
                {stState.error && <p className="mb-2 text-sm text-red-600">{stState.error}</p>}
                {stState.success && <p className="mb-2 text-sm text-emerald-700">{t("hp_saved", lang)}</p>}
                <form action={stAction} className="grid gap-2 sm:grid-cols-2" key={sel.id}>
                  <input type="hidden" name="id" value={sel.id} />
                  <div>
                    <Label>{t("sg_status", lang)}</Label>
                    <Select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                      {Object.keys(STATUS_KEYS).map((k) => (
                        <option key={k} value={k}>{t(STATUS_KEYS[k], lang)}</option>
                      ))}
                    </Select>
                  </div>
                  {status === "duplicate" && (
                    <div>
                      <Label>{t("sg_dup_of", lang)} (SUG-…)</Label>
                      <Input name="duplicate_of" placeholder="SUG-2026-00001" required />
                    </div>
                  )}
                  {status === "implemented" && (
                    <>
                      <div>
                        <Label>{t("sg_version", lang)}</Label>
                        <Input name="implemented_version" placeholder="v2026.09" />
                      </div>
                      <div>
                        <Label>{t("sg_related", lang)}</Label>
                        <Input name="related_link" placeholder="/admin/… ya commit" />
                      </div>
                    </>
                  )}
                  <div className="sm:col-span-2">
                    <Label>{t("sg_note", lang)}</Label>
                    <Textarea name="note" rows={2} required={status === "rejected"} />
                  </div>
                  <div className="sm:col-span-2">
                    <Submit label={t("sg_save_status", lang)} icon={<Save className="h-4 w-4" />} />
                  </div>
                </form>
              </Card>
            )}

            <Card>
              <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("sg_history", lang)}</h3>
              <ul className="space-y-1.5 text-sm">
                {comments.map((c) => (
                  <li key={c.id} className={`rounded-lg px-3 py-1.5 ${c.kind === "comment" ? "bg-surface-50 dark:bg-surface-800" : "bg-brand-50 text-brand-900 dark:bg-brand-950/30 dark:text-brand-200"}`}>
                    <span className="text-[11px] text-surface-400">{c.by} · {new Date(c.at).toLocaleString("en-GB")}</span>
                    <p>{c.body}</p>
                  </li>
                ))}
                {comments.length === 0 && <li className="text-xs text-surface-400">—</li>}
              </ul>
              {cmState.error && <p className="mt-2 text-xs text-red-600">{cmState.error}</p>}
              <form action={cmAction} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={sel.id} />
                <Input name="body" placeholder={t("sg_comment_ph", lang)} required className="flex-1" />
                <Submit label={t("sg_comment", lang)} icon={<MessageSquare className="h-4 w-4" />} />
              </form>
            </Card>
          </div>
        )}
      </div>
      {myDepartment && !canReview && <p className="text-[11px] text-surface-400">{t("sg_my_dept", lang)}: {myDepartment}</p>}
    </div>
  );
}
