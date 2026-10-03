"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitOrganizationSignup, type OrganizationSignupState } from "@/actions/organization-signup";

const initialState: OrganizationSignupState = {};

export function RequestOrganizationForm() {
  const [state, formAction] = useFormState(submitOrganizationSignup, initialState);
  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Request receive ho gayi. Hamari team aap se rabta karegi.</p>}
      <Field label="Company / business name" name="company_name" required />
      <Field label="Your full name" name="admin_name" required />
      <Field label="Email" name="admin_email" type="email" required />
      <Field label="Phone / WhatsApp" name="admin_phone" />
      <Field label="Custom domain (optional)" name="custom_domain" placeholder="erp.example.com" />
      <div><label htmlFor="subscription_plan" className="text-sm font-semibold">Preferred plan</label><select id="subscription_plan" name="subscription_plan" defaultValue="starter" className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm"><option value="starter">Starter</option><option value="business">Business</option><option value="enterprise">Enterprise</option></select></div>
      <input name="website_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <SubmitButton />
    </form>
  );
}

function Field({ label, name, type = "text", placeholder, required }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <div><label htmlFor={name} className="text-sm font-semibold">{label}</label><input id={name} name={name} type={type} placeholder={placeholder} required={required} className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></div>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-xl bg-[#102e4d] px-4 py-3 text-sm font-bold text-white hover:bg-[#173f66] disabled:opacity-60">{pending ? "Submitting..." : "Request AgriBridge OS"}</button>;
}

