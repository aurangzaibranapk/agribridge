import { payrollViewer } from "@/lib/payroll/access";
import NewQistClient from "./new-qist-client";

export const dynamic = "force-dynamic";

export default async function NewQistPage({ searchParams }: { searchParams: { type?: string; id?: string; name?: string } }) {
  const v = await payrollViewer();
  if (!v?.qistMaker) return <div className="p-8 text-center text-slate-500">Ijazat nahi.</div>;
  const preset = searchParams.type && searchParams.id ? { type: searchParams.type, id: searchParams.id, name: searchParams.name ?? "" } : null;
  return <NewQistClient preset={preset} />;
}
