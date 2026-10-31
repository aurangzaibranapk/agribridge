import { HandoverFlowList } from "../flow-list";

export const dynamic = "force-dynamic";

export default function PartyHandoverPage({ searchParams }: { searchParams?: { date?: string } }) {
  return <HandoverFlowList destination="party" dateParam={searchParams?.date} />;
}
