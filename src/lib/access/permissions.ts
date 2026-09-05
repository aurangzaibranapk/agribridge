import { createServiceClient } from "@/lib/supabase/service";
import { narrowerScope, type Action, type DataScope } from "@/lib/access/types";

/**
 * Kisi banday ki asal ijazat.
 *
 * Teen jagah se aati hai, aur milti hai -- ghatti nahi:
 *   1. Us ke role (department) ki ijazat
 *   2. Us ke apne naam par di hui ijazat
 *   3. Waqti ijazat (chhutti par gaye kisi ki jagah)
 *
 * Ek hi feature par do jagah se ijazat aaye to actions jama ho jate hain
 * aur data scope mein se JO ZYADA KHULA HO wo chalta hai -- kyunke banday
 * ko wo ijazat jaan boojh kar di gayi thi.
 *
 * Waqti ijazat ka waqt yahin dekha jata hai. Chhutti par gaye manager ki
 * jagah kisi ko dena aam baat hai; asal masla wapas lena hota hai, aur
 * wo kisi ko yaad nahi rehta. Is liye ye kaam yaad par nahi chhora gaya.
 */

export interface FeatureGrant {
  actions: Set<Action>;
  scope: DataScope;
  /** Waqti ijazat se aaya -- safhe par batane ke liye. */
  temporary: boolean;
  expiresAt: string | null;
}

export interface UserAccess {
  role: string;
  branchId: string | null;
  unrestricted: boolean;
  grants: Map<string, FeatureGrant>;
}

export const UNRESTRICTED_ROLES = ["owner", "super_admin", "admin"];

const SCOPE_RANK: Record<DataScope, number> = { all: 4, own_branch: 3, own_shop: 2, own_records: 1 };

function widerScope(a: DataScope, b: DataScope): DataScope {
  return SCOPE_RANK[a] >= SCOPE_RANK[b] ? a : b;
}

function merge(map: Map<string, FeatureGrant>, key: string, grant: FeatureGrant): void {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, grant);
    return;
  }
  grant.actions.forEach((a) => existing.actions.add(a));
  existing.scope = widerScope(existing.scope, grant.scope);
  // Pakki ijazat waqti se bhaari hai: agar dono jagah se mili hai to wo
  // waqt guzarne par khatam nahi honi chahiye.
  if (!grant.temporary) {
    existing.temporary = false;
    existing.expiresAt = null;
  }
}

export async function loadUserAccess(profileId: string): Promise<UserAccess | null> {
  const service = createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("role, is_active, branch_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile?.is_active) return null;

  const base: UserAccess = {
    role: profile.role,
    branchId: profile.branch_id,
    unrestricted: UNRESTRICTED_ROLES.includes(profile.role),
    grants: new Map(),
  };
  if (base.unrestricted) return base;

  const now = new Date().toISOString();

  const [{ data: roleRows }, { data: userRows }] = await Promise.all([
    service.from("role_feature_permissions").select("feature_key, actions, data_scope").eq("role", profile.role),
    service
      .from("user_feature_permissions")
      .select("feature_key, actions, data_scope, starts_at, expires_at")
      .eq("profile_id", profileId)
      // Jo shuru hi nahi hui, ya guzar chuki -- dono ka koi asar nahi.
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);

  for (const row of roleRows ?? []) {
    merge(base.grants, row.feature_key, {
      actions: new Set((row.actions as string[]) as Action[]),
      scope: row.data_scope as DataScope,
      temporary: false,
      expiresAt: null,
    });
  }

  for (const row of userRows ?? []) {
    merge(base.grants, row.feature_key, {
      actions: new Set((row.actions as string[]) as Action[]),
      scope: row.data_scope as DataScope,
      temporary: row.expires_at != null,
      expiresAt: row.expires_at,
    });
  }

  return base;
}

/** Is feature par ye kaam kar sakta hai? */
export function can(access: UserAccess, featureKey: string, action: Action = "view"): boolean {
  if (access.unrestricted) return true;
  return access.grants.get(featureKey)?.actions.has(action) ?? false;
}

/** Is feature par us ka data kitna khula hai. */
export function scopeFor(access: UserAccess, featureKey: string): DataScope | null {
  if (access.unrestricted) return "all";
  return access.grants.get(featureKey)?.scope ?? null;
}

/** Jin feature par kam az kam dekhne ki ijazat hai. */
export function visibleFeatures(access: UserAccess): string[] {
  if (access.unrestricted) return [];
  return [...access.grants.entries()].filter(([, g]) => g.actions.has("view")).map(([key]) => key);
}

/**
 * Department Head kisi ko kya de sakta hai.
 *
 * ===== HARD RULE =====
 * Head sirf wahi de sakta hai jo Master Admin ne USE diya ho. Is ke
 * baghair delegation ek chor darwaza ban jata hai: head khud ko ya kisi
 * aur ko wo ikhtiyar de deta jo us ke paas tha hi nahi. Is liye yahan
 * ijazat hamesha katti hai, barhti nahi.
 */
export function cappedGrant(
  headActions: Action[],
  headScope: DataScope,
  wantActions: Action[],
  wantScope: DataScope
): { actions: Action[]; scope: DataScope } {
  const allowed = new Set(headActions);
  return {
    actions: wantActions.filter((a) => allowed.has(a)),
    scope: narrowerScope(headScope, wantScope),
  };
}
