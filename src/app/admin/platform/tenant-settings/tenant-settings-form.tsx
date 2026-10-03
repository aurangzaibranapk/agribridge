"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateTenantSettings, type TenantSettingsState } from "@/actions/tenant-settings";

const initialState: TenantSettingsState = {};

export function TenantSettingsForm({ organization }: { organization: { name: string; brand_name: string | null; logo_url: string | null; primary_color: string; custom_domain: string | null } }) {
  const [state, action] = useFormState(updateTenantSettings, initialState);
  return (
    <form action={action} className="max-w-2xl space-y-5 rounded-2xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900">
      <div><label className="mb-1 block text-sm font-semibold">Brand name</label><input name="brand_name" required defaultValue={organization.brand_name ?? organization.name} className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-950" /></div>
      <div><label className="mb-1 block text-sm font-semibold">Logo URL</label><input name="logo_url" type="url" placeholder="https://..." defaultValue={organization.logo_url ?? ""} className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-950" /></div>
      <div><label className="mb-1 block text-sm font-semibold">Primary color</label><input name="primary_color" type="text" defaultValue={organization.primary_color} placeholder="#0f766e" className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-950" /></div>
      <div><label className="mb-1 block text-sm font-semibold">Custom domain</label><input name="custom_domain" type="text" placeholder="portal.example.com" defaultValue={organization.custom_domain ?? ""} className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-950" /><p className="mt-1 text-xs text-surface-500">DNS/hosting setup ke baad hi live hoga.</p></div>
      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Tenant settings save ho gayi hain.</p>}
      <SaveButton />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? "Saving..." : "Save tenant settings"}</button>;
}
