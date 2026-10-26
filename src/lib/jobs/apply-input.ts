import { t, type Lang } from "@/lib/i18n/translations";

type FieldBag = { get(name: string): FormDataEntryValue | null };

/** Stored values. Staff profile uses the same three (`chk_staff_gender`). */
export const APPLY_GENDERS = ["male", "female", "other"] as const;
export type ApplyGender = (typeof APPLY_GENDERS)[number];

export function staffGenderOrNull(value: unknown): ApplyGender | null {
  const gender = String(value ?? "").trim().toLowerCase();
  return (APPLY_GENDERS as readonly string[]).includes(gender) ? (gender as ApplyGender) : null;
}

export function readApplyFields(formData: FieldBag): {
  vacancyId: string;
  fullName: string;
  email: string;
  gender: string;
  lang: Lang;
} {
  const raw = String(formData.get("ui_lang") ?? "");
  const lang: Lang = raw === "en" || raw === "rm" || raw === "ur" ? raw : "en";
  return {
    vacancyId: String(formData.get("vacancy_id") ?? "").trim(),
    fullName: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    gender: String(formData.get("gender") ?? "").trim().toLowerCase(),
    lang,
  };
}

/** Naam, email, vacancy, aur gender — public form in chaaron ko maangta hai. */
export function applyInputError(fields: {
  vacancyId: string;
  fullName: string;
  email: string;
  gender: string;
  lang: Lang;
}): string | null {
  if (!fields.vacancyId || !fields.fullName || !fields.email || !fields.gender) return t("sp_apply_required", fields.lang);
  if (!staffGenderOrNull(fields.gender)) return t("sp_apply_required", fields.lang);
  return null;
}
