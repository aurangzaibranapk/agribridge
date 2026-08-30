import type { Database } from "@/lib/types/database.types";

// Darje ka naam wahin se jahan wo waqai tay hote hain -- database ke
// enum se. Alag se likhi hui fehrist ek din DB se alag ho jati hai,
// aur us din koi darja chup chaap kaam karna chhoR deta hai.
export type UserRole = Database["public"]["Enums"]["user_role"];

export const STAFF_ROLES: UserRole[] = [
  "owner",
  "super_admin",
  "admin",
  "manager",
  "sales_staff",
  "finance",
  "warehouse",
  "admin_assistant",
  "hr",
  "procurement",
  "milk_collection",
];

export function getRoleRedirectPath(role: UserRole): string {
  if (STAFF_ROLES.includes(role)) return "/admin";
  if (role === "farmer") return "/portal/dashboard";
  // Vendor hamara mulazim nahi -- us ka apna safha hai, /admin nahi.
  if (role === "machinery_vendor") return "/vendor";
  return "/";
}

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}