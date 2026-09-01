"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitInvestorInquiry, type FormState } from "@/actions/public-forms";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: FormState = {};

export function InvestorInquiryForm() {
  const lang = useLang();
  const [state, formAction] = useFormState(submitInvestorInquiry, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("sp_inquiry_thanks", lang)}</p>}
      <div><Label htmlFor="name">{t("sp_full_name_req", lang)}</Label><Input id="name" name="name" required /></div>
      <div><Label htmlFor="phone">{t("sp_phone_wa", lang)}</Label><Input id="phone" name="phone" /></div>
      <div><Label htmlFor="email">{t("sp_email", lang)}</Label><Input id="email" name="email" type="email" /></div>
      <div>
        <Label htmlFor="interest_type">{t("sp_interested_in", lang)}</Label>
        <Select id="interest_type" name="interest_type" defaultValue="product_investment">
          <option value="product_investment">{t("sh_product_investment", lang)}</option>
          <option value="corporation_deal">{t("sh_corporation_deal", lang)}</option>
          <option value="dairy_investment">{t("sh_dairy_livestock", lang)}</option>
          <option value="franchise">{t("sh_franchise", lang)}</option>
          <option value="other">{t("sp_other", lang)}</option>
        </Select>
      </div>
      <div><Label htmlFor="message">{t("sp_message", lang)}</Label><Textarea id="message" name="message" rows={3} /></div>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending..." : "Submit Inquiry"}</Button>;
}
