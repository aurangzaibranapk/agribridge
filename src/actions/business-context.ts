"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type BusinessContext = "master" | "karyana" | "agri_inputs" | "grain_procurement" | "dairy" | "machinery_fleet";

export async function setBusinessContext(formData: FormData): Promise<void> {
  const value = String(formData.get("business") ?? "master") as BusinessContext;
  const cookieStore = await cookies();
  cookieStore.set("business_context", value, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/admin", "layout");
}