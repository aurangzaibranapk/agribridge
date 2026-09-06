"use client";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, Loader2 } from "lucide-react";
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

/** Chunte hi mehfooz — aur wo baat nazar bhi aati hai. */
function Nishan({ mehfooz, kharabi }: { mehfooz: boolean; kharabi?: string }) {
  const { pending } = useFormStatus();
  if (pending) return <Loader2 className="h-3.5 w-3.5 animate-spin text-surface-400" />;
  if (kharabi) return <span className="text-[11px] text-red-600">{kharabi}</span>;
  if (mehfooz)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
        <Check className="h-3 w-3" /> mehfooz
      </span>
    );
  return null;
}

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
  const [state, formAction] = useFormState(assignUserShop, initialState);
  const lang = useLang();
  const shopsForBranch = shops.filter((s) => s.branch_id === currentBranchId);

  /**
   * "Mehfooz ho gaya" ka nishan.
   *
   * Malik (6 September): *"Anwar ko maine karyana par lagaya hai to kahin
   * save ka button nahi, jahan hum save kar dein."*
   *
   * Button ki zaroorat nahi thi -- chunte hi form jama ho jata tha. Kami
   * ye thi ke KUCH NAZAR NAHI AATA THA. Aur usi din wo baat aur mehngi
   * ban gayi: `profiles` par badalne ka koi RLS qanoon hi nahi tha, is
   * liye update chup chaap 0 qatarein badalta tha -- aur safha phir bhi
   * khamosh rehta tha. Dono baatein ab theek hain: likhai service client
   * se hoti hai aur ginti ki tasdeeq hoti hai, aur yahan nateeja nazar
   * aata hai.
   */
  const [nishan, setNishan] = useState(false);
  useEffect(() => {
    if (!state.success) return;
    setNishan(true);
    const t2 = setTimeout(() => setNishan(false), 2500);
    return () => clearTimeout(t2);
  }, [state]);

  if (!currentBranchId) {
    return <span className="text-xs text-surface-400">{t("us_pick_branch_first", lang)}</span>;
  }

  // Is shaakh ke neeche koi dukan hai hi nahi -- ye baat SAAF kehni
  // paRti hai.
  if (shopsForBranch.length === 0) {
    return (
      <span className="text-xs text-amber-700 dark:text-amber-400">
        Is shaakh ke neeche koi dukan darj nahi — pehle Shops par is shaakh ki dukan banayein ya us dukan ki
        shaakh theek karein.
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-0.5">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="shop_id"
        defaultValue={currentShopId ?? ""}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700 outline-none focus:border-brand-400 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300"
      >
        <option value="">{t("us_all_shops_branch", lang)}</option>
        {shopsForBranch.map((s) => (
          <option key={s.id} value={s.id}>
            {/*
              Dukan ka NAAM pehle, qism baad mein.
              Pehle yahan sirf qism likhi hoti thi -- aur us ka nateeja
              malik ki screen par saamne aaya: ek hi shaakh ke neeche do
              "Karyana" bilkul ek jaise nazar aate the, aur ye batane ka
              koi raasta nahi tha ke banda kaunsi dukan par baithta hai.
            */}
            {s.name} ({BUSINESS_TYPE_LABELS[s.business_type] ?? s.business_type})
          </option>
        ))}
      </select>
      <Nishan mehfooz={nishan} kharabi={state.error} />
    </form>
  );
}
