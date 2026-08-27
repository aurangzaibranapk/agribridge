import { CategoryDashboard } from "@/app/admin/category-dashboard";

export const dynamic = "force-dynamic";

export default async function PesticidePage() {
  return <CategoryDashboard categoryName="Pesticide" title="Pesticide" />;
}