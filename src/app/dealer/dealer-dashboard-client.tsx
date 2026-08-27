"use client";
import { useFormState, useFormStatus } from "react-dom";
import { dealerRespondToOrder, dealerDispatchOrder, type ActionState } from "@/actions/bridge-orders";
import { Package, Wallet, Clock, CheckCircle2, XCircle, Truck } from "lucide-react";

const initialState: ActionState = {};

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  commissionAmount: number;
  placedAt: string;
  area: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  assigned: { label: "Naya - Response Chahiye", color: "bg-amber-50 text-amber-700" },
  dealer_accepted: { label: "Accept Kiya - Dispatch Karein", color: "bg-blue-50 text-blue-700" },
  dealer_rejected: { label: "Reject Kiya", color: "bg-red-50 text-red-700" },
  dealer_dispatched: { label: "Dispatch Ho Gaya", color: "bg-purple-50 text-purple-700" },
  staff_verified: { label: "Verify Ho Gaya", color: "bg-green-50 text-green-700" },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-800" },
};

export function DealerDashboardClient({
  dealerName,
  dealerCode,
  currentPayable,
  pendingCount,
  orders,
}: {
  dealerName: string;
  dealerCode: string;
  currentPayable: number;
  pendingCount: number;
  orders: Order[];
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-surface-900">{dealerName}</h1>
        <p className="text-sm text-surface-500">Dealer Code: {dealerCode}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
          <Clock className="h-5 w-5 text-amber-500" />
          <p className="mt-2 text-2xl font-bold text-surface-900">{pendingCount}</p>
          <p className="text-xs text-surface-500">Naye Orders</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
          <Package className="h-5 w-5 text-brand-500" />
          <p className="mt-2 text-2xl font-bold text-surface-900">{orders.length}</p>
          <p className="text-xs text-surface-500">Total Orders</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
          <Wallet className="h-5 w-5 text-red-500" />
          <p className="mt-2 text-2xl font-bold text-surface-900">Rs {currentPayable.toLocaleString()}</p>
          <p className="text-xs text-surface-500">Aapko Dena Hai (Payable)</p>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-surface-700">Orders</h2>
      {orders.length === 0 ? (
        <p className="rounded-card border border-surface-200 bg-white p-6 text-center text-sm text-surface-400">
          Abhi koi Order nahi hai.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-surface-100 text-surface-600" };

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-surface-500">{order.orderNumber}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
      </div>
      <p className="mt-1 text-sm text-surface-600">{order.area}</p>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-surface-500">Order Value: Rs {order.subtotal.toLocaleString()}</span>
        <span className="font-medium text-brand-700">Commission: Rs {order.commissionAmount.toLocaleString()}</span>
      </div>
      {order.status === "assigned" && <RespondButtons orderId={order.id} />}
      {order.status === "dealer_accepted" && <DispatchButton orderId={order.id} />}
    </div>
  );
}

function RespondButtons({ orderId }: { orderId: string }) {
  const [acceptState, acceptAction] = useFormState(dealerRespondToOrder, initialState);
  const [rejectState, rejectAction] = useFormState(dealerRespondToOrder, initialState);

  return (
    <div className="mt-3 flex gap-2">
      <form action={acceptAction} className="flex-1">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="response" value="accept" />
        <AcceptButton />
      </form>
      <form action={rejectAction} className="flex-1">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="response" value="reject" />
        <RejectButton />
      </form>
      {(acceptState.error || rejectState.error) && (
        <p className="text-xs text-red-600">{acceptState.error || rejectState.error}</p>
      )}
    </div>
  );
}

function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
      <CheckCircle2 className="h-4 w-4" /> Accept
    </button>
  );
}
function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-100 py-2 text-sm font-medium text-surface-600 hover:bg-surface-200 disabled:opacity-60">
      <XCircle className="h-4 w-4" /> Reject
    </button>
  );
}

function DispatchButton({ orderId }: { orderId: string }) {
  const [state, formAction] = useFormState(dealerDispatchOrder, initialState);
  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="order_id" value={orderId} />
      {state.error && <p className="mb-1 text-xs text-red-600">{state.error}</p>}
      <DispatchSubmitButton />
    </form>
  );
}
function DispatchSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60">
      <Truck className="h-4 w-4" /> Dispatch Kar Diya
    </button>
  );
}