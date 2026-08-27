import { getFarmerByBookingToken } from "@/actions/public-machinery-booking";
import { PublicBookingForm } from "./booking-form";

export const dynamic = "force-dynamic";

export default async function PublicMachineryBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const farmer = await getFarmerByBookingToken(token);

  if (!farmer) {
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
        <PublicBookingForm token={token} farmerName={farmer.full_name} />
      </div>
    </div>
  );
}