/**
 * Demand Center ke qaide -- pure functions, taake test ho saken.
 * Maker (staff) recommend karta hai, checker (Admin/Owner) faisla.
 */
export const DEMAND_APPROVER_ROLES = ["owner", "super_admin", "admin"] as const;
export const DEMAND_REVIEWER_BLOCKED_ROLES = ["farmer", "dealer", "buyer", "investor", "customer"] as const;
export type DemandStatus = "pending" | "reviewing" | "approved" | "ordered" | "fulfilled" | "rejected" | "cancelled";

export interface DemandRow {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit: string;
  needed_by: string | null;
  status: string;
  farmer_id: string;
}

export function isApproverRole(role: string | null | undefined) {
  return (DEMAND_APPROVER_ROLES as readonly string[]).includes(String(role ?? ""));
}
export function isReviewerRole(role: string | null | undefined) {
  const r = String(role ?? "");
  return r !== "" && !(DEMAND_REVIEWER_BLOCKED_ROLES as readonly string[]).includes(r);
}

export function canRecommend(a: { role: string; actorId: string; farmerUserId: string | null; status: string }): string | null {
  if (!isReviewerRole(a.role)) return "Sirf staff demand review kar sakta hai.";
  if (a.farmerUserId && a.farmerUserId === a.actorId) return "Apni demand khud review nahi ki ja sakti.";
  if (a.status !== "pending" && a.status !== "reviewing") return "Ye demand ab review ke liye khuli nahi.";
  return null;
}

export function canDecide(a: { role: string; actorId: string; reviewedBy: string | null; farmerUserId: string | null; status: string }): string | null {
  if (!isApproverRole(a.role)) return "Faisla sirf Admin ya Owner karta hai.";
  if (a.status !== "reviewing" || !a.reviewedBy) return "Pehle staff review (note ke sath) zaroori hai.";
  if (a.reviewedBy === a.actorId) return "Review karne wala khud approve nahi kar sakta (maker-checker).";
  if (a.farmerUserId && a.farmerUserId === a.actorId) return "Apni demand khud approve nahi ki ja sakti.";
  return null;
}

export function canMarkOrdered(a: { role: string; status: string }): string | null {
  if (!isApproverRole(a.role)) return "Order sirf Admin ya Owner mark karta hai.";
  if (a.status !== "approved") return "Sirf approved demand ordered ho sakti hai.";
  return null;
}

export interface ProductAggregate {
  key: string;
  productName: string;
  unit: string;
  totalQuantity: number;
  farmers: number;
  earliestNeededBy: string | null;
  latestNeededBy: string | null;
  counts: { pending: number; approved: number; rejected: number; ordered: number };
}

/** Product-wise jama: kul miqdar, kisan, zaroorat ki tareekhein, status ginti. */
export function aggregateDemands(rows: DemandRow[]): ProductAggregate[] {
  const map = new Map<string, ProductAggregate & { farmerSet: Set<string> }>();
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    const key = `${r.product_id ?? r.product_name.trim().toLowerCase()}|${r.unit}`;
    let a = map.get(key);
    if (!a) {
      a = { key, productName: r.product_name.trim(), unit: r.unit, totalQuantity: 0, farmers: 0, earliestNeededBy: null, latestNeededBy: null,
        counts: { pending: 0, approved: 0, rejected: 0, ordered: 0 }, farmerSet: new Set() };
      map.set(key, a);
    }
    if (r.status !== "rejected") a.totalQuantity = Math.round((a.totalQuantity + Number(r.quantity || 0)) * 1000) / 1000;
    a.farmerSet.add(r.farmer_id);
    if (r.needed_by) {
      if (!a.earliestNeededBy || r.needed_by < a.earliestNeededBy) a.earliestNeededBy = r.needed_by;
      if (!a.latestNeededBy || r.needed_by > a.latestNeededBy) a.latestNeededBy = r.needed_by;
    }
    if (r.status === "pending" || r.status === "reviewing") a.counts.pending++;
    else if (r.status === "approved") a.counts.approved++;
    else if (r.status === "rejected") a.counts.rejected++;
    else if (r.status === "ordered" || r.status === "fulfilled") a.counts.ordered++;
  }
  return [...map.values()]
    .map(({ farmerSet, ...a }) => ({ ...a, farmers: farmerSet.size }))
    .sort((x, y) => y.totalQuantity - x.totalQuantity);
}
