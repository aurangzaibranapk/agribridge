import Link from "next/link";
import { Droplet, Wheat, Tractor, ShoppingCart, Warehouse, Truck, Wallet, Users } from "lucide-react";
import PnlPage from "@/app/admin/reports/pnl/page";

export const dynamic = "force-dynamic";

/**
 * Branch Dashboard -- "Branches" ki fehrist se seedha, Reports mein
 * dhoondhna nahi paRta.
 *
 * Malik (8 September): "Branch par click karte hi seedha uska poora
 * dashboard khule -- Budget, Sales, Stock, Kharche sab kuch usi ek
 * jagah mile."
 *
 * Ye poora hisaab (branch → har shop → budget/sale/stock/kharcha)
 * `/admin/reports/pnl` mein pehle se ban chuka hai aur asal data se
 * verify ho chuka hai. Yahan wohi engine reuse hota hai -- dobara
 * likhna do jagah do hisaab ka khatra banata (is project mein pehle
 * bhi ho chuka hai). Sirf DARWAZA yahan hai: is branch ke `id` ko
 * `branch_id` bana kar seedha wahi safha dikha diya jata hai.
 *
 * Malik (8 September, doosra qadam): "sidebar waisi hi rahe -- is
 * dashboard ke ANDAR baqi modules (Milk, Grain, Machinery, waghera)
 * ke quick link aa jayen, ek jagah se poora branch chal sake."
 *
 * Jin safhon ke apne `/admin/reports/*` mein pehle se branch filter
 * hai (Sales, Inventory, Purchase -- `?branch=`), wahan seedha isi
 * branch ka data khulta hai. Baqi (Milk, Grain, Machinery, Finance ka
 * Cash Book, Fleet, HR) abhi khud branch-scoped nahi hain -- wahan
 * plain link hai (poori fehrist), jhoothi filtering ka daawa nahi.
 */
const QUICK_LINKS = (branchId: string) => [
  { label: "Doodh (Milk)", href: "/admin/milk-collection", icon: Droplet, scoped: false },
  { label: "Anaj (Grain)", href: "/admin/grain-procurement/dashboard", icon: Wheat, scoped: false },
  { label: "Machinery", href: "/admin/machinery-rental/dashboard", icon: Tractor, scoped: false },
  { label: "Sales & Retail", href: `/admin/reports/sales?branch=${branchId}`, icon: ShoppingCart, scoped: true },
  { label: "Inventory & Warehouse", href: `/admin/reports/inventory?branch=${branchId}`, icon: Warehouse, scoped: true },
  { label: "Purchase", href: `/admin/reports/purchases?branch=${branchId}`, icon: Truck, scoped: true },
  { label: "Finance (Cash Book)", href: "/admin/finance", icon: Wallet, scoped: false },
  { label: "HR & Staff", href: "/admin/hr", icon: Users, scoped: false },
];

export default async function BranchDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_LINKS(id).map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300 dark:hover:bg-surface-800"
            title={l.scoped ? "Isi branch ka data" : "Poori company ki fehrist (is branch tak scoped nahi)"}
          >
            <l.icon className="h-3.5 w-3.5" />
            {l.label}
          </Link>
        ))}
      </div>
      <PnlPage searchParams={Promise.resolve({ branch_id: id })} />
    </div>
  );
}
