"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { assignDepartmentHead, removeDepartmentHead, type ActionState } from "@/actions/department-head";
import { ACTIONS, ACTION_LABEL, DATA_SCOPES, SCOPE_LABEL, type Action } from "@/lib/access/types";
import { Crown, ShieldAlert } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initial: ActionState = {};

export interface StaffOption {
  id: string;
  name: string;
  role: string;
}

export interface HeadInfo {
  profileId: string;
  name: string;
  maxActions: string[];
  maxScope: string;
  expiresAt: string | null;
}

/**
 * Head lagane ka form.
 *
 * Hadd yahin tay hoti hai, head banate waqt -- baad mein nahi. Hadd ke
 * baghair head banana aur poori ijazat de dena ek hi baat hai, aur us
 * soorat mein wo ijazat kabhi wapas nahi aati kyunke kisi ko yaad hi
 * nahi rehta ke di kab thi.
 */
export function HeadForm({
  departmentKey,
  departmentLabel,
  staff,
  head,
}: {
  departmentKey: string;
  departmentLabel: string;
  staff: StaffOption[];
  head: HeadInfo | null;
}) {
  const lang = useLang();
  const [state, action] = useFormState(assignDepartmentHead, initial);
  const [removeState, removeAction] = useFormState(removeDepartmentHead, initial);
  const [actions, setActions] = useState<Set<string>>(new Set(head?.maxActions ?? ["view"]));

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
        <Crown className="h-4 w-4 text-amber-600" /> {departmentLabel} ka Head
      </h3>

      {head ? (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-surface-900 dark:text-white">{head.name}</p>
          <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
            Hadd: {head.maxActions.map((a) => ACTION_LABEL[a as Action] ?? a).join(", ")} —{" "}
            {SCOPE_LABEL[head.maxScope as keyof typeof SCOPE_LABEL] ?? head.maxScope}
            {head.expiresAt && ` • ${head.expiresAt.slice(0, 10)} tak`}
          </p>
          <form action={removeAction} className="mt-2">
            <input type="hidden" name="department_key" value={departmentKey} />
            <RemoveButton />
            {removeState.error && <p className="mt-1 text-xs text-red-700">{removeState.error}</p>}
          </form>
        </div>
      ) : (
        <p className="mt-1 text-xs text-surface-500">{t("at_no_head", lang)}</p>
      )}

      <form action={action} className="mt-3 space-y-3 border-t border-surface-200 pt-3 dark:border-surface-800">
        <input type="hidden" name="department_key" value={departmentKey} />

        <div>
          <label className="text-xs font-medium text-surface-600">{t("at_who_is_head", lang)}</label>
          <select name="profile_id" defaultValue={head?.profileId ?? ""} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">— chunein —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-surface-600">
            <ShieldAlert className="h-3 w-3 text-amber-600" />{t("at_max_can_give", lang)}</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {ACTIONS.map((a: Action) => {
              const on = actions.has(a);
              return (
                <label
                  key={a}
                  className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${
                    on
                      ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/30"
                      : "border-surface-200 text-surface-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="max_actions"
                    value={a}
                    checked={on}
                    onChange={() =>
                      setActions((prev) => {
                        const next = new Set(prev);
                        if (next.has(a)) next.delete(a);
                        else next.add(a);
                        return next;
                      })
                    }
                    className="hidden"
                  />
                  {ACTION_LABEL[a]}
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-surface-400">{t("at_head_limit", lang)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-surface-600">{t("at_data_limit", lang)}</label>
            <select
              name="max_data_scope"
              defaultValue={head?.maxScope ?? "own_branch"}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            >
              {DATA_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">{t("at_until_when", lang)}</label>
            <input
              name="expires_at"
              type="date"
              defaultValue={head?.expiresAt?.slice(0, 10) ?? ""}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            />
          </div>
        </div>

        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {state.message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>}

        <SaveButton />
      </form>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {pending ? "Ho raha hai..." : "Head Lagayein"}
    </button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 disabled:opacity-50"
    >
      {pending ? "..." : "Head hatayein"}
    </button>
  );
}
