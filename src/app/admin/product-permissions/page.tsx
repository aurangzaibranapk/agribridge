import { redirect } from "next/navigation";

/** Product permissions ab unified Staff & Access Control ke andar hain. */
export default function ProductPermissionsPage() {
  redirect("/admin/staff-access");
}
