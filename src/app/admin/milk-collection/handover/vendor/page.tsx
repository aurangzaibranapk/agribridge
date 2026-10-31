import { HandoverFlowList } from "../flow-list";

export const dynamic = "force-dynamic";

export default function VendorHandoverPage({ searchParams }: { searchParams?: { date?: string } }) {
  return <HandoverFlowList destination="vendor" dateParam={searchParams?.date} />;
}
