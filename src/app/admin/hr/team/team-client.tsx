"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ChevronRight, Users } from "lucide-react";
import { saveReportingLine, type AttState } from "@/actions/hr-attendance";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AttState = {};

interface Row {
  id: string;
  name: string;
  role: string;
  designation: string | null;
  departmentKey: string | null;
  departmentLabel: string | null;
  branchId: string | null;
  branchName: string | null;
  employmentType: string;
  reportsTo: string | null;
  reportsToName: string | null;
  directReports: number;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

export function TeamClient({
  lang,
  canEdit,
  rows,
  departments,
  branches,
}: {
  lang: Lang;
  canEdit: boolean;
  rows: Row[];
  departments: { key: string; label: string }[];
  branches: { id: string; name: string }[];
}) {
  const [state, action] = useFormState(saveReportingLine, initial);
  const [editing, setEditing] = useState<string | null>(null);

  // Darakht: jis ka afsar is fehrist mein nahi (ya hai hi nahi), wo jaR
  // par aata hai. Ghair maujood afsar ki wajah se koi banda gayab nahi
  // hota -- wo khamoshi se poori shakh chhupa deta.
  const { children, roots } = useMemo(() => {
    const ids = new Set(rows.map((r) => r.id));
    const children = new Map<string, Row[]>();
    const roots: Row[] = [];
    for (const r of rows) {
      if (r.reportsTo && ids.has(r.reportsTo)) {
        const list = children.get(r.reportsTo) ?? [];
        list.push(r);
        children.set(r.reportsTo, list);
      } else {
        roots.push(r);
      }
    }
    return { children, roots };
  }, [rows]);

  const withManager = rows.filter((r) => r.reportsTo).length;

  const renderNode = (r: Row, depth: number): React.ReactNode => (
    <div key={r.id} style={{ marginInlineStart: depth * 18 }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-100 py-1.5">
        {depth > 0 && <ChevronRight className="h-3 w-3 text-surface-300" />}
        <span className="font-medium">{r.name}</span>
        {r.designation && <span className="text-xs text-surface-500">{r.designation}</span>}
        {r.departmentLabel && <Badge tone="gray">{r.departmentLabel}</Badge>}
        {r.branchName && <span className="text-xs text-surface-400">{r.branchName}</span>}
        {r.directReports > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-surface-500">
            <Users className="h-3 w-3" /> {r.directReports}
          </span>
        )}
        {!r.reportsTo && <Badge tone="amber">{t("hrt_no_manager", lang)}</Badge>}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(editing === r.id ? null : r.id)}
            className="text-xs text-brand-700 underline"
          >
            {t("hrt_save", lang)}
          </button>
        )}
      </div>

      {canEdit && editing === r.id && (
        <form action={action} className="my-2 grid gap-2 rounded border border-brand-200 bg-brand-50/40 p-2 sm:grid-cols-2">
          <input type="hidden" name="profile_id" value={r.id} />
          <div>
            <Label htmlFor={`rt-${r.id}`}>{t("hrt_reports_to", lang)}</Label>
            <Select id={`rt-${r.id}`} name="reports_to" defaultValue={r.reportsTo ?? ""} className="w-full">
              <option value="">{t("hrt_no_manager", lang)}</option>
              {rows
                .filter((o) => o.id !== r.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`dept-${r.id}`}>{t("hrt_department", lang)}</Label>
            <Select id={`dept-${r.id}`} name="department_key" defaultValue={r.departmentKey ?? ""} className="w-full">
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`br-${r.id}`}>{t("hrt_branch", lang)}</Label>
            <Select id={`br-${r.id}`} name="branch_id" defaultValue={r.branchId ?? ""} className="w-full">
              <option value="">—</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`dg-${r.id}`}>{t("hrt_designation", lang)}</Label>
            <Input id={`dg-${r.id}`} name="designation" defaultValue={r.designation ?? ""} />
          </div>
          <div>
            <Label htmlFor={`et-${r.id}`}>{t("hrt_employment", lang)}</Label>
            <Select id={`et-${r.id}`} name="employment_type" defaultValue={r.employmentType} className="w-full">
              <option value="permanent">Permanent</option>
              <option value="contract">Contract</option>
              <option value="daily_wage">Daily wage</option>
              <option value="intern">Intern</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Submit label={t("hrt_save", lang)} />
          </div>
        </form>
      )}

      {(children.get(r.id) ?? []).map((c) => renderNode(c, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-3">
      {withManager === 0 && (
        <Card>
          <p className="text-sm text-amber-800">{t("hrt_no_reporting_yet", lang)}</p>
        </Card>
      )}

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.notice && <p className="text-sm text-emerald-700">{state.notice}</p>}

      <Card>
        <div className="overflow-x-auto">
          <div className="min-w-[32rem]">{roots.map((r) => renderNode(r, 0))}</div>
        </div>
      </Card>
    </div>
  );
}
