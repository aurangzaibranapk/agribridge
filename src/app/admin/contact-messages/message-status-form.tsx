"use client";

import { useFormState } from "react-dom";
import { updateContactMessageStatus, type ActionState } from "@/actions/cms";
import { Select } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function MessageStatusForm({ id, status }: { id: string; status: string }) {
  const lang = useLang();
  const [, formAction] = useFormState(updateContactMessageStatus, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Select name="status" defaultValue={status} onChange={(e) => e.target.form?.requestSubmit()}>
        <option value="new">{t("at_new", lang)}</option>
        <option value="read">{t("at_read", lang)}</option>
        <option value="responded">{t("at_responded", lang)}</option>
        <option value="closed">{t("at_closed", lang)}</option>
      </Select>
    </form>
  );
}
