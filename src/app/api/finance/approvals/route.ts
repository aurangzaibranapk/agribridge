import { NextRequest, NextResponse } from "next/server";
import { approveSupplierPayment, rejectSupplierPayment } from "@/actions/supplier-payment-requests";
import { verifyCollectionDeposit } from "@/actions/pos-collection";
import { createClient } from "@/lib/supabase/server";

/** Finance approval replay route. Server actions retain all permission and comment checks. */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind = ["supplier_approve", "supplier_reject", "deposit_verify"].includes(body.kind) ? body.kind : "";
  if (!kind || !body.fields || typeof body.fields !== "object") return NextResponse.json({ error: "Approval ki maloomat durust nahi." }, { status: 400 });
  const formData = new FormData();
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) if (typeof value === "string") formData.set(key, value);
  const result = kind === "supplier_approve"
    ? await approveSupplierPayment({}, formData)
    : kind === "supplier_reject"
      ? await rejectSupplierPayment({}, formData)
      : await verifyCollectionDeposit({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
