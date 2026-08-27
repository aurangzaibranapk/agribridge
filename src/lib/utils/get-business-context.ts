import { cookies } from "next/headers";
import type { BusinessContext } from "@/actions/business-context";

const VALID: BusinessContext[] = ["master", "karyana", "agri_inputs", "grain_procurement", "dairy", "machinery_fleet"];

export async function getBusinessContext(): Promise<BusinessContext> {
  const cookieStore = await cookies();
  const value = cookieStore.get("business_context")?.value;
  if (value && VALID.includes(value as BusinessContext)) return value as BusinessContext;
  return "master";
}

export const BUSINESS_LABELS: Record<BusinessContext, string> = {
  master: "Master View",
  karyana: "Al Rana Traders (Karyana)",
  agri_inputs: "Agri Inputs",
  grain_procurement: "Grain Procurement",
  dairy: "Dairy",
  machinery_fleet: "Machinery & Fleet",
};