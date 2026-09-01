import { createServiceClient } from "@/lib/supabase/service";
import { loadRegistry } from "@/lib/access/registry";
import { narrowerScope, type Action, type DataScope } from "@/lib/access/types";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

/**
 * Department Head apni team ko kya de sakta hai.
 *
 * ===== POORE MARHALE KA BUNYADI USOOL =====
 * Head sirf WAHI de sakta hai jo Master Admin ne USE diya ho.
 *
 * Is ke baghair delegation ek chor darwaza ban jata hai: head kisi ko
 * (ya khud ko) wo ikhtiyar de deta hai jo us ke paas tha hi nahi, aur
 * ye baat kisi report mein nazar nahi aati -- ijazat theek nazar aati
 * rehti hai, bas wo aayi kahan se, ye koi nahi poochhta.
 *
 * Is liye hadd teen jagah se aati hai, aur teenon mein se JO TANG HO
 * wohi chalti hai:
 *   1. Master Admin ne head ko kya diya (max_actions / max_data_scope)
 *   2. Head khud us feature par kya kar sakta hai
 *   3. Head kya dena chah raha hai
 *
 * Doosri shart aksar bhula di jati hai, magar wohi sab se zaroori hai:
 * head ko "approve" ki hadd mil sakti hai, magar agar us ke apne role
 * mein us feature par approve nahi hai, to wo kisi aur ko bhi nahi de
 * sakta.
 */

export interface HeadPower {
  departmentKey: string;
  departmentLabel: string;
  dashboardKey: string | null;
  maxActions: Action[];
  maxScope: DataScope;
  /** Is department ke feature -- inhi par ijazat di ja sakti hai. */
  featureKeys: string[];
  /** Head khud kis feature par kya kar sakta hai. */
  own: Map<string, { actions: Set<Action>; scope: DataScope }>;
  /** Master Admin darje ka shakhs -- us par hadd nahi. */
  unrestricted: boolean;
}

export async function loadHeadPower(profileId: string): Promise<HeadPower | null> {
  const service = createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("role, is_active")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile?.is_active) return null;

  const { data: grant } = await service
    .from("department_head_grants")
    .select("department_key, max_actions, max_data_scope, starts_at, expires_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!grant) return null;

  // Head ki apni ijazat ka waqt bhi guzar sakta hai -- chhutti par gaye
  // kisi ki jagah head banaya gaya ho to us ka ikhtiyar bhi khatam hona
  // chahiye, warna wo hamesha ke liye rah jata hai.
  const now = Date.now();
  if (grant.starts_at && new Date(grant.starts_at).getTime() > now) return null;
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) return null;

  const { data: dept } = await service
    .from("departments")
    .select("key, label, dashboard_key")
    .eq("key", grant.department_key)
    .maybeSingle();
  if (!dept) return null;

  const registry = await loadRegistry();
  const featureKeys = dept.dashboard_key ? (registry.byDashboard.get(dept.dashboard_key) ?? []) : [];

  const own = new Map<string, { actions: Set<Action>; scope: DataScope }>();
  const { data: mine } = await service
    .from("v_user_feature_access")
    .select("feature_key, actions, data_scope")
    .eq("profile_id", profileId);

  const RANK: Record<DataScope, number> = { all: 4, own_branch: 3, own_shop: 2, own_records: 1 };
  for (const row of mine ?? []) {
    if (!row.feature_key) continue;
    const existing = own.get(row.feature_key) ?? { actions: new Set<Action>(), scope: "own_records" as DataScope };
    for (const a of ((row.actions as string[] | null) ?? []) as Action[]) existing.actions.add(a);
    const s = (row.data_scope as DataScope) ?? "own_records";
    if (RANK[s] > RANK[existing.scope]) existing.scope = s;
    own.set(row.feature_key, existing);
  }

  return {
    departmentKey: dept.key,
    departmentLabel: dept.label,
    dashboardKey: dept.dashboard_key,
    maxActions: ((grant.max_actions as string[]) ?? []) as Action[],
    maxScope: (grant.max_data_scope as DataScope) ?? "own_branch",
    featureKeys,
    own,
    unrestricted: UNRESTRICTED_ROLES.includes(profile.role),
  };
}

/** Is feature par head kaun se kaam de sakta hai. */
export function grantableActions(power: HeadPower, featureKey: string): Action[] {
  if (!power.featureKeys.includes(featureKey)) return [];
  const ownActions = power.own.get(featureKey)?.actions;
  // Master Admin darje ke shakhs ko apni fehrist ki shart se chhoot hai
  // -- us ke paas har cheez hoti hai, magar view mein wo nazar nahi aati.
  if (power.unrestricted) return power.maxActions;
  if (!ownActions) return [];
  return power.maxActions.filter((a) => ownActions.has(a));
}

/** Is feature par head kitna data khol sakta hai. */
export function grantableScope(power: HeadPower, featureKey: string): DataScope {
  const ownScope = power.own.get(featureKey)?.scope;
  if (power.unrestricted || !ownScope) return power.maxScope;
  return narrowerScope(power.maxScope, ownScope);
}

export interface CapResult {
  actions: Action[];
  scope: DataScope;
  /** Jo maanga gaya magar diya nahi ja saka -- head ko batane ke liye. */
  refused: Action[];
}

/**
 * Jo maanga gaya us mein se jo diya ja sakta hai, wo.
 *
 * Chup chaap kaat dena ghalat hota: head samajhta hai us ne approve de
 * diya, aur banda hairan hota hai ke button chalta kyun nahi. Is liye
 * jo nahi diya ja saka wo alag bata diya jata hai.
 */
export function capGrant(
  power: HeadPower,
  featureKey: string,
  wantActions: Action[],
  wantScope: DataScope
): CapResult {
  const allowed = new Set(grantableActions(power, featureKey));
  const actions = wantActions.filter((a) => allowed.has(a));
  const refused = wantActions.filter((a) => !allowed.has(a));
  return { actions, scope: narrowerScope(grantableScope(power, featureKey), wantScope), refused };
}
