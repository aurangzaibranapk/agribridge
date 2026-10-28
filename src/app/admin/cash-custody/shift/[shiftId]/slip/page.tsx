import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureCustodyPacket } from "@/actions/cash-custody-chain";
import { packetIdForShift, loadCustodyViewer } from "@/lib/cash-custody/load";
import { parseSlipCopy } from "@/lib/cash-custody/chain";

export const dynamic = "force-dynamic";

export default async function ShiftCustodySlipPage({
  params,
  searchParams,
}: {
  params: { shiftId: string };
  searchParams?: { copy?: string; print?: string };
}) {
  const viewer = await loadCustodyViewer();
  if (!viewer) redirect("/login");
  const id = await packetIdForShift(params.shiftId);
  const copy = parseSlipCopy(searchParams?.copy);
  const print = searchParams?.print === "1" ? "&print=1" : "";
  if (id) redirect(`/admin/cash-custody/packet/${id}/slip?copy=${copy}${print}`);

  return (
    <main className="mx-auto max-w-sm px-4 py-10 text-sm">
      <p className="font-medium text-surface-800">Is shift ki do slips abhi nahi bani.</p>
      <p className="mt-2 text-xs text-surface-500">Band shift jis mein ginti hui cash hai, us par staff copy aur jama copy yahin se ban sakti hain.</p>
      <form action={ensureCustodyPacket} className="mt-4">
        <input type="hidden" name="shift_id" value={params.shiftId} />
        <button type="submit" className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white">
          Dono slips banayein
        </button>
      </form>
      <Link href="/admin/pos" className="mt-4 block text-xs text-surface-500">← POS</Link>
    </main>
  );
}
