import { notFound } from "next/navigation";
import { Shell } from "@/components/call-center/shell";
import { PartyScreen } from "@/components/call-center/screens";
import { loadParty } from "@/lib/call-center/load";
import type { PartyKind } from "@/lib/call-center/rules";

export const dynamic = "force-dynamic";

export const metadata = { title: "Caller 360" };

const KINDS = new Set<PartyKind>(["farmer", "customer", "dealer"]);

export default async function CallerPage({ params }: { params: { kind: string; id: string } }) {
  if (!KINDS.has(params.kind as PartyKind)) notFound();
  const data = await loadParty(params.kind, params.id);
  return (
    <Shell
      variant="live"
      title={data.name || "Caller"}
      crumb={data.code ? `Caller 360 · ${data.code}` : "Caller 360"}
      example={false}
    >
      <PartyScreen data={data} variant="live" />
    </Shell>
  );
}
