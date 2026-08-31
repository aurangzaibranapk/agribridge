"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { t, type Lang } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createBooking,
  quickRegisterFarmer,
  saveBookingDraft,
  discardBookingDraft,
  type ActionState,
} from "@/actions/machinery-lifecycle";
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { PaymentSlipUpload } from "@/components/ui/payment-slip-upload";
import { MapPin, Loader2, UserPlus, X } from "lucide-react";
import { addCrop } from "@/actions/crops";
import { pickDefaultRate, type RateCard } from "@/lib/machinery/rate-card";

const initialState: ActionState = {};

interface Farmer {
  id: string;
  full_name: string;
  farmer_code: string;
  phone_number: string;
  cnic: string;
  district: string;
  village: string;
  previous_bookings: number;
  outstanding: number;
}
interface Account {
  id: string;
  name: string;
  account_type: string;
}

/**
 * Adhoore kaghaz ki shakl.
 *
 * Do hisse jaan boojh kar alag hain: `fields` wo khane hain jo form
 * khud sambhalta hai (unhein wapas likh dena kaafi hai), aur `ui` wo
 * jawab hain jo React ki yaad mein rehte hain -- unhein wapas rakhna
 * parta hai warna khana bhara hua dikhta hai magar system ke liye
 * khali hota hai.
 */
interface DraftPayload {
  fields?: Record<string, string>;
  ui?: {
    code?: string;
    farmerId?: string;
    advance?: boolean;
    advanceMethod?: string;
    advanceEvidence?: string;
    fieldReady?: string;
    harvestReady?: string;
    willSell?: string;
    coords?: { lat: number; lng: number } | null;
  };
  savedAt?: string;
}

/**
 * Staff ka booking form.
 *
 * Sections mein is liye hai ke ye form khet par, mobile par bhara jata
 * hai -- ek lambi fehrist mein staff aadha bhar kar chhoR deta hai.
 *
 * Rate ka koi khana yahan NAHI hai. Pehle "andaza" ka ek khana tha, aur
 * wo aksar bill ka rate samajh liya jata tha. Asal rate kattai se pehle
 * kisan se confirm hota hai aur bill sirf usi se banta hai -- is liye
 * booking ke waqt koi number likhwana sirf ghalat fehmi paida karta hai.
 *
 * Machine bhi yahan nahi chuni jati: wo rawangi ke waqt chunti hai, jab
 * ye maloom ho ke us din kaun si machine khali hai.
 */
export function NewBookingForm({
  farmers,
  accounts,
  crops,
  rateCards,
  capacity,
  staffName,
  defaultFarmerId,
  defaultRequestId,
  defaultAcres,
  defaultLocation,
  defaultDate,
  draft,
}: {
  farmers: Farmer[];
  accounts: Account[];
  /** Fasl ki fehrist database se (174). */
  crops: { key: string; label: string }[];
  /** Default rate ki fehrist (177) -- sirf khana bharne ke liye. */
  rateCards: RateCard[];
  /** Agle 30 din ki gunjaish (180) -- planner wale view se. */
  capacity: { date: string; capacity: number; booked: number; free: number }[];
  staffName?: string | null;
  defaultFarmerId?: string;
  defaultRequestId?: string;
  defaultAcres?: string;
  defaultLocation?: string;
  /** Planner se aayi hui tareekh (180) -- wahan se seedha yahan. */
  defaultDate?: string;
  draft?: DraftPayload | null;
}) {
  const lang = useLang();
  const router = useRouter();
  const [state, formAction] = useFormState(createBooking, initialState);
  const [code, setCode] = useState(
    () => farmers.find((f) => f.id === defaultFarmerId)?.farmer_code ?? ""
  );
  const [farmerId, setFarmerId] = useState(defaultFarmerId ?? "");
  const [advance, setAdvance] = useState(false);
  const [advanceMethod, setAdvanceMethod] = useState("cash");
  const [advanceEvidence, setAdvanceEvidence] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // Naya kisan yahin ban jata hai. Ye alag <form> nahi ho sakta (HTML
  // form ke andar form nahi chalta), is liye action seedha bulaya jata
  // hai.
  const [addedFarmers, setAddedFarmers] = useState<Farmer[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickDistrict, setQuickDistrict] = useState("");
  const [quickMsg, setQuickMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  // Dono sawalon ka teesra jawab "pata nahi" hai, aur wo jaan boojh kar
  // hai. Booking aksar hafta pehle hoti hai; us waqt "pata nahi" hi sach
  // hota hai. Usay majboori se "haan" likhwana jhoot ko record bana deta
  // hai -- aur record par bharosa khatam ho jata hai.
  const [fieldReady, setFieldReady] = useState("");
  const [harvestReady, setHarvestReady] = useState("");
  const [willSell, setWillSell] = useState("");
  const [quickPending, startQuick] = useTransition();

  const allFarmers = useMemo(() => [...addedFarmers, ...farmers], [addedFarmers, farmers]);

  function quickRegister() {
    setQuickMsg(null);
    startQuick(async () => {
      const fd = new FormData();
      fd.set("full_name", quickName);
      fd.set("phone_number", quickPhone);
      fd.set("district", quickDistrict);
      const res = await quickRegisterFarmer({}, fd);
      if (res.error || !res.farmerId) {
        setQuickMsg({ tone: "bad", text: res.error ?? "Kisan nahi bana." });
        return;
      }
      const fresh: Farmer = {
        id: res.farmerId,
        full_name: res.farmerName ?? quickName,
        farmer_code: res.farmerCode ?? "",
        phone_number: quickPhone,
        // Naye kisan ka CNIC yahan nahi liya jata -- wo Farmers ke safhe
        // par bharta hai. Khali chhoRna sach hai; jhoota adad daalna nahi.
        cnic: "",
        district: quickDistrict,
        village: "",
        previous_bookings: 0,
        outstanding: 0,
      };
      setAddedFarmers((prev) => [fresh, ...prev.filter((f) => f.id !== fresh.id)]);
      setFarmerId(fresh.id);
      setCode(fresh.farmer_code);
      setQuickOpen(false);
      setQuickMsg({ tone: "ok", text: res.notice ?? `${fresh.farmer_code} — ${fresh.full_name} ban gaya aur chun liya gaya.` });
    });
  }

  const farmer = useMemo(() => allFarmers.find((f) => f.id === farmerId) ?? null, [allFarmers, farmerId]);

  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // --- Adhoora kaghaz ---
  //
  // Ye form khet par, mobile par bhara jata hai. Battery khatam ho
  // jaye ya koi phone aa jaye aur browser band ho jaye -- pehle sab
  // kuch chala jata tha.
  //
  // Wo sirf waqt ka nuqsan nahi tha. Jise dobara bharna pare wo aksar
  // dobara bharta hi nahi: wo kaghaz par likh leta hai aur "baad mein
  // daal doonga" kehta hai, aur wo baad kabhi nahi aata. Jo booking
  // system mein nahi aayi, us ka bill bhi kabhi nahi banta.
  const [draftOffer, setDraftOffer] = useState<DraftPayload | null>(draft ?? null);
  const [restore, setRestore] = useState<Record<string, string> | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  /** Is waqt form mein jo kuch hai, wo. */
  function snapshot(): DraftPayload | null {
    const form = formRef.current;
    if (!form) return null;
    const fields: Record<string, string> = {};
    new FormData(form).forEach((v, k) => {
      if (typeof v === "string") fields[k] = v;
    });
    return {
      fields,
      ui: { code, farmerId, advance, advanceMethod, advanceEvidence, fieldReady, harvestReady, willSell, coords },
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Likhte hi nahi -- rukte hi.
   *
   * Har harf par server ko bhejna phone ka data aur battery dono kha
   * jata hai, aur khet ka signal waise bhi kamzor hota hai. Do second
   * ki khamoshi ka intezar kaafi hai: jo cheez do second se nahi
   * badli, wo shayad likhi ja chuki hai.
   */
  useEffect(() => {
    if (state.success || draftOffer) return;
    const form = formRef.current;
    if (!form) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const snap = snapshot();
        if (!snap) return;
        // Bilkul khali form mehfooz karne ki koi wajah nahi -- warna
        // safha kholte hi ek khali draft ban jata hai aur agli dafa
        // "adhoori booking mili" ka jhoota paigham aata hai.
        const kuchHai =
          Boolean(snap.ui?.farmerId) ||
          Object.entries(snap.fields ?? {}).some(
            ([k, v]) => v.trim() !== "" && k !== "request_id" && k !== "advance_received" && k !== "crop_type"
          );
        if (!kuchHai) return;
        void saveBookingDraft(snap);
        setDraftSavedAt(snap.savedAt ?? null);
      }, 2000);
    };

    form.addEventListener("input", bump);
    form.addEventListener("change", bump);
    return () => {
      if (timer) clearTimeout(timer);
      form.removeEventListener("input", bump);
      form.removeEventListener("change", bump);
    };
  }, [state.success, draftOffer, code, farmerId, advance, advanceMethod, advanceEvidence, fieldReady, harvestReady, willSell, coords]);

  /**
   * Wapas likhna.
   *
   * UI wale jawab pehle rakhe ja chuke hote hain (React ne dobara
   * banaya hota hai), aur phir wo khane bhare jate hain jo form khud
   * sambhalta hai. Tarteeb ulti ho to React apni dobara banayi hui
   * shakl in ki likhi hui qeemat mita deta hai.
   */
  useEffect(() => {
    if (!restore) return;
    const form = formRef.current;
    if (!form) return;
    for (const [name, value] of Object.entries(restore)) {
      const el = form.elements.namedItem(name);
      if (!el) continue;
      const target = el instanceof RadioNodeList ? el.item(0) : el;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        if (target instanceof HTMLInputElement && (target.type === "radio" || target.type === "checkbox")) continue;
        if (target.type === "hidden") continue;
        target.value = value;
      }
    }
    setRestore(null);
  }, [restore]);

  function resumeDraft() {
    const d = draftOffer;
    if (!d) return;
    const u = d.ui ?? {};
    setCode(u.code ?? "");
    setFarmerId(u.farmerId ?? "");
    setAdvance(Boolean(u.advance));
    setAdvanceMethod(u.advanceMethod ?? "cash");
    setAdvanceEvidence(u.advanceEvidence ?? "");
    setFieldReady(u.fieldReady ?? "");
    setHarvestReady(u.harvestReady ?? "");
    setWillSell(u.willSell ?? "");
    setCoords(u.coords ?? null);
    setDraftOffer(null);
    setRestore(d.fields ?? {});
  }

  function dropDraft() {
    setDraftOffer(null);
    void discardBookingDraft();
  }

  /**
   * Bharne se pehle jaanch -- yahin, safha bheje baghair.
   *
   * Do usool:
   *   1. Button kabhi band nahi hota. Band button ye nahi batata ke kya
   *      kam hai; banda usay dabata rehta hai aur samajhta hai app kharab
   *      hai.
   *   2. Jo cheez kam ho, us tak khud le jaya jata hai aur surkh kar diya
   *      jata hai. Upar likha hua paigham us waqt kaam nahi aata jab khana
   *      teen safhe neeche ho.
   *
   * Sirf WAJIBI cheezein rokti hain. Baqi sab khali chhoRa ja sakta hai.
   */
  function findMissing(): Record<string, string> {
    const form = formRef.current;
    if (!form) return {};
    const fd = new FormData(form);
    const nextErrors: Record<string, string> = {};
    const numberOf = (key: string) => Number(fd.get(key) ?? 0) || 0;

    if (!farmerId) nextErrors.farmer = "Kisan chunein — ya yahin naya bana lein.";
    if (numberOf("harvest_area_acres") + numberOf("harvest_area_kanal") / 8 <= 0) {
      nextErrors.harvest_area = "Kattai ka raqba likhein (acre ya kanal).";
    }
    if (!String(fd.get("machine_type_requested") ?? "").trim()) {
      nextErrors.machine_type_requested = "Machine ki qism likhein.";
    }

    if (advance) {
      if (numberOf("advance_amount") <= 0) nextErrors.advance_amount = "Advance ki raqam likhein.";
      if (!String(fd.get("advance_account_id") ?? "").trim()) {
        nextErrors.advance_account_id = "Advance kis khate mein aaya, wo chunein.";
      }
    }

    return nextErrors;
  }

  function handleSubmit(e: React.MouseEvent<HTMLButtonElement>) {
    const missing = findMissing();
    setErrors(missing);
    const first = Object.keys(missing)[0];
    if (!first) return;

    e.preventDefault();
    const el = document.getElementById(`fld-${first}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLElement | null)?.focus?.();
  }

  // Kattai ka kul raqba -- qism ka batwara isi se parkha jata hai (176).
  const [harvestTotal, setHarvestTotal] = useState<number>(Number(defaultAcres ?? 0) || 0);

  // Fasal aur machine se default rate milta hai (177). Dono yahan
  // rakhe hain kyunke rate ka khana neeche hai aur ye upar -- warna
  // rate card ko pata hi na chalta ke kis fasal ka rate chahiye.
  const [cropKey, setCropKey] = useState<string>(crops[0]?.key ?? "other");
  const [machineTypeReq, setMachineTypeReq] = useState<string>("");

  // Kattai ki tareekh -- gunjaish isi par parkhi jati hai (180).
  const [preferredDate, setPreferredDate] = useState<string>(defaultDate ?? "");

  // Farmer ID likhte hi kisan saamne aa jata hai -- code, naam, phone ya
  // CNIC, chaaron se. Staff ko yaad sirf ek cheez hoti hai, aur wo har
  // baar wahi nahi hoti. Khet par aksar sirf shanakhti card hota hai.
  function lookup(value: string) {
    setCode(value);
    const needle = value.trim().toLowerCase();
    if (!needle) {
      setFarmerId("");
      return;
    }
    // CNIC dono tarah likha jata hai -- dashon ke sath aur baghair. Adad
    // hi asal cheez hai, is liye dono taraf se dash hata kar milate hain.
    const digits = needle.replace(/\D/g, "");
    const found = allFarmers.find(
      (f) =>
        f.farmer_code.toLowerCase() === needle ||
        f.phone_number.replace(/\D/g, "") === digits ||
        (digits.length >= 13 && (f.cnic ?? "").replace(/\D/g, "") === digits) ||
        f.full_name.toLowerCase().includes(needle)
    );
    setFarmerId(found?.id ?? "");
  }

  function captureLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (state.success && state.bookingNumber) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="text-sm text-surface-500">{t("mc_booking_made", lang)}</p>
        <p className="mt-1 font-display text-2xl font-bold text-brand-700 dark:text-brand-300">{state.bookingNumber}</p>
        <p className="mt-3 text-sm text-surface-600 dark:text-surface-300">{t("nb_all_under_id", lang)}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => router.push(`/admin/machinery-rental/booking/${state.bookingId}`)}>
            {t("mc_open_booking", lang)}
          </Button>
          <Button variant="secondary" onClick={() => router.refresh()}>
            {t("mc_one_more_booking", lang)}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4 pb-24">
      {defaultRequestId && (
        <p className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300">
          Kisan ki apni farmaish se booking bana rahe hain. Booking ban'ne par wo farmaish poori shudah ho jayegi.
        </p>
      )}
      <input type="hidden" name="request_id" value={defaultRequestId ?? ""} />

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {state.error}
        </p>
      )}

      {/* Adhoora kaghaz mila -- magar khud nahi khulta.
          Chup chaap bhar dena us bande ko dhoka de sakta hai jo waqai
          nayi booking banane aaya hai: wo purane kisan ke naam par
          nayi booking bana dega. Is liye pehle poochha jata hai. */}
      {draftOffer && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {t("mc_draft_found", lang)}
          </p>
          {draftOffer.savedAt && (
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
              {new Date(draftOffer.savedAt).toLocaleString()}
              {draftOffer.ui?.code ? ` · ${draftOffer.ui.code}` : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={resumeDraft}>
              {t("mc_draft_resume", lang)}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={dropDraft}>
              {t("mc_draft_discard", lang)}
            </Button>
          </div>
        </div>
      )}

      {/* Khamoshi se mehfooz hota rehta hai. Ye line sirf itna kehti
          hai ke phone band ho jaye to kuch nahi jayega -- taake banda
          bina fikar ke bharta rahe. */}
      {!draftOffer && draftSavedAt && (
        <p className="text-xs text-surface-400">{t("mc_draft_saved", lang)}</p>
      )}

      {/* 1 — Kisan */}
      <Card className="space-y-3">
        <SectionTitle n={1} title={t("mc_farmer", lang)} />
        <div>
          <Label>{t("mc_farmer_lookup", lang)}</Label>
          <Input
            id="fld-farmer"
            value={code}
            onChange={(e) => lookup(e.target.value)}
            placeholder={t("mc_eg_farmer_code", lang)}
            autoFocus
            className={errors.farmer ? "border-red-500 focus:ring-red-500" : undefined}
          />
          {errors.farmer && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.farmer}</p>}
        </div>
        <input type="hidden" name="farmer_id" value={farmerId} />

        {farmer ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-900/40 dark:bg-brand-950/20">
            <p className="font-medium text-surface-900 dark:text-surface-100">{farmer.full_name}</p>
            <p className="text-surface-600 dark:text-surface-300">{farmer.phone_number || "Mobile darj nahi"}</p>
            {farmer.district && <p className="text-surface-600 dark:text-surface-300">{farmer.district}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="gray">Pichli bookings: {farmer.previous_bookings}</Badge>
              <Badge tone={farmer.outstanding > 0 ? "red" : "green"}>
                Machinery ka baqi: Rs {farmer.outstanding.toLocaleString()}
              </Badge>
            </div>
          </div>
        ) : (
          // Button hamesha nazar aata hai, sirf "kisan nahi mila" ke
          // baad nahi. Nayi booking par khana khali hota hai -- us waqt
          // button chhupa dena ka matlab tha ke staff pehle kuch likhe,
          // phir us ke na milne ka intezar kare, tab jaa kar us ko
          // naya kisan banane ka raasta dikhe.
          !quickOpen && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-surface-500">
              <span>{code.trim() === "" ? "Kisan pehle se darj nahi?" : "Ye kisan nahi mila."}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuickName("");
                  setQuickPhone(/^[0-9+\-\s]+$/.test(code.trim()) ? code.trim() : "");
                  setQuickDistrict("");
                  setQuickOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4" /> {t("mc_new_farmer_here", lang)}
              </Button>
            </div>
          )
        )}

        {quickMsg && (
          <p
            className={
              "text-sm " +
              (quickMsg.tone === "ok"
                ? "text-brand-700 dark:text-brand-300"
                : "text-red-600 dark:text-red-400")
            }
          >
            {quickMsg.text}
          </p>
        )}

        {quickOpen && (
          <div className="space-y-3 rounded-lg border border-brand-200 p-3 dark:border-brand-900/40">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{t("mc_new_farmer", lang)}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setQuickOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Label>{t("mc_name_req", lang)}</Label>
              <Input value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder={t("mc_eg_name", lang)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("mc_mobile_req", lang)}</Label>
                <Input value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} placeholder={t("mc_eg_phone", lang)} />
              </div>
              <div>
                <Label>{t("mc_district", lang)}</Label>
                <Input value={quickDistrict} onChange={(e) => setQuickDistrict(e.target.value)} placeholder={t("mc_eg_district", lang)} />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={quickRegister}
              disabled={quickPending || !quickName.trim() || quickPhone.replace(/\D/g, "").length < 10}
            >
              {quickPending ? "Ban raha hai..." : "Banayein aur chunein"}
            </Button>
            <p className="text-xs text-surface-500">
              Sirf itna hi kaafi hai. Baqi tafseel (walid ka naam, CNIC, gaon, zameen, bank, kaghazat) kisan apni
              profile se ek hi baar bharta hai, aur phir har service wohi parhti hai. Mobile zaroori hai — wohi kisan
              ki pehchan hai; pehle se kisi ka hua to naya nahi banega, wohi purana chun liya jayega.
            </p>
          </div>
        )}
      </Card>

      {/* 2 — Kaam */}
      <Card className="space-y-3">
        <SectionTitle n={2} title={t("mc_work", lang)} />

        <div>
          <Label>{t("mc_machine_type_req", lang)}</Label>
          <Input
            id="fld-machine_type_requested"
            name="machine_type_requested"
            placeholder={t("mc_eg_machine", lang)}
            value={machineTypeReq}
            onChange={(e) => setMachineTypeReq(e.target.value)}
            className={errors.machine_type_requested ? "border-red-500 focus:ring-red-500" : undefined}
          />
          {errors.machine_type_requested && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.machine_type_requested}</p>
          )}
          <p className="mt-1 text-xs text-surface-500">{t("nb_no_machine_yet", lang)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("mc_crop", lang)}</Label>
            <CropPicker crops={crops} lang={lang} onChange={setCropKey} />
          </div>
          <div>
            <Label>{t("mc_when_needed", lang)}</Label>
            <Input
              type="date"
              name="preferred_date"
              min={new Date().toISOString().slice(0, 10)}
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
            />
          </div>
        </div>

        <AreaPair
          label={t("mc_area_work", lang)}
          acresName="harvest_area_acres"
          kanalName="harvest_area_kanal"
          required
          defaultAcres={defaultAcres}
          fieldId="fld-harvest_area"
          error={errors.harvest_area}
          onTotal={setHarvestTotal}
        />

        <DayCapacity
          rows={capacity}
          date={preferredDate}
          acres={harvestTotal}
          lang={lang}
          onPick={setPreferredDate}
        />

        <HarvestTypePicker
          total={harvestTotal}
          lang={lang}
          rateCards={rateCards}
          crop={cropKey}
          machineType={machineTypeReq}
        />

        <div>
          <Label>{t("mc_field_address", lang)}</Label>
          <Input name="location_address" defaultValue={defaultLocation ?? ""} placeholder={t("mc_field_address_hint", lang)} />
          <input type="hidden" name="village" value="" />
          <input type="hidden" name="location_lat" value={coords?.lat ?? ""} />
          <input type="hidden" name="location_lng" value={coords?.lng ?? ""} />
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={captureLocation} disabled={locating}>
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {coords ? "Dobara lein" : "Location capture karein"}
            </Button>
            {coords && (
              <span className="text-xs text-green-700 dark:text-green-400">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
            )}
          </div>
        </div>

        <YesNo
          label={t("mc_field_ready", lang)}
          name="field_ready"
          value={fieldReady}
          onChange={setFieldReady}
          hint="Paani khara ho ya pichli fasal ka rehna baqi ho to machine wapas aa jati hai."
        />
        <YesNo
          label={t("mc_harvest_ready", lang)}
          name="harvest_ready"
          value={harvestReady}
          onChange={setHarvestReady}
          hint="Kachi fasal par harvester bhejna nuqsan hai."
        />
        {/* Ye sawal BOOKING ke waqt ka hai, kaam khatam hone ka nahi:
            fasal ki kharidari ki tayari isi din se shuru hoti hai. Agli
            fasal ki yaad dahani ka sawal us se ulta hai -- wo kaam
            mukammal hone par poochha jata hai. */}
        <YesNo
          label={t("mc_will_sell_full", lang)}
          name="will_sell_to_us"
          value={willSell}
          onChange={setWillSell}
          hint="Iska jawab Grain kharidari ki fehrist banata hai."
        />
      </Card>

      {/* 5 — Advance */}
      <Card className="space-y-3">
        <SectionTitle n={3} title={t("mc_advance", lang)} />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="advance_received"
              value="no"
              checked={!advance}
              onChange={() => setAdvance(false)}
            />
            {t("mc_no_advance", lang)}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="advance_received"
              value="yes"
              checked={advance}
              onChange={() => setAdvance(true)}
            />
            {t("mc_advance_taken", lang)}
          </label>
        </div>

        {advance && (
          <div className="space-y-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("mc_amount_req", lang)}</Label>
                <Input
                  id="fld-advance_amount"
                  type="number"
                  name="advance_amount"
                  step="0.01"
                  placeholder={t("mc_eg_amount", lang)}
                  className={errors.advance_amount ? "border-red-500 focus:ring-red-500" : undefined}
                />
                {errors.advance_amount && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.advance_amount}</p>
                )}
              </div>
              <div>
                <Label>{t("mc_method", lang)}</Label>
                <Select name="advance_method" value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value)}>
                  <option value="cash">{t("mc_cash", lang)}</option>
                  <option value="bank">{t("mc_bank", lang)}</option>
                  <option value="wallet">{t("mc_wallet", lang)}</option>
                  <option value="other">{t("mc_other", lang)}</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("mc_which_account_in", lang)}</Label>
              <Select
                id="fld-advance_account_id"
                name="advance_account_id"
                defaultValue=""
                className={errors.advance_account_id ? "border-red-500 focus:ring-red-500" : undefined}
              >
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.account_type})
                  </option>
                ))}
              </Select>
              {errors.advance_account_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.advance_account_id}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("mc_date", lang)}</Label>
                <Input type="date" name="advance_date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <Label>{t("mc_reference_receipt", lang)}</Label>
                <Input name="advance_reference" />
              </div>
            </div>
            <div>
              <input type="hidden" name="advance_evidence_url" value={advanceEvidence} />
              <PaymentSlipUpload onUploaded={setAdvanceEvidence} />
            </div>
            {staffName && (
              <p className="rounded bg-surface-50 px-2 py-1 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                {/* Naam beech mein aata hai, is liye jumla do hisson mein
                    toRne ke bajaye poora jumla fehrist mein rakha gaya hai
                    aur naam us mein daala jata hai -- warna Urdu mein
                    lafzon ki tarteeb ulti hoti hai aur jumla toot jata. */}
                {t("mc_money_recorded_under", lang).split("{name}").map((part, i) => (
                  <span key={i}>
                    {part}
                    {i === 0 && <strong>{staffName}</strong>}
                  </span>
                ))}
              </p>
            )}
            <p className="text-xs text-surface-500">
              Advance aamdani nahi hai. Jab tak kaam na ho, ye paisa kisan ki amanat ke taur par darj hota hai — aur
              bill bante waqt poora ka poora us mein se kata jata hai.
            </p>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div>
          <Label>{t("mc_notes", lang)}</Label>
          <Textarea name="notes" rows={2} />
        </div>
        <SubmitButton onCheck={handleSubmit} />
      </Card>
    </form>
  );
}

/**
 * Haan / Nahi / Pata nahi -- teen baRe button.
 *
 * Dropdown se bacha gaya hai: counter par khara banda mobile par ek haath
 * se form bharta hai, aur dropdown kholna, scroll karna, phir chunna teen
 * kaam hain. Yahan ek chhoona kaafi hai.
 */
function YesNo({
  label,
  name,
  value,
  onChange,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const options = [
    { v: "yes", t: "Haan" },
    { v: "no", t: "Nahi" },
    { v: "unknown", t: "Pata nahi" },
  ];
  return (
    <div>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <div className="mt-1 flex gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(value === o.v ? "" : o.v)}
            className={
              "flex-1 rounded-lg border py-2 text-sm font-medium transition " +
              (value === o.v
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/30 dark:text-brand-300"
                : "border-surface-200 text-surface-500 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800")
            }
          >
            {o.t}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-surface-500">{hint}</p>}
    </div>
  );
}

/**
 * Fasl chunne ka khana -- fehrist database se (174).
 *
 * "+ Nayi fasal" yahin par hai. Pehle staff ko fasal ka naam "other"
 * mein daalna paRta tha, aur report mein wo sab ek dher ban jate the.
 *
 * Ye nested form nahi hai: booking ka form pehle se khula hua hai, aur
 * form ke andar form HTML mein chalta hi nahi. Is liye action seedha
 * bulaya jata hai.
 */
/**
 * Kattai ki qism aur us ka batwara (176).
 *
 * Ek khet mein dono kaam ho sakte hain: kuch acre ki parali sabit
 * chhoRni hai, kuch ka kutra karna hai -- aur dono ka rate alag hai.
 *
 * Jor ki jaanch yahan bhi hai aur database mein bhi. Dono jaan boojh
 * kar hain: yahan wali staff ko wahin bata deti hai ke 8 + 3 dus nahi
 * hote; database wali us soorat ke liye hai jab koi doosra raasta
 * (portal, purani screen) yahi ghalti le kar aaye.
 */
/**
 * Us din kitni jagah hai (180).
 *
 * Booking lete waqt sab se aam sawal yehi hai. Pehle us ka jawab tab
 * milta tha jab form bhar chuka hota aur database rok deta -- yani
 * kisan saamne khaRa hota aur staff ko phir se sab kuch badalna parta.
 *
 * Ye ROKTA nahi. Malik ka faisla hai ke rok na ho: manager kabhi doosri
 * machine ka bandobast kar leta hai. Ye sirf saamne rakh deta hai, aur
 * jin dinon mein jagah hai wo bhi dikha deta hai -- ek click par tareekh
 * badal jati hai.
 */
function DayCapacity({
  rows,
  date,
  acres,
  lang,
  onPick,
}: {
  rows: { date: string; capacity: number; booked: number; free: number }[];
  date: string;
  acres: number;
  lang: Lang;
  onPick: (d: string) => void;
}) {
  if (!date) return null;
  const day = rows.find((r) => r.date === date);
  // Chuni hui tareekh agle 30 din se bahar ho to planner ke paas us ka
  // jawab hai hi nahi -- khamoshi behtar hai, jhoota "jagah hai" nahi.
  if (!day) return null;

  const fits = acres <= 0 || acres <= day.free + 0.001;
  // Wo din jin mein maanga gaya raqba poora aa jata hai.
  const options = rows
    .filter((r) => r.date >= new Date().toISOString().slice(0, 10) && r.free >= acres && acres > 0)
    .slice(0, 4);

  return (
    <div
      className={`rounded-card border p-3 text-sm ${
        fits
          ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
          : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
      }`}
    >
      <p className={fits ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300"}>
        <strong>{date}</strong> — {day.booked} / {day.capacity} acre bandhe hain, <strong>{day.free} acre</strong>{" "}
        bachi hai.
      </p>

      {!fits && (
        <>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Aap {acres} acre maang rahe hain. Booking phir bhi ho sakti hai — magar us par manager ki ijazat aur wajah
            darj karni hogi.
          </p>
          {options.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-surface-700 dark:text-surface-300">{t("nb_free_days", lang)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <button
                    key={o.date}
                    type="button"
                    onClick={() => onPick(o.date)}
                    className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-brand-700 shadow-sm hover:bg-brand-50 dark:bg-surface-800 dark:text-brand-300"
                  >
                    {o.date} — {o.free} acre
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HarvestTypePicker({
  total,
  lang,
  rateCards,
  crop,
  machineType,
}: {
  total: number;
  lang: Lang;
  rateCards: RateCard[];
  crop: string;
  machineType: string;
}) {
  const [type, setType] = useState<"sabit" | "kutra" | "dono">("sabit");
  const [sabit, setSabit] = useState("");
  const [kutra, setKutra] = useState("");
  const [sabitRate, setSabitRate] = useState("");
  const [kutraRate, setKutraRate] = useState("");

  // Rate card se default (177). Ye sirf KHALI khana bharta hai. Jis
  // khane par staff ne hath rakh diya, us par ye dobara nahi chaRhta --
  // warna fasal badalte hi wo rate ur jata jo abhi likha gaya tha.
  const [sabitTouched, setSabitTouched] = useState(false);
  const [kutraTouched, setKutraTouched] = useState(false);
  const cardSabit = pickDefaultRate(rateCards, { crop, machineType, harvestType: "sabit" });
  const cardKutra = pickDefaultRate(rateCards, { crop, machineType, harvestType: "kutra" });

  useEffect(() => {
    if (!sabitTouched) setSabitRate(cardSabit ? String(cardSabit.rate) : "");
    if (!kutraTouched) setKutraRate(cardKutra ? String(cardKutra.rate) : "");
    // Fasal ya machine badle to default dobara dekha jata hai.
  }, [cardSabit?.id, cardKutra?.id, sabitTouched, kutraTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  const sabitNum = Number(sabit) || 0;
  const kutraNum = Number(kutra) || 0;
  const sum = Math.round((sabitNum + kutraNum) * 10000) / 10000;
  const matches = total > 0 && Math.round(sum * 10000) === Math.round(total * 10000);
  const estimate =
    Math.round((sabitNum * (Number(sabitRate) || 0) + kutraNum * (Number(kutraRate) || 0)) * 100) / 100;

  const OPTIONS: { key: "sabit" | "kutra" | "dono"; label: string }[] = [
    { key: "sabit", label: t("mh_sabit", lang) },
    { key: "kutra", label: t("mh_kutra", lang) },
    { key: "dono", label: t("mh_dono", lang) },
  ];

  return (
    <div>
      <Label>{t("mh_type_label", lang)}</Label>
      <input type="hidden" name="harvest_type" value={type} />
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setType(o.key)}
            className={
              o.key === type
                ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg bg-surface-100 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"
            }
          >
            {o.label}
          </button>
        ))}
      </div>

      {type === "dono" && (
        <div className="mt-3 space-y-3 rounded-card border border-surface-200 p-3 dark:border-surface-700">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("mh_sabit_acres", lang)}</Label>
              <Input
                type="number"
                name="sabit_area"
                step="0.01"
                value={sabit}
                onChange={(e) => setSabit(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>{t("mh_kutra_acres", lang)}</Label>
              <Input
                type="number"
                name="kutra_area"
                step="0.01"
                value={kutra}
                onChange={(e) => setKutra(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Jor foran saamne -- taake ghalti bhare hue form ke baad na khule. */}
          <p className={matches ? "text-xs text-green-700 dark:text-green-400" : "text-xs text-amber-700 dark:text-amber-400"}>
            {t("mh_total_check", lang)}: {sum} / {total} {t("md_acres_short", lang)} —{" "}
            {matches ? t("mh_sum_ok", lang) : t("mh_sum_bad", lang)}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("mh_sabit_rate", lang)}</Label>
              <Input
                type="number"
                name="sabit_rate"
                step="0.01"
                value={sabitRate}
                onChange={(e) => {
                  setSabitTouched(true);
                  setSabitRate(e.target.value);
                }}
                placeholder="0"
              />
              {cardSabit && !sabitTouched && (
                <p className="mt-1 text-xs text-surface-500">{t("mrc_from_card", lang)}</p>
              )}
              {sabitTouched && <p className="mt-1 text-xs text-brand-600">{t("mrc_changed", lang)}</p>}
            </div>
            <div>
              <Label>{t("mh_kutra_rate", lang)}</Label>
              <Input
                type="number"
                name="kutra_rate"
                step="0.01"
                value={kutraRate}
                onChange={(e) => {
                  setKutraTouched(true);
                  setKutraRate(e.target.value);
                }}
                placeholder="0"
              />
              {cardKutra && !kutraTouched && (
                <p className="mt-1 text-xs text-surface-500">{t("mrc_from_card", lang)}</p>
              )}
              {kutraTouched && <p className="mt-1 text-xs text-brand-600">{t("mrc_changed", lang)}</p>}
            </div>
          </div>

          {estimate > 0 && (
            <div className="rounded-lg bg-surface-50 p-2 text-xs dark:bg-surface-800">
              <p className="text-surface-700 dark:text-surface-300">
                {t("mh_sabit", lang)}: {sabitNum} × Rs {(Number(sabitRate) || 0).toLocaleString()} = Rs{" "}
                {Math.round(sabitNum * (Number(sabitRate) || 0)).toLocaleString()}
              </p>
              <p className="text-surface-700 dark:text-surface-300">
                {t("mh_kutra", lang)}: {kutraNum} × Rs {(Number(kutraRate) || 0).toLocaleString()} = Rs{" "}
                {Math.round(kutraNum * (Number(kutraRate) || 0)).toLocaleString()}
              </p>
              <p className="mt-1 font-semibold text-surface-900 dark:text-white">
                {t("mh_estimate", lang)}: Rs {estimate.toLocaleString()}
              </p>
              <p className="mt-0.5 text-surface-500">{t("mh_estimate_note", lang)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CropPicker({
  crops,
  lang,
  onChange,
}: {
  crops: { key: string; label: string }[];
  lang: Lang;
  onChange?: (key: string) => void;
}) {
  const [list, setList] = useState(crops);
  const [value, setValue] = useState(crops[0]?.key ?? "other");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const label = name.trim();
    if (!label) return;
    const fd = new FormData();
    fd.set("label", label);
    startTransition(async () => {
      const res = await addCrop({}, fd);
      if (res.error) {
        setMsg(res.error);
        return;
      }
      if (res.key && res.label) {
        // Pehle se maujood ho to dobara na chipke -- wohi chun li jati hai.
        setList((prev) => (prev.some((c) => c.key === res.key) ? prev : [...prev, { key: res.key!, label: res.label! }]));
        setValue(res.key);
        onChange?.(res.key);
      }
      setName("");
      setAdding(false);
      setMsg(null);
    });
  }

  return (
    <div>
      <Select
        name="crop_type"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
      >
        {list.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
        <option value="other">{t("mc_other", lang)}</option>
      </Select>

      {adding ? (
        <div className="mt-1.5 flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("mcrop_new_name", lang)}
            className="text-sm"
          />
          <Button type="button" onClick={save} disabled={pending || !name.trim()} className="shrink-0">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("mcrop_save", lang)}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setAdding(false);
              setName("");
              setMsg(null);
            }}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 text-xs font-medium text-brand-600 hover:underline"
        >
          {t("mcrop_add_new", lang)}
        </button>
      )}
      {msg && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{msg}</p>}
    </div>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-surface-100 pb-2 dark:border-surface-800">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
        {n}
      </span>
      <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{title}</h2>
    </div>
  );
}

/**
 * Acre aur kanal alag alag liye jate hain kyunki yahan aise hi bola
 * jata hai ("nau acre chaar kanal"). Jorh hamesha database mein hota
 * hai, is liye kisi jagah ye bhoolne ka khatra nahi ke kanal ko 8 se
 * taqseem karna tha.
 */
function AreaPair({
  label,
  acresName,
  kanalName,
  required,
  defaultAcres,
  fieldId,
  error,
  onTotal,
}: {
  label: string;
  acresName: string;
  kanalName: string;
  required?: boolean;
  defaultAcres?: string;
  fieldId?: string;
  error?: string;
  /** Kul raqba badle to bahar khabar -- khana khud apna hi rehta hai. */
  onTotal?: (total: number) => void;
}) {
  const lang = useLang();
  const acresRef = useRef<HTMLInputElement>(null);
  const kanalRef = useRef<HTMLInputElement>(null);
  function report() {
    if (!onTotal) return;
    const a = Number(acresRef.current?.value ?? 0) || 0;
    const k = Number(kanalRef.current?.value ?? 0) || 0;
    onTotal(Math.round((a + k / 8) * 10000) / 10000);
  }
  return (
    <div>
      <Label>
        {label} {required && "*"}
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <Input
            ref={acresRef}
            id={fieldId}
            type="number"
            name={acresName}
            step="0.01"
            placeholder="0"
            defaultValue={defaultAcres ?? ""}
            onChange={report}
            className={error ? "border-red-500 focus:ring-red-500" : undefined}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">{t("nb_acre", lang)}</span>
        </div>
        <div className="relative">
          <Input
            ref={kanalRef}
            type="number"
            name={kanalName}
            step="0.01"
            placeholder="0"
            onChange={report}
            className={error ? "border-red-500 focus:ring-red-500" : undefined}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">{t("nb_kanal", lang)}</span>
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/**
 * Button sirf us waqt band hota hai jab booking waqai ban rahi ho.
 *
 * Pehle ye kisan chune baghair bhi band rehta tha -- aur band button ye
 * nahi batata ke kya kam hai. Ab wo hamesha dabta hai, aur jo cheez kam
 * ho wo khud surkh ho kar saamne aa jati hai.
 */
function SubmitButton({ onCheck }: { onCheck: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" onClick={onCheck} disabled={pending} className="w-full">
      {pending ? "Ban rahi hai..." : "Booking Banayein"}
    </Button>
  );
}
