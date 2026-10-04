"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type BusinessContext = "master" | "karyana" | "agri_inputs" | "grain_procurement" | "dairy" | "machinery_fleet" | "vet";

const CONTEXT_HREF: Record<BusinessContext, string> = {
  // Dropdown business names ko un ke asal, registered dashboards se jorain.
  // Purane context keys (karyana/agri_inputs waghera) dashboard keys nahi
  // thay, is liye un par click karne se dead route khul sakta tha.
  master: "/admin/command-center",
  karyana: "/admin/department-dashboard/shops",
  agri_inputs: "/admin/department-dashboard/product",
  grain_procurement: "/admin/department-dashboard/grain",
  dairy: "/admin/department-dashboard/dairy",
  machinery_fleet: "/admin/department-dashboard/machinery",
  // Vets ka alag canonical dashboard abhi registry mein nahi; is business
  // view ka safe working home livestock/feed page hai.
  vet: "/admin/wanda",
};

export async function setBusinessContext(formData: FormData): Promise<void> {
  const value = String(formData.get("business") ?? "master") as BusinessContext;
  const cookieStore = await cookies();
  cookieStore.set("business_context", value, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(CONTEXT_HREF[value] ?? "/admin/master-dashboard");
}
