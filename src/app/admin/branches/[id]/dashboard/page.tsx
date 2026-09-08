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
 */
export default async function BranchDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PnlPage searchParams={Promise.resolve({ branch_id: id })} />;
}
