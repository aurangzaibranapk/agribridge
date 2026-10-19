/**
 * Admin sidebar + header ka halka rang (19 Oct 2026). Malik pehle chunega,
 * phir sirf ADMIN_TINT ka ek lafz badalna hai. Dark theme har option mein
 * wahi navy rehta hai (sirf light theme ka rang badalta hai).
 *
 * Class strings poori likhi hain taake Tailwind inhein pakar le.
 */
export type AdminTint = "white" | "mint" | "sage" | "navy";

/** <- Malik ki pasand yahan. "white" = aaj wala (koi tabdeeli nahi). */
export const ADMIN_TINT: AdminTint = "white";

export interface AdminTintTokens {
  aside: string;   // sidebar ka pas-manzar + border (light) -- dark navy wahi
  header: string;  // upar wali patti
  hover: string;   // menu item hover (light)
  divider: string; // sidebar ki lakeerein
  legend: string;  // neeche "Naya / baqi" wali chhoti patti
}

const DARK_ASIDE = "dark:border-white/10 dark:bg-[#0b1430]";
const DARK_HEADER = "dark:border-surface-800 dark:bg-surface-900";

export const ADMIN_TINTS: Readonly<Record<AdminTint, AdminTintTokens>> = {
  white: {
    aside: `border-surface-200 bg-white/90 ${DARK_ASIDE}`,
    header: `border-surface-200 bg-white ${DARK_HEADER}`,
    hover: "hover:bg-surface-100",
    divider: "border-surface-200",
    legend: "bg-surface-100",
  },
  mint: {
    aside: `border-[#cdebdc] bg-[#e6f5ec] ${DARK_ASIDE}`,
    header: `border-[#cdebdc] bg-[#f1faf4] ${DARK_HEADER}`,
    hover: "hover:bg-[#d3eedf]",
    divider: "border-[#cdebdc]",
    legend: "bg-[#d6efe1]",
  },
  sage: {
    aside: `border-[#e3dfc9] bg-[#f3f0e1] ${DARK_ASIDE}`,
    header: `border-[#e3dfc9] bg-[#f9f7ee] ${DARK_HEADER}`,
    hover: "hover:bg-[#e7e2cb]",
    divider: "border-[#e3dfc9]",
    legend: "bg-[#e8e4cf]",
  },
  navy: {
    aside: `border-[#d5e0f3] bg-[#e8eefb] ${DARK_ASIDE}`,
    header: `border-[#d5e0f3] bg-[#f3f6fd] ${DARK_HEADER}`,
    hover: "hover:bg-[#d8e3f7]",
    divider: "border-[#d5e0f3]",
    legend: "bg-[#dae4f7]",
  },
};

export const adminTint = (k: AdminTint = ADMIN_TINT): AdminTintTokens => ADMIN_TINTS[k] ?? ADMIN_TINTS.white;
