import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { getOrderPermissions } from "@/lib/order-permissions";
import { getAdvancePaymentStatus } from "@/lib/order-payment-gate";
import { OrderDetailActions } from "./order-detail-actions";
import { PaymentSection } from "./payment-section";
import { DispatchSection } from "./dispatch-section";
import { GrnSection } from "./grn-section";
import { ComplaintFeedbackSection } from "./complaint-feedback-section";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (["completed", "approved", "delivered"].includes(status)) return "green" as const;
  if (["rejected", "cancelled"].includes(status)) return "red" as const;
  if (status === "draft") return "amber" as const;
  return "blue" as const;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin",
  admin: "Admin",
  owner: "Admin",
  admin_assistant: "Admin",
  manager: "Manager",
  sales_staff: "Sales Team",
  finance: "Finance Team",
  warehouse: "Warehouse Team",
  farmer: "Farmer",
  customer: "Customer",
  dealer: "Dealer",
  investor: "Investor",
  company_rep: "Company Rep",
};

function roleLabel(role: string | null, hasBranch: boolean) {
  if (role && ROLE_LABELS[role]) return ROLE_LABELS[role];
  if (hasBranch) return "Shop Staff";
  return "System";
}

const NEXT_STEP_HINTS: Record<string, string> = {
  submitted: "Ab Sales Team ko is order ko verify karna hai.",
  sales_verified: "Ab Finance Team ko verify karna hai.",
  finance_verified: "Ab Manager ko order approve karna hai.",
  payment_submitted: "Payment Finance Team ke paas verification ke liye bhej di gayi hai.",
  approved: "Ab Warehouse Team ko dispatch banana hai.",
  dispatched: "Order in transit hone ka intezar hai.",
  in_transit: "Ab shop ko delivery confirm karni hai.",
  delivered: "Ab shop ko GRN banana hai.",
};

const STEPPER_STAGES = [
  { statuses: ["submitted"], label: "Order Submit Hua" },
  { statuses: ["sales_verified"], label: "Sales Verify Hui" },
  { statuses: ["finance_verified"], label: "Finance Verify Hui" },
  { statuses: ["approved"], label: "Order Approve Hua" },
  { statuses: ["dispatched"], label: "Dispatch Hua" },
  { statuses: ["in_transit"], label: "In Transit" },
  { statuses: ["delivered"], label: "Deliver Hua" },
  { statuses: ["completed"], label: "GRN Complete" },
];

export default async function AgriOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  const { data: order } = await supabase.from("agri_orders").select("*, branches!agri_orders_order_to_branch_id_fkey(name)").eq("id", id).single();

  if (!order) {
    return <div className="p-8 text-center text-surface-400">Order nahi mila.</div>;
  }

  const permissions = await getOrderPermissions(order.order_to_branch_id ?? null, order.order_from_branch_id ?? null);

  // Advance order ki payment poori hui ya nahi — isi se dispatch ka
  // button khulta hai aur upar wala banner tay hota hai. Base order par
  // isSatisfied hamesha true aata hai, is liye koi farq nahi parta.
  const advance = await getAdvancePaymentStatus(order.id);

  // Logged-in user's own identity - passed down so the Delivery Confirm
  // modal can auto-fill "Receiver" fields instead of retyping what the
  // system already knows (identity-driven principle established earlier).
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const { data: currentProfile } = currentUser
    ? await supabase.from("profiles").select("full_name, phone_number").eq("id", currentUser.id).maybeSingle()
    : { data: null };
  const currentUserIdentity = {
    name: currentProfile?.full_name ?? "",
    mobile: currentProfile?.phone_number ?? "",
  };

  const { data: items } = await supabase.from("agri_order_items").select("*").eq("order_id", id).order("created_at");
  const { data: timeline } = await supabase.from("agri_order_timeline").select("*").eq("order_id", id).order("created_at", { ascending: true });
  const { data: rawPayments } = permissions.canSeePayments
    ? await supabase.from("agri_order_payments").select("*").eq("order_id", id).order("created_at", { ascending: false })
    : { data: [] as any[] };
  const { data: rawDispatch } = permissions.canSeeDispatch
    ? await supabase.from("agri_dispatches").select("*").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const { data: rawDelivery } = rawDispatch
    ? await supabase.from("agri_deliveries").select("*").eq("dispatch_id", rawDispatch.id).limit(1).maybeSingle()
    : { data: null };
  const { data: rawDispatchItems } = rawDispatch
    ? await supabase.from("agri_dispatch_items").select("*").eq("dispatch_id", rawDispatch.id)
    : { data: [] as any[] };
  const { data: rawDeliveryItems } = rawDelivery
    ? await supabase.from("agri_delivery_items").select("*").eq("delivery_id", rawDelivery.id)
    : { data: [] as any[] };
  const deliveryInfoByOrderItem: Record<string, { received_qty: number; short_qty: number; damaged_qty: number; reason: string | null }> = {};
  (rawDeliveryItems ?? []).forEach((di: any) => {
    const dispatchItem = (rawDispatchItems ?? []).find((dsi: any) => dsi.id === di.dispatch_item_id);
    if (dispatchItem?.order_item_id) {
      deliveryInfoByOrderItem[dispatchItem.order_item_id] = {
        received_qty: Number(di.received_qty),
        short_qty: Number(di.short_qty),
        damaged_qty: Number(di.damaged_qty),
        reason: di.reason,
      };
    }
  });
  const { data: rawGrn } = permissions.canSeeGrn
    ? await supabase.from("agri_grns").select("*").eq("order_id", id).limit(1).maybeSingle()
    : { data: null };
  const { data: rawComplaints } = permissions.canSeeComplaints
    ? await supabase.from("agri_complaints").select("*").eq("order_id", id).order("created_at", { ascending: false })
    : { data: [] as any[] };
  const { data: rawFeedback } = permissions.canSeeComplaints
    ? await supabase.from("agri_feedback").select("id").eq("order_id", id).limit(1).maybeSingle()
    : { data: null };

  const { data: rawDrivers } = permissions.canSeeDispatch
    ? await supabase
        .from("drivers")
        .select("id, full_name, mobile_number, dispatch_vehicles(vehicle_number)")
        .eq("is_active", true)
        .order("full_name")
    : { data: [] as any[] };
  const drivers = (rawDrivers ?? []).map((d: any) => ({
    id: d.id,
    full_name: d.full_name,
    mobile_number: d.mobile_number,
    vehicle_number: Array.isArray(d.dispatch_vehicles) ? d.dispatch_vehicles[0]?.vehicle_number ?? "" : "",
  }));

  const creatorIds = Array.from(new Set((timeline ?? []).map((t) => t.created_by).filter(Boolean)));
  let creatorInfo: Record<string, { name: string; role: string | null; hasBranch: boolean }> = {};
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase.from("profiles").select("id, full_name, role, branch_id").in("id", creatorIds);
    creatorInfo = Object.fromEntries(
      (creators ?? []).map((c: any) => [c.id, { name: c.full_name ?? "User", role: c.role, hasBranch: !!c.branch_id }])
    );
  }

  const toBranch = Array.isArray(order.branches) ? order.branches[0]?.name : order.branches?.name;

  // Branch-to-branch order mein maal dene wali shop ka naam. Alag query
  // se aata hai kyunke order ki apni select sirf order_to_branch_id wale
  // rishte ko laati hai.
  const { data: fromBranchRow } = order.order_from_branch_id
    ? await supabase.from("branches").select("name").eq("id", order.order_from_branch_id).maybeSingle()
    : { data: null };
  const fromBranch = fromBranchRow?.name ?? null;

  const payments = (rawPayments ?? []).map((p) => ({
    id: p.id,
    payment_number: p.payment_number,
    payment_method: p.payment_method,
    bank_name: p.bank_name,
    transaction_id: p.transaction_id,
    payment_date: p.payment_date,
    paid_amount: Number(p.paid_amount),
    receipt_url: p.receipt_url,
    status: p.status,
    rejection_reason: p.rejection_reason,
  }));

  const orderItemsForDispatch = (items ?? []).map((i) => ({
    id: i.id,
    product_name: i.product_name,
    batch_no: i.batch_no,
    expiry_date: i.expiry_date,
    order_qty: Number(i.order_qty),
  }));

  const orderItemsForGrn = (items ?? []).map((i) => ({
    id: i.id,
    product_id: i.product_id,
    product_name: i.product_name,
    batch_no: i.batch_no,
    expiry_date: i.expiry_date,
    order_qty: Number(i.order_qty),
    unit_price: Number(i.unit_price),
  }));

  const dispatch = rawDispatch
    ? {
        id: rawDispatch.id,
        dispatch_number: rawDispatch.dispatch_number,
        vehicle_no: rawDispatch.vehicle_no,
        driver_name: rawDispatch.driver_name,
        driver_mobile: rawDispatch.driver_mobile,
        transporter: rawDispatch.transporter,
        dispatch_date: rawDispatch.dispatch_date,
        expected_delivery_date: rawDispatch.expected_delivery_date,
        delivery_location: rawDispatch.delivery_location,
        status: rawDispatch.status,
      }
    : null;

  const delivery = rawDelivery
    ? {
        id: rawDelivery.id,
        delivered_date: rawDelivery.delivered_date,
        receiver_name: rawDelivery.receiver_name,
        delivered_qty: rawDelivery.delivered_qty ? Number(rawDelivery.delivered_qty) : null,
        short_qty: rawDelivery.short_qty ? Number(rawDelivery.short_qty) : null,
        damaged_qty: rawDelivery.damaged_qty ? Number(rawDelivery.damaged_qty) : null,
        delivery_photo_url: rawDelivery.delivery_photo_url,
        delivery_challan_url: rawDelivery.delivery_challan_url,
      }
    : null;

  const grn = rawGrn
    ? {
        id: rawGrn.id,
        grn_number: rawGrn.grn_number,
        ordered_value: Number(rawGrn.ordered_value),
        received_value: Number(rawGrn.received_value),
        shortage_amount: Number(rawGrn.shortage_amount),
        damage_amount: Number(rawGrn.damage_amount),
        payable_amount: Number(rawGrn.payable_amount),
        discrepancy_status: rawGrn.discrepancy_status ?? "none",
        warehouse_notes: rawGrn.warehouse_notes ?? null,
        final_payable_amount: rawGrn.final_payable_amount !== null && rawGrn.final_payable_amount !== undefined ? Number(rawGrn.final_payable_amount) : null,
      }
    : null;

  const complaints = (rawComplaints ?? []).map((c) => ({
    id: c.id,
    complaint_number: c.complaint_number,
    complaint_type: c.complaint_type,
    description: c.description,
    status: c.status,
    resolution_notes: c.resolution_notes,
  }));

  const nextStepHint = NEXT_STEP_HINTS[order.status];

  const reachedStatuses = new Set((timeline ?? []).map((t) => t.status));
  const isRejected = order.status === "rejected" || order.status === "cancelled";
  let currentStageIdx = -1;
  STEPPER_STAGES.forEach((stage, idx) => {
    if (stage.statuses.some((s) => reachedStatuses.has(s))) currentStageIdx = idx;
  });

  return (
    <div>
      <PageHeader
        title={order.order_number}
        description={`${order.order_type} | ${order.shop_dealer_name ?? toBranch ?? order.order_to_type}`}
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge tone={statusTone(order.status)}>{order.status.replace(/_/g, " ")}</Badge>
        <span className="font-display text-lg font-bold text-surface-900 dark:text-white">Rs {Number(order.grand_total).toLocaleString()}</span>
      </div>

      {nextStepHint && (
        <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">{nextStepHint}</div>
      )}

      {advance.isAdvance && !isRejected && (
        advance.isSatisfied ? (
          <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">
            Advance Order — poori payment Rs {advance.grandTotal.toLocaleString()} verify ho chuki hai. Dispatch ho sakta hai.
          </div>
        ) : (
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Advance Order — Rs {advance.verifiedPaid.toLocaleString()} verify hui, <strong>Rs {advance.remaining.toLocaleString()} baqi hai</strong>. Poori payment aane tak dispatch nahi hoga.
          </div>
        )
      )}

      <OrderDetailActions orderId={order.id} status={order.status} permissions={permissions} />

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">Product</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Price</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((i) => (
                  <tr key={i.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">
                      {i.product_name} {i.pack_size ? `(${i.pack_size})` : ""}
                      {i.batch_no && <span className="ml-1 text-xs text-surface-400">Batch: {i.batch_no}</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{i.order_qty}</td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {Number(i.unit_price).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {Number(i.line_total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
            <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Order Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-surface-500">Subtotal</span><span>Rs {Number(order.subtotal).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Discount</span><span>- Rs {Number(order.discount).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Tax</span><span>+ Rs {Number(order.tax).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Freight</span><span>+ Rs {Number(order.freight_charges).toLocaleString()}</span></div>
              <div className="flex justify-between border-t border-surface-100 pt-1 font-semibold dark:border-surface-800"><span>Grand Total</span><span>Rs {Number(order.grand_total).toLocaleString()}</span></div>
            </div>
            <p className="mt-2 text-xs text-surface-500">Payment Mode: {advance.isAdvance ? "Advance Order (pehle payment)" : `Base Order / Khata (${order.payment_terms})`}</p>
            <p className="mt-1 text-xs text-surface-500">
              Maal Kahan Se: {order.order_from_branch_id ? `${fromBranch ?? "Doosri Shop"} (shop-to-shop)` : "Company / HQ Warehouse"}
            </p>
            {order.order_from_branch_id && (
              <p className="mt-1 text-xs text-surface-500">
                Settlement: {order.settlement_method === "direct_branch"
                  ? "Seedha shops ke darmiyan (Company ka taalluq nahi)"
                  : "Company ke zariye"}
              </p>
            )}
            {order.rejection_reason && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">Reject Wajah: {order.rejection_reason}</p>}
          </div>

          {permissions.canSeePayments && <PaymentSection orderId={order.id} payments={payments} permissions={permissions} />}
          {permissions.canSeeDispatch && (
            <DispatchSection orderId={order.id} orderStatus={order.status} orderItems={orderItemsForDispatch} dispatch={dispatch} delivery={delivery} permissions={permissions} drivers={drivers} dispatchItems={(rawDispatchItems ?? []).map((di: any) => ({ id: di.id, product_name: di.product_name, dispatched_qty: Number(di.dispatched_qty) }))} currentUserIdentity={currentUserIdentity} advanceBlocked={!advance.isSatisfied} advanceRemaining={advance.remaining} />
          )}
          {permissions.canSeeGrn && (
            <GrnSection orderId={order.id} dispatchId={dispatch?.id ?? null} orderStatus={order.status} orderItems={orderItemsForGrn} grn={grn} permissions={permissions} deliveryInfoByOrderItem={deliveryInfoByOrderItem} />
          )}
          {permissions.canSeeComplaints && (
            <ComplaintFeedbackSection orderId={order.id} orderStatus={order.status} complaints={complaints} hasFeedback={!!rawFeedback} permissions={permissions} />
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Order Progress</h3>
          <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
            {!isRejected ? (
              <div className="space-y-0">
                {STEPPER_STAGES.map((stage, idx) => {
                  const isDone = idx <= currentStageIdx;
                  const isLast = idx === STEPPER_STAGES.length - 1;
                  return (
                    <div key={stage.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isDone ? "bg-green-500 text-white" : "bg-surface-200 text-surface-400 dark:bg-surface-700"
                          }`}
                        >
                          {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                        </div>
                        {!isLast && <div className={`w-0.5 flex-1 ${isDone && idx < currentStageIdx ? "bg-green-500" : "bg-surface-200 dark:bg-surface-700"}`} style={{ minHeight: "20px" }} />}
                      </div>
                      <p className={`pb-4 text-sm ${isDone ? "font-medium text-surface-900 dark:text-white" : "text-surface-400"}`}>{stage.label}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                Ye order {order.status === "rejected" ? "reject" : "cancel"} ho chuka hai.
              </p>
            )}
          </div>

          <h3 className="mb-2 mt-4 text-sm font-semibold text-surface-900 dark:text-white">Detailed Log</h3>
          <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
            <div className="space-y-2.5">
              {(timeline ?? []).map((t) => {
                const creator = t.created_by ? creatorInfo[t.created_by] : null;
                const label = creator
                  ? permissions.isOwnerBranch
                    ? roleLabel(creator.role, creator.hasBranch)
                    : `${creator.name} (${roleLabel(creator.role, creator.hasBranch)})`
                  : null;
                return (
                  <div key={t.id} className="border-b border-surface-50 pb-2 text-xs last:border-0 dark:border-surface-800">
                    <p className="font-medium text-surface-700 dark:text-surface-300">{t.status.replace(/_/g, " ")}</p>
                    <p className="text-surface-500">{t.note}</p>
                    {label && <p className="text-surface-400">By: {label}</p>}
                    <p className="text-surface-400">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}