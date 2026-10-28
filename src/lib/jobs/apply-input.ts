import { t, type Lang } from "@/lib/i18n/translations";

type FieldBag = { get(name: string): FormDataEntryValue | null };

/** Stored values. Staff profile uses the same three (`chk_staff_gender`). */
export const APPLY_GENDERS = ["male", "female", "other"] as const;
export type ApplyGender = (typeof APPLY_GENDERS)[number];

/** ID card par yahi aath groups chhapte hain. Khali = abhi maloom nahi. */
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const BLOOD_ALIASES: Record<string, (typeof BLOOD_GROUPS)[number]> = {
  "A+": "A+", "A-": "A-", "B+": "B+", "B-": "B-", "AB+": "AB+", "AB-": "AB-", "O+": "O+", "O-": "O-",
  APOS: "A+", APOSITIVE: "A+", ANEG: "A-", ANEGATIVE: "A-", "A+VE": "A+", "A-VE": "A-",
  BPOS: "B+", BPOSITIVE: "B+", BNEG: "B-", BNEGATIVE: "B-", "B+VE": "B+", "B-VE": "B-",
  ABPOS: "AB+", ABPOSITIVE: "AB+", ABNEG: "AB-", ABNEGATIVE: "AB-", "AB+VE": "AB+", "AB-VE": "AB-",
  OPOS: "O+", OPOSITIVE: "O+", ONEG: "O-", ONEGATIVE: "O-", "O+VE": "O+", "O-VE": "O-",
};

export function staffGenderOrNull(value: unknown): ApplyGender | null {
  const gender = String(value ?? "").trim().toLowerCase();
  return (APPLY_GENDERS as readonly string[]).includes(gender) ? (gender as ApplyGender) : null;
}

/** "O positive" / "o+" → "O+". Khali ya anjaan qeemat null. */
export function bloodGroupOrNull(value: unknown): string | null {
  const raw = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return null;
  return BLOOD_ALIASES[raw] ?? null;
}

export function readApplyFields(formData: FieldBag): {
  vacancyId: string;
  fullName: string;
  email: string;
  gender: string;
  bloodGroup: string;
  emergencyName: string;
  emergencyPhone: string;
  lang: Lang;
} {
  const raw = String(formData.get("ui_lang") ?? "");
  const lang: Lang = raw === "en" || raw === "rm" || raw === "ur" ? raw : "en";
  return {
    vacancyId: String(formData.get("vacancy_id") ?? "").trim(),
    fullName: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    gender: String(formData.get("gender") ?? "").trim().toLowerCase(),
    bloodGroup: String(formData.get("blood_group") ?? "").trim(),
    emergencyName: String(formData.get("emergency_contact_name") ?? "").trim(),
    emergencyPhone: String(formData.get("emergency_contact_phone") ?? "").trim(),
    lang,
  };
}

function loosePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Naam, email, vacancy, aur gender — public form in chaaron ko maangta hai. Blood aur emergency optional hain. */
export function applyInputError(fields: {
  vacancyId: string;
  fullName: string;
  email: string;
  gender: string;
  bloodGroup?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  lang: Lang;
}): string | null {
  if (!fields.vacancyId || !fields.fullName || !fields.email || !fields.gender) return t("sp_apply_required", fields.lang);
  if (!staffGenderOrNull(fields.gender)) return t("sp_apply_required", fields.lang);
  if (fields.bloodGroup && !bloodGroupOrNull(fields.bloodGroup)) return t("sp_blood_invalid", fields.lang);
  if ((fields.emergencyName ?? "").length > 80) return t("sp_emergency_invalid", fields.lang);
  if (fields.emergencyPhone && !loosePhone(fields.emergencyPhone)) return t("sp_emergency_invalid", fields.lang);
  return null;
}
