import { listCollectors } from "@/actions/milk-collectors";
import { CollectorsClient } from "./collectors-client";

export const dynamic = "force-dynamic";

export default async function CollectorsPage() {
  const collectors = await listCollectors();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Collectors (Ladke)</h1>
      <CollectorsClient initialCollectors={collectors} />
    </div>
  );
}
