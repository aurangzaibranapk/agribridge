"use client";
import { useFormState } from "react-dom";
import { assignUserShop, type ActionState } from "@/actions/shops";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Shop {
  id: string;
  name: string;
  branch_id: string | null;
  business_type: string;
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  karyana: "Karyana",
  agri_inputs: "Agri Inputs",
  grain_procurement: "Grain",
  dairy: "Dairy",
  machinery_fleet: "Machinery",
};

export function ShopSelector({
  userId,
  currentShopId,
  currentBranchId,
  shops,
}: {
  userId: string;
  currentShopId: string | null;
  currentBranchId: string | null;
  shops: Shop[];
}) {
  const [, formAction] = useFormState(assignUserShop, initialState);
  const lang = useLang();
  const shopsForBranch = shops.filter((s) => s.branch_id === currentBranchId);

  if (!currentBranchId) {
    return <span className="text-xs text-surface-400">{t("us_pick_branch_first", lang)}</span>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="shop_id"
        defaultValue={currentShopId ?? ""}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700 outline-none focus:border-brand-400 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300"
      >
        <option value="">{t("us_all_shops_branch", lang)}</option>
        {shopsForBranch.map((s) => (
          <option key={s.id} value={s.id}>{BUSINESS_TYPE_LABELS[s.business_type] ?? s.business_type}</option>
        ))}
      </select>
    </form>
  );
}