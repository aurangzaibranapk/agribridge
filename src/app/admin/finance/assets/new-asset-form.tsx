"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createAsset, type AssetState } from "@/actions/assets";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Select, Label, Textarea, Button } from "@/components/ui/form";
import { Plus, AlertTriangle, Check, X } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AssetState = {};

interface Cat {
  id: string;
  name: string;
  life: number;
  method: string;
  rate: number | null;
}

/**
 * Naya asaasa.
 *
 * Qism chunte hi umar aur tareeqa khud bhar jate hain -- ye jaan boojh
 * kar hai. Har banda har dafa apni marzi ki umar likhne lage to ek hi
 * jaisi do gaariyan alag alag raftaar se ghisti hain, aur do saal baad
 * koi nahi bata sakta ke aisa kyun hua.
 */
export function NewAssetForm({
  lang,
  categories,
  accounts,
  suppliers,
}: {
  lang: Lang;
  categories: Cat[];
  accounts: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(createAsset, initial);
  const [open, setOpen] = useState(false);
  const aaj = new Date().toISOString().slice(0, 10);

  const [catId, setCatId] = useState("");
  const [method, setMethod] = useState("straight_line");
  const [life, setLife] = useState("60");
  const [rate, setRate] = useState("");
  const [funding, setFunding] = useState("cash");

  function pickCat(id: string) {
    setCatId(id);
    const c = categories.find((x) => x.id === id);
    if (c) {
      setLife(String(c.life));
      setMethod(c.method);
      setRate(c.rate === null ? "" : String(c.rate));
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> {t("fa_new", lang)}
        </Button>
        {state.success && state.message && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
            <Check className="h-4 w-4" /> {state.message}
          </span>
        )}
      </div>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">{t("fa_new", lang)}</p>
          <p className="mt-0.5 text-xs text-surface-500">{t("fa_new_hint", lang)}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="name">{t("fa_f_name", lang)}</Label>
          <Input id="name" name="name" required placeholder={t("fa_f_name_ph", lang)} />
        </div>

        <div>
          <Label htmlFor="category_id">{t("fa_f_cat", lang)}</Label>
          <Select id="category_id" name="category_id" required value={catId} onChange={(e) => pickCat(e.target.value)}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="acquired_on">{t("fa_f_bought", lang)}</Label>
          <Input id="acquired_on" name="acquired_on" type="date" required defaultValue={aaj} />
        </div>

        <div>
          <Label htmlFor="in_service_on">{t("fa_f_service", lang)}</Label>
          <Input id="in_service_on" name="in_service_on" type="date" defaultValue={aaj} />
          <p className="mt-1 text-xs text-surface-400">{t("fa_f_service_hint", lang)}</p>
        </div>

        <div>
          <Label htmlFor="cost">{t("fa_f_cost", lang)}</Label>
          <Input id="cost" name="cost" type="number" min="1" step="0.01" required />
        </div>

        <div>
          <Label htmlFor="salvage_value">{t("fa_f_salvage", lang)}</Label>
          <Input id="salvage_value" name="salvage_value" type="number" min="0" step="0.01" defaultValue="0" />
          <p className="mt-1 text-xs text-surface-400">{t("fa_f_salvage_hint", lang)}</p>
        </div>

        <div>
          <Label htmlFor="life_months">{t("fa_f_life", lang)}</Label>
          <Input id="life_months" name="life_months" type="number" min="1" max="1200" required value={life} onChange={(e) => setLife(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="method">{t("fa_f_method", lang)}</Label>
          <Select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="straight_line">{t("fa_m_sl", lang)}</option>
            <option value="reducing_balance">{t("fa_m_rb", lang)}</option>
          </Select>
        </div>

        {method === "reducing_balance" && (
          <div>
            <Label htmlFor="dep_rate">{t("fa_f_rate", lang)}</Label>
            <Input id="dep_rate" name="dep_rate" type="number" min="0.1" max="99.9" step="0.1" required value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
        )}

        <div>
          <Label htmlFor="funding">{t("fa_f_funding", lang)}</Label>
          <Select id="funding" name="funding" value={funding} onChange={(e) => setFunding(e.target.value)}>
            <option value="cash">{t("fa_fund_cash", lang)}</option>
            <option value="credit">{t("fa_fund_credit", lang)}</option>
            <option value="opening">{t("fa_fund_opening", lang)}</option>
          </Select>
        </div>

        {funding === "cash" && (
          <div>
            <Label htmlFor="finance_account_id">{t("fa_f_account", lang)}</Label>
            <Select id="finance_account_id" name="finance_account_id" required>
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {funding === "credit" && (
          <div>
            <Label htmlFor="supplier_id">{t("fa_f_supplier", lang)}</Label>
            <Select id="supplier_id" name="supplier_id">
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="serial_no">{t("fa_f_serial", lang)}</Label>
          <Input id="serial_no" name="serial_no" />
        </div>

        <div>
          <Label htmlFor="location">{t("fa_f_location", lang)}</Label>
          <Input id="location" name="location" />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <Label htmlFor="notes">{t("fa_f_notes", lang)}</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>

        <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
          <SubmitButton lang={lang} />
          <p className="text-xs text-surface-400">{t("fa_f_ledger_note", lang)}</p>
        </div>
      </form>
    </Card>
  );
}

function SubmitButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("fa_saving", lang) : t("fa_save", lang)}
    </Button>
  );
}
