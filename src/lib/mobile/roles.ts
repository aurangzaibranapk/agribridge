/**
 * Portal ka role → mobile app ka ghar.
 *
 * milk_collection ek hi portal role hai. MCA aur MCO alag desk hain:
 * staff_details.field_app_role (migration 698) pehle, warna designation.
 * Khali ho to maidan wala MCA — chiller wala banda designation se MCO banta hai.
 */

export type AppRole =
  | "farmer"
  /** Purane saved sessions ke liye. Naya customer login farmer ghar par canonical hota hai. */
  | "customer"
  | "staff"
  | "supplier"
  | "dealer"
  | "mca"
  | "mco"
  | "admin"
  | "vet";

const ADMIN = new Set(["owner", "super_admin", "admin", "admin_assistant"]);

export function isPortalAdmin(role: string | null | undefined): boolean {
  return ADMIN.has(String(role ?? "").trim());
}
const STAFF = new Set([
  "manager",
  "sales_staff",
  "finance",
  "warehouse",
  "hr",
  "procurement",
  "machinery",
  "call_center_agent",
  "investor",
  "company_rep",
  "ai_assistant",
]);

export function appRoleFor(input: {
  role: string | null | undefined;
  designation?: string | null;
  fieldAppRole?: string | null;
}): AppRole {
  const explicit = String(input.fieldAppRole ?? "").trim().toLowerCase();
  if (explicit === "mca" || explicit === "mco") return explicit;

  const role = String(input.role ?? "").trim();
  if (role === "farmer") return "farmer";
  if (role === "customer") return "farmer";
  if (role === "dealer") return "dealer";
  if (role === "machinery_vendor") return "supplier";
  if (role === "agronomist") return "vet";
  if (ADMIN.has(role)) return "admin";
  if (role === "milk_collection") {
    const desk = String(input.designation ?? "").toLowerCase();
    if (/\bmco\b|chiller/.test(desk)) return "mco";
    return "mca";
  }
  if (STAFF.has(role)) return "staff";
  return "staff";
}

/** Kisan aur customer ek hi mobile account/ghar hain. Purana saved role bhi yahin aata hai. */
export function canonicalAppRole(role: AppRole | string | null | undefined): AppRole {
  return role === "customer" ? "farmer" : (role as AppRole);
}

/** Portal LLM: kisan ka assistant, ya staff ka Abram. Baqi ke liye chat nahi. */
export function supportChatKind(portalRole: string | null | undefined): "farmer" | "staff" | null {
  const role = String(portalRole ?? "");
  if (role === "farmer" || role === "customer") return "farmer";
  const staff = new Set([
    "owner", "super_admin", "admin", "admin_assistant", "manager",
    "sales_staff", "finance", "warehouse", "hr", "procurement", "milk_collection",
    "machinery",
  ]);
  return staff.has(role) ? "staff" : null;
}
