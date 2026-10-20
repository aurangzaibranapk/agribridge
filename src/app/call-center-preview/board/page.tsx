import { Shell } from "@/components/call-center/shell";
import { BoardScreen } from "@/components/call-center/screens";
import { exampleBoard } from "@/lib/call-center/fixtures";

export const metadata = { title: "Complaints Board" };

export default function PreviewBoardPage() {
  return (
    <Shell
      variant="preview"
      title="Complaints Board"
      crumb="Owner / department dashboard"
      example
    >
      <BoardScreen data={exampleBoard} />
    </Shell>
  );
}
