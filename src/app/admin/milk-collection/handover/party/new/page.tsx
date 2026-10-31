import { HandoverEditor } from "../../editor";

export const dynamic = "force-dynamic";

export default function NewPartyHandover({ searchParams }: { searchParams?: { date?: string } }) {
  return <HandoverEditor destination="party" dateHint={searchParams?.date} />;
}
