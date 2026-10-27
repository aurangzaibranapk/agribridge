/**
 * Department login ki jagah: ek shaakh, ikhtiyari ek dukan.
 *
 * Column naam schema se: `profiles.branch_id`, `profiles.shop_id`
 * (dono uuid, null ho sakte hain, branches / shops par FK).
 *
 * Finance aur Admin Assistant ka customer portal (migration 572,
 * fn_cp_is_admin) tamam gahak dekhta rehta hai. Shaakh un ki
 * report aur POS ki jagah hai — yahan se portal ki rok nahi badalti.
 */

export const ORG_WIDE_ROLES = ["owner", "super_admin", "admin"] as const;
export const PLACE_EDITORS = ORG_WIDE_ROLES;

/** 572: ye role customer portal par tamam gahak dekhte hain. */
export const CUSTOMER_PORTAL_ALL_CUSTOMERS = ["owner", "super_admin", "admin", "admin_assistant", "finance"] as const;

export type PlaceBranch = { id: string; name: string; is_active?: boolean | null };
export type PlaceShop = { id: string; name: string; branch_id: string | null; is_active?: boolean | null; business_type?: string | null };

export type PlaceVerdict =
  | { ok: true; branchId: string | null; shopId: string | null }
  | { ok: false; error: string };

const SHOP_TYPE_LABELS: Record<string, string> = {
  karyana: "Karyana",
  agri_inputs: "Agri Inputs",
  grain_procurement: "Grain",
  dairy: "Dairy",
  machinery_fleet: "Machinery",
  vet: "Vets",
  central: "Central Warehouse",
};

export function normalizePlaceId(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

export function canEditLoginPlace(role: string | null | undefined, isActive: boolean | null | undefined): boolean {
  return isActive === true && (PLACE_EDITORS as readonly string[]).includes(role ?? "");
}

/** Owner / Super Admin / Admin poori idare par baith sakte hain. Baqi har login ek shaakh. */
export function branchRequired(role: string | null | undefined): boolean {
  return !(ORG_WIDE_ROLES as readonly string[]).includes(role ?? "");
}

export function keepsAllCustomerPortal(role: string | null | undefined): boolean {
  return role === "finance" || role === "admin_assistant";
}

export function shopsForBranch<T extends { id: string; branch_id: string | null; is_active?: boolean | null }>(
  shops: T[],
  branchId: string | null,
  keepShopId?: string | null,
): T[] {
  if (!branchId) return [];
  return shops.filter((shop) => shop.branch_id === branchId && (shop.is_active !== false || shop.id === keepShopId));
}

export function shopOptionLabel(shop: { name: string; business_type?: string | null; is_active?: boolean | null }): string {
  const kind = shop.business_type ? (SHOP_TYPE_LABELS[shop.business_type] ?? shop.business_type) : "";
  const band = shop.is_active === false ? " (band)" : "";
  return kind ? `${shop.name} (${kind})${band}` : `${shop.name}${band}`;
}

export function placeCaption(
  rows: { id: string; name: string }[],
  id: string | null,
): { tone: "none" | "missing" | "named"; text: string | null } {
  if (!id) return { tone: "none", text: null };
  const row = rows.find((item) => item.id === id);
  if (!row) return { tone: "missing", text: null };
  return { tone: "named", text: row.name };
}

/**
 * Branch badalne par doosri shaakh ki dukan khud hat jati hai.
 * Dono ek sath ("both") wahi likhte hain jo form ne bheja.
 */
export function resolvePlaceWrite(
  policy: "both" | "branch" | "shop",
  current: { branchId: string | null; shopId: string | null },
  requested: { branchId: string | null; shopId: string | null },
  shops: { id: string; branch_id: string | null }[],
): { branchId: string | null; shopId: string | null } {
  if (policy === "both") return { branchId: requested.branchId, shopId: requested.shopId };
  if (policy === "shop") return { branchId: current.branchId, shopId: requested.shopId };

  let shopId = current.shopId;
  const branchId = requested.branchId;
  if (!branchId) shopId = null;
  else if (shopId) {
    const shop = shops.find((item) => item.id === shopId);
    if (!shop || shop.branch_id !== branchId) shopId = null;
  }
  return { branchId, shopId };
}

export function validateLoginPlace(input: {
  role: string | null | undefined;
  branchId: string | null;
  shopId: string | null;
  beforeBranchId: string | null;
  beforeShopId: string | null;
  branches: PlaceBranch[];
  shops: PlaceShop[];
}): PlaceVerdict {
  const branchId = input.branchId;
  const shopId = input.shopId;

  if (branchRequired(input.role) && !branchId) {
    return { ok: false, error: "Department login ek hi shaakh par band hai — shaakh chunein." };
  }

  if (branchId) {
    const branch = input.branches.find((item) => item.id === branchId);
    if (!branch) return { ok: false, error: "Ye shaakh fehrist mein nahi." };
    if (branch.is_active === false && branchId !== input.beforeBranchId) {
      return { ok: false, error: "Band shaakh par naya login nahi lagta." };
    }
  }

  if (shopId) {
    if (!branchId) return { ok: false, error: "Dukan se pehle shaakh chunein." };
    const shop = input.shops.find((item) => item.id === shopId);
    if (!shop) return { ok: false, error: "Ye dukan fehrist mein nahi." };
    if (shop.branch_id !== branchId) {
      return { ok: false, error: "Dukan usi shaakh ki honi chahiye jo chuni gayi hai." };
    }
    if (shop.is_active === false && shopId !== input.beforeShopId) {
      return { ok: false, error: "Band dukan par naya login nahi lagta." };
    }
  }

  return { ok: true, branchId, shopId };
}

function placeName(rows: { id: string; name: string }[], id: string | null): string | null {
  if (!id) return null;
  return rows.find((item) => item.id === id)?.name ?? id;
}

function blank(value: string | null): string {
  return value ?? "(khali)";
}

export function describePlaceChange(input: {
  beforeBranchId: string | null;
  beforeShopId: string | null;
  afterBranchId: string | null;
  afterShopId: string | null;
  branches: { id: string; name: string }[];
  shops: { id: string; name: string }[];
}): {
  changed: boolean;
  changes: Record<string, { pehle: string | null; ab: string | null }>;
  description: string;
} {
  const changes: Record<string, { pehle: string | null; ab: string | null }> = {};
  if (input.beforeBranchId !== input.afterBranchId) {
    changes.Shaakh = {
      pehle: placeName(input.branches, input.beforeBranchId),
      ab: placeName(input.branches, input.afterBranchId),
    };
  }
  if (input.beforeShopId !== input.afterShopId) {
    changes.Dukan = {
      pehle: placeName(input.shops, input.beforeShopId),
      ab: placeName(input.shops, input.afterShopId),
    };
  }
  const description = Object.entries(changes)
    .map(([key, row]) => `${key}: ${blank(row.pehle)} → ${blank(row.ab)}`)
    .join(". ");
  return { changed: description.length > 0, changes, description };
}

export function formatAuditChangeLines(changes: unknown): string[] {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(changes as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    if (!("pehle" in value) || !("ab" in value)) continue;
    const row = value as { pehle?: unknown; ab?: unknown };
    lines.push(`${key}: ${showAuditValue(row.pehle)} → ${showAuditValue(row.ab)}`);
  }
  return lines;
}

function showAuditValue(value: unknown): string {
  if (value == null || value === "") return "(khali)";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
