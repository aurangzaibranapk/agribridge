"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveAssetCategory, type AssetState } from "@/actions/assets";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Select, Label, Button } from "@/components/ui/form";
import { AlertTriangle, Check, Pencil, Plus, X } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AssetState = {};

interface Cat {
  id: string;
  name: string;
  asset_account: string;
  accum_account: string;
  expense_account: string;
  life: number;
  method: string;
  rate: number | null;
  used: number;
}

interface Acc {
  code: string;
  name: string;
  type: string;
}

export function CategoryClient({
  lang,
  canEdit,
  categories,
  accounts,
}: {
  lang: Lang;
  canEdit: boolean;
  categories: Cat[];
  accounts: Acc[];
}) {
  const [state, formAction] = useFormState(saveAssetCategory, initial);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [creating, setCreating] = useState(false);
  const [method, setMethod] = useState("straight_line");

  const assetAccounts = accounts.filter((a) => a.type === "asset");
  const expenseAccounts = accounts.filter((a) => a.type === "expense");
  const open = creating || editing !== null;

  function startEdit(c: Cat) {
    setEditing(c);
    setCreating(false);
    setMethod(c.method);
  }

  return (
    <div className="space-y-4">
      {state.error && (
        <Card className="flex items-start gap-2 border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </Card>
      )}
      {state.success && state.message && (
        <Card className="flex items-start gap-2 border-emerald-200 bg-emerald-50 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </Card>
      )}

      {canEdit && !open && (
        <Button
          onClick={() => {
            setCreating(true);
            setEditing(null);
            setMethod("straight_line");
          }}
          className="inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> {t("fa_cat_new", lang)}
        </Button>
      )}

      {open && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between">
            <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">
              {editing ? t("fa_cat_edit", lang) : t("fa_cat_new", lang)}
            </p>
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
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <div>
              <Label htmlFor="cat_name">{t("fa_cat_name", lang)}</Label>
              <Input id="cat_name" name="name" required defaultValue={editing?.name ?? ""} />
            </div>

            <div>
              <Label htmlFor="asset_account">{t("fa_cat_asset_acc", lang)}</Label>
              <Select id="asset_account" name="asset_account" required defaultValue={editing?.asset_account ?? ""}>
                <option value="">—</option>
                {assetAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="accum_account">{t("fa_cat_accum_acc", lang)}</Label>
              <Select id="accum_account" name="accum_account" required defaultValue={editing?.accum_account ?? "1390"}>
                <option value="">—</option>
                {assetAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="expense_account">{t("fa_cat_exp_acc", lang)}</Label>
              <Select id="expense_account" name="expense_account" required defaultValue={editing?.expense_account ?? "6200"}>
                <option value="">—</option>
                {expenseAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="default_life_months">{t("fa_cat_life", lang)}</Label>
              <Input
                id="default_life_months"
                name="default_life_months"
                type="number"
                min="1"
                max="1200"
                required
                defaultValue={editing?.life ?? 60}
              />
            </div>

            <div>
              <Label htmlFor="default_method">{t("fa_f_method", lang)}</Label>
              <Select id="default_method" name="default_method" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="straight_line">{t("fa_m_sl", lang)}</option>
                <option value="reducing_balance">{t("fa_m_rb", lang)}</option>
              </Select>
            </div>

            {method === "reducing_balance" && (
              <div>
                <Label htmlFor="default_rate">{t("fa_f_rate", lang)}</Label>
                <Input
                  id="default_rate"
                  name="default_rate"
                  type="number"
                  min="0.1"
                  max="99.9"
                  step="0.1"
                  required
                  defaultValue={editing?.rate ?? ""}
                />
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <SaveButton lang={lang} />
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
            <tr>
              <th className="px-4 py-3">{t("fa_cat_name", lang)}</th>
              <th className="px-4 py-3">{t("fa_cat_asset_acc", lang)}</th>
              <th className="px-4 py-3">{t("fa_cat_exp_acc", lang)}</th>
              <th className="px-4 py-3 text-right">{t("fa_cat_life", lang)}</th>
              <th className="px-4 py-3">{t("fa_f_method", lang)}</th>
              <th className="px-4 py-3 text-right">{t("fa_cat_used", lang)}</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.asset_account}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.expense_account}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.life}</td>
                <td className="px-4 py-3">
                  {c.method === "straight_line" ? t("fa_m_sl", lang) : `${t("fa_m_rb", lang)} ${c.rate ?? "—"}%`}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{c.used}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-xs hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                    >
                      <Pencil className="h-3 w-3" /> {t("fa_cat_edit", lang)}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("fa_cat_note", lang)}</Card>
    </div>
  );
}

function SaveButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("fa_saving", lang) : t("fa_save", lang)}
    </Button>
  );
}
