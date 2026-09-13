"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserRole } from "@/actions/users";
import { Select } from "@/components/ui/form";
import { DEPARTMENTS } from "@/lib/departments";
import type { UserRole } from "@/lib/utils/roles";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

/**
 * Kisi banday ka role -- yani us ka DEPARTMENT.
 *
 * Yahan pehle aath option haath se likhe hue the. Us ki wajah se
 * /admin/departments par "Machinery -- 0 banday" likha aata tha aur
 * admin samajhta ke abhi kisi ko lagaya nahi; asal baat ye thi ke
 * lagaya ja hi nahi sakta tha -- option maujood hi nahi tha. Yehi haal
 * HR, Procurement aur Dairy ka bhi tha.
 *
 * Ab fehrist DEPARTMENTS se banti hai -- wohi jagah jahan se safha
 * "Department aur Ijazat" bhi banta hai. Kal naya department bane to
 * dono jagah ek sath aa jayega, aur aisi khamoshi dobara nahi hogi.
 *
 * Upar wale teen role (Owner, Super Admin, Admin) kisi department ke
 * nahi -- wo poore idare ke hain, is liye alag likhe hain.
 */
const ORG_ROLES: Array<{ value: UserRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
];

export function RoleSelector({ userId, currentRole }: { userId: string; currentRole: UserRole }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lang = useLang();
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
      <Select
        value={currentRole}
        onChange={(e) => handleChange(e.target.value as UserRole)}
        disabled={pending}
        className="h-8 w-40 text-xs"
      >
        <optgroup label={t("us_organisation", lang)}>
          {ORG_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </optgroup>
        <optgroup label={t("c_department", lang)}>
          {DEPARTMENTS.map((d) => (
            <option key={d.role} value={d.role}>
              {d.label}
            </option>
          ))}
        </optgroup>
      </Select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
