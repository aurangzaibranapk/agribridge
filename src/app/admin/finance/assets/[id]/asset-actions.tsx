"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { disposeAsset, revalueAsset, type AssetState } from "@/actions/assets";
import { Card } from "@/components/ui/layout-primitives";
import { Input, Select, Label, Textarea, Button } from "@/components/ui/form";
import { AlertTriangle, Check, Scale, PackageX } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: AssetState = {};

/**
 * Do kaam jo asaase par ho sakte hain: kitab se kharij, aur dobara
 * qeemat.
 *
 * Dono band rehte hain jab tak banda khud na khole. Ye jaan boojh kar
 * hai -- ye rozana ke button nahi, aur inhen safhe par khula rakhna
 * ghalti se dabne ka darwaza kholta hai.
 */
export function AssetActions({
  lang,
  assetId,
  bookValue,
  accounts,
}: {
  lang: Lang;
  assetId: string;
  bookValue: number;
  accounts: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<"none" | "dispose" | "revalue">("none");
  const [dState, dAction] = useFormState(disposeAsset, initial);
  const [rState, rAction] = useFormState(revalueAsset, initial);
  const [type, setType] = useState("sale");
  const [proceeds, setProceeds] = useState("");
  const [newValue, setNewValue] = useState("");
  const aaj = new Date().toISOString().slice(0, 10);

  const rs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;
  const gainLoss = Math.round(((Number(proceeds) || 0) - bookValue) * 100) / 100;
  const farq = Math.round(((Number(newValue) || 0) - bookValue) * 100) / 100;

  return (
    <div className="space-y-3">
      {(dState.error || rState.error) && (
        <Card className="flex items-start gap-2 border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{dState.error ?? rState.error}</span>
        </Card>
      )}
      {(dState.success || rState.success) && (
        <Card className="flex items-start gap-2 border-emerald-200 bg-emerald-50 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{dState.message ?? rState.message}</span>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === "dispose" ? "primary" : "secondary"}
          onClick={() => setTab(tab === "dispose" ? "none" : "dispose")}
          className="inline-flex items-center gap-1.5"
        >
          <PackageX className="h-4 w-4" /> {t("fa_act_dispose", lang)}
        </Button>
        <Button
          variant={tab === "revalue" ? "primary" : "secondary"}
          onClick={() => setTab(tab === "revalue" ? "none" : "revalue")}
          className="inline-flex items-center gap-1.5"
        >
          <Scale className="h-4 w-4" /> {t("fa_act_revalue", lang)}
        </Button>
      </div>

      {tab === "dispose" && (
        <Card className="space-y-4">
          <p className="text-sm text-surface-500">{t("fa_d_hint", lang)}</p>
          <form action={dAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="asset_id" value={assetId} />

            <div>
              <Label htmlFor="disposed_on">{t("fa_d_date", lang)}</Label>
              <Input id="disposed_on" name="disposed_on" type="date" required defaultValue={aaj} max={aaj} />
            </div>

            <div>
              <Label htmlFor="disposal_type">{t("fa_d_type", lang)}</Label>
              <Select
                id="disposal_type"
                name="disposal_type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  if (e.target.value !== "sale") setProceeds("");
                }}
              >
                <option value="sale">{t("fa_d_sale", lang)}</option>
                <option value="scrap">{t("fa_d_scrap", lang)}</option>
                <option value="written_off">{t("fa_d_write", lang)}</option>
              </Select>
            </div>

            {type === "sale" && (
              <>
                <div>
                  <Label htmlFor="proceeds">{t("fa_d_proceeds", lang)}</Label>
                  <Input
                    id="proceeds"
                    name="proceeds"
                    type="number"
                    min="0"
                    step="0.01"
                    value={proceeds}
                    onChange={(e) => setProceeds(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="finance_account_id">{t("fa_d_account", lang)}</Label>
                  <Select id="finance_account_id" name="finance_account_id" required={Number(proceeds) > 0}>
                    <option value="">—</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="buyer_name">{t("fa_d_buyer", lang)}</Label>
                  <Input id="buyer_name" name="buyer_name" />
                </div>
              </>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="d_reason">{t("fa_d_reason", lang)}</Label>
              <Textarea id="d_reason" name="reason" rows={2} required={type !== "sale"} />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3">
              <SubmitButton lang={lang} />
              <p className="text-xs text-surface-500">
                {t("fa_d_book", lang)} {rs(bookValue)} ·{" "}
                <span className={gainLoss >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {gainLoss >= 0 ? t("fa_d_gain", lang) : t("fa_d_loss", lang)} {rs(Math.abs(gainLoss))}
                </span>
              </p>
            </div>
          </form>
        </Card>
      )}

      {tab === "revalue" && (
        <Card className="space-y-4">
          <p className="text-sm text-surface-500">{t("fa_r_hint", lang)}</p>
          <form action={rAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="asset_id" value={assetId} />

            <div>
              <Label htmlFor="revalued_on">{t("fa_r_date", lang)}</Label>
              <Input id="revalued_on" name="revalued_on" type="date" required defaultValue={aaj} max={aaj} />
            </div>

            <div>
              <Label htmlFor="new_carrying">{t("fa_r_new", lang)}</Label>
              <Input
                id="new_carrying"
                name="new_carrying"
                type="number"
                min="0"
                step="0.01"
                required
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="r_reason">{t("fa_r_reason", lang)}</Label>
              <Textarea id="r_reason" name="reason" rows={2} required placeholder={t("fa_r_reason_ph", lang)} />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3">
              <SubmitButton lang={lang} />
              <p className="text-xs text-surface-500">
                {t("fa_r_now", lang)} {rs(bookValue)}
                {newValue && (
                  <>
                    {" · "}
                    <span className={farq >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      {farq >= 0 ? "+" : "−"} {rs(Math.abs(farq))}
                    </span>
                  </>
                )}
              </p>
            </div>
          </form>
        </Card>
      )}
    </div>
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
