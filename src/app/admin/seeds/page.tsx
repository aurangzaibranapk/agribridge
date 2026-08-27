import { CategoryDashboard } from "@/app/admin/category-dashboard";

export const dynamic = "force-dynamic";

export default async function SeedsPage() {
  return <CategoryDashboard categoryName="Seeds" title="Seeds" />;
}