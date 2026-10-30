import { HandoverEditor } from "../editor";

export const dynamic = "force-dynamic";

export default function NewHandoverPage({ searchParams }: { searchParams?: { date?: string } }) {
  return <HandoverEditor dateHint={searchParams?.date} />;
}
