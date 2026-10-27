import { bloodGroupOrNull, staffGenderOrNull } from "@/lib/jobs/apply-input";

/** Trimmed text, ya null jab khana khali ho. Dash yahan value nahi maani jati. */
export function filledText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text === "—" || text === "–") return null;
  return text;
}

export interface IdCardSources {
  fullName?: string | null;
  designation?: string | null;
  employeeCode?: string | null;
  branchName?: string | null;
  staffPhone?: string | null;
  whatsappNumber?: string | null;
  profilePhone?: string | null;
  applicationPhone?: string | null;
  staffCnic?: string | null;
  applicationCnic?: string | null;
  staffPhoto?: string | null;
  applicationPhoto?: string | null;
  staffBlood?: string | null;
  applicationBlood?: string | null;
  staffEmergencyName?: string | null;
  applicationEmergencyName?: string | null;
  staffEmergencyPhone?: string | null;
  applicationEmergencyPhone?: string | null;
}

export interface IdCardFields {
  fullName: string;
  designation: string;
  employeeCode: string | null;
  branchName: string | null;
  phone: string | null;
  cnic: string | null;
  photoUrl: string | null;
  bloodGroup: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
}

function first(...values: Array<unknown>): string | null {
  for (const value of values) {
    const text = filledText(value);
    if (text) return text;
  }
  return null;
}

/**
 * Staff record pehle. Jo khana khali ho, joined application se bharo.
 * Blood staff par jaisa darj hai waisa dikhao (settings free text).
 * Application se aane wali blood sirf maani hui group ho.
 */
export function mergeIdCard(sources: IdCardSources): IdCardFields {
  const staffBlood = filledText(sources.staffBlood);
  const applicationBlood = bloodGroupOrNull(sources.applicationBlood);
  return {
    fullName: first(sources.fullName) ?? "Staff",
    designation: first(sources.designation) ?? "",
    employeeCode: first(sources.employeeCode),
    branchName: first(sources.branchName),
    phone: first(sources.staffPhone, sources.whatsappNumber, sources.profilePhone, sources.applicationPhone),
    cnic: first(sources.staffCnic, sources.applicationCnic),
    photoUrl: first(sources.staffPhoto, sources.applicationPhoto),
    bloodGroup: staffBlood ?? applicationBlood,
    emergencyName: first(sources.staffEmergencyName, sources.applicationEmergencyName),
    emergencyPhone: first(sources.staffEmergencyPhone, sources.applicationEmergencyPhone),
  };
}

export function cardMessage(card: IdCardFields, emptyLabel: string): string {
  const line = (label: string, value: string | null) => `${label} ${value ?? emptyLabel}`;
  const rows = [
    "AgriBridge - Staff ID Card",
    line("Name:", card.fullName),
    line("Designation:", card.designation || null),
  ];
  if (card.employeeCode) rows.push(`Employee code: ${card.employeeCode}`);
  if (card.branchName) rows.push(`Branch: ${card.branchName}`);
  rows.push(line("Phone:", card.phone), line("CNIC:", card.cnic), line("Blood group:", card.bloodGroup));
  const emergency = [card.emergencyName, card.emergencyPhone].filter(Boolean).join(" ");
  rows.push(line("Emergency:", emergency || null));
  return rows.join("\n");
}

/** 0303… → 92303… taake wa.me seedha staff ke number par khule. */
export function pkWhatsAppDigits(phone: string | null): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("3")) return `92${digits}`;
  return null;
}

export function whatsAppUrl(phone: string | null, text: string): string {
  const digits = pkWhatsAppDigits(phone);
  const query = `text=${encodeURIComponent(text)}`;
  return digits ? `https://wa.me/${digits}?${query}` : `https://wa.me/?${query}`;
}

export function mailtoUrl(name: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(`${name} - ID Card`)}&body=${encodeURIComponent(body)}`;
}

export interface HireApplication {
  id?: string | null;
  phone?: string | null;
  cnic?: string | null;
  address?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  photo_url?: string | null;
}

export interface HireOffer {
  id?: string | null;
  status?: string | null;
  designation?: string | null;
  proposed_salary?: number | null;
}

/**
 * Join par staff_details mein wahi khane jo application par hon.
 * Pehle se bhara khana nahi mitta. Offer ka link sirf qubool shuda offer ka.
 */
export function hireStaffPatch(
  existing: Record<string, unknown> | null,
  application: HireApplication,
  offer: HireOffer | null,
): Record<string, unknown> {
  const incoming: Record<string, unknown> = {
    designation: filledText(offer?.designation),
    basic_salary: offer?.proposed_salary ?? null,
    phone: filledText(application.phone),
    cnic: filledText(application.cnic),
    address: filledText(application.address),
    gender: staffGenderOrNull(application.gender),
    blood_group: bloodGroupOrNull(application.blood_group),
    emergency_contact_name: filledText(application.emergency_contact_name),
    emergency_contact_phone: filledText(application.emergency_contact_phone),
    photo_url: filledText(application.photo_url),
    application_id: filledText(application.id),
    offer_id: offer?.status === "accepted" ? filledText(offer.id) : null,
  };
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value == null || value === "") continue;
    if (existing && filledText(existing[key])) continue;
    patch[key] = value;
  }
  return patch;
}
