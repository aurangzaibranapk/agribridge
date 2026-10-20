import { Shell } from "@/components/call-center/shell";
import { PartyScreen } from "@/components/call-center/screens";
import { exampleParty } from "@/lib/call-center/fixtures";

export const metadata = { title: "New Complaint" };

export default function PreviewComplaintPage() {
  return (
    <Shell
      variant="preview"
      title="Muhammad Aslam (Example)"
      crumb="Caller 360 · FRM-000045"
      example
    >
      <PartyScreen data={exampleParty} variant="preview" modalOpen />
    </Shell>
  );
}
