import { CategoryDashboard } from "@/app/admin/category-dashboard";

export const dynamic = "force-dynamic";

export default async function FertilizerPage() {
  return <CategoryDashboard categoryName="Fertilizer" title="Fertilizer" />;
}