import { Receipt } from "lucide-react";

/** POS close par har dukan ki do slips — staff copy aur jama copy. */
export function CustodySlipLinks({ packetId }: { packetId: string }) {
  const both = `/admin/cash-custody/packet/${packetId}/slip?copy=both&print=1`;
  const staff = `/admin/cash-custody/packet/${packetId}/slip?copy=staff`;
  const deposit = `/admin/cash-custody/packet/${packetId}/slip?copy=deposit`;
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-surface-200 p-3">
      <p className="text-xs text-surface-600">
        Har dukan par do slips. Staff copy aap rakhain — dastakhat aur system mein raqam. Jama copy cash ke sath jaye.
      </p>
      <a href={both} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white">
        <Receipt className="h-4 w-4" /> Dono slips kholen (print)
      </a>
      <div className="grid grid-cols-2 gap-2">
        <a href={staff} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-surface-200 px-2 py-1.5 text-center text-xs font-medium text-surface-700">
          Staff copy
        </a>
        <a href={deposit} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-surface-200 px-2 py-1.5 text-center text-xs font-medium text-surface-700">
          Jama copy
        </a>
      </div>
    </div>
  );
}
