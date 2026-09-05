"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { saveConflictRule, type AccessState } from "@/actions/access-requests";
import { Textarea, Label, Input, Select } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AccessState = {};

function SaveBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      <Save className="h-3.5 w-3.5" /> {pending ? "…" : label}
    </button>
  );
}

/** Rule badalna -- Owner/Admin. Duties JSON hi hai: code mein kuch nahi. */
export function RuleForm({ lang, rule }: { lang: Lang; rule: any }) {
  const [state, action] = useFormState(saveConflictRule, initial);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-brand-700 hover:underline">
        {open ? t("cfl_rule_close", lang) : t("cfl_rule_edit", lang)}
      </button>
      {open && (
        <form action={action} className="mt-2 grid gap-2 rounded-lg border border-surface-200 p-3 text-sm sm:grid-cols-2 dark:border-surface-700">
          <input type="hidden" name="id" value={rule.id} />
          {state.error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 sm:col-span-2">{state.error}</p>}
          {state.success && <p className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800 sm:col-span-2">{state.message}</p>}
          <div className="sm:col-span-2">
            <Label>Label</Label>
            <Input name="label" defaultValue={rule.label} />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("cfl_rule_desc", lang)}</Label>
            <Textarea name="description" rows={2} defaultValue={rule.description ?? ""} />
          </div>
          <div>
            <Label>Severity</Label>
            <Select name="severity" defaultValue={rule.severity}>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </Select>
          </div>
          <div>
            <Label>Enforcement</Label>
            <Select name="enforcement" defaultValue={rule.enforcement}>
              <option value="advise">advise (sirf batao)</option>
              <option value="override">override (Owner/Admin wajah ke sath)</option>
              <option value="block">block (koi nahi)</option>
            </Select>
          </div>
          {rule.kind === "sod" && (
            <>
              <div>
                <Label>{t("cfl_rule_min_scope", lang)}</Label>
                <Select name="min_scope" defaultValue={rule.min_scope}>
                  <option value="own_records">own_records</option>
                  <option value="own_shop">own_shop</option>
                  <option value="own_branch">own_branch</option>
                  <option value="all">all</option>
                </Select>
              </div>
              <div>
                <Label>{t("cfl_rule_narrow", lang)}</Label>
                <Select name="narrow_scope_severity" defaultValue={rule.narrow_scope_severity ?? ""}>
                  <option value="">— (takraao nahi)</option>
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Duties (JSON: [{"{"}label, features[], actions[]{"}"}])</Label>
                <Textarea name="duties" rows={5} className="font-mono text-xs" defaultValue={JSON.stringify(rule.duties ?? [], null, 1)} />
              </div>
            </>
          )}
          {rule.kind !== "sod" && (
            <div className="sm:col-span-2">
              <Label>Params (JSON, misal {"{"}&quot;threshold&quot;: 3{"}"})</Label>
              <Textarea name="params" rows={2} className="font-mono text-xs" defaultValue={JSON.stringify(rule.params ?? {}, null, 0)} />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label>{t("cfl_rule_reco", lang)}</Label>
            <Textarea name="recommendation" rows={2} defaultValue={rule.recommendation ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="is_active" defaultChecked={!!rule.is_active} /> {t("cfl_rule_active", lang)}
          </label>
          <div className="text-right">
            <SaveBtn label={t("cfl_rule_save", lang)} />
          </div>
        </form>
      )}
    </div>
  );
}
