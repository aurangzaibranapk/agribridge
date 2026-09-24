"use client";
import { useFormState, useFormStatus } from "react-dom";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { Button, Input, Label, Select, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { saveRateCard, toggleRateCard, type RateCardState } from "@/actions/machinery-rate-card";

const initialState: RateCardState = {};

interface Row {
  id: string;
  crop_key: string | null;
  machine_type: string | null;
  harvest_type: "sabit" | "kutra";
  rate: number;
  effective_from: string;
  is_active: boolean;
  notes: string | null;
}

export function RateCardClient({
  cards,
  crops,
  canEdit,
}: {
  cards: Row[];
  crops: { key: string; label: string }[];
  canEdit: boolean;
}) {
  const lang = useLang();
  const today = new Date().toISOString().slice(0, 10);
  const cropName = (key: string | null) =>
    key === null ? t("mrc_any_crop", lang) : (crops.find((c) => c.key === key)?.label ?? key);

  return (
    <div className="space-y-4">
      {canEdit && <AddForm crops={crops} />}

      <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">{t("mrc_crop", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mrc_machine", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mrc_type", lang)}</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mrc_rate", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("mrc_from", lang)}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{cropName(c.crop_key)}</td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">
                  {c.machine_type ?? t("mrc_any_machine", lang)}
                </td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">
                  {c.harvest_type === "sabit" ? t("mh_sabit", lang) : t("mh_kutra", lang)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-surface-900 dark:text-white">
                  Rs {c.rate.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">
                  {c.effective_from}
                  {c.effective_from > today && (
                    <span className="ml-1 text-xs text-brand-600">({t("mrc_future", lang)})</span>
                  )}
                  {c.notes && <span className="block text-xs text-surface-400">{c.notes}</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {c.is_active ? <Badge tone="green">{t("mrc_active", lang)}</Badge> : <Badge tone="red">{t("mrc_stopped", lang)}</Badge>}
                  {canEdit && <ToggleButton id={c.id} active={c.is_active} />}
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-surface-400">
                  {t("mrc_empty", lang)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-surface-500">{t("mrc_history_note", lang)}</p>
    </div>
  );
}

function AddForm({ crops }: { crops: { key: string; label: string }[] }) {
  const lang = useLang();
  const [state, action] = useFormState(saveRateCard, initialState);

  return (
    <Card>
      <form action={action} className="space-y-3">
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {state.error}
          </p>
        )}
        {state.success && state.notice && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">
            {state.notice}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>{t("mrc_crop", lang)}</Label>
            <Select name="crop_key" defaultValue="">
              <option value="">{t("mrc_any_crop", lang)}</option>
              {crops.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("mrc_machine", lang)}</Label>
            <Input name="machine_type" placeholder={t("mrc_any_machine", lang)} />
          </div>
          <div>
            <Label>{t("mrc_type", lang)}</Label>
            <Select name="harvest_type" defaultValue="sabit">
              <option value="sabit">{t("mh_sabit", lang)}</option>
              <option value="kutra">{t("mh_kutra", lang)}</option>
            </Select>
          </div>
          <div>
            <Label>{t("mrc_rate", lang)}</Label>
            <Input type="number" name="rate" step="0.01" placeholder="0" />
          </div>
          <div>
            <Label>{t("mrc_from", lang)}</Label>
            <Input type="date" name="effective_from" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <Label>{t("mrc_notes", lang)}</Label>
            <Input name="notes" />
          </div>
        </div>

        <Submit label={t("mrc_add", lang)} />
      </form>
    </Card>
  );
}

function ToggleButton({ id, active }: { id: string; active: boolean }) {
  const lang = useLang();
  const [, action] = useFormState(toggleRateCard, initialState);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="ml-2 text-xs font-medium text-brand-600 hover:underline">
        {active ? t("mrc_stop", lang) : t("mrc_start", lang)}
      </button>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}
