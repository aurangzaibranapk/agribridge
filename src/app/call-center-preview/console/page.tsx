import { Shell } from "@/components/call-center/shell";
import { ConsoleScreen } from "@/components/call-center/screens";
import { exampleConsole } from "@/lib/call-center/fixtures";

export const metadata = { title: "Agent Console" };

export default function PreviewConsolePage() {
  return (
    <Shell
      variant="preview"
      title="Agent Console"
      crumb="Caller dhoondein — mobile, naam ya ID"
      example
    >
      <ConsoleScreen data={exampleConsole} variant="preview" />
    </Shell>
  );
}
