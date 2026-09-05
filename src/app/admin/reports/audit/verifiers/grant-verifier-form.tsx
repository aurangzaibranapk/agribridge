"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { grantLossVerifier, type ActionState } from "@/actions/stock-loss";
import { UserPlus } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Staff {
  id: string;
  name: string;
  role: string | null;
}
interface Shop {
  id: string;
  name: string;
}

export function GrantVerifierForm({ staff, shops }: { staff: Staff[]; shops: Shop[] }) {
  const [state, formAction] = useFormState(grantLossVerifier, initialState);
  const lang = useLang();
  const [profileId, setProfileId] = useState("");
  const [shopId, setShopId] = useState("");

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 flex items-center gap-1.5 font-display text-base font-semibold text-surface-900 dark:text-white">
        <UserPlus className="h-4 w-4" />{t("at_give_verify_permission", lang)}</h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{t("rv_permission_granted", lang)}</p>}
      <form action={formAction} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select name="profile_id" value={profileId} onChange={(e) => setProfileId(e.target.value)} required className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">- Staff Select Karein -</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
          ))}
        </select>
        <select name="shop_id" value={shopId} onChange={(e) => setShopId(e.target.value)} className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">{t("rv_all_shops", lang)}</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>{s.name} (sirf ye Shop)</option>
          ))}
        </select>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Permission Dein"}</button>;
}