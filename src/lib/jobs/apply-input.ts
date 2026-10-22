import { t, type Lang } from "@/lib/i18n/translations";

type FieldBag = { get(name: string): FormDataEntryValue | null };

export function readApplyFields(formData: FieldBag): {
  vacancyId: string;
  fullName: string;
  email: string;
  lang: Lang;
} {
  const raw = String(formData.get("ui_lang") ?? "");
  const lang: Lang = raw === "en" || raw === "rm" || raw === "ur" ? raw : "en";
  return {
    vacancyId: String(formData.get("vacancy_id") ?? "").trim(),
    fullName: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    lang,
  };
}

/** Naam, email, aur vacancy — wahi teen jo applyToVacancy pehle se maangta hai. */
export function applyInputError(fields: { vacancyId: string; fullName: string; email: string; lang: Lang }): string | null {
  if (!fields.vacancyId || !fields.fullName || !fields.email) return t("sp_apply_required", fields.lang);
  return null;
}
