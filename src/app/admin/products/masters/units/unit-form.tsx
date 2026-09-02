"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Save, Power, Trash2 } from "lucide-react";
import { saveUnit, toggleUnit, deleteUnit, type UnitActionState } from "@/actions/units";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import type { UnitRow } from "@/lib/units";

const initial: UnitActionState = {};

function Btn({ label, icon, tone = "brand", name, value }: { label: string; icon: React.ReactNode; tone?: "brand" | "gray" | "red"; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  const cls = tone === "brand" ? "bg-brand-600 text-white hover:bg-brand-700" : tone === "red" ? "bg-red-600 text-white hover:bg-red-700" : "bg-surface-100 text-surface-800 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-200";
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${cls}`}>
      {icon} {pending ? "…" : label}
    </button>
  );
}

/** Unit banana / badalna. Aliases comma se alag: bori, thaila, sack. */
export function UnitForm({ lang, unit, units }: { lang: Lang; unit?: UnitRow; units: UnitRow[] }) {
  const [state, action] = useFormState(saveUnit, initial);
  const [open, setOpen] = useState(!unit);
  return (
    <div>
      {unit && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-brand-700 hover:underline">
          {open ? t("un_close", lang) : t("un_edit", lang)}
        </button>
      )}
      {open && (
        <form action={action} className="mt-2 grid gap-2 rounded-lg border border-surface-200 p-3 text-sm sm:grid-cols-2 dark:border-surface-700">
          {state.error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 sm:col-span-2">{state.error}</p>}
          {state.success && <p className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800 sm:col-span-2">{state.message}</p>}
          <div>
            <Label>Code *</Label>
            <Input name="code" defaultValue={unit?.code ?? ""} placeholder="kg" required readOnly={!!unit} className={unit ? "bg-surface-50" : ""} />
          </div>
          <div>
            <Label>{t("un_kind", lang)}</Label>
            <Select name="kind" defaultValue={unit?.kind ?? "count"}>
              <option value="count">count (ginti)</option>
              <option value="weight">weight (wazan)</option>
              <option value="volume">volume (litre)</option>
              <option value="length">length</option>
              <option value="time">time</option>
              <option value="other">other</option>
            </Select>
          </div>
          <div>
            <Label>{t("un_label", lang)} *</Label>
            <Input name="label" defaultValue={unit?.label ?? ""} placeholder="Kilogram (kg)" required />
          </div>
          <div>
            <Label>Label (English)</Label>
            <Input name="label_en" defaultValue={unit?.label_en ?? ""} />
          </div>
          <div>
            <Label>{t("un_base", lang)}</Label>
            <Select name="base_code" defaultValue={unit?.base_code ?? ""}>
              <option value="">—</option>
              {units.map((u) => (
                <option key={u.code} value={u.code}>{u.code}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("un_factor", lang)}</Label>
            <Input name="factor" type="number" step="any" defaultValue={unit?.factor ?? ""} placeholder="1000 = 1 ton mein 1000 kg" />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("un_aliases", lang)}</Label>
            <Textarea name="aliases" rows={2} defaultValue={(unit?.aliases ?? []).join(", ")} placeholder="bag, bori, thaila, sack" />
          </div>
          <div>
            <Label>{t("un_sort", lang)}</Label>
            <Input name="sort_order" type="number" defaultValue={unit?.sort_order ?? 100} />
          </div>
          <div className="self-end text-right">
            <Btn label={t("un_save", lang)} icon={<Save className="h-3.5 w-3.5" />} />
          </div>
        </form>
      )}
    </div>
  );
}

export function UnitRowActions({ lang, unit }: { lang: Lang; unit: UnitRow }) {
  const [tState, toggle] = useFormState(toggleUnit, initial);
  const [dState, del] = useFormState(deleteUnit, initial);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={toggle}>
        <input type="hidden" name="code" value={unit.code} />
        <input type="hidden" name="active" value={unit.is_active ? "0" : "1"} />
        <Btn label={unit.is_active ? t("un_deactivate", lang) : t("un_activate", lang)} icon={<Power className="h-3.5 w-3.5" />} tone="gray" />
      </form>
      <form action={del}>
        <input type="hidden" name="code" value={unit.code} />
        <Btn label={t("un_delete", lang)} icon={<Trash2 className="h-3.5 w-3.5" />} tone="red" />
      </form>
      {(tState.error || dState.error) && <span className="text-xs text-red-700">{tState.error ?? dState.error}</span>}
    </div>
  );
}
