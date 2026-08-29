"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { applyFatAction, applyFatToBatch, recordChillerReceipt, type ActionState } from "@/actions/milk-chiller";
import { NO_ROUTE } from "@/lib/milk-collection";
import { Droplet, AlertTriangle, ImageIcon } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initial: ActionState = {};

export interface PendingEntry {
  id: string;
  collection_number: string;
  farmer_label: string;
  liters: number;
  lr: number | null;
  channel: string;
  collectionSource: string;
  lr_url: string | null;
  flags: string[];
}

export interface RouteGroup {
  route: string;
  entries: PendingEntry[];
  liters: number;
  /** Pehle se darj shuda chiller receipt, agar hai. */
  received: number | null;
  shortageLiters: number | null;
  redAlert: boolean;
}

function Notice({ state }: { state: ActionState }) {
  if (state.error) return <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.message) return <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>;
  return null;
}

function Submit({ label, tone = "brand" }: { label: string; tone?: "brand" | "surface" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
        tone === "brand" ? "bg-brand-600 text-white" : "border border-surface-300 text-surface-700"
      }`}
    >
      {pending ? "..." : label}
    </button>
  );
}

/** Ek entry par FAT. */
function EntryRow({ entry }: { entry: PendingEntry }) {
  const lang = useLang();
  const [state, action] = useFormState(applyFatAction, initial);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-surface-900 dark:text-white">{entry.farmer_label}</p>
          <p className="text-xs text-surface-500">
            {entry.liters} L{entry.lr != null && ` • LR ${entry.lr}`} • {entry.collection_number}
          </p>
          {entry.flags.map((f) => (
            <p key={f} className="mt-0.5 text-xs text-amber-700">⚠️ {f}</p>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {entry.lr_url && (
            <a
              href={entry.lr_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs text-surface-600"
            >
              <ImageIcon className="h-3 w-3" /> LR
            </a>
          )}
          <form action={action} className="flex items-center gap-2">
            <input type="hidden" name="entry_id" value={entry.id} />
            <input
              name="fat_percentage"
              type="number"
              step="0.1"
              min={0}
              max={15}
              placeholder="FAT"
              className="w-20 rounded-lg border border-surface-200 p-2 text-sm"
            />
            <Submit label={t("mk_apply", lang)} />
          </form>
        </div>
      </div>
      <Notice state={state} />
    </li>
  );
}

/** Poore route par ek hi FAT. */
function BatchFat({ route, date, shift }: { route: string; date: string; shift: string }) {
  const lang = useLang();
  const [state, action] = useFormState(applyFatToBatch, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="route_name" value={route} />
      <input type="hidden" name="entry_date" value={date} />
      <input type="hidden" name="shift" value={shift} />
      <input
        name="fat_percentage"
        type="number"
        step="0.1"
        min={0}
        max={15}
        placeholder="FAT"
        className="w-20 rounded-lg border border-surface-200 p-2 text-sm"
      />
      <Submit label={t("mk_apply_to_all", lang)} tone="surface" />
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.message && <span className="text-xs text-green-700">{state.message}</span>}
    </form>
  );
}

function ChillerReceipt({
  group,
  date,
  shift,
}: {
  group: RouteGroup;
  date: string;
  shift: string;
}) {
  const lang = useLang();
  const [state, action] = useFormState(recordChillerReceipt, initial);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="route_name" value={group.route} />
      <input type="hidden" name="entry_date" value={date} />
      <input type="hidden" name="shift" value={shift} />
      <div>
        <label className="text-xs text-surface-500">{t("mk_arrived_at_chiller", lang)}</label>
        <input
          name="chiller_received_volume"
          type="number"
          step="0.1"
          min={0}
          defaultValue={group.received ?? ""}
          className="mt-1 w-32 rounded-lg border border-surface-200 p-2 text-sm"
        />
      </div>
      <Submit label={t("mk_record", lang)} tone="surface" />
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.message && <span className="text-xs text-surface-700">{state.message}</span>}
    </form>
  );
}

export function ChillerClient({
  groups,
  date,
  shift,
}: {
  groups: RouteGroup[];
  date: string;
  shift: string;
}) {
  const lang = useLang();
  const [open, setOpen] = useState<string | null>(groups[0]?.route ?? null);

  if (groups.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-white p-8 text-center text-sm text-surface-400 dark:border-surface-800 dark:bg-surface-900">
        {t("mk_no_milk_this_shift", lang)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const expanded = open === group.route;
        return (
          <div
            key={group.route}
            className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900"
          >
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : group.route)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                <Droplet className="h-4 w-4 text-brand-600" />
                {group.route === NO_ROUTE ? t("mk_no_route", lang) : group.route}
              </span>
              <span className="flex items-center gap-2 text-xs text-surface-500">
                {group.entries.length} {t("mk_entries", lang)} • {Math.round(group.liters * 10) / 10} L
                {group.redAlert && <AlertTriangle className="h-4 w-4 text-red-600" />}
              </span>
            </button>

            {expanded && (
              <div className="border-t border-surface-200 dark:border-surface-800">
                <div className="border-b border-surface-100 bg-surface-50 px-4 py-3 dark:border-surface-800 dark:bg-surface-800/40">
                  <BatchFat route={group.route} date={date} shift={shift} />
                  <p className="mt-1 text-xs text-surface-500">
                    {t("mk_batch_fat_note", lang)}
                  </p>

                  <ChillerReceipt group={group} date={date} shift={shift} />
                  {group.shortageLiters != null && (
                    <p className={`mt-1 text-xs ${group.redAlert ? "text-red-700" : "text-surface-600"}`}>
                      {t("mk_field", lang)} {Math.round(group.liters * 10) / 10} L → {t("mk_chiller", lang)} {group.received} L ={" "}
                      {group.shortageLiters > 0 ? t("mk_shortage", lang) : t("mk_excess", lang)} {Math.abs(group.shortageLiters)} L
                      {group.redAlert && ` ${t("mk_over_limit", lang)}`}
                    </p>
                  )}
                </div>

                {group.entries.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-surface-400">{t("mk_route_all_fat_done", lang)}</p>
                ) : (
                  <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                    {group.entries.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
