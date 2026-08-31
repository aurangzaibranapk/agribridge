"use client";
import { useFormState } from "react-dom";
import { assignUserBranch, type ActionState } from "@/actions/branches";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
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
  const [, formAction] = useFormState(assignUserBranch, initialState);
  const lang = useLang();

  return (
    <form action={formAction}>
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
    </form>
  );
}