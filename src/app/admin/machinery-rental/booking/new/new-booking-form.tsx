"use client";
import { useMemo, useState, useTransition } from "react";
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
  village: string;
  previous_bookings: number;
  outstanding: number;
}
interface Machine {
  id: string;
  machine_type: string;
  model: string | null;
  rate_type: string;
  rate_amount: number;
  vendor_name: string;
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
 * Rate yahan sirf ANDAZA hai. Us par "Estimated" ka nishan jaan boojh
 * kar saamne likha hai, taake koi ise tay shuda rate na samajh le:
 * asal rate kattai se pehle kisan se confirm hota hai, aur bill usi se
 * banta hai.
 */
export function NewBookingForm({
  farmers,
  machines,
  accounts,
  staffName,
  defaultFarmerId,
  defaultRequestId,
  defaultAcres,
  defaultLocation,
}: {
  farmers: Farmer[];
  machines: Machine[];
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
  const [quickVillage, setQuickVillage] = useState("");
  const [quickMsg, setQuickMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [quickPending, startQuick] = useTransition();

  const allFarmers = useMemo(() => [...addedFarmers, ...farmers], [addedFarmers, farmers]);

  function quickRegister() {
    setQuickMsg(null);
    startQuick(async () => {
      const fd = new FormData();
      fd.set("full_name", quickName);
      fd.set("phone_number", quickPhone);
      fd.set("village", quickVillage);
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
        village: quickVillage,
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
    <form action={formAction} className="space-y-4 pb-24">
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
          <Input value={code} onChange={(e) => lookup(e.target.value)} placeholder="0025" autoFocus />
        </div>
        <input type="hidden" name="farmer_id" value={farmerId} />

        {farmer ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-900/40 dark:bg-brand-950/20">
            <p className="font-medium text-surface-900 dark:text-surface-100">{farmer.full_name}</p>
            <p className="text-surface-600 dark:text-surface-300">{farmer.phone_number || "Mobile darj nahi"}</p>
            {farmer.village && <p className="text-surface-600 dark:text-surface-300">{farmer.village}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="gray">Pichli bookings: {farmer.previous_bookings}</Badge>
              <Badge tone={farmer.outstanding > 0 ? "red" : "green"}>
                Machinery ka baqi: Rs {farmer.outstanding.toLocaleString()}
              </Badge>
            </div>
          </div>
        ) : (
          code.trim() !== "" &&
          !quickOpen && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-surface-500">
              <span>Ye kisan nahi mila.</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuickName("");
                  setQuickPhone(/^[0-9+\-\s]+$/.test(code.trim()) ? code.trim() : "");
                  setQuickVillage("");
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
                <Label>Mobile</Label>
                <Input value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
              </div>
              <div>
                <Label>Gaon</Label>
                <Input value={quickVillage} onChange={(e) => setQuickVillage(e.target.value)} placeholder="Chak Mahabali" />
              </div>
            </div>
            <Button type="button" size="sm" onClick={quickRegister} disabled={quickPending || !quickName.trim()}>
              {quickPending ? "Ban raha hai..." : "Banayein aur chunein"}
            </Button>
            <p className="text-xs text-surface-500">
              Sirf itna hi kaafi hai. CNIC, zameen aur kaghazat baad mein Farmers wale safhe se bhare ja sakte hain.
              Mobile pehle se kisi kisan ka hua to naya nahi banega — wohi purana chun liya jayega, taake ek hi banda
              do khaton mein na bat jaye.
            </p>
          </div>
        )}
      </Card>

      {/* 2 — Khet aur fasal */}
      <Card className="space-y-3">
        <SectionTitle n={2} title="Khet aur Fasal" />
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
            <Label>Gaon / Farm</Label>
            <Input name="village" defaultValue={farmer?.village ?? ""} placeholder="Chak Mahabali" />
          </div>
        </div>

        <AreaPair label="Kul raqba" acresName="total_area_acres" kanalName="total_area_kanal" />
        <AreaPair
          label="Kattai ka raqba"
          acresName="harvest_area_acres"
          kanalName="harvest_area_kanal"
          required
          defaultAcres={defaultAcres}
        />

        <div>
          <Label>Pata</Label>
          <Input name="location_address" defaultValue={defaultLocation ?? ""} placeholder="Khet tak pahunchne ka pata" />
        </div>

        <div>
          <Label>Google Location</Label>
          <input type="hidden" name="location_lat" value={coords?.lat ?? ""} />
          <input type="hidden" name="location_lng" value={coords?.lng ?? ""} />
          <div className="flex items-center gap-2">
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
          <p className="mt-1 text-xs text-surface-500">
            Location baad mein raasta banane aur machine bhejne ke kaam aati hai.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Khet tak rasai</Label>
            <Select name="field_access" defaultValue="">
              <option value="">—</option>
              <option value="easy">Asaan</option>
              <option value="medium">Darmiyana</option>
              <option value="difficult">Mushkil</option>
            </Select>
          </div>
          <div>
            <Label>Kattai kab tak</Label>
            <Input type="date" name="expected_harvest_date" />
          </div>
          <div>
            <Label>Pasandeeda tareekh</Label>
            <Input type="date" name="preferred_date" />
          </div>
          <div>
            <Label>Pasandeeda waqt</Label>
            <Select name="preferred_time" defaultValue="any">
              <option value="morning">Subah</option>
              <option value="afternoon">Dopahar</option>
              <option value="evening">Shaam</option>
              <option value="any">Koi bhi</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>Khaas hidayat</Label>
          <Textarea name="special_instructions" rows={2} placeholder="Khet mein khaal hai, choti machine behtar rahegi..." />
        </div>
      </Card>

      {/* 3 — Machinery */}
      <Card className="space-y-3">
        <SectionTitle n={3} title="Machinery ki Zaroorat" />
        <div>
          <Label>Machine ki qism *</Label>
          <Input name="machine_type_requested" placeholder="Kubota Harvester / Combine / Rotavator" required />
        </div>
        <div>
          <Label>Machine (abhi tay ho to)</Label>
          <Select name="machine_id" defaultValue="">
            <option value="">Abhi tay nahi (Unassigned)</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.machine_type}
                {m.model ? ` (${m.model})` : ""} — {m.vendor_name} — Rs {m.rate_amount.toLocaleString()}/{m.rate_type.replace("per_", "")}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-surface-500">
            Booking ke waqt machine tay karna zaroori nahi — baad mein rawangi ke waqt bhi tay ho sakti hai.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Kitni machinein</Label>
            <Input type="number" name="required_units" min={1} defaultValue={1} />
          </div>
          <div>
            <Label>Deegar service</Label>
            <Input name="other_service" placeholder="Thresher, loading..." />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-200">
          <input type="checkbox" name="trolley_required" className="h-4 w-4" />
          Trolley chahiye
        </label>
      </Card>

      {/* 4 — Rate */}
      <Card className="space-y-3">
        <SectionTitle n={4} title="Rate — booking ke waqt" />
        <div>
          <Label>Andaza (Rs per acre)</Label>
          <Input type="number" name="estimated_rate" step="0.01" placeholder="7000" />
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <p className="font-medium">Ye rate abhi sirf ANDAZA hai.</p>
          <p className="mt-1">
            Bill kabhi is se nahi banega. Kattai se pehle final rate kisan ko bheja jayega, aur us ke confirm karne ke
            baad hi wo rate "final" ban kar bill ki bunyad banega.
          </p>
        </div>
      </Card>

      {/* 5 — Advance */}
      <Card className="space-y-3">
        <SectionTitle n={5} title="Advance" />
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
                <Input type="number" name="advance_amount" step="0.01" placeholder="20000" />
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
              <Select name="advance_account_id" defaultValue="">
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.account_type})
                  </option>
                ))}
              </Select>
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
        <SubmitButton disabled={!farmerId} />
      </Card>
    </form>
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
}: {
  label: string;
  acresName: string;
  kanalName: string;
  required?: boolean;
  defaultAcres?: string;
}) {
  return (
    <div>
      <Label>
        {label} {required && "*"}
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <Input type="number" name={acresName} step="0.01" placeholder="0" defaultValue={defaultAcres ?? ""} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">
            acre
          </span>
        </div>
        <div className="relative">
          <Input type="number" name={kanalName} step="0.01" placeholder="0" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">
            kanal
          </span>
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full">
      {pending ? "Ban rahi hai..." : "Booking Banayein"}
    </Button>
  );
}
