import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Livestock -> Dairy Management (malik ki manzoori, 19 Oct 2026).
 * Is safhe ke dono kaam ab /portal/dairy par hain:
 *   - "Doodh ki farokht" (buyer, rate, L/din, doodh par advance) -- wohi `farmers` khane
 *   - "Maweshi loan" -- wohi `livestock_loans` (staff manzoori)
 * Purane links / bookmarks yahan aa kar Dairy par chale jate hain.
 * Koi data delete nahi hua; purane form components (livestock-form,
 * livestock-details-form) aur admin screens wahin hain.
 */
export default function LivestockMovedToDairy() {
  redirect("/portal/dairy");
}
