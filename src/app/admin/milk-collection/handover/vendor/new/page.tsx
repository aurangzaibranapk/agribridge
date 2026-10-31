import { HandoverEditor } from "../../editor";

export const dynamic = "force-dynamic";

export default function NewVendorHandover({ searchParams }: { searchParams?: { date?: string } }) {
  return <HandoverEditor destination="vendor" dateHint={searchParams?.date} />;
}
