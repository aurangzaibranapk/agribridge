"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveDashboardFeatures,
  saveFeatureDashboards,
  saveFeatureRolePermission,
  type ActionState,
} from "@/actions/dashboard-manager";
import { ACTIONS, ACTION_LABEL, DATA_SCOPES, SCOPE_LABEL, type Action } from "@/lib/access/types";
import { Check, Search, LayoutGrid, Puzzle, ShieldAlert, Save } from "lucide-react";

const initial: ActionState = {};

export interface DashboardInfo {
  key: string;
  label: string;
  summary: string | null;
  featureKeys: string[];
}

export interface FeatureInfo {
  key: string;
  label: string;
  route: string;
  isSensitive: boolean;
  dashboardKeys: string[];
}

export interface RolePerm {
  role: string;
  featureKey: string;
  actions: string[];
  scope: string;
}

export interface DeptInfo {
  role: string;
  label: string;
}

function Notice({ state }: { state: ActionState }) {
  if (state.error) return <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.message) return <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>;
  return null;
}

function SaveButton({ label = "Mahfooz Karein" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      <Save className="h-4 w-4" />
      {pending ? "Ho raha hai..." : label}
    </button>
  );
}

/**
 * Dashboard & Feature Manager.
 *
 * Do taraf se dekhne ki gunjaish hai, jaan boojh kar:
 *   Dashboard ki taraf se -- "is dashboard par kya kya ho"
 *   Feature ki taraf se   -- "ye cheez kahan kahan nazar aaye"
 *
 * Dono ek hi rishta badalte hain. Magar sochne ka andaz alag hota hai:
 * naya dashboard banate waqt pehla sawal aata hai, aur "Fuel Tracker
 * Milk ko bhi de do" jaisi baat mein doosra.
 */
export function ManagerClient({
  dashboards,
  features,
  rolePerms,
  departments,
}: {
  dashboards: DashboardInfo[];
  features: FeatureInfo[];
  rolePerms: RolePerm[];
  departments: DeptInfo[];
}) {
  const [tab, setTab] = useState<"dashboard" | "feature">("dashboard");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { key: "dashboard" as const, label: "Dashboard ki taraf se", Icon: LayoutGrid },
          { key: "feature" as const, label: "Feature ki taraf se", Icon: Puzzle },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
              tab === key
                ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/30"
                : "border-surface-200 text-surface-600"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <DashboardSide dashboards={dashboards} features={features} />
      ) : (
        <FeatureSide dashboards={dashboards} features={features} rolePerms={rolePerms} departments={departments} />
      )}
    </div>
  );
}

/* ---------------- Dashboard ki taraf se ---------------- */

function DashboardSide({ dashboards, features }: { dashboards: DashboardInfo[]; features: FeatureInfo[] }) {
  const [key, setKey] = useState(dashboards[0]?.key ?? "");
  const dashboard = dashboards.find((d) => d.key === key);
  const [state, action] = useFormState(saveDashboardFeatures, initial);

  const [picked, setPicked] = useState<Set<string>>(new Set(dashboard?.featureKeys ?? []));
  const [loadedFor, setLoadedFor] = useState(key);
  const [query, setQuery] = useState("");

  if (loadedFor !== key) {
    setLoadedFor(key);
    setPicked(new Set(dashboards.find((d) => d.key === key)?.featureKeys ?? []));
    setQuery("");
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return features;
    return features.filter((f) => f.label.toLowerCase().includes(q) || f.route.toLowerCase().includes(q));
  }, [features, query]);

  function toggle(k: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Dashboard</h2>
        <div className="space-y-1">
          {dashboards.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setKey(d.key)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                d.key === key
                  ? "bg-brand-600 text-white"
                  : "text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
              }`}
            >
              <span className="block font-medium">{d.label}</span>
              <span className={`block text-xs ${d.key === key ? "text-brand-100" : "text-surface-400"}`}>
                {d.featureKeys.length} feature
              </span>
            </button>
          ))}
        </div>
      </div>

      <form action={action} className="space-y-3 lg:col-span-3">
        <input type="hidden" name="dashboard_key" value={key} />

        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="text-base font-semibold text-surface-900 dark:text-white">{dashboard?.label}</h2>
          <p className="text-xs text-surface-500">{dashboard?.summary}</p>
          <Notice state={state} />
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-surface-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Feature dhoondein"
              className="w-full rounded-lg border border-surface-200 p-2 pl-9 text-sm"
            />
          </div>
        </div>

        <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <ul className="grid grid-cols-1 gap-px bg-surface-100 sm:grid-cols-2 dark:bg-surface-800">
            {shown.map((f) => {
              const on = picked.has(f.key);
              const elsewhere = f.dashboardKeys.filter((d) => d !== key);
              return (
                <li key={f.key} className="bg-white dark:bg-surface-900">
                  <label className="flex cursor-pointer items-start gap-2 px-3 py-2">
                    <input type="checkbox" checked={on} onChange={() => toggle(f.key)} className="mt-1" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm text-surface-900 dark:text-white">
                        {f.label}
                        {f.isSensitive && <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />}
                      </span>
                      <span className="block truncate text-xs text-surface-400">{f.route}</span>
                      {elsewhere.length > 0 && (
                        <span className="block text-xs text-surface-400">
                          Aur {elsewhere.length} dashboard par bhi
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {[...picked].map((k) => (
          <input key={k} type="hidden" name="feature_keys" value={k} />
        ))}

        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-sm text-surface-600 dark:text-surface-400">
            <span className="font-semibold text-surface-900 dark:text-white">{picked.size}</span> feature
          </p>
          <SaveButton />
        </div>
      </form>
    </div>
  );
}

/* ---------------- Feature ki taraf se ---------------- */

function FeatureSide({
  dashboards,
  features,
  rolePerms,
  departments,
}: {
  dashboards: DashboardInfo[];
  features: FeatureInfo[];
  rolePerms: RolePerm[];
  departments: DeptInfo[];
}) {
  const [query, setQuery] = useState("");
  const [key, setKey] = useState(features[0]?.key ?? "");
  const feature = features.find((f) => f.key === key);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return features.slice(0, 40);
    return features.filter((f) => f.label.toLowerCase().includes(q) || f.route.toLowerCase().includes(q)).slice(0, 40);
  }, [features, query]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-surface-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Feature dhoondein"
            className="w-full rounded-lg border border-surface-200 p-2 pl-9 text-sm"
          />
        </div>
        <div className="max-h-[70vh] space-y-1 overflow-y-auto">
          {shown.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setKey(f.key)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                f.key === key
                  ? "bg-brand-600 text-white"
                  : "text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
              }`}
            >
              <span className="block font-medium">{f.label}</span>
              <span className={`block text-xs ${f.key === key ? "text-brand-100" : "text-surface-400"}`}>
                {f.dashboardKeys.length} dashboard
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 lg:col-span-2">
        {feature && <FeatureDashboards key={`d-${feature.key}`} feature={feature} dashboards={dashboards} />}
        {feature && (
          <FeatureRoles
            key={`r-${feature.key}`}
            feature={feature}
            departments={departments}
            rolePerms={rolePerms.filter((p) => p.featureKey === feature.key)}
          />
        )}
      </div>
    </div>
  );
}

function FeatureDashboards({ feature, dashboards }: { feature: FeatureInfo; dashboards: DashboardInfo[] }) {
  const [state, action] = useFormState(saveFeatureDashboards, initial);
  const [picked, setPicked] = useState<Set<string>>(new Set(feature.dashboardKeys));

  return (
    <form action={action} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <input type="hidden" name="feature_key" value={feature.key} />

      <h2 className="flex items-center gap-1.5 text-base font-semibold text-surface-900 dark:text-white">
        {feature.label}
        {feature.isSensitive && <ShieldAlert className="h-4 w-4 text-amber-600" />}
      </h2>
      <p className="text-xs text-surface-400">{feature.route}</p>
      <p className="mt-1 text-xs text-surface-500">Ye cheez kahan kahan nazar aaye:</p>

      <Notice state={state} />

      <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
        {dashboards.map((d) => {
          const on = picked.has(d.key);
          return (
            <label
              key={d.key}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                on ? "bg-brand-50 text-brand-900 dark:bg-brand-950/30 dark:text-brand-200" : "text-surface-600"
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(d.key)) next.delete(d.key);
                    else next.add(d.key);
                    return next;
                  })
                }
              />
              <span className="truncate">{d.label}</span>
            </label>
          );
        })}
      </div>

      {[...picked].map((k) => (
        <input key={k} type="hidden" name="dashboard_keys" value={k} />
      ))}

      <div className="mt-3 flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}

function FeatureRoles({
  feature,
  departments,
  rolePerms,
}: {
  feature: FeatureInfo;
  departments: DeptInfo[];
  rolePerms: RolePerm[];
}) {
  return (
    <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Kaun kya kar sakta hai</h3>
        <p className="text-xs text-surface-500">
          Har department ke liye alag. Ek bhi kaam na chunein to us department se ye feature hat jata hai.
        </p>
      </div>
      <ul className="divide-y divide-surface-100 dark:divide-surface-800">
        {departments.map((d) => (
          <li key={d.role} className="p-4">
            <RoleRow
              feature={feature}
              dept={d}
              current={rolePerms.find((p) => p.role === d.role) ?? null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleRow({
  feature,
  dept,
  current,
}: {
  feature: FeatureInfo;
  dept: DeptInfo;
  current: RolePerm | null;
}) {
  const [state, action] = useFormState(saveFeatureRolePermission, initial);
  const [actions, setActions] = useState<Set<string>>(new Set(current?.actions ?? []));
  const [scope, setScope] = useState(current?.scope ?? "own_branch");

  return (
    <form action={action}>
      <input type="hidden" name="feature_key" value={feature.key} />
      <input type="hidden" name="role" value={dept.role} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-surface-900 dark:text-white">{dept.label}</span>
        <div className="flex items-center gap-2">
          <select
            name="data_scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-lg border border-surface-200 p-1.5 text-xs"
          >
            {DATA_SCOPES.map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
              </option>
            ))}
          </select>
          <SmallSave />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
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
                name="actions"
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

      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.message && <p className="mt-1 text-xs text-green-700">{state.message}</p>}
    </form>
  );
}

function SmallSave() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg border border-surface-300 px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
    >
      <Check className="h-3 w-3" />
      {pending ? "..." : "Mahfooz"}
    </button>
  );
}
