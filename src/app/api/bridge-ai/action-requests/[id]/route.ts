import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const body = await request.json();
  const { status, reviewNotes, supplierId, branchId, quantity, unitCost } = body;

  if (!["approved", "rejected", "needs_changes"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let createdPurchaseId: string | null = null;

  // AI ka order draft (260): manzoor -> submitted (chain mein), radd ->
  // cancelled, changes -> draft hi rehta hai. Draft khud kabhi aage
  // nahi jata.
  const { data: reqRow } = await supabase
    .from("bridge_ai_action_requests")
    .select("created_order_id")
    .eq("id", params.id)
    .maybeSingle();
  if (reqRow?.created_order_id) {
    const orderId = reqRow.created_order_id;
    const { data: order } = await supabase.from("agri_orders").select("order_number, status, shop_dealer_name").eq("id", orderId).maybeSingle();
    if (order && order.status === "draft" && (status === "approved" || status === "rejected")) {
      const nextStatus = status === "approved" ? "submitted" : "cancelled";
      const { error: oErr } = await supabase
        .from("agri_orders")
        .update(status === "approved" ? { status: nextStatus } : { status: nextStatus, rejection_reason: reviewNotes || "AI draft radd" })
        .eq("id", orderId);
      if (oErr) return NextResponse.json({ error: `Order ka darja nahi badla: ${oErr.message}` }, { status: 500 });
      await supabase.from("agri_order_timeline").insert({
        order_id: orderId,
        status: nextStatus,
        note: status === "approved" ? `AI draft manzoor - ${order.order_number} Sales ke paas` : `AI draft radd${reviewNotes ? `: ${reviewNotes}` : ""}`,
        created_by: user?.id ?? null,
      });
      if (status === "approved") {
        const { notifyRoles } = await import("@/lib/notifications");
        await notifyRoles(["sales_staff", "super_admin", "admin", "owner"], "Naya Order Aaya", `${order.shop_dealer_name ?? "Shop"} ke liye ${order.order_number} (AI draft, manzoor) - verify karein.`, `/admin/agri-orders/${orderId}`);
      }
    }
  }

  // Agar approve ho raha hai aur supplier/branch/quantity di gayi hai, to asal Purchase Order bana dein
  if (status === "approved" && supplierId && branchId && quantity) {
    const { data: actionRequest } = await supabase
      .from("bridge_ai_action_requests")
      .select("product_id")
      .eq("id", params.id)
      .single();

    if (actionRequest?.product_id) {
      const purchaseNumber = `PO-${Date.now()}`;
      const finalUnitCost = Number(unitCost) || 0;
      const finalQuantity = Number(quantity);
      const totalAmount = finalQuantity * finalUnitCost;

      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          purchase_number: purchaseNumber,
          supplier_id: supplierId,
          branch_id: branchId,
          purchase_date: new Date().toISOString().slice(0, 10),
          status: "pending",
          total_amount: totalAmount,
          notes: "Bridge AI proposal se banaya gaya (admin approved)",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (purchaseError || !purchase) {
        return NextResponse.json({ error: purchaseError?.message ?? "Purchase order create nahi ho saka" }, { status: 500 });
      }

      const batchNumber = `${purchaseNumber}-${actionRequest.product_id.slice(0, 8)}`;
      const { data: batch, error: batchError } = await supabase
        .from("stock_batches")
        .insert({
          product_id: actionRequest.product_id,
          batch_number: batchNumber,
          manufacture_date: null,
          expiry_date: null,
          initial_quantity: finalQuantity,
        })
        .select("id")
        .single();

      if (batchError || !batch) {
        return NextResponse.json({ error: `Batch create nahi ho saka: ${batchError?.message}` }, { status: 500 });
      }

      const { error: itemError } = await supabase.from("purchase_items").insert({
        purchase_id: purchase.id,
        product_id: actionRequest.product_id,
        batch_id: batch.id,
        quantity: finalQuantity,
        unit_cost: finalUnitCost,
        line_total: totalAmount,
      });

      if (itemError) {
        return NextResponse.json({ error: `Purchase line save nahi ho saki: ${itemError.message}` }, { status: 500 });
      }

      createdPurchaseId = purchase.id;
    }
  }

  const { error } = await supabase
    .from("bridge_ai_action_requests")
    .update({
      status,
      review_notes: reviewNotes || null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      ...(createdPurchaseId ? { created_purchase_id: createdPurchaseId } : {}),
    })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, purchaseId: createdPurchaseId });
}