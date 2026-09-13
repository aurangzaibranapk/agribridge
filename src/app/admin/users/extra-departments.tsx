"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserExtraRoles } from "@/actions/users";
import { DEPARTMENTS } from "@/lib/departments";
import { X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

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
 *
 * -------------------------------------------------------------------
 * BAND KARNE KA RAASTA
 *
 * Malik (6 September): *"is ke upar cross ka nishan lagayein. Ab kuch
 * select hi nahi karna, is ko hatana hai to ye nahi hat raha jab tak
 * refresh nahi karenge."*
 *
 * Pehle ye `<details>` tha aur har tick ke baad safha khud taza hota
 * tha -- us taza hone mein khana dobara khul kar saamne aa jata tha, aur
 * band karne ka koi saaf raasta nazar nahi aata tha. Banda phans jata
 * tha.
 *
 * Ab khulna aur band hona hamare apne haath mein hai: kone mein cross,
 * Escape se bhi band, aur bahar kahin dabane se bhi. Teen raaste is
 * liye ke har banda alag tarah se band karne ki koshish karta hai.
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
  const lang = useLang();
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

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

  const khaanaRef = useRef<HTMLDivElement | null>(null);

  // Escape se band, aur bahar dabane se bhi.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (khaanaRef.current && !khaanaRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const likhai =
    chosen.length === 0
      ? "— (sirf apna department)"
      : chosen.map((r) => DEPARTMENTS.find((d) => d.role === r)?.label ?? r).join(", ");

  return (
    <div ref={khaanaRef} className="relative w-52">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-left text-xs text-surface-500 hover:text-surface-800 dark:hover:text-surface-200"
      >
        {open ? "\u25bc" : "\u25b6"} {likhai}
      </button>

      {open && (
        <div className="mt-2 space-y-1 rounded-lg border border-surface-200 bg-white p-2 shadow-lg dark:border-surface-700 dark:bg-surface-900">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">
              Doosre department
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Band karein"
              className="-mr-1 -mt-1 rounded p-0.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-800 dark:hover:text-surface-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

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
          <p className="pt-1 text-[11px] leading-snug text-surface-400">{t("at_ticked_depts", lang)}</p>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
