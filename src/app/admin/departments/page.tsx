import { redirect } from "next/navigation";

/**
 * Department-wide defaults used to grant permissions automatically and
 * duplicated the per-person access workflow. Keep old bookmarks working,
 * but send administrators to the single explicit-save access screen.
 */
export default function DepartmentsPage() {
  redirect("/admin/staff-access");
}
