import { Shell } from "@/components/call-center/shell";
import { AgentsScreen } from "@/components/call-center/screens";
import { loadAgents } from "@/lib/call-center/load";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agent Admin" };

export default async function AgentAdminPage() {
  const data = await loadAgents();
  return (
    <Shell
      variant="live"
      title="Agent Admin"
      crumb="Admin staff khud banata hai — koi joining email nahi"
      example={false}
    >
      <AgentsScreen data={data} />
    </Shell>
  );
}
