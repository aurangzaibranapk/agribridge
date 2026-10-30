import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserPlaceCard } from "@/app/admin/users/user-place-card";
import type { PlaceBranch, PlaceShop } from "@/lib/access/login-place";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login place preview",
  robots: { index: false, follow: false },
};

const branches: PlaceBranch[] = [
  { id: "mah", name: "Main Branch Mahabali", is_active: true },
  { id: "nb", name: "157 NB", is_active: true },
];

const shops: PlaceShop[] = [
  { id: "dukan", name: "Kisaan Dukan Mahabali", branch_id: "mah", business_type: "agri_inputs", is_active: true },
  { id: "karyana", name: "Kisaan Karyana Mahabali", branch_id: "mah", business_type: "karyana", is_active: true },
  { id: "milk", name: "Kisaan Milk Center", branch_id: "mah", business_type: "dairy", is_active: true },
  { id: "grain", name: "Kisaan Procurement Mahabali", branch_id: "mah", business_type: "grain_procurement", is_active: true },
  { id: "nbk", name: "157 Karyana", branch_id: "nb", business_type: "karyana", is_active: true },
];

const rows = [
  { id: "sales", fullName: "Sales Team", role: "sales_staff", branchId: "mah", shopId: "dukan", open: true },
  { id: "finance", fullName: "Finance Team", role: "finance", branchId: "mah", shopId: null, open: false },
];

/** Dev screenshot of the real card. Production par 404. Kuch likha nahi jata. */
export default function UserPlacePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="min-h-screen bg-[#e7f2ea] md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden flex-col gap-1 bg-[#0f3a2e] p-4 text-sm text-[#d7efe2] md:flex">
        <p className="text-base font-semibold text-white">AgriBridge</p>
        <p className="rounded-lg px-2 py-1.5 text-[#b7d7c4]">Dashboard</p>
        <p className="rounded-lg bg-white/15 px-2 py-1.5 font-semibold text-white">Users aur Role</p>
      </aside>
      <main className="px-4 py-6 sm:px-8">
        <p className="text-xs font-medium text-emerald-900">Preview — yahan se koi login save nahi hota.</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-surface-900">Log aur un ke darje</h1>
        <p className="mt-1 max-w-xl text-sm text-surface-600">
          Ek shaakh. Dukan ikhtiyari hai aur usi shaakh ki honi chahiye. Sirf Owner ya Admin badalte hain.
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-sm backdrop-blur">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left text-xs text-surface-400">
                <th className="px-4 py-3">Naam</th>
                <th className="px-4 py-3">Shaakh</th>
                <th className="px-4 py-3">Dukan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-surface-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-surface-800">{row.fullName}</td>
                  <td className="px-4 py-3 text-xs text-surface-700">
                    {branches.find((branch) => branch.id === row.branchId)?.name}
                    <UserPlaceCard
                      userId={row.id}
                      fullName={row.fullName}
                      role={row.role}
                      branchId={row.branchId}
                      shopId={row.shopId}
                      branches={branches}
                      shops={shops}
                      initialOpen={row.open}
                      previewMode
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-surface-700">
                    {shops.find((shop) => shop.id === row.shopId)?.name ?? "Poori shaakh"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
