import Link from "next/link";
import Image from "next/image";
import { Plus, Package, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { Button, Badge } from "@/components/ui/form";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils/format";
import { DeleteButton } from "@/app/admin/products/delete-button";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
type ProductRow = {
  id: string; name: string; pack_size: string | null; purchase_price: number; selling_price: number;
  is_available: boolean; is_verified: boolean; image_url: string | null; categories: { name: string } | null; brands: { name: string } | null;
};
export default async function ProductsPage({ searchParams }: { searchParams: { page?: string; q?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const q = searchParams.q?.trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";

  let query = supabase
    .from("products")
    .select("id, name, pack_size, purchase_price, selling_price, is_available, is_verified, image_url, categories(name), brands(name)", { count: "exact" })
    .eq("is_deleted", false);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: products, count } = await query.order("name").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const cols: Column<ProductRow>[] = [
    {
      header: "Product",
      accessor: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-surface-100">
            {p.image_url ? <Image src={p.image_url} alt={p.name} width={36} height={36} className="object-cover" /> : <Package className="h-4 w-4 text-surface-400" />}
          </div>
          <div>
            <p className="font-medium text-surface-900">{p.name}</p>
            <p className="text-xs text-surface-400">{p.pack_size ?? "-"}</p>
          </div>
        </div>
      ),
    },
    { header: "Category", accessor: (p) => p.categories?.name ?? "-" },
    { header: "Brand", accessor: (p) => p.brands?.name ?? "-" },
    { header: "Purchase Price", accessor: (p) => formatCurrency(p.purchase_price), className: "text-right" },
    { header: "Selling Price", accessor: (p) => formatCurrency(p.selling_price), className: "text-right" },
    {
      header: "Status",
      accessor: (p) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={p.is_available ? "green" : "gray"}>{p.is_available ? "Available" : "Unavailable"}</Badge>
          {!p.is_verified && <Badge tone="amber">{t("pd_pending_verify", lang)}</Badge>}
        </div>
      ),
    },
    {
      header: "Edit",
      accessor: (p) => (
        <Link
          href={`/admin/products/${p.id}/edit`}
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      ),
    },
    ...(isUnrestricted
      ? [
          {
            header: "Delete",
            accessor: (p: ProductRow) => <DeleteButton productId={p.id} />,
          } as Column<ProductRow>,
        ]
      : []),
  ];
  return (
    <div>
      <PageHeader
        title={t("pd_management", lang)}
        description="Products, pricing, and specifications"
        actions={
          <Link href="/admin/products/new">
            <Button><Plus className="h-4 w-4" />{t("c_add_product", lang)}</Button>
          </Link>
        }
      />
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("pd_search", lang)}
          className="h-10 w-full max-w-md rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </form>
      <DataTable columns={cols} rows={(products ?? []) as unknown as ProductRow[]} keyFor={(p) => p.id} emptyTitle="No products yet" />
      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={count ?? 0} basePath={`/admin/products${q ? `?q=${q}` : "?"}`} />
    </div>
  );
}