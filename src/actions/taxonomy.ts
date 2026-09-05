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

/**
 * Form ke beech mein hi nayi Company / Brand / Qism.
 *
 * Malik ka kehna (5 September): *"yahan par company, brand ya category
 * add karna ho to option hona chahiye — wo add ho jayein."*
 *
 * Pehle iska sirf ek raasta tha: form chhor kar Categories ke safhe par
 * jao, wahan bana kar wapas aao — aur us safhe par pahunchte hi product
 * ka aadha bhara hua form, tasveer, aur AI se nikli hui tafseel sab
 * zaya. Is liye log qism khali chhor dete the, aur POS par "Uncategorised"
 * ka dher lag jata tha (52 cheezein).
 *
 * Ye function usi safhe par qatar banata hai aur us ki `id` WAPAS deta
 * hai, taake form usay foran chun le. Kahin jana nahi parta.
 *
 * Naam ka takraao "khata" nahi hai: agar wohi naam pehle se maujood hai
 * to MAUJOODA qatar wapas ki jati hai. Do "Pulses" banana kisi ke kaam
 * ka nahi, aur "pehle se hai" keh kar rok dena bande ko wapas usi safhe
 * par bhej deta hai jahan se hum ne bachaya tha.
 */
export async function addTaxonomyItemInline(
  table: string,
  name: string,
  opts?: { categoryKind?: "karyana" | "agri" }
): Promise<{ id: string; name: string } | { error: string }> {
  assertAllowed(table);
  const clean = name.trim();
  if (!clean) return { error: "Naam likhna zaroori hai." };

  const supabase = createClient();

  // Pehle se maujood? To wohi wapas -- naya banane ki zaroorat nahi.
  const { data: mila } = await supabase
    .from(table)
    .select("id, name")
    .ilike("name", clean)
    .maybeSingle();
  if (mila) return { id: mila.id as string, name: mila.name as string };

  // Har table ka apna insert -- ek hi jagah se `table` bhejne par
  // TypeScript ko qatar ki shakal maloom nahi hoti.
  const { data, error } =
    table === "categories"
      ? await supabase
          .from("categories")
          .insert({ name: clean, category_kind: opts?.categoryKind ?? "karyana" })
          .select("id, name")
          .single()
      : table === "brands"
        ? await supabase.from("brands").insert({ name: clean }).select("id, name").single()
        : await supabase.from("companies").insert({ name: clean }).select("id, name").single();

  // Ijazat na hone par PostgREST khali jawab deta hai, khata nahi (RLS).
  // Us "kuch nahi mila" ko kamyabi samajh lena is project ki purani
  // ghalti hai -- is liye yahan saaf farq kiya ja raha hai.
  if (error) return { error: error.message };
  if (!data) return { error: "Naya indraj nahi bana — shayad ijazat nahi hai." };

  revalidatePath(`/admin/${table}`);
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { id: data.id as string, name: data.name as string };
}
