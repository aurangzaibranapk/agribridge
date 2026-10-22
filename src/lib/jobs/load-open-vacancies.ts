import { createClient } from "@/lib/supabase/server";
import type { VacancySource } from "./vacancy-i18n";

const BASE = "id, title, designation, description, requirements, seats_total, branches(name)";
const WITH_I18N = `${BASE}, title_en, title_ur, title_roman, description_en, description_ur, description_roman, brand, brand_en, brand_ur, brand_roman`;

function branchName(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return branchName(value[0]);
  if (typeof value === "object" && value && "name" in value) {
    const name = (value as { name?: string | null }).name;
    return name?.trim() ? name : null;
  }
  return null;
}

function asSource(row: Record<string, unknown>): VacancySource {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: (row.description as string | null) ?? null,
    requirements: (row.requirements as string | null) ?? null,
    seats_total: row.seats_total == null ? null : Number(row.seats_total),
    branch_name: branchName(row.branches),
    title_en: (row.title_en as string | null) ?? null,
    title_ur: (row.title_ur as string | null) ?? null,
    title_roman: (row.title_roman as string | null) ?? null,
    description_en: (row.description_en as string | null) ?? null,
    description_ur: (row.description_ur as string | null) ?? null,
    description_roman: (row.description_roman as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    brand_en: (row.brand_en as string | null) ?? null,
    brand_ur: (row.brand_ur as string | null) ?? null,
    brand_roman: (row.brand_roman as string | null) ?? null,
  };
}

/**
 * Khuli jagahein. Naye i18n khane migration se pehle na hon to
 * purana select — safha band nahi hota, sirf ek zaban ka purana matn.
 */
export async function loadOpenVacancies(): Promise<VacancySource[]> {
  const supabase = createClient();
  const full = await supabase
    .from("job_vacancies")
    .select(WITH_I18N)
    .eq("is_open", true)
    .order("created_at", { ascending: false });

  const rows = full.error
    ? (
        await supabase
          .from("job_vacancies")
          .select(BASE)
          .eq("is_open", true)
          .order("created_at", { ascending: false })
      ).data
    : full.data;

  return (rows ?? []).map((row) => asSource(row as unknown as Record<string, unknown>));
}
