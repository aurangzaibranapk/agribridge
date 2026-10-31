import { HandoverFlowList } from "../flow-list";

export const dynamic = "force-dynamic";

export default function CompanyHandoverPage({ searchParams }: { searchParams?: { date?: string } }) {
  return <HandoverFlowList destination="company" dateParam={searchParams?.date} />;
}
