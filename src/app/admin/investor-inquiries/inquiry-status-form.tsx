"use client";

import { useFormState } from "react-dom";
import { updateInvestorInquiryStatus, type ActionState } from "@/actions/cms";
import { Select } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function InquiryStatusForm({ id, status }: { id: string; status: string }) {
  const [, formAction] = useFormState(updateInvestorInquiryStatus, initialState);
  const lang = useLang();
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Select name="status" defaultValue={status} onChange={(e) => e.target.form?.requestSubmit()}>
        <option value="new">{t("c_new", lang)}</option>
        <option value="read">{t("c_read", lang)}</option>
        <option value="responded">{t("c_responded", lang)}</option>
        <option value="closed">{t("ii_closed", lang)}</option>
      </Select>
    </form>
  );
}
