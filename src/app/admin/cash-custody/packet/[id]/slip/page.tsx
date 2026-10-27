import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { loadCustodyPacket, loadCustodyViewer } from "@/lib/cash-custody/load";
import { kindLabel, parseSlipCopy, rs, statusLabel, timelinePhrase, whenPkt } from "@/lib/cash-custody/chain";
import { StaffConfirmForm } from "./confirm-form";
import { SlipPrint } from "./print-button";

export const dynamic = "force-dynamic";

function CopySheet({
  copy,
  shop,
  branch,
  counter,
  shift,
  amount,
  number,
  opened,
  origin,
  holder,
  status,
  signature,
  confirmedAt,
  confirmedAmount,
  hops,
}: {
  copy: "staff" | "deposit";
  shop: string;
  branch: string | null;
  counter: string | null;
  shift: string | null;
  amount: string;
  number: string;
  opened: string;
  origin: string | null;
  holder: string | null;
  status: string;
  signature: string | null;
  confirmedAt: string | null;
  confirmedAmount: number | null;
  hops: { phrase: string; at: string }[];
}) {
  const staff = copy === "staff";
  return (
    <article className="slip-sheet mx-auto w-full max-w-sm border border-dashed border-surface-400 bg-white p-4 font-mono text-black print:break-after-page print:border-0">
      <p className="text-center text-lg font-bold uppercase">{shop}</p>
      {branch && <p className="text-center text-[11px] uppercase">{branch}</p>}
      {counter && <p className="text-center text-xs">POS: {counter}</p>}
      <h1 className="mt-2 text-center text-sm font-bold uppercase">{staff ? "Staff copy — ye aap rakhain" : "Jama copy — ye cash ke sath jaye"}</h1>
      <p className="mt-1 text-center text-[11px]">{opened}</p>
      <div className="my-3 border-t border-dashed border-surface-400" />
      <p className="flex justify-between text-xs"><span>Slip</span><span>{number}</span></p>
      {shift && <p className="flex justify-between text-xs"><span>Shift</span><span>{shift}</span></p>}
      <p className="flex justify-between text-xs"><span>Kahan se</span><span>{origin ?? "—"}</span></p>
      <p className="flex justify-between text-xs"><span>Ab kis ke paas</span><span>{holder ?? "—"}</span></p>
      <p className="mt-2 flex justify-between text-sm font-bold"><span>Raqam</span><span>{amount}</span></p>
      <p className="mt-1 text-xs">Status: {statusLabel(status)}</p>
      {signature && (
        <p className="mt-2 text-xs">
          Staff confirm: {signature}
          {confirmedAt ? ` · ${confirmedAt}` : ""}
          {confirmedAmount != null ? ` · ${rs(confirmedAmount)}` : ""}
        </p>
      )}
      {hops.length > 0 && (
        <div className="mt-3 text-[11px]">
          <p className="font-semibold">Timeline</p>
          {hops.map((h, i) => (
            <p key={i} className="mt-1">{h.at} — {h.phrase}</p>
          ))}
        </div>
      )}
      <div className="mt-8 grid grid-cols-2 gap-4 text-[11px]">
        <div className="border-t border-surface-500 pt-1">Jama karne wala — dastakhat</div>
        <div className="border-t border-surface-500 pt-1">{staff ? "System confirm" : "Finance / bank — dastakhat"}</div>
      </div>
      <p className="mt-3 text-center text-[10px] text-surface-500">{staff ? "Ye copy counter par rehti hai." : "Ye copy note ke sath jama hoti hai."}</p>
    </article>
  );
}

export default async function CustodySlipPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { copy?: string; print?: string };
}) {
  const viewer = await loadCustodyViewer();
  if (!viewer) redirect("/login");
  const loaded = await loadCustodyPacket(params.id, viewer);
  if (!loaded) notFound();
  const { packet, hops } = loaded;
  const copy = parseSlipCopy(searchParams?.copy);
  const service = createServiceClient() as any;
  const { data: counter } = packet.counter_id
    ? await service.from("pos_counters").select("name").eq("id", packet.counter_id).maybeSingle()
    : { data: null };
  const shop = packet.shopName ?? packet.branchName ?? "Shop";
  const hopLines = hops.map((h) => ({
    phrase: timelinePhrase({ holderName: h.holderName, kind: h.kind, startedAt: h.started_at, endedAt: h.ended_at }),
    at: whenPkt(h.started_at),
    kind: kindLabel(h.kind),
  }));
  const sheet = (which: "staff" | "deposit") => (
    <CopySheet
      copy={which}
      shop={shop}
      branch={packet.shopName ? packet.branchName : null}
      counter={counter?.name ?? null}
      shift={packet.shiftNumber}
      amount={rs(Number(packet.amount))}
      number={which === "staff" ? packet.staff_copy_number : packet.deposit_copy_number}
      opened={whenPkt(packet.opened_at)}
      origin={packet.originName}
      holder={packet.holderName}
      status={packet.status}
      signature={packet.staff_signature}
      confirmedAt={packet.staff_confirmed_at ? whenPkt(packet.staff_confirmed_at) : null}
      confirmedAmount={packet.staff_confirmed_amount}
      hops={hopLines}
    />
  );

  return (
    <main className="mx-auto max-w-lg px-3 py-6">
      <style>{`@media print { .no-print { display: none !important; } .slip-sheet { break-after: page; } }`}</style>
      <div className="no-print mb-3 flex items-center justify-between gap-2">
        <Link href={`/admin/cash-custody/packet/${packet.id}`} className="text-xs text-surface-500">← Timeline</Link>
        <SlipPrint autoPrint={searchParams?.print === "1"} />
      </div>
      {(copy === "both" || copy === "staff") && sheet("staff")}
      {copy === "both" && <p className="no-print my-3 text-center text-[11px] text-surface-400">Kainchi se alag karein — neeche jama copy</p>}
      {copy === "both" && <div className="my-4 border-t-2 border-dashed border-surface-300 print:hidden" />}
      {(copy === "both" || copy === "deposit") && sheet("deposit")}
      {viewer.userId === packet.origin_profile_id && !packet.staff_confirmed_at && (copy === "staff" || copy === "both") && (
        <StaffConfirmForm packetId={packet.id} amount={Number(packet.amount)} defaultName={viewer.name} />
      )}
    </main>
  );
}
