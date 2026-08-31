"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserExtraRoles } from "@/actions/users";
import { DEPARTMENTS } from "@/lib/departments";

/**
 * Ek bande ke DOOSRE department.
 *
 * Yahan dropdown nahi hai, tick hain -- aur ye faisla soch kar kiya
 * gaya. Dropdown ek hi cheez chunne ke liye banta hai; jab ek bande ke
 * do ya teen department ho sakte hon to dropdown har dafa ye jhoot
 * bolta hai ke ek hi ho sakta hai. Tick saamne rakh dete hain ke is
 * waqt kaun se khule hue hain.
 *
 * Asli department (role) yahan nazar nahi aata. Wo saath wale khane
 * mein hai aur wohi us ka ghar hai -- usay yahan dobara dikhana ye
 * bhulawa deta ke shayad usay bhi yahin se hataya ja sakta hai.
 *
 * Har tick foran mehfooz hoti hai. "Save" ka button rakhne ka matlab
 * hota ke koi tick laga kar chala jaye aur usay pata bhi na chale ke
 * kuch mehfooz hua hi nahi.
 */
export function ExtraDepartments({
  userId,
  mainRole,
  current,
}: {
  userId: string;
  mainRole: string;
  current: string[];
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const others = DEPARTMENTS.filter((d) => d.role !== mainRole);

  function toggle(role: string) {
    const next = chosen.includes(role) ? chosen.filter((r) => r !== role) : [...chosen, role];
    setChosen(next);
    setError(null);
    startTransition(async () => {
      const result = await updateUserExtraRoles(userId, next);
      if (result?.error) {
        // Nakaam koshish par tick wapas apni jagah. Warna safha kuch aur
        // dikhata rehta aur database kuch aur kehta.
        setChosen(chosen);
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <details className="w-52">
      <summary className="cursor-pointer text-xs text-surface-500 hover:text-surface-800 dark:hover:text-surface-200">
        {chosen.length === 0
          ? "— (sirf apna department)"
          : chosen
              .map((r) => DEPARTMENTS.find((d) => d.role === r)?.label ?? r)
              .join(", ")}
      </summary>
      <div className="mt-2 space-y-1 rounded-lg border border-surface-200 p-2 dark:border-surface-700">
        {others.map((d) => (
          <label key={d.role} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={chosen.includes(d.role)}
              disabled={pending}
              onChange={() => toggle(d.role)}
            />
            <span>{d.label}</span>
          </label>
        ))}
        <p className="pt-1 text-[11px] leading-snug text-surface-400">
          Jo tick hoga, us department ke safhe bhi khulenge aur us ka data bhi — apne department ke sath sath.
        </p>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </details>
  );
}
