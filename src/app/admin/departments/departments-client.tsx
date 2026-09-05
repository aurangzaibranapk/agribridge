"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveDepartmentPermissions, applyDepartmentToAll, type ActionState } from "@/actions/permissions";
import { ADMIN_NAV_GROUPS } from "@/components/layout/nav-items";
import { DEPARTMENTS } from "@/lib/departments";
import { Check, Sparkles, Users, UserCheck } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initial: ActionState = {};

export interface DeptRow {
  role: string;
  pages: string[];
  staffCount: number;
  overrideCount: number;
}

/**
 * Department ki ijazat set karne ka safha.
 *
 * Safhe module ke hisab se dikhaye jate hain, ek lambi fehrist mein
 * nahi. Ek waqt mein 150 cheezein saamne rakh dene se koi bhi soch samajh
 * kar tick nahi karta -- sab kuch tick kar diya jata hai, aur rok bekar
 * ho jati hai.
 */
export function DepartmentsClient({ rows }: { rows: DeptRow[] }) {
  const [roleKey, setRoleKey] = useState(DEPARTMENTS[0].role);
  const lang = useLang();
  const dept = DEPARTMENTS.find((d) => d.role === roleKey)!;
  const row = rows.find((r) => r.role === roleKey);

  const [state, action] = useFormState(saveDepartmentPermissions, initial);
  const [picked, setPicked] = useState<Set<string>>(new Set(row?.pages ?? []));
  const [dirtyFor, setDirtyFor] = useState(roleKey);

  // Department badla to us ka apna set laden.
  if (dirtyFor !== roleKey) {
    setDirtyFor(roleKey);
    setPicked(new Set(rows.find((r) => r.role === roleKey)?.pages ?? []));
  }

  const allHrefs = useMemo(
    () => [...new Set(ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)))],
    []
  );

  function toggle(href: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  function toggleGroup(hrefs: string[], on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      hrefs.forEach((h) => (on ? next.add(h) : next.delete(h)));
      return next;
    });
  }

  function applySuggested() {
    setPicked(new Set(dept.suggestedPages.filter((p) => allHrefs.includes(p))));
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {/* ---- Department ki fehrist ---- */}
      <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("c_department", lang)}</h2>
        <div className="space-y-1">
          {DEPARTMENTS.map((d) => {
            const r = rows.find((x) => x.role === d.role);
            const active = d.role === roleKey;
            return (
              <button
                key={d.role}
                type="button"
                onClick={() => setRoleKey(d.role)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  active
                    ? "bg-brand-600 text-white"
                    : "text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
                }`}
              >
                <span className="block font-medium">{d.label}</span>
                <span className={`block text-xs ${active ? "text-brand-100" : "text-surface-400"}`}>
                  {r?.staffCount ?? 0} banday • {r?.pages.length ?? 0} safhe
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Safhe ---- */}
      <form action={action} className="space-y-3 lg:col-span-3">
        <input type="hidden" name="role" value={roleKey} />

        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-surface-900 dark:text-white">{dept.label}</h2>
              <p className="text-xs text-surface-500">{dept.summary}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-surface-400">
                <Users className="h-3 w-3" />
                {row?.staffCount ?? 0} banday
                {(row?.overrideCount ?? 0) > 0 &&
                  ` • ${row?.overrideCount} ki apni alag ijazat hai (un par ye set nahi lagta)`}
              </p>
            </div>
            <button
              type="button"
              onClick={applySuggested}
              className="flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-sm font-medium text-brand-700"
            >
              <Sparkles className="h-4 w-4" />{t("dp_apply_suggestion", lang)}</button>
          </div>

          {(row?.overrideCount ?? 0) > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
              <p className="text-xs text-amber-800 dark:text-amber-300">{t("dp_of_this_dept", lang)}<strong>{row?.overrideCount}</strong> banday apni alag ijazat par chal
                rahe hain — un par ye set nahi lagta. Sab ko department par lana ho to neeche wala
                button dabayein.
              </p>
              <ApplyToAll role={roleKey} />
            </div>
          )}

          {state.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          {state.success && (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t("dp_saved_all", lang)}</p>
          )}
        </div>

        <div className="space-y-3">
          {ADMIN_NAV_GROUPS.map((group) => {
            const hrefs = group.items.map((i) => i.href);
            const on = hrefs.filter((h) => picked.has(h)).length;
            return (
              <div
                key={group.label}
                className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900"
              >
                <div className="flex items-center justify-between border-b border-surface-200 px-4 py-2.5 dark:border-surface-800">
                  <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                    {group.label}{" "}
                    <span className="text-xs font-normal text-surface-400">
                      {on}/{hrefs.length}
                    </span>
                  </h3>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => toggleGroup(hrefs, true)} className="text-brand-700 underline">{t("dp_all", lang)}</button>
                    <button type="button" onClick={() => toggleGroup(hrefs, false)} className="text-surface-500 underline">{t("dp_none", lang)}</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => {
                    const on = picked.has(item.href);
                    return (
                      <label
                        key={`${group.label}-${item.href}`}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                          on ? "bg-brand-50 text-brand-900 dark:bg-brand-950/30 dark:text-brand-200" : "text-surface-600"
                        }`}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggle(item.href)} />
                        <span className="truncate">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {[...picked].map((href) => (
          <input key={href} type="hidden" name="allowed_pages" value={href} />
        ))}

        <SaveBar count={picked.size} label={dept.label} />
      </form>
    </div>
  );
}

function SaveBar({ count, label }: { count: number; label: string }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <p className="text-sm text-surface-600 dark:text-surface-400">
        <span className="font-semibold text-surface-900 dark:text-white">{count}</span> safhe — {label}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        {pending ? "Mahfooz ho raha hai..." : "Mahfooz Karein"}
      </button>
    </div>
  );
}

/**
 * Alag form -- form ke andar form nahi ban sakta, aur ye kaam department
 * ki ijazat mahfooz karne se bilkul alag hai.
 */
function ApplyToAll({ role }: { role: string }) {
  const lang = useLang();
  const [state, action] = useFormState(applyDepartmentToAll, initial);
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="role" value={role} />
      <ApplyButton />
      {state.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-700">{t("dp_done_set", lang)}</p>}
    </form>
  );
}

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg border border-amber-600 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 disabled:opacity-50 dark:bg-surface-900"
    >
      <UserCheck className="h-3.5 w-3.5" />
      {pending ? "Lag raha hai..." : "Sab par department ka set lagayein"}
    </button>
  );
}
