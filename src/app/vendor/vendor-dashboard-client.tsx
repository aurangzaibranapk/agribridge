"use client";
import { Tractor, Wallet, Clock, Package } from "lucide-react";

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  bookingDate: string;
  totalAmount: number;
  vendorPayable: number;
  amountPaidToVendor: number;
  farmerName: string;
  machineLabel: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmed", color: "bg-blue-50 text-blue-700" },
  in_progress: { label: "Chal Raha Hai", color: "bg-purple-50 text-purple-700" },
  completed: { label: "Mukammal", color: "bg-green-50 text-green-700" },
  cancelled: { label: "Cancel", color: "bg-red-50 text-red-700" },
};

export function VendorDashboardClient({
  vendorName,
  totalOutstanding,
  pendingCount,
  bookings,
}: {
  vendorName: string;
  totalOutstanding: number;
  pendingCount: number;
  bookings: Booking[];
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Tractor className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-surface-900">{vendorName}</h1>
          <p className="text-sm text-surface-500">Machinery Vendor Portal</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
          <Clock className="h-5 w-5 text-amber-500" />
          <p className="mt-2 text-2xl font-bold text-surface-900">{pendingCount}</p>
          <p className="text-xs text-surface-500">Pending Bookings</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
          <Package className="h-5 w-5 text-brand-500" />
          <p className="mt-2 text-2xl font-bold text-surface-900">{bookings.length}</p>
          <p className="text-xs text-surface-500">Total Bookings</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
          <Wallet className="h-5 w-5 text-green-500" />
          <p className="mt-2 text-2xl font-bold text-surface-900">Rs {totalOutstanding.toLocaleString()}</p>
          <p className="text-xs text-surface-500">Aapko Milna Hai (Outstanding)</p>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-surface-700">Bookings</h2>
      {bookings.length === 0 ? (
        <p className="rounded-card border border-surface-200 bg-white p-6 text-center text-sm text-surface-400">
          Abhi koi Booking nahi hai.
        </p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const statusInfo = STATUS_LABELS[b.status] ?? { label: b.status, color: "bg-surface-100 text-surface-600" };
            const remaining = b.vendorPayable - b.amountPaidToVendor;
            return (
              <div key={b.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-surface-500">{b.bookingNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-surface-800">{b.machineLabel}</p>
                <p className="text-xs text-surface-500">Farmer: {b.farmerName} - {new Date(b.bookingDate).toLocaleDateString()}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-surface-500">Aapka Hissa: Rs {b.vendorPayable.toLocaleString()}</span>
                  <span className={`font-medium ${remaining > 0 ? "text-amber-700" : "text-green-700"}`}>
                    {remaining > 0 ? `Baaqi: Rs ${remaining.toLocaleString()}` : "Poora Mil Gaya"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}