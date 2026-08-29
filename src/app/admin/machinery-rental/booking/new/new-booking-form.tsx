"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createBooking, quickRegisterFarmer, type ActionState } from "@/actions/machinery-lifecycle";
import { Button, Input, Label, Select, Textarea, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { PaymentSlipUpload } from "@/components/ui/payment-slip-upload";
import { MapPin, Loader2, UserPlus, X } from "lucide-react";

const initialState: ActionState = {};

interface Farmer {
  id: string;
  full_name: string;
  farmer_code: string;
  phone_number: string;
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
  staffName,
  defaultFarmerId,
  defaultRequestId,
  defaultAcres,
  defaultLocation,
}: {
  farmers: Farmer[];
  accounts: Account[];
  staffName?: string | null;
  defaultFarmerId?: string;
  defaultRequestId?: string;
  defaultAcres?: string;
  defaultLocation?: string;
}) {
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

  // Farmer ID likhte hi kisan saamne aa jata hai -- code, naam ya phone,
  // teenon se. Staff ko yaad sirf ek cheez hoti hai, aur wo har baar
  // wahi nahi hoti.
  function lookup(value: string) {
    setCode(value);
    const needle = value.trim().toLowerCase();
    if (!needle) {
      setFarmerId("");
      return;
    }
    const found = allFarmers.find(
      (f) =>
        f.farmer_code.toLowerCase() === needle ||
        f.phone_number.replace(/\D/g, "") === needle.replace(/\D/g, "") ||
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
        <p className="text-sm text-surface-500">Booking ban gayi</p>
        <p className="mt-1 font-display text-2xl font-bold text-brand-700 dark:text-brand-300">{state.bookingNumber}</p>
        <p className="mt-3 text-sm text-surface-600 dark:text-surface-300">
          Advance, rate confirmation, machine rawangi, asal kaam, bill aur payment — sab isi Booking ID ke neeche.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => router.push(`/admin/machinery-rental/booking/${state.bookingId}`)}>
            Booking kholein
          </Button>
          <Button variant="secondary" onClick={() => router.refresh()}>
            Ek aur booking
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

      {/* 1 — Kisan */}
      <Card className="space-y-3">
        <SectionTitle n={1} title="Kisan" />
        <div>
          <Label>Farmer ID / Mobile / Naam</Label>
          <Input
            id="fld-farmer"
            value={code}
            onChange={(e) => lookup(e.target.value)}
            placeholder="0025"
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
                <UserPlus className="h-4 w-4" /> Yahin naya kisan banayein
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
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100">Naya kisan</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setQuickOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Label>Naam *</Label>
              <Input value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder="Muhammad Aslam" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mobile *</Label>
                <Input value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
              </div>
              <div>
                <Label>Zila</Label>
                <Input value={quickDistrict} onChange={(e) => setQuickDistrict(e.target.value)} placeholder="Sahiwal" />
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
        <SectionTitle n={2} title="Kaam" />

        <div>
          <Label>Machine ki qism *</Label>
          <Input
            id="fld-machine_type_requested"
            name="machine_type_requested"
            placeholder="Kubota Harvester / Combine / Rotavator"
            className={errors.machine_type_requested ? "border-red-500 focus:ring-red-500" : undefined}
          />
          {errors.machine_type_requested && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.machine_type_requested}</p>
          )}
          <p className="mt-1 text-xs text-surface-500">
            Kaun si machine jayegi, ye abhi tay karna zaroori nahi — wo rawangi ke waqt chuni jati hai.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fasal</Label>
            <Select name="crop_type" defaultValue="wheat">
              <option value="wheat">Gandum (Wheat)</option>
              <option value="rice">Chawal (Rice)</option>
              <option value="maize">Makai (Maize)</option>
              <option value="other">Deegar</option>
            </Select>
          </div>
          <div>
            <Label>Kab chahiye</Label>
            <Input type="date" name="preferred_date" min={new Date().toISOString().slice(0, 10)} />
          </div>
        </div>

        <AreaPair
          label="Raqba (kitna kaam)"
          acresName="harvest_area_acres"
          kanalName="harvest_area_kanal"
          required
          defaultAcres={defaultAcres}
          fieldId="fld-harvest_area"
          error={errors.harvest_area}
        />

        <div>
          <Label>Khet ka pata</Label>
          <Input name="location_address" defaultValue={defaultLocation ?? ""} placeholder="Gaon / khet tak pahunchne ka pata" />
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
          label="Khet tayyar hai?"
          name="field_ready"
          value={fieldReady}
          onChange={setFieldReady}
          hint="Paani khara ho ya pichli fasal ka rehna baqi ho to machine wapas aa jati hai."
        />
        <YesNo
          label="Fasal pakk gayi?"
          name="harvest_ready"
          value={harvestReady}
          onChange={setHarvestReady}
          hint="Kachi fasal par harvester bhejna nuqsan hai."
        />
      </Card>

      {/* 5 — Advance */}
      <Card className="space-y-3">
        <SectionTitle n={3} title="Advance" />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="advance_received"
              value="no"
              checked={!advance}
              onChange={() => setAdvance(false)}
            />
            Advance nahi liya
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="advance_received"
              value="yes"
              checked={advance}
              onChange={() => setAdvance(true)}
            />
            Advance liya hai
          </label>
        </div>

        {advance && (
          <div className="space-y-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Raqam *</Label>
                <Input
                  id="fld-advance_amount"
                  type="number"
                  name="advance_amount"
                  step="0.01"
                  placeholder="20000"
                  className={errors.advance_amount ? "border-red-500 focus:ring-red-500" : undefined}
                />
                {errors.advance_amount && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.advance_amount}</p>
                )}
              </div>
              <div>
                <Label>Tareeqa</Label>
                <Select name="advance_method" value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="wallet">Wallet</option>
                  <option value="other">Deegar</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Kis khate mein aaya *</Label>
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
                <Label>Tareekh</Label>
                <Input type="date" name="advance_date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <Label>Reference / Receipt no.</Label>
                <Input name="advance_reference" />
              </div>
            </div>
            <div>
              <input type="hidden" name="advance_evidence_url" value={advanceEvidence} />
              <PaymentSlipUpload onUploaded={setAdvanceEvidence} />
            </div>
            {staffName && (
              <p className="rounded bg-surface-50 px-2 py-1 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                Ye paisa <strong>{staffName}</strong> ke naam par darj hoga — jo abhi login hai.
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
          <Label>Notes</Label>
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
}: {
  label: string;
  acresName: string;
  kanalName: string;
  required?: boolean;
  defaultAcres?: string;
  fieldId?: string;
  error?: string;
}) {
  return (
    <div>
      <Label>
        {label} {required && "*"}
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <Input
            id={fieldId}
            type="number"
            name={acresName}
            step="0.01"
            placeholder="0"
            defaultValue={defaultAcres ?? ""}
            className={error ? "border-red-500 focus:ring-red-500" : undefined}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">
            acre
          </span>
        </div>
        <div className="relative">
          <Input
            type="number"
            name={kanalName}
            step="0.01"
            placeholder="0"
            className={error ? "border-red-500 focus:ring-red-500" : undefined}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">
            kanal
          </span>
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
