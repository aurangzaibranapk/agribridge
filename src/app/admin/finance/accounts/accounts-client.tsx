"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveGlAccount, toggleGlAccount, transferAccountBalance, type GlAccountState } from "@/actions/gl-accounts";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Select, Label, Button } from "@/components/ui/form";
import { AlertTriangle, Check, Pencil, Plus, X } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: GlAccountState = {};

interface Acc {
  code: string;
  name: string;
  type: string;
  side: string;
  active: boolean;
  contra: boolean;
  sort: number;
  /** null = baqi mil hi nahi saka. Sifar se ALAG. */
  balance: number | null;
}

const GROUPS: { key: string; labelKey: "coa_g_asset" | "coa_g_liability" | "coa_g_equity" | "coa_g_income" | "coa_g_expense" }[] = [
  { key: "asset", labelKey: "coa_g_asset" },
  { key: "liability", labelKey: "coa_g_liability" },
  { key: "equity", labelKey: "coa_g_equity" },
  { key: "income", labelKey: "coa_g_income" },
  { key: "expense", labelKey: "coa_g_expense" },
];

export function AccountsClient({ lang, canEdit, accounts }: { lang: Lang; canEdit: boolean; accounts: Acc[] }) {
  const [state, formAction] = useFormState(saveGlAccount, initial);
  const [toggleState, toggleAction] = useFormState(toggleGlAccount, initial);
  const [moveState, moveAction] = useFormState(transferAccountBalance, initial);
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState<Acc | null>(null);
  const [creating, setCreating] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const open = creating || editing !== null;
  const rs = (n: number | null) => (n === null ? "—" : `Rs ${Math.round(n).toLocaleString()}`);

  return (
    <div className="space-y-4">
      {(state.error || toggleState.error || moveState.error) && (
        <Card className="flex items-start gap-2 border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error ?? toggleState.error ?? moveState.error}</span>
        </Card>
      )}
      {(state.success || toggleState.success || moveState.success) && (
        <Card className="flex items-start gap-2 border-emerald-200 bg-emerald-50 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message ?? toggleState.message ?? moveState.message}</span>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canEdit && !open && (
          <Button
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
            className="inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> {t("coa_new", lang)}
          </Button>
        )}
        {canEdit && !moving && (
          <Button variant="secondary" onClick={() => setMoving(true)}>
            {t("coa_move", lang)}
          </Button>
        )}
        <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          {t("coa_show_closed", lang)}
        </label>
      </div>

      {/* Khate "milana" -- magar purani qatarein utha kar nahi. Tafseel
          actions/gl-accounts.ts mein. */}
      {moving && (
        <Card className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">{t("coa_move", lang)}</p>
              <p className="mt-0.5 text-xs text-surface-500">{t("coa_move_hint", lang)}</p>
            </div>
            <button type="button" onClick={() => setMoving(false)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form action={moveAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="from_code">{t("coa_move_from", lang)}</Label>
              <Select id="from_code" name="from_code" required>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="to_code">{t("coa_move_to", lang)}</Label>
              <Select id="to_code" name="to_code" required>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="move_reason">{t("coa_move_reason", lang)}</Label>
              <Input id="move_reason" name="reason" required minLength={10} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-200">
                <input type="checkbox" name="close_source" />
                {t("coa_move_close", lang)}
              </label>
              <SaveButton lang={lang} />
            </div>
          </form>
        </Card>
      )}

      {open && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">
                {editing ? t("coa_edit", lang) : t("coa_new", lang)}
              </p>
              <p className="mt-0.5 text-xs text-surface-500">{t("coa_form_hint", lang)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="original_code" value={editing?.code ?? ""} />

            <div>
              <Label htmlFor="code">{t("coa_code", lang)}</Label>
              <Input
                id="code"
                name="code"
                required
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                defaultValue={editing?.code ?? ""}
                readOnly={editing !== null}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="acc_name">{t("coa_name", lang)}</Label>
              <Input id="acc_name" name="name" required defaultValue={editing?.name ?? ""} />
            </div>

            <div>
              <Label htmlFor="account_type">{t("coa_type", lang)}</Label>
              <Select id="account_type" name="account_type" required defaultValue={editing?.type ?? ""}>
                <option value="">—</option>
                {GROUPS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {t(g.labelKey, lang)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="normal_side">{t("coa_side", lang)}</Label>
              <Select id="normal_side" name="normal_side" required defaultValue={editing?.side ?? ""}>
                <option value="">—</option>
                <option value="debit">{t("coa_debit", lang)}</option>
                <option value="credit">{t("coa_credit", lang)}</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="sort_order">{t("coa_sort", lang)}</Label>
              <Input id="sort_order" name="sort_order" type="number" defaultValue={editing?.sort ?? 100} />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
                <input type="checkbox" name="is_contra" defaultChecked={editing?.contra ?? false} className="mt-1" />
                <span>
                  {t("coa_contra", lang)}
                  <span className="block text-xs text-surface-500">{t("coa_contra_hint", lang)}</span>
                </span>
              </label>
            </div>

            {editing && (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-amber-700 dark:text-amber-400">
                {t("coa_edit_warn", lang)}
              </p>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <SaveButton lang={lang} />
            </div>
          </form>
        </Card>
      )}

      {GROUPS.map((g) => {
        const rows = accounts.filter((a) => a.type === g.key && (showClosed || a.active));
        if (rows.length === 0) return null;
        return (
          <Card key={g.key} className="overflow-x-auto p-0">
            <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
              <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">{t(g.labelKey, lang)}</p>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
                <tr>
                  <th className="px-4 py-2">{t("coa_code", lang)}</th>
                  <th className="px-4 py-2">{t("coa_name", lang)}</th>
                  <th className="px-4 py-2">{t("coa_side", lang)}</th>
                  <th className="px-4 py-2 text-right">{t("coa_balance", lang)}</th>
                  {canEdit && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {rows.map((a) => (
                  <tr key={a.code} className={a.active ? "" : "opacity-50"}>
                    <td className="px-4 py-2 font-mono text-xs">{a.code}</td>
                    <td className="px-4 py-2 text-surface-900 dark:text-white">
                      {a.name}
                      {a.contra && <span className="ml-2 text-xs text-surface-400">({t("coa_contra_tag", lang)})</span>}
                      {!a.active && <span className="ml-2 text-xs text-surface-400">({t("coa_closed_tag", lang)})</span>}
                    </td>
                    <td className="px-4 py-2 text-surface-500">
                      {a.side === "debit" ? t("coa_debit", lang) : t("coa_credit", lang)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{rs(a.balance)}</td>
                    {canEdit && (
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(a);
                              setCreating(false);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-xs hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                          >
                            <Pencil className="h-3 w-3" /> {t("coa_edit", lang)}
                          </button>
                          <form action={toggleAction}>
                            <input type="hidden" name="code" value={a.code} />
                            <input type="hidden" name="active" value={a.active ? "0" : "1"} />
                            <button
                              type="submit"
                              className="rounded-lg border border-surface-200 px-2 py-1 text-xs hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                            >
                              {a.active ? t("coa_close", lang) : t("coa_reopen", lang)}
                            </button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("coa_note", lang)}</Card>
    </div>
  );
}

function SaveButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("coa_saving", lang) : t("coa_save", lang)}
    </Button>
  );
}
