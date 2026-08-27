import { CategoryDashboard } from "@/app/admin/category-dashboard";

export const dynamic = "force-dynamic";

export default async function GroceryPage() {
  return <CategoryDashboard categoryName="Grocery" title="Grocery / Karyana" />;
}