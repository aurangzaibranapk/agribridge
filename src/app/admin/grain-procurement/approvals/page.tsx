import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { requireGrainApprover } from "@/lib/grain/approval-guard";
import { grainPendingCalc, grainPendingExpenses, GRAIN_EXPENSE_LABELS, type GrainPendingPayload } from "@/lib/grain/pending-payload";
import { GrainStatusBadge } from "@/app/admin/grain-procurement/grain-client";
import { GrainApprovalActions } from "./approval-actions";

export const dynamic = "force-dynamic";

const GRAIN_NAME: Record<string, string> = { wheat: "Gandum", rice: "Munji / Dhan", maize: "Makai" };
const rs = (n: number | null | undefined) => `Rs ${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const kg = (n: number | null | undefined) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`;
const pkDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}-${m}-${y}`;
};
const pkTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }) + " PKT" : "—");

/**
 * Grain entries jo "Pending (Admin approval)" par hain. Sirf Owner / Admin /
 * Super Admin. Yahan se Approve par hi stock, ledger, cash book, khaata,
 * kharche aur payment darj hote hain.
 */
export default async function GrainApprovalsPage() {
  const guard = await requireGrainApprover();
  if ("error" in guard) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="Grain Entry -- Admin Approval" description="Pending grain khareed ka review." />
        <Card><p className="text-sm text-red-700">{guard.error}</p></Card>
      </div>
    );
  }

  const service = createServiceClient() as any;
  const [{ data: open }, { data: done }] = await Promise.all([
    service.from("grain_pending_entries").select("*").in("status", ["pending", "approving"]).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
    service.from("grain_pending_entries").select("*").in("status", ["approved", "rejected"]).order("reviewed_at", { ascending: false }).limit(30),
  ]);
  const rows: any[] = [...(open ?? []), ...(done ?? [])];

  const ids = (key: string) => Array.from(new Set(rows.map((r) => r[key]).filter(Boolean)));
  const accountIds = new Set<string>();
  for (const r of rows) {
    const p = (r.payload ?? {}) as GrainPendingPayload;
    if (p.payment_account_id) accountIds.add(p.payment_account_id);
    for (const e of grainPendingExpenses(p)) if (e.account_id) accountIds.add(e.account_id);
  }
  const peopleIds = Array.from(new Set(rows.flatMap((r) => [r.created_by, r.reviewed_by, r.updated_by]).filter(Boolean)));
  const [{ data: farmers }, { data: parties }, { data: warehouses }, { data: accounts }, { data: profiles }, { data: allWarehouses }, { data: allAccounts }] = await Promise.all([
    ids("farmer_id").length ? service.from("farmers").select("id, full_name, farmer_code").in("id", ids("farmer_id")) : { data: [] },
    ids("party_id").length ? service.from("grain_parties").select("id, party_name").in("id", ids("party_id")) : { data: [] },
    ids("warehouse_id").length ? service.from("warehouses").select("id, name").in("id", ids("warehouse_id")) : { data: [] },
    accountIds.size ? service.from("finance_accounts").select("id, name").in("id", Array.from(accountIds)) : { data: [] },
    peopleIds.length ? service.from("profiles").select("id, full_name").in("id", peopleIds) : { data: [] },
    service.from("warehouses").select("id, name").eq("is_active", true).order("name"),
    service.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
  ]);
  const nameOf = (list: any[] | null, id: string | null, field: string) => (id ? list?.find((x) => x.id === id)?.[field] ?? "—" : "—");

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5">
      <PageHeader
        title="Grain Entry -- Admin Approval"
        description="Staff ne ye entries 'Pending (Admin approval)' par save ki hain. Abhi in ka stock, ledger, cash book, khaata, kharche aur payment darj NAHI hua. Parh kar Approve, Edit ya Reject karein."
      />
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
        <p><b>Approve</b> = entry ki asal tareekh par stock, ledger, cash book, khaata, kharche aur payment darj (purani tareekh par wajah: &quot;Admin approved backdated entry&quot;). Do dafa click se do entry nahi banti.</p>
        <p className="mt-1"><b>Edit</b> = khaane theek karein, hisaab dobara banega, entry Pending hi rahegi. <b>Reject</b> = kuch darj nahi hoga, record wajah ke sath mehfooz rahega.</p>
        <p className="mt-1"><Link href="/admin/grain-procurement" className="underline">Anaj ki Kharid par wapas</Link></p>
      </div>

      {(open ?? []).length === 0 && <Card><p className="text-sm text-surface-500">Is waqt koi entry approval ka intezar nahi kar rahi.</p></Card>}

      {rows.map((r) => {
        const p = (r.payload ?? {}) as GrainPendingPayload;
        const calc = grainPendingCalc(p);
        const bagMode = p.bag_calculation === "on";
        const expenses = grainPendingExpenses(p);
        const seller = r.farmer_id ? `${nameOf(farmers, r.farmer_id, "full_name")} (Kisan ${nameOf(farmers, r.farmer_id, "farmer_code")})` : `${nameOf(parties, r.party_id, "party_name")} (Party)`;
        const history = Array.isArray(r.edit_history) ? r.edit_history : [];
        const isOpen = r.status === "pending" || r.status === "approving";
        return (
          <section id={`p-${r.id}`} key={r.id} className={`rounded-2xl border bg-white p-4 shadow-card dark:bg-surface-900 sm:p-5 ${isOpen ? "border-amber-300 dark:border-amber-800" : "border-surface-200 dark:border-surface-800"}`}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-surface-100 pb-3 dark:border-surface-800">
              <div>
                <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{seller} <GrainStatusBadge status={r.status} /></h2>
                <p className="text-xs text-surface-500">
                  {GRAIN_NAME[r.grain_type] ?? r.grain_type} · Tareekh <b>{pkDate(r.entry_date)}</b> · Godam {nameOf(warehouses, r.warehouse_id, "name")} · Banayi: {nameOf(profiles, r.created_by, "full_name")} ({pkTime(r.created_at)})
                </p>
                {r.reviewed_at && <p className="text-xs text-surface-500">{r.status === "rejected" ? "Reject" : "Approve"}: {nameOf(profiles, r.reviewed_by, "full_name")} ({pkTime(r.reviewed_at)})</p>}
              </div>
              {r.approved_entry_id && <Link href={`/admin/grain-procurement/bill/${r.approved_entry_id}`} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Asal bill dekhein</Link>}
            </div>

            {r.reject_reason && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-300">Reject ki wajah: {r.reject_reason}</p>}
            {r.last_error && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-300">Pichli koshish: {r.last_error}</p>}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-surface-200 p-3 text-sm dark:border-surface-700">
                <h3 className="mb-2 font-semibold">Wazan aur cut</h3>
                <Line k="Kul wazan" v={`${kg(r.gross_weight_kg)} (${(Number(r.gross_weight_kg ?? 0) / 40).toFixed(2)} mand)`} />
                {bagMode && calc.bagKg && <Line k="Boriyan" v={`${calc.bags.toLocaleString(undefined, { maximumFractionDigits: 3 })} (1 bori = ${calc.bagKg} kg)`} />}
                {bagMode && <Line k="Cut ka tareeqa" v={calc.cutBasis === "per_bag" ? `Fi bori ${calc.unitCutKg} kg` : calc.cutBasis === "percentage" ? `Preset ${Number(p.preset_cut_percentage ?? 0)}%` : `Kul ${calc.unitCutKg} kg`} />}
                <Line k="Kul cut" v={kg(Number(r.gross_weight_kg ?? 0) - Number(r.net_weight_kg ?? 0))} />
                <Line k="Saaf wazan" v={`${kg(r.net_weight_kg)} (${(Number(r.net_weight_kg ?? 0) / 40).toFixed(3)} mand)`} strong />
                {p.moisture_percentage && <Line k="Nami" v={`${p.moisture_percentage}%`} />}
                {p.quality_grade && <Line k="Quality" v={p.quality_grade} />}
              </div>
              <div className="rounded-xl border border-surface-200 p-3 text-sm dark:border-surface-700">
                <h3 className="mb-2 font-semibold">Raqam</h3>
                <Line k="Rate" v={`${rs(Number(p.rate_per_kg ?? 0))} fi mand`} />
                <Line k="Anaj ki qeemat" v={rs(r.total_amount)} />
                <Line k={`Chungi (${p.chungi_type === "cash" ? "naqad" : "anaj"}${bagMode && p.chungi_basis === "per_bag" ? ", fi bori" : ""})`} v={`- ${rs(Number(r.total_amount ?? 0) - Number(r.payable_amount ?? 0))}`} />
                <Line k={r.farmer_id ? "Kisan ko dena" : "Party ko dena"} v={rs(r.payable_amount)} strong />
                <div className="mt-2 border-t border-surface-100 pt-2 dark:border-surface-800">
                  <p className="font-medium">Payment: {p.make_payment === "yes" ? "Haan" : "Nahi"}</p>
                  {p.make_payment === "yes" && (
                    <>
                      <Line k="Raqam" v={rs(Number(p.payment_amount ?? 0))} />
                      <Line k="Tareeqa" v={p.payment_method ?? "—"} />
                      <Line k="Account" v={nameOf(accounts, p.payment_account_id ?? null, "name")} />
                      <Line k="Raseed" v={r.receipt_photo_url ? "Lagi hui" : "Slip nahi lagi"} />
                      {r.receipt_photo_url && <a href={r.receipt_photo_url} target="_blank" rel="noreferrer" className="text-xs text-brand-700 underline">Raseed kholein</a>}
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-surface-200 p-3 text-sm dark:border-surface-700">
                <h3 className="mb-2 font-semibold">Kharche (hamara kharcha)</h3>
                {expenses.length === 0 && <p className="text-xs text-surface-500">Koi kharcha nahi.</p>}
                {expenses.map((e, i) => (
                  <Line key={i} k={`${GRAIN_EXPENSE_LABELS[e.category] ?? e.category}${e.description ? ` -- ${e.description}` : ""} (${nameOf(accounts, e.account_id, "name")})`} v={rs(e.amount)} />
                ))}
                {expenses.length > 0 && <Line k="Kul kharcha" v={rs(r.expenses_total)} strong />}
                <div className="mt-2 border-t border-surface-100 pt-2 text-xs text-surface-600 dark:border-surface-800">
                  <p className="font-medium">Notes</p>
                  <p className="whitespace-pre-wrap">{p.notes || "—"}</p>
                </div>
                {history.length > 0 && <p className="mt-2 text-[11px] text-surface-500">Admin ne {history.length} dafa edit kiya.</p>}
              </div>
            </div>

            {isOpen && (
              <GrainApprovalActions
                pendingId={r.id}
                status={r.status}
                payload={p}
                warehouses={allWarehouses ?? []}
                accounts={allAccounts ?? []}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-0.5 ${strong ? "font-semibold text-surface-900 dark:text-white" : "text-surface-600 dark:text-surface-300"}`}>
      <span>{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
