import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import type { Action, DataScope } from "@/lib/access/types";

/**
 * Kaam karne se pehle ki rok.
 *
 * Marhala 3 tak sirf ek sawal tha: safha khulta hai ya nahi. Magar
 * safha khul jane ka matlab ye nahi ke banda us par har kaam kar sakta
 * hai. "Cash Book dekh sakta hai magar entry nahi kar sakta" -- ye baat
 * safhe ki rok se kahi hi nahi ja sakti.
 *
 * Ye rok purani role wali rok ki JAGAH nahi, us ke UPAR lagti hai. Dono
 * chalti hain, aur jo pehle rok de wo chalti hai. Purani hata dena aasan
 * hota, magar phir ek hi ghalti (kisi feature ki ijazat ghalat set ho
 * jana) poore darwaze khol deti.
 *
 * SAHARA: agar is banday ki koi feature wali ijazat hai hi nahi (naya
 * system, ya wo purane raaste par chal raha hai), to ye rok chup chaap
 * haath utha leti hai aur faisla purani role wali rok par chhor deti
 * hai. Warna is marhale ki deploy hote hi har banda har kaam se ruk
 * jata -- aur wajah kisi ko nazar na aati.
 */

export interface Caller {
  userId: string;
  role: string;
  branchId: string | null;
  unrestricted: boolean;
  /** Feature wali ijazat mili hi nahi -- purani rok par bharosa karo. */
  legacy: boolean;
  scope: DataScope;
}

export type GuardResult = { caller: Caller } | { error: string };

export async function requireAction(featureKey: string, action: Action): Promise<GuardResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, branch_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) return { error: "Ye account fa'aal nahi hai." };

  if (UNRESTRICTED_ROLES.includes(profile.role)) {
    return {
      caller: {
        userId: user.id,
        role: profile.role,
        branchId: profile.branch_id,
        unrestricted: true,
        legacy: false,
        scope: "all",
      },
    };
  }

  const service = createServiceClient();
  const { data: rows } = await service
    .from("v_user_feature_access")
    .select("feature_key, actions, data_scope")
    .eq("profile_id", user.id);

  const base = {
    userId: user.id,
    role: profile.role,
    branchId: profile.branch_id,
    unrestricted: false,
  };

  if (!rows || rows.length === 0) {
    // Purane raaste par hai -- faisla wahin hoga.
    return { caller: { ...base, legacy: true, scope: "own_branch" } };
  }

  // Ek hi feature par do jagah se ijazat aa sakti hai (role ki aur apni).
  // Dono jama karte hain, kyunke dono jaan boojh kar di gayi thin.
  const mine = rows.filter((r) => r.feature_key === featureKey);
  const actions = new Set<string>();
  let scope: DataScope = "own_records";
  const RANK: Record<DataScope, number> = { all: 4, own_branch: 3, own_shop: 2, own_records: 1 };
  for (const row of mine) {
    for (const a of (row.actions as string[] | null) ?? []) actions.add(a);
    const s = row.data_scope as DataScope;
    if (RANK[s] > RANK[scope]) scope = s;
  }

  if (!actions.has(action)) {
    return { error: `Aapko is kaam ki ijazat nahi hai (${featureKey} → ${action}).` };
  }

  return { caller: { ...base, legacy: false, scope } };
}

/**
 * Sirf poochhna -- rokna nahi. Button dikhana hai ya nahi, ye us ke
 * liye.
 *
 * Band button dikhana banday ka waqt bhi zaya karta hai aur bharosa
 * bhi: wo dabata hai, kuch nahi hota, aur samajh nahi aata kis se kahe.
 */
export async function canDo(featureKey: string, action: Action): Promise<boolean> {
  const result = await requireAction(featureKey, action);
  if ("error" in result) return false;
  // Purane raaste par ho to button chhupate nahi -- purani rok us ka
  // faisla khud kar legi.
  return true;
}

/**
 * Data kitna dikhega -- query par lagane wala hissa.
 *
 * Column ka naam har table mein alag hota hai, is liye bulane wala
 * batata hai. Andaza lagana yahan mehnga parta: ghalat column par filter
 * lagne se ya to sab kuch dikhne lagta hai ya kuch bhi nahi, aur dono
 * soorton mein masla der se pakra jata hai.
 */
export interface ScopeColumns {
  branch?: string;
  shop?: string;
  owner?: string;
}

export function applyScope<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  caller: Caller,
  columns: ScopeColumns
): T {
  if (caller.unrestricted || caller.scope === "all") return query;

  if (caller.scope === "own_records" && columns.owner) {
    return query.eq(columns.owner, caller.userId);
  }

  if (caller.scope === "own_shop" && columns.shop && caller.branchId) {
    return query.eq(columns.shop, caller.branchId);
  }

  if (columns.branch && caller.branchId) {
    return query.eq(columns.branch, caller.branchId);
  }

  return query;
}
