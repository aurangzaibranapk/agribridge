"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  addFarmByToken,
  updateFarmLocationByToken,
  submitPublicMachineryRequest,
  type PublicBookingState,
  type PortalFarm,
  type PortalBooking,
} from "@/actions/public-machinery-booking";
import { Tractor, Loader2, MapPin, CheckCircle2, Plus, Crosshair, Pencil } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: PublicBookingState = {};

const CROP_OPTIONS = [
  { value: "wheat", label: "گندم" },
  { value: "rice", label: "چاول" },
  { value: "maize", label: "مکئی" },
  { value: "cotton", label: "کپاس" },
  { value: "sugarcane", label: "گنا" },
  { value: "vegetables", label: "سبزیاں" },
  { value: "other", label: "دیگر" },
];

/**
 * Booking ki seerhi -- kisan ki zaban mein.
 *
 * Kisan ke liye "rate_final_karein" jaisi koi cheez nahi hoti. Us ke
 * liye sirf ek sawal hai: mera kaam kahan tak pahuncha. Is liye wohi
 * qadam dikhte hain jo us se guzarte hain, aur us tarteeb mein jis
 * mein wo waqai hote hain.
 */
const STEPS: Array<{ key: string; label: string }> = [
  { key: "nayi", label: "درخواست موصول ہوئی" },
  { key: "schedule", label: "ریٹ طے ہو گیا" },
  { key: "machine_gayi", label: "مشین بھیج دی گئی" },
  { key: "chal_raha", label: "کٹائی جاری ہے" },
  { key: "mukammal", label: "کام مکمل" },
];

export function FarmerPortal({
  token,
  farmer,
  farms,
  bookings,
  pendingRequests,
}: {
  token: string;
  farmer: { id: string; full_name: string; farmer_code: string | null; village: string | null };
  farms: PortalFarm[];
  bookings: PortalBooking[];
  pendingRequests: Array<{ id: string; machineType: string; acres: number | null; expectedDate: string | null; createdAt: string }>;
}) {
  const lang = useLang();
  const [tab, setTab] = useState<"bookings" | "new" | "farms">(
    bookings.length === 0 && pendingRequests.length === 0 ? "new" : "bookings"
  );

  return (
    <div dir="rtl" className="space-y-4">
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
        <h2 className="flex items-center justify-end gap-2 font-display text-sm font-semibold text-surface-900">
          السلام علیکم، {farmer.full_name} <Tractor className="h-4 w-4 text-brand-600" />
        </h2>
        {farmer.farmer_code && <p className="mt-0.5 text-right text-xs text-surface-400">{farmer.farmer_code}</p>}
      </div>

      <div className="flex gap-1 rounded-lg bg-surface-100 p-1">
        <Tab active={tab === "bookings"} onClick={() => setTab("bookings")}>
          میری بکنگ
        </Tab>
        <Tab active={tab === "new"} onClick={() => setTab("new")}>
          نئی درخواست
        </Tab>
        <Tab active={tab === "farms"} onClick={() => setTab("farms")}>
          میرے کھیت
        </Tab>
      </div>

      {tab === "bookings" && <BookingsList bookings={bookings} pendingRequests={pendingRequests} />}
      {tab === "new" && <NewRequest token={token} farms={farms} onNeedFarm={() => setTab("farms")} />}
      {tab === "farms" && <Farms token={token} farms={farms} />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-2 text-xs font-medium ${
        active ? "bg-white text-surface-900 shadow-sm" : "text-surface-500"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Meri bookings                                                       */
/* ------------------------------------------------------------------ */

function BookingsList({
  bookings,
  pendingRequests,
}: {
  bookings: PortalBooking[];
  pendingRequests: Array<{ id: string; machineType: string; acres: number | null; expectedDate: string | null; createdAt: string }>;
}) {
  if (bookings.length === 0 && pendingRequests.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-white p-6 text-center shadow-card">
        <p className="text-sm text-surface-500">ابھی کوئی بکنگ نہیں ہے۔</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendingRequests.map((r) => (
        <div key={r.id} className="rounded-card border border-amber-200 bg-amber-50 p-4 shadow-card">
          <p className="text-sm font-medium text-amber-900">درخواست بھیج دی گئی — ابھی منظوری کا انتظار ہے</p>
          <p className="mt-1 text-xs text-amber-700">
            {r.machineType}
            {r.acres ? ` · ${r.acres} ایکڑ` : ""}
            {r.expectedDate ? ` · ${new Date(r.expectedDate).toLocaleDateString()}` : ""}
          </p>
          <p className="mt-1 text-xs text-amber-600">الرانا ٹریڈرز جلد رابطہ کر کے ریٹ بتا دے گا۔</p>
        </div>
      ))}

      {bookings.map((b) => (
        <BookingCard key={b.bookingId} b={b} />
      ))}
    </div>
  );
}

function BookingCard({ b }: { b: PortalBooking }) {
  const reached = STEPS.findIndex((s) => s.key === b.workState);
  const cancelled = b.workState === "cancelled";

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-semibold text-surface-900">{b.bookingNumber}</p>
          <p className="text-xs text-surface-500">
            {b.area} ایکڑ
            {b.machineType ? ` · ${b.machineType}` : ""}
            {b.harvestDate ? ` · ${new Date(b.harvestDate).toLocaleDateString()}` : ""}
          </p>
        </div>
        {b.rate !== null && b.rateStatus === "final" && (
          <p className="whitespace-nowrap text-xs text-surface-500">Rs {b.rate.toLocaleString()} / ایکڑ</p>
        )}
      </div>

      {cancelled ? (
        <p className="mt-3 rounded-lg bg-surface-100 px-3 py-2 text-xs text-surface-500">یہ بکنگ منسوخ ہو گئی۔</p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {STEPS.map((s, i) => {
            const done = reached >= 0 && i <= reached;
            return (
              <li key={s.key} className="flex items-center gap-2 text-xs">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    done ? "bg-brand-600 text-white" : "bg-surface-200"
                  }`}
                >
                  {done && <CheckCircle2 className="h-3 w-3" />}
                </span>
                <span className={done ? "font-medium text-surface-800" : "text-surface-400"}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Paisa. Ye tab hi dikhta hai jab bill ban chuka ho -- us se
          pehle koi asal adad hai hi nahi, aur andaza dikhana wo cheez
          hai jise kisan bill samajh leta hai. */}
      {b.billNumber && (
        <div className="mt-3 space-y-1 rounded-lg border border-surface-200 p-3 text-xs">
          <Line label="بل" value={`Rs ${(b.gross ?? 0).toLocaleString()}`} />
          {b.advance > 0 && <Line label="ایڈوانس" value={`Rs ${b.advance.toLocaleString()}`} />}
          <Line label="ادا شدہ" value={`Rs ${b.received.toLocaleString()}`} />
          <div className="mt-1 flex justify-between border-t border-surface-200 pt-1 font-semibold">
            <span>باقی</span>
            <span className={b.outstanding > 0 ? "text-red-600" : "text-brand-700"}>
              Rs {b.outstanding.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-surface-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mere khet                                                           */
/* ------------------------------------------------------------------ */

function Farms({ token, farms }: { token: string; farms: PortalFarm[] }) {
  const [adding, setAdding] = useState(farms.length === 0);

  return (
    <div className="space-y-3">
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
        <p className="text-xs text-surface-500">
          کھیت ایک بار محفوظ ہو جائے تو اگلی بار صرف منتخب کرنا ہے — مقام دوبارہ لینے کی ضرورت نہیں۔
        </p>
      </div>

      {farms.map((f) => (
        <FarmCard key={f.id} token={token} farm={f} />
      ))}

      {adding ? (
        <AddFarm token={token} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700"
        >
          <Plus className="h-4 w-4" /> نیا کھیت شامل کریں
        </button>
      )}
    </div>
  );
}

function FarmCard({ token, farm }: { token: string; farm: PortalFarm }) {
  const [fixing, setFixing] = useState(false);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-semibold text-surface-900">{farm.name}</p>
          <p className="text-xs text-surface-500">
            {farm.areaAcres} ایکڑ{farm.village ? ` · ${farm.village}` : ""}
          </p>
        </div>
        {farm.lat !== null && farm.lng !== null ? (
          <span className="flex items-center gap-1 whitespace-nowrap text-xs text-brand-700">
            <MapPin className="h-3.5 w-3.5" /> مقام محفوظ
          </span>
        ) : (
          <span className="whitespace-nowrap text-xs text-amber-700">مقام نہیں</span>
        )}
      </div>

      {/* Sehat bhi likhi jati hai. 5 meter ka pin aur 500 meter ka pin
          dekhne mein ek jaise hote hain -- aur machine bhejne wale ke
          liye wo farq sab kuch hai. */}
      {farm.accuracyM !== null && (
        <p className="mt-1 text-xs text-surface-400">تقریباً {Math.round(farm.accuracyM)} میٹر کے اندر</p>
      )}

      {fixing ? (
        <LocationForm
          token={token}
          farmId={farm.id}
          onDone={() => setFixing(false)}
          initialLat={farm.lat}
          initialLng={farm.lng}
        />
      ) : (
        <button
          type="button"
          onClick={() => setFixing(true)}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600"
        >
          <Pencil className="h-3 w-3" />
          {farm.lat === null ? "مقام شامل کریں" : "مقام درست کریں"}
        </button>
      )}
    </div>
  );
}

/**
 * Mauqa lene ka khana.
 *
 * Do raaste jaan boojh kar: khet par khare ho kar button dabana, ya
 * naqshe wale adad khud likh dena. GPS kabhi kuch meter idhar-udhar
 * hota hai aur khet ka kinara sarak se nazar aata hai -- us waqt
 * kisan hum se behtar jaanta hai ke pin kahan hona chahiye.
 */
function LocationForm({
  token,
  farmId,
  onDone,
  initialLat,
  initialLng,
}: {
  token: string;
  farmId: string;
  onDone: () => void;
  initialLat: number | null;
  initialLng: number | null;
}) {
  const lang = useLang();
  const [state, action] = useFormState(updateFarmLocationByToken, initialState);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number | null } | null>(
    initialLat !== null && initialLng !== null ? { lat: initialLat, lng: initialLng, acc: null } : null
  );
  const [manual, setManual] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (state.success) {
    return <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{state.notice}</p>;
  }

  return (
    <form action={action} className="mt-3 space-y-2 rounded-lg border border-surface-200 p-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="farm_id" value={farmId} />
      <input type="hidden" name="farm_lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="farm_lng" value={coords?.lng ?? ""} />
      <input type="hidden" name="farm_accuracy" value={coords?.acc ?? ""} />
      <input type="hidden" name="farm_manual" value={manual ? "yes" : "no"} />

      <CaptureButton
        locating={locating}
        haveCoords={coords !== null}
        onClick={() => {
          if (!navigator.geolocation) {
            setErr("اس ڈیوائس پر لوکیشن دستیاب نہیں ہے۔");
            return;
          }
          setLocating(true);
          setErr(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy ?? null });
              setManual(false);
              setLocating(false);
            },
            () => {
              setErr("مقام حاصل نہیں ہو سکا۔");
              setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
          );
        }}
      />

      {coords && (
        <p className="text-xs text-surface-500">
          {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          {coords.acc !== null && ` · تقریباً ${Math.round(coords.acc)} میٹر`}
        </p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-surface-500">خود درست کریں</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.000001"
            placeholder={t("ou_latitude", lang)}
            value={coords?.lat ?? ""}
            onChange={(e) => {
              setCoords({ lat: Number(e.target.value), lng: coords?.lng ?? 0, acc: null });
              setManual(true);
            }}
            className="w-full rounded-lg border border-surface-200 p-2 text-xs"
          />
          <input
            type="number"
            step="0.000001"
            placeholder={t("ou_longitude", lang)}
            value={coords?.lng ?? ""}
            onChange={(e) => {
              setCoords({ lat: coords?.lat ?? 0, lng: Number(e.target.value), acc: null });
              setManual(true);
            }}
            className="w-full rounded-lg border border-surface-200 p-2 text-xs"
          />
        </div>
      </details>

      {err && <p className="text-xs text-red-600">{err}</p>}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <Submit label="محفوظ کریں" small />
        <button type="button" onClick={onDone} className="rounded-lg border border-surface-200 px-3 text-xs text-surface-500">
          رہنے دیں
        </button>
      </div>
    </form>
  );
}

function AddFarm({ token, onDone }: { token: string; onDone: () => void }) {
  const [state, action] = useFormState(addFarmByToken, initialState);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number | null } | null>(null);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (state.success) {
    return (
      <div className="rounded-card border border-brand-200 bg-brand-50 p-4 text-center">
        <p className="text-sm text-brand-800">{state.notice}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-2 text-xs font-medium text-brand-700 underline">
          صفحہ تازہ کریں
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="farm_lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="farm_lng" value={coords?.lng ?? ""} />
      <input type="hidden" name="farm_accuracy" value={coords?.acc ?? ""} />
      <input type="hidden" name="farm_manual" value="no" />

      <div>
        <label className="block text-xs font-medium text-surface-600">کھیت کا نام *</label>
        <input name="farm_name" required placeholder="مثلاً مہابلی" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-surface-600">کتنے ایکڑ *</label>
          <input type="number" step="0.1" min="0.1" name="farm_acres" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-600">گاؤں</label>
          <input name="farm_village" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-surface-600">مقام</label>
        <CaptureButton
          locating={locating}
          haveCoords={coords !== null}
          onClick={() => {
            if (!navigator.geolocation) {
              setErr("اس ڈیوائس پر لوکیشن دستیاب نہیں ہے۔");
              return;
            }
            setLocating(true);
            setErr(null);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy ?? null });
                setLocating(false);
              },
              () => {
                setErr("مقام حاصل نہیں ہو سکا۔");
                setLocating(false);
              },
              { enableHighAccuracy: true, timeout: 15000 }
            );
          }}
        />
        {coords && (
          <p className="mt-1 text-xs text-surface-500">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            {coords.acc !== null && ` · تقریباً ${Math.round(coords.acc)} میٹر`}
          </p>
        )}
        <p className="mt-1 text-xs text-surface-400">کھیت پر کھڑے ہو کر لیں تو زیادہ درست ہوتا ہے۔ بعد میں درست بھی کر سکتے ہیں۔</p>
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </div>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}

      <div className="flex gap-2">
        <Submit label="کھیت محفوظ کریں" />
        <button type="button" onClick={onDone} className="rounded-lg border border-surface-200 px-3 text-xs text-surface-500">
          رہنے دیں
        </button>
      </div>
    </form>
  );
}

function CaptureButton({ locating, haveCoords, onClick }: { locating: boolean; haveCoords: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locating}
      className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
    >
      {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
      {locating ? "مقام حاصل کیا جا رہا ہے..." : haveCoords ? "دوبارہ لیں" : "میرا موجودہ مقام لیں"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Nayi darkhwast                                                      */
/* ------------------------------------------------------------------ */

function NewRequest({ token, farms, onNeedFarm }: { token: string; farms: PortalFarm[]; onNeedFarm: () => void }) {
  const [state, action] = useFormState(submitPublicMachineryRequest, initialState);
  const [machineType, setMachineType] = useState("harvester");
  const [picked, setPicked] = useState<string[]>(farms.length === 1 ? [farms[0].id] : []);
  const [willSell, setWillSell] = useState<"" | "yes" | "no">("");
  const [wantsReminder, setWantsReminder] = useState<"" | "yes" | "no">("");
  const [advance, setAdvance] = useState(false);

  if (state.success) {
    return (
      <div className="rounded-card border border-green-200 bg-white p-6 text-center shadow-card">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
        <p className="mt-3 font-display text-base font-semibold text-surface-900">{state.notice}</p>
        <p className="mt-1 text-sm text-surface-500">الرانا ٹریڈرز جلد آپ سے رابطہ کرے گا اور ریٹ بتا دے گا۔</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-3 text-xs font-medium text-brand-700 underline">
          صفحہ تازہ کریں
        </button>
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <div className="rounded-card border border-amber-200 bg-amber-50 p-5 text-center">
        <p className="text-sm text-amber-900">پہلے اپنا کھیت شامل کریں — پھر ہر بار صرف منتخب کرنا ہو گا۔</p>
        <button type="button" onClick={onNeedFarm} className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
          کھیت شامل کریں
        </button>
      </div>
    );
  }

  const chosenAcres = farms.filter((f) => picked.includes(f.id)).reduce((s, f) => s + f.areaAcres, 0);

  return (
    <form action={action} className="space-y-3 rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="will_sell_to_us" value={willSell} />
      <input type="hidden" name="wants_next_season_reminder" value={wantsReminder} />
      {picked.map((id) => (
        <input key={id} type="hidden" name="farm_ids" value={id} />
      ))}

      {/* Khet chunte hi raqba aur jagah khud aa jate hain -- wo kisan
          se dobara poochhna wo cheez likhwana hai jo pehle se likhi
          hui hai, aur wahin se ghalat adad aate hain. */}
      <div>
        <label className="block text-xs font-medium text-surface-600">کن کھیتوں کی کٹائی کروانی ہے؟ *</label>
        <div className="mt-2 space-y-2">
          {farms.map((f) => {
            const on = picked.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setPicked(on ? picked.filter((x) => x !== f.id) : [...picked, f.id])}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-right ${
                  on ? "border-brand-500 bg-brand-50" : "border-surface-200"
                }`}
              >
                <span>
                  <span className="block text-sm font-medium text-surface-800">{f.name}</span>
                  <span className="block text-xs text-surface-500">
                    {f.areaAcres} ایکڑ
                    {f.lat === null ? " · مقام نہیں" : ""}
                  </span>
                </span>
                {on && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
              </button>
            );
          })}
        </div>
        {picked.length > 1 && (
          <p className="mt-2 rounded-lg bg-surface-100 px-3 py-2 text-xs text-surface-600">
            {picked.length} کھیت · کل {chosenAcres} ایکڑ — ہر کھیت کی الگ بکنگ بنے گی، کیونکہ مشین ایک جگہ جاتی ہے اور بل ایک رقبے کا بنتا ہے۔
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-surface-600">کونسی مشین چاہیے؟ *</label>
        <select
          name="machine_type"
          value={machineType}
          onChange={(e) => setMachineType(e.target.value)}
          className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
        >
          <option value="harvester">ہارویسٹر</option>
          <option value="rotavator">روٹاویٹر</option>
          <option value="thresher">تھریشر</option>
          <option value="tractor">ٹریکٹر</option>
          <option value="kubota">کبوٹا (Kubota)</option>
          <option value="other">دیگر</option>
        </select>
      </div>

      {machineType === "other" && (
        <div>
          <label className="block text-xs font-medium text-surface-600">کونسی مشین؟ *</label>
          <input name="machine_type_other" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" placeholder="مثلاً لیزر لیولر" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-surface-600">فصل</label>
          <select name="crop_type" defaultValue="wheat" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            {CROP_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-600">کب چاہیے؟ *</label>
          <input
            type="date"
            name="expected_date"
            min={new Date().toISOString().split("T")[0]}
            required
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
        </div>
      </div>

      {/* Advance ka DAWA -- hisaab nahi.
          Kisan ka keh dena bill kam nahi karta: hamara banda dekhta
          hai, tab wo raqam ginti mein aati hai. Warna "20,000 diye"
          keh dene se bill kam ho jaya karega. */}
      <div className="rounded-lg border border-surface-200 p-3">
        <label className="flex items-center justify-between text-sm font-medium text-surface-700">
          <span>کیا ایڈوانس دے چکے ہیں؟</span>
          <input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} className="h-4 w-4" />
        </label>
        {advance && (
          <div className="mt-2 space-y-2">
            <input
              type="number"
              name="advance_amount"
              step="0.01"
              placeholder="کتنا؟ مثلاً 20000"
              className="w-full rounded-lg border border-surface-200 p-2 text-sm"
            />
            <select name="advance_method" defaultValue="cash" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="cash">نقد</option>
              <option value="bank">بینک</option>
              <option value="wallet">ایزی پیسہ / جاز کیش</option>
            </select>
            <input
              name="advance_reference"
              placeholder="ٹرانزیکشن نمبر (اگر ہو)"
              className="w-full rounded-lg border border-surface-200 p-2 text-sm"
            />
            <p className="text-xs text-surface-500">
              یہ رقم ہمارے عملے کی تصدیق کے بعد آپ کے بل میں کم ہو گی۔
            </p>
          </div>
        )}
      </div>

      <YesNo label="کیا آپ ہمیں فصل بیچیں گے؟ *" value={willSell} onChange={setWillSell} />
      <YesNo label="کیا اگلی فصل کے لیے یاد دہانی چاہیے؟ *" value={wantsReminder} onChange={setWantsReminder} />

      <div>
        <label className="block text-xs font-medium text-surface-600">مزید کچھ (اختیاری)</label>
        <textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </div>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}

      <Submit
        label="بکنگ کی درخواست بھیجیں"
        disabled={willSell === "" || wantsReminder === "" || picked.length === 0}
      />
    </form>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "" | "yes" | "no";
  onChange: (v: "yes" | "no") => void;
}) {
  return (
    <div className={`rounded-lg border-2 p-3 ${value === "" ? "border-red-300 bg-red-50" : "border-surface-200"}`}>
      <label className="block text-sm font-medium text-surface-700">{label}</label>
      <div className="mt-2 flex gap-2">
        {(["yes", "no"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
              value === v ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"
            }`}
          >
            {v === "yes" ? "ہاں" : "نہیں"}
          </button>
        ))}
      </div>
    </div>
  );
}

function Submit({ label, disabled, small }: { label: string; disabled?: boolean; small?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`flex items-center justify-center gap-2 rounded-lg bg-brand-600 font-medium text-white hover:bg-brand-700 disabled:opacity-60 ${
        small ? "px-3 py-1.5 text-xs" : "w-full px-4 py-2.5 text-sm"
      }`}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? "بھیجا جا رہا ہے..." : label}
    </button>
  );
}
