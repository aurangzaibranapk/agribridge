export type TenantPlan = "internal" | "starter" | "business" | "enterprise";

export const TENANT_PLAN_LIMITS: Record<TenantPlan, { staff: number | null; branches: number | null; products: number | null }> = {
  internal: { staff: null, branches: null, products: null },
  starter: { staff: 10, branches: 3, products: 500 },
  business: { staff: 50, branches: 10, products: 5000 },
  enterprise: { staff: null, branches: null, products: null },
};

export function tenantPlan(value: string | null | undefined): TenantPlan {
  return value === "starter" || value === "business" || value === "enterprise" ? value : "internal";
}

export function limitLabel(value: number | null) {
  return value === null ? "Unlimited" : String(value);
}
