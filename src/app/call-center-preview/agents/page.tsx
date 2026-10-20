import { Shell } from "@/components/call-center/shell";
import { AgentsScreen } from "@/components/call-center/screens";
import { exampleAgents } from "@/lib/call-center/fixtures";

export const metadata = { title: "Agent Admin" };

export default function PreviewAgentsPage() {
  return (
    <Shell
      variant="preview"
      title="Agent Admin"
      crumb="Admin staff khud banata hai — koi joining email nahi"
      example
    >
      <AgentsScreen data={exampleAgents} />
    </Shell>
  );
}
