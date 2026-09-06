import { redirect } from "next/navigation";

/**
 * "Company Expenses" ab "Paisa & Khata" hai.
 *
 * =====================================================================
 * EK HI KAAM KE DO NAAM THE
 * =====================================================================
 *
 * Malik (6 September): *"Ek hi kaam baar baar naye tag naye naam ke sath
 * nahi hone chahiye... saare ERP ko check karoge, jahan jahan koi bhi
 * [nakal] hai un ko ek ek kar ke hataoge."*
 *
 * Ye safha aur `/admin/kharche` (Paisa & Khata) ek hi table parhte the
 * — `company_expense_requests`. Wohi qatarein, wohi manzoori, do alag
 * naam. Aur wo do naam ek dusre se aage nikal chuke the: Paisa & Khata
 * mein banda, khata, tareekh, mazdoori aur ledger ka raasta bhi hai; ye
 * safha un ke baghair tha.
 *
 * Safha mitaya nahi gaya, MOR diya gaya — kyunke purane link, bookmark
 * aur report ke raaste isi par aate hain. Mita dene se wo har jagah
 * "safha nahi mila" dikhate.
 *
 * `revalidatePath("/admin/company-expenses")` bhi apni jagah hai: ye
 * safha ab kuch dikhata nahi, magar us raaste par aane wale ko taaza
 * jagah par bhejna theek rehta hai.
 */
export default function CompanyExpensesRedirect() {
  redirect("/admin/kharche");
}
