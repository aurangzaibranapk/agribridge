import { CustomerStatementPage } from "@/app/admin/crm/[id]/statement/page";

export default function StaffCustomerStatementAlias({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  return <CustomerStatementPage params={params} searchParams={searchParams} />;
}
