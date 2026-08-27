import type { UserRole } from "@/lib/types/database.types";

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
  return "/";
}

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}