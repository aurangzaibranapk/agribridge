"use client";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, Loader2 } from "lucide-react";
import { assignUserBranch, type ActionState } from "@/actions/branches";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
}

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

export function BranchSelector({
  userId,
  currentBranchId,
  branches,
}: {
  userId: string;
  currentBranchId: string | null;
  branches: Branch[];
}) {
  const [state, formAction] = useFormState(assignUserBranch, initialState);
  const lang = useLang();

  // Nateeja nazar aana chahiye. Wajah `shop-selector.tsx` mein likhi hai:
  // khamosh kaamyabi aur khamosh nakami dono ek jaisi lagti hain.
  const [nishan, setNishan] = useState(false);
  useEffect(() => {
    if (!state.success) return;
    setNishan(true);
    const t2 = setTimeout(() => setNishan(false), 2500);
    return () => clearTimeout(t2);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-0.5">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="branch_id"
        defaultValue={currentBranchId ?? ""}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700 outline-none focus:border-brand-400 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300"
      >
        <option value="">{t("us_all_branches", lang)}</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <Nishan mehfooz={nishan} kharabi={state.error} />
    </form>
  );
}