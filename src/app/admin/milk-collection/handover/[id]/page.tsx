import { HandoverEditor } from "../editor";

export const dynamic = "force-dynamic";

export default function EditHandoverPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { saved?: string };
}) {
  return <HandoverEditor id={params.id} saved={searchParams?.saved === "1"} />;
}
