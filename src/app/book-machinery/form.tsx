"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { quickFarmerMachineryBooking, type QuickBookingState } from "@/actions/quick-farmer-booking";
import { createClient } from "@/lib/supabase/client";
import { Tractor, Loader2, MapPin, CheckCircle2 } from "lucide-react";

const initialState: QuickBookingState = {};

const CROP_OPTIONS = [
  { value: "wheat", label: "گندم" },
  { value: "rice", label: "چاول" },
  { value: "maize", label: "مکئی" },
  { value: "cotton", label: "کپاس" },
  { value: "sugarcane", label: "گنا" },
  { value: "vegetables", label: "سبزیاں" },
  { value: "other", label: "دیگر" },
];

export function GeneralBookingForm() {
  const [state, formAction] = useFormState(quickFarmerMachineryBooking, initialState);
  const [machineType, setMachineType] = useState("rotavator");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [willSell, setWillSell] = useState<"" | "yes" | "no">("");
  const [wantsReminder, setWantsReminder] = useState<"" | "yes" | "no">("");

  async function handleOAuth(provider: "google" | "facebook") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("اس ڈیوائس پر لوکیشن دستیاب نہیں ہے۔");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("لوکیشن حاصل نہیں ہو سکی۔");
        setLocating(false);
      }
    );
  }

  if (state.success) {
    return (
      <div dir="rtl" className="rounded-card border border-green-200 bg-white p-6 text-center shadow-card">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
        <p className="mt-3 font-display text-base font-semibold text-surface-900">بکنگ کی درخواست بھیج دی گئی</p>
        <p className="mt-1 text-sm text-surface-500">الرانا ٹریڈرز جلد آپ سے رابطہ کرے گا اور ریٹ بتا دے گا۔</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <h2 className="flex items-center justify-end gap-2 font-display text-sm font-semibold text-surface-900">
        مشینری بکنگ کریں <Tractor className="h-4 w-4 text-brand-600" />
      </h2>
      <p className="mt-1 text-right text-xs text-surface-500">پہلی بار بک کر رہے ہیں؟ نیچے اپنا نام اور موبائل نمبر لکھ کر فارم بھر دیں۔</p>

      <div className="mt-3 space-y-2">
        <button type="button" onClick={() => handleOAuth("google")} className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50">
          Google کے ساتھ جاری رکھیں
        </button>
        <button type="button" onClick={() => handleOAuth("facebook")} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#166FE5]">
          Facebook کے ساتھ جاری رکھیں
        </button>
      </div>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-surface-200" />
        <span className="text-xs text-surface-400">یا نام و موبائل نمبر سے فارم بھریں</span>
        <div className="h-px flex-1 bg-surface-200" />
      </div>

      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-right text-xs text-red-700">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-surface-600">آپ کا نام *</label>
          <input type="text" name="full_name" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" placeholder="اپنا پورا نام لکھیں" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-600">موبائل نمبر *</label>
          <input type="tel" name="phone_number" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" placeholder="03001234567" />
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-600">کونسی مشین چاہیے؟ *</label>
          <select name="machine_type" value={machineType} onChange={(e) => setMachineType(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="rotavator">روٹاویٹر</option>
            <option value="thresher">تھریشر</option>
            <option value="harvester">ہارویسٹر</option>
            <option value="tractor">ٹریکٹر</option>
            <option value="kubota">کبوٹا (Kubota)</option>
            <option value="other">دیگر</option>
          </select>
        </div>

        {machineType === "other" && (
          <div>
            <label className="block text-xs font-medium text-surface-600">کونسی مشین؟ *</label>
            <input type="text" name="machine_type_other" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" placeholder="مثلاً لیزر لیولر" />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-surface-600">کتنے ایکڑ؟ *</label>
          <input type="number" step="0.1" min="0.1" name="acres" required placeholder="مثلاً 5" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-600">فصل</label>
          <select name="crop_type" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- منتخب کریں -</option>
            {CROP_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-600">کب چاہیے؟ *</label>
          <input type="date" name="expected_date" min={new Date().toISOString().split("T")[0]} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-600">مقام</label>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {coords ? "مقام مل گیا \u2713" : locating ? "مقام حاصل کیا جا رہا ہے..." : "میرا موجودہ مقام بھیجیں"}
          </button>
          {locationError && <p className="mt-1 text-xs text-red-600">{locationError}</p>}
          <input type="hidden" name="location_lat" value={coords?.lat ?? ""} />
          <input type="hidden" name="location_lng" value={coords?.lng ?? ""} />
          <input type="text" name="location_address" className="mt-2 w-full rounded-lg border border-surface-200 p-2 text-sm" placeholder="گاؤں / علاقے کا نام لکھیں" />
        </div>

        <div className={`rounded-lg border-2 p-3 ${willSell === "" ? "border-red-300 bg-red-50" : "border-surface-200"}`}>
          <label className="block text-sm font-medium text-surface-700">کیا آپ ہمیں فصل بیچیں گے؟ *</label>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setWillSell("yes")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${willSell === "yes" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>ہاں</button>
            <button type="button" onClick={() => setWillSell("no")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${willSell === "no" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>نہیں</button>
          </div>
          <input type="hidden" name="will_sell_to_us" value={willSell} />
        </div>

        <div className={`rounded-lg border-2 p-3 ${wantsReminder === "" ? "border-red-300 bg-red-50" : "border-surface-200"}`}>
          <label className="block text-sm font-medium text-surface-700">کیا اگلی فصل کے لیے مشینری بکنگ کی یاد دہانی چاہیے؟ *</label>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setWantsReminder("yes")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${wantsReminder === "yes" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>ہاں</button>
            <button type="button" onClick={() => setWantsReminder("no")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${wantsReminder === "no" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>نہیں</button>
          </div>
          <input type="hidden" name="wants_next_season_reminder" value={wantsReminder} />
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-600">مزید کچھ (اختیاری)</label>
          <textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>

        <SubmitButton disabled={willSell === "" || wantsReminder === ""} />
      </form>
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? "بھیجا جا رہا ہے..." : "بکنگ کی درخواست بھیجیں"}
    </button>
  );
}