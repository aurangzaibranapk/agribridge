"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { grantTeamPermission, type ActionState } from "@/actions/department-head";
import { ACTION_LABEL, DATA_SCOPES, SCOPE_LABEL, type Action } from "@/lib/access/types";
import { Save, ShieldCheck, Clock, Info } from "lucide-react";

const initial: ActionState = {};

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface GrantableFeature {
  key: string;
  label: string;
  /** Head is feature par jo de sakta hai -- is se aage kuch nahi. */
  actions: Action[];
  maxScope: string;
}

export interface ExistingGrant {
  profileId: string;
  featureKey: string;
  actions: string[];
  scope: string;
  expiresAt: string | null;
}

/**
 * Head apni team banata hai.
 *
 * Screen par sirf wohi kaam nazar aate hain jo head khud de sakta hai.
 * Zyada dikha kar phir mana kar dena us se bura hota: head soch kar
 * chunta hai, aur baad mein pata chalta hai ke wo chun hi nahi sakta
 * tha.
 */
export function TeamClient({
  members,
  features,
  grants,
}: {
  members: TeamMember[];
  features: GrantableFeature[];
  grants: ExistingGrant[];
}) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const member = members.find((m) => m.id === memberId);
  const mine = grants.filter((g) => g.profileId === memberId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Team</h2>
        {members.length === 0 && <p className="px-1 text-xs text-surface-400">Koi staff nahi mila.</p>}
        <div className="max-h-[70vh] space-y-1 overflow-y-auto">
          {members.map((m) => {
            const count = grants.filter((g) => g.profileId === m.id).length;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberId(m.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  m.id === memberId
                    ? "bg-brand-600 text-white"
                    : "text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
                }`}
              >
                <span className="block font-medium">{m.name}</span>
                <span className={`block text-xs ${m.id === memberId ? "text-brand-100" : "text-surface-400"}`}>
                  {m.role}
                  {count > 0 && ` • ${count} khaas ijazat`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 lg:col-span-2">
        {!member ? (
          <div className="rounded-card border border-surface-200 bg-white p-8 text-center text-sm text-surface-400 dark:border-surface-800 dark:bg-surface-900">
            Team ka koi banda chunein.
          </div>
        ) : (
          features.map((f) => (
            <FeatureGrantRow
              key={`${member.id}-${f.key}`}
              member={member}
              feature={f}
              existing={mine.find((g) => g.featureKey === f.key) ?? null}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FeatureGrantRow({
  member,
  feature,
  existing,
}: {
  member: TeamMember;
  feature: GrantableFeature;
  existing: ExistingGrant | null;
}) {
  const [state, action] = useFormState(grantTeamPermission, initial);
  const [actions, setActions] = useState<Set<string>>(new Set(existing?.actions ?? []));
  const [scope, setScope] = useState(existing?.scope ?? feature.maxScope);
  const [expires, setExpires] = useState(existing?.expiresAt?.slice(0, 10) ?? "");

  const scopeChoices = DATA_SCOPES.filter((s) => {
    const RANK: Record<string, number> = { all: 4, own_branch: 3, own_shop: 2, own_records: 1 };
    return RANK[s] <= RANK[feature.maxScope];
  });

  return (
    <form
      action={action}
      className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
    >
      <input type="hidden" name="profile_id" value={member.id} />
      <input type="hidden" name="feature_key" value={feature.key} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-surface-900 dark:text-white">{feature.label}</span>
        {existing?.expiresAt && (
          <span className="flex items-center gap-1 text-xs text-amber-700">
            <Clock className="h-3 w-3" /> {existing.expiresAt.slice(0, 10)} tak
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {feature.actions.map((a) => {
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

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-surface-500">Kis ka data</label>
          <select
            name="data_scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="mt-1 block rounded-lg border border-surface-200 p-1.5 text-xs"
          >
            {scopeChoices.map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-surface-500">Kab tak (marzi ki baat)</label>
          <input
            name="expires_at"
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="mt-1 block rounded-lg border border-surface-200 p-1.5 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-surface-500">Wajah</label>
          <input
            name="reason"
            placeholder="Misal: chhutti par gaye Bilal ki jagah"
            className="mt-1 w-full rounded-lg border border-surface-200 p-1.5 text-xs"
          />
        </div>
        <SmallSave />
      </div>

      {state.error && <p className="mt-2 text-xs text-red-700">{state.error}</p>}
      {state.message && <p className="mt-2 text-xs text-green-700">{state.message}</p>}
    </form>
  );
}

function SmallSave() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
    >
      <Save className="h-3 w-3" />
      {pending ? "..." : "Mahfooz"}
    </button>
  );
}

export function HeadLimitNotice({ actions, scope }: { actions: string[]; scope: string }) {
  return (
    <div className="rounded-card border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
      <p className="flex items-start gap-1.5 text-xs text-blue-900 dark:text-blue-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Aap apni team ko zyada se zyada ye de sakte hain:{" "}
          <strong>{actions.map((a) => ACTION_LABEL[a as Action] ?? a).join(", ")}</strong> —{" "}
          <strong>{SCOPE_LABEL[scope as keyof typeof SCOPE_LABEL] ?? scope}</strong>.
          <br />
          Jo aap ke paas khud nahi hai, wo aap kisi ko nahi de sakte —{" "}
          <ShieldCheck className="inline h-3 w-3" /> ye rok database mein bhi lagi hui hai.
        </span>
      </p>
    </div>
  );
}
