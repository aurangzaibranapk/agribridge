import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout-primitives";
export const dynamic="force-dynamic";
export default async function PromisesPage(){
 const db=createClient() as any; const {data}=await db.from("payment_promises").select("id,party_type,party_id,promised_amount,promise_date,status,fulfilled_amount,notes,created_at").order("promise_date",{ascending:true});
 return <div className="space-y-4"><PageHeader title="Promise to Pay" description="Customer commitments, due dates aur broken promises."/><Link href="/admin/finance/recovery" className="text-sm underline">← Recovery Dashboard</Link><Card className="p-0"><div className="overflow-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-surface-50 text-left text-xs"><tr><th className="p-3">Party</th><th className="p-3">Promise Date</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Fulfilled</th><th className="p-3">Status</th><th className="p-3">Notes</th></tr></thead><tbody>{(data||[]).map((r:any)=><tr key={r.id} className="border-t"><td className="p-3 capitalize">{r.party_type}</td><td className="p-3">{r.promise_date}</td><td className="p-3 text-right">Rs {Number(r.promised_amount).toLocaleString("en-PK")}</td><td className="p-3 text-right">Rs {Number(r.fulfilled_amount).toLocaleString("en-PK")}</td><td className="p-3 capitalize">{String(r.status).replaceAll("_"," ")}</td><td className="p-3">{r.notes||"—"}</td></tr>)}</tbody></table></div></Card></div>;
}
