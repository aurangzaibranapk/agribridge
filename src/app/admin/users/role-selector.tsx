"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserRole } from "@/actions/users";
import { Select } from "@/components/ui/form";
import type { UserRole } from "@/lib/utils/roles";
export function RoleSelector({ userId, currentRole }: { userId: string; currentRole: UserRole }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function handleChange(role: UserRole) {
    setError(null);
    startTransition(async () => {
      const result = await updateUserRole(userId, role);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }
  return (
    <div>
      <Select value={currentRole} onChange={(e) => handleChange(e.target.value as UserRole)} disabled={pending} className="h-8 w-40 text-xs">
        <option value="owner">Owner</option>
        <option value="super_admin">Super Admin</option>
        <option value="admin">Admin</option>
        <option value="manager">Manager (Shop Manager)</option>
        <option value="sales_staff">Sales Staff</option>
        <option value="finance">Finance</option>
        <option value="warehouse">Warehouse</option>
        <option value="admin_assistant">Admin Assistant</option>
      </Select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}