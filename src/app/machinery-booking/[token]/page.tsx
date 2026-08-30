import { getFarmerPortal } from "@/actions/public-machinery-booking";
import { FarmerPortal } from "./farmer-portal";

export const dynamic = "force-dynamic";

/**
 * Kisan ka apna safha.
 *
 * Pehle yahan sirf ek darkhwast ka form tha: har dafa naye sire se
 * raqba, jagah, sab kuch. Ab teen cheezein hain, aur teenon ek hi
 * sawal ke hisse hain -- "meri kattai ka kya bana?"
 *
 *   Mere khet      -- ek dafa pin, hamesha ke liye
 *   Nayi darkhwast -- khet chunein, baqi sab wahin se aata hai
 *   Meri bookings  -- kaam kahan tak pahuncha, kitna baqi
 */
export default async function PublicMachineryBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getFarmerPortal(token);

  if (!portal.farmer) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-surface-50 p-4">
        <div className="rounded-card border border-red-200 bg-white p-6 text-center shadow-card">
          <p className="text-sm font-medium text-red-600">یہ لنک اب کام نہیں کر رہا۔</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-surface-50 p-4">
      <div className="mx-auto max-w-md pt-6">
        <div className="mb-4 text-center">
          <h1 className="font-display text-xl font-bold text-surface-900">الرانا ٹریڈرز - ایگری برج</h1>
          <p className="mt-1 text-sm text-surface-500">مشینری بکنگ</p>
        </div>
        <FarmerPortal
          token={token}
          farmer={portal.farmer}
          farms={portal.farms}
          bookings={portal.bookings}
          pendingRequests={portal.pendingRequests}
        />
      </div>
    </div>
  );
}
