import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { profileKaKhanaBadlein } from "@/lib/profile-write";
import {
  canEditLoginPlace,
  describePlaceChange,
  normalizePlaceId,
  resolvePlaceWrite,
  validateLoginPlace,
  type PlaceBranch,
  type PlaceShop,
} from "@/lib/access/login-place";

export interface PlaceActionState {
  error?: string;
  success?: boolean;
  notice?: string;
}

const NO_CHANGE = "Koi tabdeeli nahi — record nahi likha.";

/**
 * `profiles.branch_id` aur `profiles.shop_id` ek sath, sirf Owner/Admin.
 *
 * Likhai service client se hai (profiles par UPDATE ka RLS qanoon nahi —
 * dekhein profile-write.ts). Purani aur nayi jagah Activity Log par
 * `user_place` module mein naam se likhi jati hai, sirf id se nahi.
 *
 * Customer portal ki RLS (572) yahan se nahi chherti.
 */
export async function commitLoginPlace(input: {
  userId: string;
  policy: "both" | "branch" | "shop";
  branchId: string | null;
  shopId: string | null;
}): Promise<PlaceActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active, organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditLoginPlace(me?.role, me?.is_active)) {
    return { error: "Shaakh aur dukan sirf Owner ya Admin badal sakte hain." };
  }
  if (!me?.organization_id) return { error: "Idara maloom nahi." };

  const userId = input.userId.trim();
  if (!userId) return { error: "Banda maloom nahi." };

  const service = createServiceClient();
  const { data: target, error: targetError } = await service
    .from("profiles")
    .select("id, full_name, role, branch_id, shop_id, organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return { error: targetError.message };
  if (!target) return { error: "Ye login mila nahi." };
  if (target.organization_id !== me.organization_id) return { error: "Ye login aap ke idare ka nahi." };

  const { data: branchRows, error: branchError } = await service
    .from("branches")
    .select("id, name, is_active")
    .eq("organization_id", me.organization_id);
  if (branchError) return { error: branchError.message };
  const branches = (branchRows ?? []) as PlaceBranch[];

  const branchIds = branches.map((branch) => branch.id);
  let shops: PlaceShop[] = [];
  if (branchIds.length > 0) {
    const { data: shopRows, error: shopError } = await service
      .from("shops")
      .select("id, name, branch_id, is_active")
      .in("branch_id", branchIds);
    if (shopError) return { error: shopError.message };
    shops = (shopRows ?? []) as PlaceShop[];
  }

  const next = resolvePlaceWrite(
    input.policy,
    { branchId: target.branch_id, shopId: target.shop_id },
    { branchId: input.branchId, shopId: input.shopId },
    shops,
  );
  const verdict = validateLoginPlace({
    role: target.role,
    branchId: next.branchId,
    shopId: next.shopId,
    beforeBranchId: target.branch_id,
    beforeShopId: target.shop_id,
    branches,
    shops,
  });
  if (!verdict.ok) return { error: verdict.error };

  const nameBranches = await rowForName(branches, target.branch_id, async (id) => {
    const { data } = await service.from("branches").select("id, name, is_active").eq("id", id).maybeSingle();
    return data as PlaceBranch | null;
  });
  const nameShops = await rowForName(shops, target.shop_id, async (id) => {
    const { data } = await service.from("shops").select("id, name, branch_id, is_active").eq("id", id).maybeSingle();
    return data as PlaceShop | null;
  });

  const change = describePlaceChange({
    beforeBranchId: target.branch_id,
    beforeShopId: target.shop_id,
    afterBranchId: verdict.branchId,
    afterShopId: verdict.shopId,
    branches: nameBranches,
    shops: nameShops,
  });
  if (!change.changed) {
    revalidatePath("/admin/users");
    return { success: true, notice: NO_CHANGE };
  }

  const written = await profileKaKhanaBadlein(userId, {
    branch_id: verdict.branchId,
    shop_id: verdict.shopId,
  });
  if (written.error) return { error: written.error };

  await logAudit({
    actionType: "update",
    module: "user_place",
    recordId: userId,
    recordLabel: target.full_name,
    description: change.description,
    changes: change.changes,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/activity-logs");
  return { success: true, notice: change.description };
}

async function rowForName<T extends { id: string }>(
  rows: T[],
  id: string | null,
  load: (id: string) => Promise<T | null>,
): Promise<T[]> {
  if (!id || rows.some((row) => row.id === id)) return rows;
  const extra = await load(id);
  return extra ? [...rows, extra] : rows;
}

export function readPlaceForm(formData: FormData): { userId: string; branchId: string | null; shopId: string | null } {
  return {
    userId: String(formData.get("user_id") ?? ""),
    branchId: normalizePlaceId(formData.get("branch_id")),
    shopId: normalizePlaceId(formData.get("shop_id")),
  };
}
