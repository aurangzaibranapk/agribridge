"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: boolean;
}

const ALLOWED_TABLES = ["categories", "brands", "companies"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

function assertAllowed(table: string): asserts table is AllowedTable {
  if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
    throw new Error(`Table "${table}" is not a valid taxonomy table.`);
  }
}

export async function saveTaxonomyItem(table: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  assertAllowed(table);
  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const payload: Record<string, any> = { name };
  if (table === "brands") {
    const logoUrl = formData.get("logo_url");
    if (logoUrl) payload.logo_url = String(logoUrl);
  }

  const { error } = await supabase.from(table).insert(payload);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${table}`);
  revalidatePath("/products");
  return { success: true };
}

export async function deleteTaxonomyItem(table: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  assertAllowed(table);
  const supabase = createClient();
  const { error } = await supabase.from(table).delete().eq("id", String(formData.get("id")));
  if (error) return { error: error.message };

  revalidatePath(`/admin/${table}`);
  revalidatePath("/products");
  return { success: true };
}
