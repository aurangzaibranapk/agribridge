import { Shell } from "@/components/call-center/shell";
import { BoardScreen } from "@/components/call-center/screens";
import { loadBoard } from "@/lib/call-center/load";

export const dynamic = "force-dynamic";

export const metadata = { title: "Complaints Board" };

export default async function ComplaintsBoardPage() {
  const data = await loadBoard();
  return (
    <Shell
      variant="live"
      title="Complaints Board"
      crumb="Owner / department dashboard"
      example={false}
    >
      <BoardScreen data={data} />
    </Shell>
  );
}
