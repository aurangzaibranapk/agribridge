"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  searchFarmers,
  quickRegisterFarmer,
  recordWalkIn,
  type FarmerMatch,
  type WalkInState,
} from "@/actions/milk-walkin";
import { shrinkImage } from "@/lib/image-capture";
import { Search, UserPlus, Camera, Check, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initial: WalkInState = {};

/**
 * Chiller par khare kisan ki entry.
 *
 * Tarteeb wahi rakhi gayi hai jo asal mein hoti hai: pehle kisan
 * pehchana jata hai, phir doodh naapa jata hai, phir LR aur FAT test
 * hote hain. Form ka sawal us se pehle nahi aata jab tak us ka jawab
 * maidan mein maujood na ho.
 */
export function WalkInClient({ chiller }: { chiller: string }) {
  const lang = useLang();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<FarmerMatch[] | null>(null);
  const [chosen, setChosen] = useState<FarmerMatch | null>(null);
  const [searching, startSearch] = useTransition();
  const [showNew, setShowNew] = useState(false);

  const [photo, setPhoto] = useState<{ base64: string; mimeType: string; bytes: number } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [state, action] = useFormState(recordWalkIn, initial);

  function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    startSearch(async () => {
      setMatches(await searchFarmers(q));
    });
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhoto(await shrinkImage(file));
    } finally {
      setPhotoBusy(false);
    }
  }

  // Parchi ban gayi -- yahi wo lamha hai jab kisan ko sab kuch dikhna
  // chahiye, us se pehle nahi.
  if (state.success && state.receipt) {
    const r = state.receipt;
    return (
      <div className="space-y-3">
        <div className="rounded-card border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            {t("mk_walkin_saved", lang)}
          </p>
        </div>

        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h3 className="mb-3 text-center text-sm font-semibold text-surface-900 dark:text-white">
            {t("mk_receipt", lang)}
          </h3>
          <dl className="space-y-1.5 text-sm">
            {[
              [t("mk_farmer", lang), r.farmerLabel],
              [t("mk_collection", lang), t("mk_self_delivery", lang)],
              [t("mk_milk", lang), `${r.liters} L`],
              ["LR", String(r.lr)],
              ["FAT", `${r.fat}%`],
              ["TS", String(r.ts)],
              [t("mk_rate", lang), `Rs ${r.ratePerLiter}/L`],
              [t("mk_chiller", lang), r.chiller],
              [t("mk_collection_id", lang), r.collectionNumber],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-surface-500">{label}</dt>
                <dd className="font-medium text-surface-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex justify-between border-t border-surface-200 pt-3 dark:border-surface-800">
            <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">{t("mk_amount", lang)}</span>
            <span className="text-xl font-bold text-brand-700 dark:text-brand-400">
              Rs {r.amount.toLocaleString()}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full rounded-lg bg-brand-600 py-3 text-base font-semibold text-white"
        >
          {t("mk_next_farmer", lang)}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---- 1. Kisan pehchanein ---- */}
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("mk_step1_who", lang)}</h3>

        {chosen ? (
          <div className="rounded-lg border border-brand-300 bg-brand-50 p-3 dark:bg-brand-950/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">
                  {chosen.farmer_code} — {chosen.full_name}
                </p>
                <p className="text-xs text-surface-600 dark:text-surface-400">
                  {chosen.village ?? t("mk_village_not_recorded", lang)}
                  {chosen.phone_number && ` • ${chosen.phone_number}`}
                </p>
                <p className={`text-xs ${chosen.is_active ? "text-green-700" : "text-red-700"}`}>
                  {chosen.is_active ? t("mk_active", lang) : t("mk_closed", lang)}
                </p>
              </div>
              <button type="button" onClick={() => setChosen(null)} className="text-xs text-brand-700 underline">
                {t("mk_change", lang)}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-surface-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
                  placeholder={t("mk_search_placeholder", lang)}
                  className="w-full rounded-lg border border-surface-200 p-2 pl-9 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={runSearch}
                disabled={searching}
                className="rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {searching ? "..." : t("mk_search", lang)}
              </button>
            </div>

            {matches !== null && (
              <ul className="mt-2 divide-y divide-surface-100 rounded-lg border border-surface-200 dark:divide-surface-800 dark:border-surface-800">
                {matches.length === 0 && (
                  <li className="px-3 py-3 text-xs text-surface-500">
                    {t("mk_none_found_register", lang)}
                  </li>
                )}
                {matches.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setChosen(f)}
                      className="w-full px-3 py-2 text-left hover:bg-surface-50 dark:hover:bg-surface-800"
                    >
                      <p className="text-sm font-medium text-surface-900 dark:text-white">
                        {f.farmer_code} — {f.full_name}
                      </p>
                      <p className="text-xs text-surface-500">
                        {f.village ?? "—"}
                        {f.phone_number && ` • ${f.phone_number}`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-2 text-xs text-surface-500">
              {t("mk_same_name_note", lang)}
            </p>

            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-700"
            >
              <UserPlus className="h-4 w-4" /> {t("mk_register_new", lang)}
            </button>

            {showNew && <QuickRegister onDone={(f) => { setChosen(f); setShowNew(false); }} />}
          </>
        )}
      </div>

      {/* ---- 2. Naap ---- */}
      {chosen && (
        <form action={action} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("mk_step2_measure", lang)}</h3>

          {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

          <input type="hidden" name="farmer_id" value={chosen.id} />
          <input type="hidden" name="lr_image_base64" value={photo?.base64 ?? ""} />
          <input type="hidden" name="lr_image_mime" value={photo?.mimeType ?? ""} />

          <div className="grid grid-cols-3 gap-3">
            {[
              { name: "liters", label: t("mk_milk_l_req", lang), step: "0.1" },
              { name: "lr", label: t("mk_lr_req", lang), step: "0.1" },
              { name: "fat_percentage", label: t("mk_fat_req", lang), step: "0.1" },
            ].map((f) => (
              <div key={f.name}>
                <label className="text-xs font-medium text-surface-600">{f.label}</label>
                <input
                  name={f.name}
                  type="number"
                  inputMode="decimal"
                  step={f.step}
                  min={0}
                  className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-lg font-semibold"
                />
              </div>
            ))}
          </div>

          <div className="mt-3">
            <label className="text-xs font-medium text-surface-600">{t("mk_shift", lang)}</label>
            <select name="shift" defaultValue={new Date().getHours() < 14 ? "morning" : "evening"} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="morning">{t("mk_morning", lang)}</option>
              <option value="evening">{t("mk_evening", lang)}</option>
            </select>
          </div>

          <div className="mt-3">
            <label className="flex items-center gap-1 text-xs font-medium text-surface-600">
              <Camera className="h-3 w-3" /> {t("mk_lr_photo", lang)}
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onPhoto(e.target.files?.[0])}
              className="mt-1 w-full rounded-lg border border-surface-200 p-1.5 text-xs"
            />
            {photoBusy && <p className="mt-1 text-xs text-surface-500">{t("mk_photo_preparing", lang)}</p>}
            {photo && <p className="mt-1 text-xs text-green-700">{t("mk_photo_ready", lang)} ({Math.round(photo.bytes / 1024)} KB)</p>}
          </div>

          <p className="mt-3 rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800/50 dark:text-surface-400">
            {t("mk_receiver_note_1", lang)} <span className="font-medium">{t("mk_receiver_you", lang)}</span> • {t("mk_chiller", lang)}:{" "}
            <span className="font-medium">{chiller}</span> {t("mk_receiver_note_2", lang)}
          </p>

          <SubmitButton />
        </form>
      )}
    </div>
  );
}

function SubmitButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-base font-semibold text-white disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {pending ? t("mk_saving", lang) : t("mk_save_and_receipt", lang)}
    </button>
  );
}

function QuickRegister({ onDone }: { onDone: (farmer: FarmerMatch) => void }) {
  const lang = useLang();
  const [state, action] = useFormState(quickRegisterFarmer, {} as { error?: string; farmerId?: string; farmerCode?: string });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");

  // onDone effect mein bulaya jata hai, render ke beech mein nahi:
  // render ke dauran walid component ki halat badalna React ko chakkar
  // mein daal deta hai.
  const handed = useRef(false);
  useEffect(() => {
    if (handed.current || !state.farmerId || !state.farmerCode) return;
    handed.current = true;
    onDone({
      id: state.farmerId,
      farmer_code: state.farmerCode,
      full_name: name,
      village: village || null,
      phone_number: phone,
      is_active: true,
    });
  }, [state.farmerId, state.farmerCode, name, village, phone, onDone]);

  return (
    <form action={action} className="mt-3 space-y-2 rounded-lg border border-surface-200 p-3 dark:border-surface-800">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <input
        name="full_name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("mk_full_name_req", lang)}
        className="w-full rounded-lg border border-surface-200 p-2 text-sm"
      />
      <input
        name="phone_number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        placeholder={t("mk_mobile_req", lang)}
        className="w-full rounded-lg border border-surface-200 p-2 text-sm"
      />
      <input
        name="village"
        value={village}
        onChange={(e) => setVillage(e.target.value)}
        placeholder={t("mk_village", lang)}
        className="w-full rounded-lg border border-surface-200 p-2 text-sm"
      />
      <RegisterButton />
      <p className="text-xs text-surface-500">
        {t("mk_quick_register_note", lang)}
      </p>
    </form>
  );
}

function RegisterButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-brand-600 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50"
    >
      {pending ? t("mk_creating", lang) : t("mk_make_farmer_id", lang)}
    </button>
  );
}
