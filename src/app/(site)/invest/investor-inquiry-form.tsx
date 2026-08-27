"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitInvestorInquiry, type FormState } from "@/actions/public-forms";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";

const initialState: FormState = {};

export function InvestorInquiryForm() {
  const [state, formAction] = useFormState(submitInvestorInquiry, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Thank you — our team will reach out soon.</p>}
      <div><Label htmlFor="name">Full Name *</Label><Input id="name" name="name" required /></div>
      <div><Label htmlFor="phone">Phone / WhatsApp</Label><Input id="phone" name="phone" /></div>
      <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
      <div>
        <Label htmlFor="interest_type">Interested In</Label>
        <Select id="interest_type" name="interest_type" defaultValue="product_investment">
          <option value="product_investment">Product Investment</option>
          <option value="corporation_deal">Corporation Deal</option>
          <option value="dairy_investment">Dairy & Livestock</option>
          <option value="franchise">Franchise</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div><Label htmlFor="message">Message</Label><Textarea id="message" name="message" rows={3} /></div>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending..." : "Submit Inquiry"}</Button>;
}
