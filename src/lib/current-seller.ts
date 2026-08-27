import { createClient } from "@/lib/supabase/server";

export interface CurrentSeller {
  kind: "branch" | "dealer";
  id: string; // branch_id or dealer_id
  name: string;
  userId: string;
}

/**
 * Resolves the logged-in user's selling identity — either a Branch
 * (via profiles.branch_id) or a Dealer (via dealers.user_id).
 * Used by POS and AgriBridge Ordering so staff never have to manually
 * type/select their own shop details — it's derived from their login.
 * Returns null if the user isn't linked to either.
 */
export async function getCurrentSeller(): Promise<CurrentSeller | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: dealer } = await supabase
    .from("dealers")
    .select("id, business_name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (dealer) {
    return { kind: "dealer", id: dealer.id, name: dealer.business_name, userId: user.id };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("branch_id, branches(name)")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.branch_id) {
    const branchesRel: any = (profile as any).branches;
    const branchName = Array.isArray(branchesRel) ? branchesRel[0]?.name : branchesRel?.name;
    return { kind: "branch", id: profile.branch_id, name: branchName ?? "Branch", userId: user.id };
  }

  return null;
}