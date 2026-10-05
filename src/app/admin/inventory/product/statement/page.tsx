import { redirect } from "next/navigation";

// Backward-compatible guard for old links that omitted the product ID.
// Product-specific statements are opened from the product detail/stock
// reconciliation pages as /admin/inventory/product/[productId]/statement.
export default function LegacyProductStatementRoute() {
  redirect("/admin/inventory");
}
