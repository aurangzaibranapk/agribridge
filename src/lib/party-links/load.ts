import { createServiceClient } from "@/lib/supabase/service";
import { customerReceivableFromGl, linkedNet, linkedSettlementLimit, supplierPayableFromGl, type GlLine } from "./core";

/** 622: Fa'aal party links + GL se dono taraf ka baqi. Sirf PARHNA. */
export type LinkedParty = {
  id: string; customerId: string; customerName: string; customerPhone: string | null;
  supplierId: string; supplierName: string; note: string | null; createdAt: string;
  customerReceivable: number; supplierPayable: number;
  net: { theyOwe: number; weOwe: number; net: number }; settleLimit: number;
};

type Db = any;

export async function supplierGlLines(db: Db, supplierId: string): Promise<GlLine[]> {
  const { data } = await db.rpc("fn_party_gl_lines", { p_party_type: "supplier", p_party_id: supplierId, p_accounts: ["2000", "1120"] });
  return (data ?? []) as GlLine[];
}

async function customerGl(db: Db, customerId: string) {
  const { data } = await db.from("journal_lines").select("account_code, debit, credit")
    .eq("party_type", "customer").eq("party_id", customerId).eq("account_code", "1100");
  return (data ?? []) as { account_code: string; debit: unknown; credit: unknown }[];
}

export async function loadLinkedParties(opts: { customerId?: string; supplierId?: string; db?: Db } = {}): Promise<LinkedParty[]> {
  const db = opts.db ?? (createServiceClient() as Db);
  let q = db.from("party_links")
    .select("id, customer_id, supplier_id, note, created_at, customers(name, phone_number), suppliers(name)")
    .eq("is_active", true).order("created_at", { ascending: false }).limit(500);
  if (opts.customerId) q = q.eq("customer_id", opts.customerId);
  if (opts.supplierId) q = q.eq("supplier_id", opts.supplierId);
  const { data, error } = await q;
  if (error || !data) return [];
  return Promise.all((data as any[]).map(async (l) => {
    const [cg, sg] = await Promise.all([customerGl(db, l.customer_id), supplierGlLines(db, l.supplier_id)]);
    const customerReceivable = customerReceivableFromGl(cg);
    const supplierPayable = supplierPayableFromGl(sg);
    return {
      id: l.id, customerId: l.customer_id, customerName: l.customers?.name ?? "—", customerPhone: l.customers?.phone_number ?? null,
      supplierId: l.supplier_id, supplierName: l.suppliers?.name ?? "—", note: l.note ?? null, createdAt: l.created_at,
      customerReceivable, supplierPayable,
      net: linkedNet(customerReceivable, supplierPayable),
      settleLimit: linkedSettlementLimit(customerReceivable, supplierPayable),
    };
  }));
}
