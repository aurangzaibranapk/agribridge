import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout-primitives";
import { PromisePartyCell } from "@/components/recovery/promise-party-cell";
import { updatePromiseStatus } from "@/actions/recovery";
import {
  formatPromiseDate,
  indexOutstanding,
  loadPartyReceipts,
  loadPromiseParties,
  outstandingOf,
  promiseChatOpener,
  promiseMoney,
  promisePartyOf,
  promiseRecoveryHref,
  promiseWhatsAppHref,
  receivedOf,
  rsLabel,
} from "@/lib/recovery/promise-parties";

export const dynamic = "force-dynamic";

export default async function PromisesPage() {
  const db = createClient() as any;
  const { data, error } = await db
    .from("payment_promises")
    .select("id,party_type,party_id,promised_amount,promise_date,status,fulfilled_amount,notes,created_at")
    .order("promise_date", { ascending: true });
  const rows = data ?? [];
  const [parties, outstandingResult, receipts] = await Promise.all([
    loadPromiseParties(db, rows),
    db.rpc("fn_recovery_outstanding", { p_search: null }),
    loadPartyReceipts(db, rows),
  ]);
  const outstanding = outstandingResult.error ? null : indexOutstanding(outstandingResult.data ?? []);

  return (
    <div className="space-y-4">
      <PageHeader title="Promise to Pay" description="Customer commitments, due dates aur broken promises." />
      <Link href="/admin/finance/recovery" className="text-sm underline">
        ← Recovery Dashboard
      </Link>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Wade load nahi ho sake: {error.message}. Khali fehrist ka matlab ye nahi ke koi waada nahi.
        </p>
      )}
      {outstandingResult.error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Kul baqaya load nahi hua: {outstandingResult.error.message}. Card par Total outstanding &quot;—&quot; hai — ye sifar nahi.
        </p>
      )}
      {receipts == null && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Kul adaigi load nahi hui. Card par Total payment &quot;—&quot; hai — ye sifar nahi.
        </p>
      )}
      <Card className="p-0">
        <div className="overflow-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-surface-50 text-left text-xs">
              <tr>
                <th className="p-3">Party</th>
                <th className="p-3">Promise Date</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-right">Fulfilled</th>
                <th className="p-3">Status</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Update</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const party = promisePartyOf(parties, r.party_type, r.party_id);
                const card = {
                  partyName: party.name || "Naam nahi mila",
                  promiseDate: formatPromiseDate(r.promise_date),
                  promiseAmount: rsLabel(promiseMoney(r.promised_amount)),
                  totalOutstanding: rsLabel(outstandingOf(outstanding, r.party_type, r.party_id)),
                  totalReceived: rsLabel(receivedOf(receipts, r.party_type, r.party_id)),
                };
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">
                      <PromisePartyCell
                        name={party.name}
                        phone={party.phone}
                        partyType={r.party_type}
                        recoveryHref={promiseRecoveryHref(r.party_type, r.party_id)}
                        whatsAppHref={promiseWhatsAppHref(party.phone, promiseChatOpener(party.name))}
                        card={card}
                      />
                    </td>
                    <td className="p-3">{r.promise_date}</td>
                    <td className="p-3 text-right">Rs {Number(r.promised_amount).toLocaleString("en-PK")}</td>
                    <td className="p-3 text-right">Rs {Number(r.fulfilled_amount).toLocaleString("en-PK")}</td>
                    <td className="p-3 capitalize">{String(r.status).replaceAll("_", " ")}</td>
                    <td className="p-3">{r.notes || "—"}</td>
                    <td className="p-3">
                      <form action={updatePromiseStatus} className="flex gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="promisedAmount" value={r.promised_amount} />
                        <select name="status" defaultValue={r.status} className="rounded border px-2 py-1">
                          <option value="open">Open</option>
                          <option value="fulfilled">Fulfilled</option>
                          <option value="partially_fulfilled">Partial</option>
                          <option value="broken_promise">Broken</option>
                          <option value="rescheduled">Rescheduled</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button className="rounded bg-surface-800 px-2 py-1 text-white">Save</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
