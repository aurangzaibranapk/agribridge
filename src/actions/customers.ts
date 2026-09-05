"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function saveCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = String(formData.get("phone_number") ?? "").trim();

  if (!name) return { error: "Customer name is required." };
  if (!phoneNumber) return { error: "Phone number is required." };

  const payload = {
    name,
    contact_person: (formData.get("contact_person") as string) || null,
    phone_number: phoneNumber,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    credit_limit: formData.get("credit_limit") ? Number(formData.get("credit_limit")) : 0,
    payment_due_days: formData.get("payment_due_days") ? Number(formData.get("payment_due_days")) : 0,
    // Thok wali dukan par POS khud thok ka rate lagata hai (246). Ye
    // darja gahak par ek dafa likha jata hai, har bill par nahi chuna
    // jata -- warna rate counter wale ki marzi par aa jata.
    customer_type:
      formData.get("customer_type") === "wholesale_shop" ? "wholesale_shop" : "retail",
  };

  const { error } = await supabase.from("customers").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/admin/crm");
  return { success: true };
}

export async function updateCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing customer id." };

  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = String(formData.get("phone_number") ?? "").trim();

  if (!name) return { error: "Customer name is required." };
  if (!phoneNumber) return { error: "Phone number is required." };

  const payload = {
    name,
    contact_person: (formData.get("contact_person") as string) || null,
    phone_number: phoneNumber,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    credit_limit: formData.get("credit_limit") ? Number(formData.get("credit_limit")) : 0,
    payment_due_days: formData.get("payment_due_days") ? Number(formData.get("payment_due_days")) : 0,
    // Thok wali dukan par POS khud thok ka rate lagata hai (246). Ye
    // darja gahak par ek dafa likha jata hai, har bill par nahi chuna
    // jata -- warna rate counter wale ki marzi par aa jata.
    customer_type:
      formData.get("customer_type") === "wholesale_shop" ? "wholesale_shop" : "retail",
  };

  const { error } = await supabase.from("customers").update(payload).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/crm");
  return { success: true };
}