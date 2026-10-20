import { Shell } from "@/components/call-center/shell";
import { ConsoleScreen } from "@/components/call-center/screens";
import { loadConsole } from "@/lib/call-center/load";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agent Console" };

export default async function CallCenterConsolePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q ?? "";
  const data = await loadConsole(q);
  return (
    <Shell
      variant="live"
      title="Agent Console"
      crumb="Caller dhoondein — mobile, naam ya ID"
      example={false}
    >
      <ConsoleScreen data={data} variant="live" />
    </Shell>
  );
}
