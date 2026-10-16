import { listChillars } from "@/actions/milk-chillars";
import { ChillarsClient } from "./chillars-client";

export const dynamic = "force-dynamic";

export default async function ChillarsPage() {
  const chillars = await listChillars();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Chillars</h1>
      <ChillarsClient initialChillars={chillars} />
    </div>
  );
}
