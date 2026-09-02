"use client";

import { useState } from "react";
import { Input, Label, Select } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

/**
 * Adaigi ki shartein -- purchases/new aur bill ke safhe, dono par yehi
 * khane (255). Ek jagah rakhne se dono par ek jaise sawal rehte hain.
 *
 * Sirf khane hain, koi hisaab nahi: faisla server par parsePaymentTerms
 * karta hai.
 */
export function PaymentTermsFields({ defaultDays = 30 }: { defaultDays?: number }) {
  const lang = useLang();
  const [terms, setTerms] = useState<"paid" | "partial" | "credit">("credit");

  return (
    <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-800">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="pt">{t("pu_terms", lang)}</Label>
          <Select
            id="pt"
            name="payment_terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value as "paid" | "partial" | "credit")}
            className="w-full"
          >
            <option value="credit">{t("pu_terms_credit", lang)}</option>
            <option value="partial">{t("pu_terms_partial", lang)}</option>
            <option value="paid">{t("pu_terms_paid", lang)}</option>
          </Select>
        </div>

        {terms === "partial" && (
          <div>
            <Label htmlFor="pt-paid">{t("pu_paid_now", lang)}</Label>
            <Input id="pt-paid" name="paid_now" type="number" step="0.01" min="0" required />
          </div>
        )}

        {terms !== "paid" && (
          <>
            <div>
              <Label htmlFor="pt-days">{t("pu_credit_days", lang)}</Label>
              <Input id="pt-days" name="credit_days" type="number" min="0" step="1" defaultValue={defaultDays} />
            </div>
            <div>
              <Label htmlFor="pt-due">{t("pu_due_date", lang)}</Label>
              <Input id="pt-due" name="due_date" type="date" />
            </div>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-surface-500">{t("pu_terms_hint", lang)}</p>
    </div>
  );
}
