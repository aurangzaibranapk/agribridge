"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createProduceListing, cancelProduceListing, farmerRespondToProduceOrder, type ActionState } from "@/actions/produce";
import { Plus, Wheat, X, Check } from "lucide-react";

const initialState: ActionState = {};

interface Listing {
  id: string;
  crop_name: string;
  quantity_available: number;
  unit: string;
  asking_price_per_unit: number;
  status: string;
}

interface Order {
  id: string;
  order_number: string;
  quantity: number;
  farmer_payout_amount: number;
  status: string;
  crop_name: string;
  unit: string;
}

export function SellProduceClient({ listings, orders }: { listings: Listing[]; orders: Order[] }) {
  const [showForm, setShowForm] = useState(false);

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      placed: "New Order - Awaiting your response",
      farmer_accepted: "Accepted - Awaiting payment verification",
      farmer_rejected: "Rejected",
      staff_verified: "Payment released - Please deliver",
      delivered: "Delivered",
      settled: "Settled",
      cancelled: "Cancelled",
    };
    return map[status] ?? status;
  }

  return (
    <div>
      {orders.some((o) => o.status === "placed") && (
        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-surface-900">Orders Needing Your Response</h2>
          <div className="space-y-3">
            {orders.filter((o) => o.status === "placed").map((o) => (
              <div key={o.id} className="rounded-card border border-amber-200 bg-amber-50 p-4">
                <p className="font-medium text-surface-900">
                  {o.crop_name} - {o.quantity} {o.unit}
                </p>
                <p className="text-sm text-surface-600">
                  Order #{o.order_number} - You'll receive Rs {o.farmer_payout_amount.toLocaleString()}
                </p>
                <OrderResponseButtons orderId={o.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {orders.filter((o) => o.status !== "placed").length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-surface-900">Order History</h2>
          <div className="space-y-2">
            {orders.filter((o) => o.status !== "placed").map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-3 shadow-card">
                <div>
                  <p className="text-sm font-medium text-surface-900">
                    {o.crop_name} - {o.quantity} {o.unit}
                  </p>
                  <p className="text-xs text-surface-400">Rs {o.farmer_payout_amount.toLocaleString()}</p>
                </div>
                <span className="text-xs text-surface-500">{statusLabel(o.status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-surface-900">My Listings</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New Listing
        </button>
      </div>

      <div className="space-y-3">
        {listings.length === 0 ? (
          <p className="rounded-card border border-dashed border-surface-200 bg-white p-8 text-center text-sm text-surface-400">
            No listings yet. Create one to start selling your produce.
          </p>
        ) : (
          listings.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Wheat className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-surface-900">{l.crop_name}</p>
                  <p className="text-sm text-surface-500">
                    {l.quantity_available} {l.unit} available @ Rs {l.asking_price_per_unit}/{l.unit}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    l.status === "active" ? "bg-brand-50 text-brand-700" : "bg-surface-100 text-surface-500"
                  }`}
                >
                  {l.status}
                </span>
                {l.status === "active" && <CancelButton listingId={l.id} />}
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && <NewListingModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function OrderResponseButtons({ orderId }: { orderId: string }) {
  const [, formAction] = useFormState(farmerRespondToProduceOrder, initialState);
  return (
    <div className="mt-2 flex gap-2">
      <form action={formAction}>
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="response" value="accept" />
        <AcceptButton />
      </form>
      <form action={formAction}>
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="response" value="reject" />
        <RejectButton />
      </form>
    </div>
  );
}

function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
      <Check className="h-3.5 w-3.5" /> Accept
    </button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
      <X className="h-3.5 w-3.5" /> Reject
    </button>
  );
}

function NewListingModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState(createProduceListing, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">New Produce Listing</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Listing created.</p>}
        <form action={formAction} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-surface-500">Crop Name *</label>
            <input name="crop_name" required placeholder="e.g. Wheat, Rice, Maize" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-500">Quantity Available *</label>
              <input name="quantity_available" type="number" step="0.1" required className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-500">Unit</label>
              <select name="unit" defaultValue="kg" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                <option value="kg">kg</option>
                <option value="maund">maund</option>
                <option value="ton">ton</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500">Asking Price per Unit (Rs.) *</label>
            <input name="asking_price_per_unit" type="number" step="0.01" required className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500">Quality Grade</label>
            <input name="quality_grade" placeholder="e.g. A, Premium" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500">Notes</label>
            <textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function CancelButton({ listingId }: { listingId: string }) {
  const [, formAction] = useFormState(cancelProduceListing, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="listing_id" value={listingId} />
      <button type="submit" className="text-xs text-red-600 hover:underline">Cancel</button>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Creating..." : "Create Listing"}
    </button>
  );
}