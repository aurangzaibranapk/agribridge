"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type BusinessContext = "master" | "karyana" | "agri_inputs" | "grain_procurement" | "dairy" | "machinery_fleet" | "vet";

const CONTEXT_HREF: Record<BusinessContext, string> = {
  master: "/admin/command-center",
  karyana: "/admin/department-dashboard/karyana",
  agri_inputs: "/admin/department-dashboard/agri_inputs",
  grain_procurement: "/admin/department-dashboard/grain_procurement",
  dairy: "/admin/department-dashboard/dairy",
  machinery_fleet: "/admin/department-dashboard/machinery_fleet",
  vet: "/admin/department-dashboard/vet",
};

export async function setBusinessContext(formData: FormData): Promise<void> {
  const value = String(formData.get("business") ?? "master") as BusinessContext;
  const cookieStore = await cookies();
  cookieStore.set("business_context", value, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(CONTEXT_HREF[value] ?? "/admin/command-center");
}