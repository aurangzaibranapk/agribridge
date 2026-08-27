"use client";

import { useFormState } from "react-dom";
import { updateInvestorInquiryStatus, type ActionState } from "@/actions/cms";
import { Select } from "@/components/ui/form";

const initialState: ActionState = {};

export function InquiryStatusForm({ id, status }: { id: string; status: string }) {
  const [, formAction] = useFormState(updateInvestorInquiryStatus, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Select name="status" defaultValue={status} onChange={(e) => e.target.form?.requestSubmit()}>
        <option value="new">New</option>
        <option value="read">Read</option>
        <option value="responded">Responded</option>
        <option value="closed">Closed</option>
      </Select>
    </form>
  );
}
