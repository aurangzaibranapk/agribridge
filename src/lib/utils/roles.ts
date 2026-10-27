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
  // Machinery department ka banda bhi mulazim hai. Ye yahan se reh gaya
  // tha, aur us ki saza chup thi: aisa banda login kar ke /admin ke
  // bajaye website par phenk diya jata (getRoleRedirectPath).
  "machinery",
  // Call center /admin mein aata hai, magar api-auth ki staff list mein nahi.
  "call_center_agent",
];

export function getRoleRedirectPath(role: UserRole): string {
  if (role === "call_center_agent") return "/admin/call-center";
  if (STAFF_ROLES.includes(role)) return "/admin/portal";
  if (role === "farmer") return "/portal/dashboard";
  // Phase 5: gahak ka apna Customer Portal (sirf apna khata / bill / adaigi).
  if (role === "customer") return "/portal/c";
  // Dealer ka apna safha. Staff nahi, is liye /admin nahi.
  if (role === "dealer") return "/dealer";
  // Vendor hamara mulazim nahi -- us ka apna safha hai, /admin nahi.
  if (role === "machinery_vendor") return "/vendor";
  return "/";
}

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}
