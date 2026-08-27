"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveStaffPermissions, type ActionState } from "@/actions/permissions";
import { ADMIN_NAV_GROUPS, DASHBOARD_ITEM } from "@/components/layout/nav-items";
import { Plus, Minus } from "lucide-react";

const initialState: ActionState = {};

interface Staff {
  id: string;
  full_name: string;
  role: string;
  allowed_pages: string[] | null;
}

// Each department's "home" module group — shown open by default so the
// person setting permissions isn't hunting through 11 groups to find
// the 3 pages that actually matter for this role. Everything else is
// tucked behind "Aur Groups Add Karein" in case extra access is needed.
const ROLE_HOME_GROUP: Record<string, string | null> = {
  sales_staff: "Sales",
  finance: "Finance",
  warehouse: "Inventory",
  hr: "Administration",
  admin_assistant: "Administration",
  procurement: "Purchases",
  milk_collection: "Dairy",
  manager: null, // Manager sees everything open — broad oversight role.
};

export function PermissionsClient({ staff }: { staff: Staff[] }) {
  const [selectedId, setSelectedId] = useState(staff[0]?.id ?? "");
  const selected = staff.find((s) => s.id === selectedId);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">Staff Select Karein</h2>
        <div className="space-y-1">
          {staff.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                selectedId === s.id ? "bg-brand-600 text-white" : "text-surface-700 hover:bg-surface-50 dark:text-surface-300"
              }`}
            >
              {s.full_name} <span className="text-xs opacity-70">({s.role})</span>
            </button>
          ))}
          {staff.length === 0 && <p className="text-sm text-surface-400">Koi staff nahi mila.</p>}
        </div>
      </div>
      <div className="lg:col-span-2">
        {selected && <PermissionForm key={selected.id} staff={selected} />}
      </div>
    </div>
  );
}

function PermissionForm({ staff }: { staff: Staff }) {
  const [state, formAction] = useFormState(saveStaffPermissions, initialState);
  const allowed = new Set(staff.allowed_pages ?? []);
  const homeGroupLabel = ROLE_HOME_GROUP[staff.role] ?? null;
  const [showAll, setShowAll] = useState(homeGroupLabel === null);

  const homeGroups = homeGroupLabel ? ADMIN_NAV_GROUPS.filter((g) => g.label === homeGroupLabel) : ADMIN_NAV_GROUPS;
  const otherGroups = homeGroupLabel ? ADMIN_NAV_GROUPS.filter((g) => g.label !== homeGroupLabel) : [];

  return (
    <form action={formAction} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <input type="hidden" name="profile_id" value={staff.id} />
      <h2 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">{staff.full_name} - Jo Pages Ye Dekh Sake</h2>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Permissions save ho gayin.</p>}
      <label className="mb-3 flex items-center gap-2 rounded-lg bg-surface-50 p-2 text-sm dark:bg-surface-800">
        <input type="checkbox" name="allowed_pages" value={DASHBOARD_ITEM.href} defaultChecked={allowed.has(DASHBOARD_ITEM.href)} />
        {DASHBOARD_ITEM.label}
      </label>
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
        {homeGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-500">{group.label}</p>
            <div className="grid grid-cols-2 gap-1">
              {group.items.map((item) => (
                <label key={item.href} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-surface-700 hover:bg-surface-50 dark:text-surface-300">
                  <input type="checkbox" name="allowed_pages" value={item.href} defaultChecked={allowed.has(item.href)} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        ))}

        {!showAll && otherGroups.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-surface-300 px-3 py-2 text-xs font-medium text-surface-500 hover:border-brand-400 hover:text-brand-600"
          >
            <Plus className="h-3.5 w-3.5" /> Aur Groups Add Karein (agar koi aur department ka module chahiye)
          </button>
        )}

        {showAll && otherGroups.length > 0 && (
          <>
            {homeGroupLabel && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="flex items-center gap-1.5 text-xs font-medium text-surface-400 hover:text-surface-600"
              >
                <Minus className="h-3.5 w-3.5" /> Chhupayein
              </button>
            )}
            {otherGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-400">{group.label}</p>
                <div className="grid grid-cols-2 gap-1">
                  {group.items.map((item) => (
                    <label key={item.href} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-surface-700 hover:bg-surface-50 dark:text-surface-300">
                      <input type="checkbox" name="allowed_pages" value={item.href} defaultChecked={allowed.has(item.href)} />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving..." : "Permissions Save Karein"}</button>;
}