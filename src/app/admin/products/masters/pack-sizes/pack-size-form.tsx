"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Save, Trash2 } from "lucide-react";
import { savePackSize, deletePackSize, type UnitActionState } from "@/actions/units";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import type { UnitRow, PackSizeRow } from "@/lib/units";

const initial: UnitActionState = {};

function Btn({ label, icon, tone = "brand" }: { label: string; icon: React.ReactNode; tone?: "brand" | "red" }) {
  const { pending } = useFormStatus();
  const cls = tone === "brand" ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-red-600 text-white hover:bg-red-700";
  return (
    <button type="submit" disabled={pending} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${cls}`}>
      {icon} {pending ? "…" : label}
    </button>
  );
}

/** Pack size banana / badalna: label (5L), unit, miqdar, aliases (5 ltr, panch litre). */
export function PackSizeForm({ lang, pack, units }: { lang: Lang; pack?: PackSizeRow; units: UnitRow[] }) {
  const [state, action] = useFormState(savePackSize, initial);
  const [open, setOpen] = useState(!pack);
  return (
    <div>
      {pack && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-brand-700 hover:underline">
          {open ? t("un_close", lang) : t("un_edit", lang)}
        </button>
      )}
      {open && (
        <form action={action} className="mt-2 grid gap-2 rounded-lg border border-surface-200 p-3 text-sm sm:grid-cols-2 dark:border-surface-700">
          {pack && <input type="hidden" name="id" value={pack.id} />}
          {state.error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 sm:col-span-2">{state.error}</p>}
          {state.success && <p className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800 sm:col-span-2">{state.message}</p>}
          <div>
            <Label>{t("un_label", lang)} *</Label>
            <Input name="label" defaultValue={pack?.label ?? ""} placeholder="5L" required />
          </div>
          <div>
            <Label>{t("pf_unit", lang)}</Label>
            <Select name="unit_code" defaultValue={pack?.unit_code ?? ""}>
              <option value="">—</option>
              {units.map((u) => (
                <option key={u.code} value={u.code}>{u.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("un_quantity", lang)}</Label>
            <Input name="quantity" type="number" step="any" defaultValue={pack?.quantity ?? ""} placeholder="5" />
          </div>
          <div>
            <Label>{t("un_sort", lang)}</Label>
            <Input name="sort_order" type="number" defaultValue={pack?.sort_order ?? 100} />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("un_aliases", lang)}</Label>
            <Textarea name="aliases" rows={2} defaultValue={(pack?.aliases ?? []).join(", ")} placeholder="5 ltr, 5ltr, 5 litre, panch litre" />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="is_active" value="on" defaultChecked={pack ? pack.is_active : true} onChange={() => undefined} /> {t("un_active", lang)}
          </label>
          <div className="text-right">
            <Btn label={t("un_save", lang)} icon={<Save className="h-3.5 w-3.5" />} />
          </div>
        </form>
      )}
    </div>
  );
}

export function PackSizeDelete({ lang, id }: { lang: Lang; id: string }) {
  const [state, action] = useFormState(deletePackSize, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Btn label={t("un_delete", lang)} icon={<Trash2 className="h-3.5 w-3.5" />} tone="red" />
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
