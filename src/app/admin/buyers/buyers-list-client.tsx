"use client";
import Link from "next/link";
import { useFormState } from "react-dom";
import { updateBuyerStatus, deleteBuyer, type ActionState } from "@/actions/buyers";
import { DeleteButton } from "@/components/admin/delete-button";
import { EmptyState } from "@/components/ui/layout-primitives";
import { formatDateTime } from "@/lib/utils/format";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Buyer {
  id: string;
  buyer_code: string;
  business_name: string;
  contact_person: string | null;
  phone_number: string;
  status: string;
  created_at: string;
}

export function BuyersListClient({ buyers }: { buyers: Buyer[] }) {
  const lang = useLang();
  if (buyers.length === 0) return <EmptyState title={t("by_none_yet", lang)} />;

  return (
    <div className="space-y-2">
      {buyers.map((b) => (
        <div
          key={b.id}
          className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
        >
          <div>
            <p className="font-medium text-surface-900 dark:text-white">
              {b.business_name} <span className="ml-1 font-mono text-xs text-surface-400">({b.buyer_code})</span>
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500">
              {b.contact_person ?? "-"} - {b.phone_number} - Joined {formatDateTime(b.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusSelect buyerId={b.id} currentStatus={b.status} />
            <Link href={`/admin/buyers/${b.id}/statement`} className="text-xs font-medium text-brand-600 hover:underline">
              Statement
            </Link>
            <Link href={`/admin/buyers/${b.id}/edit`} className="text-xs font-medium text-brand-600 hover:underline">
              Edit
            </Link>
            <DeleteButton id={b.id} action={deleteBuyer} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusSelect({ buyerId, currentStatus }: { buyerId: string; currentStatus: string }) {
  const lang = useLang();
  const [, formAction] = useFormState(updateBuyerStatus, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={buyerId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="rounded-lg border border-surface-200 px-2 py-1 text-xs"
      >
        <option value="active">{t("c_active", lang)}</option>
        <option value="inactive">{t("c_inactive", lang)}</option>
        <option value="suspended">{t("c_suspended", lang)}</option>
      </select>
    </form>
  );
}