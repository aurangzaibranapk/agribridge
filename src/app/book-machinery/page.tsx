import { GeneralBookingForm } from "./form";

export const dynamic = "force-dynamic";

export default function BookMachineryPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-surface-50 p-4">
      <div className="mx-auto max-w-md pt-6">
        <div className="mb-4 text-center">
          <h1 className="font-display text-xl font-bold text-surface-900">الرانا ٹریڈرز - ایگری بریج</h1>
          <p className="mt-1 text-sm text-surface-500">مشینری بکنگ</p>
        </div>
        <GeneralBookingForm />
      </div>
    </div>
  );
}