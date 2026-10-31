import { HandoverEditor } from "../../editor";

export const dynamic = "force-dynamic";

export default function NewCompanyHandover({ searchParams }: { searchParams?: { date?: string } }) {
  return <HandoverEditor destination="company" dateHint={searchParams?.date} />;
}
