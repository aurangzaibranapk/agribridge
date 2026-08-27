import { CategoryDashboard } from "@/app/admin/category-dashboard";

export const dynamic = "force-dynamic";

export default async function WandaPage() {
  return <CategoryDashboard categoryName="Animal Feed (Wanda)" title="Wanda (Animal Feed)" />;
}