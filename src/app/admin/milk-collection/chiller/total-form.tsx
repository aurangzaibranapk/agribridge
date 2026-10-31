"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { saveChillerTotal, type ChillerTotalState } from "@/actions/milk-chiller-total";
import { formatPhone3, phoneLab } from "@/lib/milk-phone-lab";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: ChillerTotalState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
      {pending ? "..." : label}
    </button>
  );
}

export function ChillerTotalForm({
  lang,
  branchId,
  date,
  shift,
  chillerNo,
  grossL,
  fat,
  lr,
  snfConstant,
  referenceTs,
  ready,
}: {
  lang: Lang;
  branchId: string;
  date: string;
  shift: string;
  chillerNo: string;
  grossL: string;
  fat: string;
  lr: string;
  snfConstant: number;
  referenceTs: number;
  ready: boolean;
}) {
  const [state, action] = useFormState(saveChillerTotal, initial);
  const [editNo, setEditNo] = useState(false);
  const [no, setNo] = useState(chillerNo);
  const [gross, setGross] = useState(grossL);
  const [fatValue, setFat] = useState(fat);
  const [lrValue, setLr] = useState(lr);
  const lab = phoneLab(Number(gross), Number(fatValue), Number(lrValue), referenceTs, snfConstant);

  return (
    <form action={action} className="space-y-4" data-testid="chiller-total-form">
      <input type="hidden" name="branch_id" value={branchId} />
      <input type="hidden" name="entry_date" value={date} />
      <input type="hidden" name="shift" value={shift} />
      <input type="hidden" name="chiller_no" value={no} />

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-surface-700">
          <span className="text-surface-500">{t("ct_chiller", lang)}: </span>
          <span className="font-semibold text-surface-900" data-testid="chiller-no-label">{no || "—"}</span>
        </p>
        <button
          type="button"
          className="rounded-lg border border-surface-300 px-2 py-1 text-xs"
          onClick={() => setEditNo((open) => !open)}
        >
          {t("ct_edit_no", lang)}
        </button>
      </div>
      {editNo && (
        <label className="block text-sm">
          {t("ct_chiller_no", lang)}
          <input
            value={no}
            onChange={(event) => setNo(event.target.value)}
            maxLength={40}
            className="mt-1 w-full max-w-xs rounded-lg border border-surface-200 p-2"
            data-testid="chiller-no-input"
          />
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          {t("ct_gross", lang)}
          <input
            name="gross_liters"
            inputMode="decimal"
            value={gross}
            onChange={(event) => setGross(event.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-surface-200 p-2"
            data-testid="chiller-gross"
          />
        </label>
        <label className="text-sm">
          {t("ct_fat", lang)}
          <input
            name="fat_percentage"
            inputMode="decimal"
            value={fatValue}
            onChange={(event) => setFat(event.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-surface-200 p-2"
            data-testid="chiller-fat"
          />
        </label>
        <label className="text-sm">
          {t("ct_lr", lang)}
          <input
            name="lr"
            inputMode="decimal"
            value={lrValue}
            onChange={(event) => setLr(event.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-surface-200 p-2"
            data-testid="chiller-lr"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-50 p-3 text-sm" data-testid="chiller-lab">
        <p data-testid="chiller-snf"><span className="text-surface-500">SNF</span><br /><span className="text-lg font-semibold">{formatPhone3(lab?.snf)}</span></p>
        <p data-testid="chiller-ts"><span className="text-surface-500">TS</span><br /><span className="text-lg font-semibold">{formatPhone3(lab?.ts)}</span></p>
        <p data-testid="chiller-adj"><span className="text-surface-500">{t("ct_adjusted", lang)}</span><br /><span className="text-lg font-semibold">{formatPhone3(lab?.adjusted)}</span></p>
      </div>
      <p className="text-xs text-surface-500">
        {t("ct_phone_note", lang)}
        {lab ? ` ${t("ct_gravity", lang)} ${formatPhone3(lab.specificGravity)}. ${t("ct_kg", lang)} ${formatPhone3(lab.kilograms)}.` : ""}
      </p>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{state.message}</p>}
      {!ready && <p className="text-sm text-amber-800">{t("ct_migration", lang)}</p>}
      <Submit label={t("ct_save", lang)} />
    </form>
  );
}
