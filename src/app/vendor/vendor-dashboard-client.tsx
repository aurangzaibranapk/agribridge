"use client";
import { useState } from "react";
import { LogoutButton } from "@/components/layout/logout-button";
import { useFormState, useFormStatus } from "react-dom";
import {
  Tractor, CheckCircle2, MapPin, Phone, Fuel, HandCoins, Calendar, CalendarDays,
  Layers, Loader2, CircleDashed, ShieldCheck, Droplets, Banknote, Inbox, ArrowRight, Navigation, BellDot,
} from "lucide-react";
import {
  submitVendorWork,
  submitVendorClosing,
  submitVendorFuel,
  submitVendorCollection,
  markVendorProgress,
  type VendorActionState,
} from "@/actions/vendor-portal";

const initialState: VendorActionState = {};

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  bookingDate: string;
  farmerName: string;
  farmerPhone: string | null;
  reachedAt: string | null;
  startedAt: string | null;
  harvestDate: string | null;
  harvestTime: string | null;
  cropType: string | null;
  bookedArea: number | null;
  finalRate: number | null;
  /** Kattai ki qism (176). "dono" ho to kaam ka batwara alag likha jata hai. */
  harvestType: string | null;
  rateFinal: boolean;
  locationAddress: string | null;
  village: string | null;
  lat: number | null;
  lng: number | null;
  machineLabel: string | null;
  fuelClaimed: number;
  fuelRejected: Array<{ id: string; rejection_reason: string | null }>;
  collections: Array<{ id: string; amount: number; date: string; settlement: string | null; status: string; reason: string | null }>;
  billNumber: string | null;
  area: number | null;
  rate: number | null;
  gross: number | null;
  /** Commission ki RAQAM -- upar ke card ke liye. Fisad kahin nahi. */
  commission: number | null;
  farmerDiesel: number;
  artDiesel: number;
  payable: number | null;
  paid: number;
  outstanding: number;
  claimed: number;
  rejected: Array<{ id: string; rejection_reason: string | null }>;
  verifiedArea: number;
  workDone: boolean;
  closingDone: boolean;
}

// Vendor ke liye halat us ki apni zabaan mein. Andar ke naam
// (bill_pending waghera) hamare nizam ke liye hain, us ke liye nahi.
const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "Rate tay ho raha hai", color: "bg-surface-100 text-surface-600" },
  ready_for_harvest: { label: "Machine bhejni hai", color: "bg-blue-50 text-blue-700" },
  in_progress: { label: "Kaam chal raha hai", color: "bg-purple-50 text-purple-700" },
  bill_pending: { label: "Bill ban raha hai", color: "bg-amber-50 text-amber-700" },
  payment_pending: { label: "Kisan se paisa aana hai", color: "bg-amber-50 text-amber-700" },
  closed: { label: "Hisaab poora", color: "bg-green-50 text-green-700" },
  cancelled: { label: "Cancel", color: "bg-red-50 text-red-700" },
};

interface Money {
  earned: number;
  received: number;
  withArt: number;
  withFarmer: number;
  dieselAdvance: number;
  netNow: number;
  commission: number;
  farmerDiesel: number;
}
interface Work {
  bookings: number;
  booked: number;
  done: number;
  running: number;
  pending: number;
  next7: number;
}
interface Diesel {
  litres: number;
  amount: number;
  byVendor: number;
  byFarmer: number;
  byArt: number;
}
interface WeekRow {
  bookingId: string;
  bookingNumber: string;
  date: string | null;
  time: string | null;
  farmerName: string;
  farmerPhone: string | null;
  area: number;
  done: number;
  cropType: string | null;
  village: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  machineLabel: string | null;
}

export interface MachineRow {
  id: string;
  code: string;
  type: string;
  model: string | null;
  status: string;
  driverName: string | null;
  seasonAcres: number;
  dieselLitres: number;
  dieselAmount: number;
  runningBooking: string | null;
  runningFarmer: string | null;
  lastLat: number | null;
  lastLng: number | null;
}

export interface LocationRow {
  jagah: string;
  farmers: number;
  bookings: number;
  acres: number;
  firstDate: string | null;
  lat: number | null;
  lng: number | null;
}

export interface PaymentRow {
  id: string;
  settlementId: string;
  date: string;
  bookingNumber: string | null;
  farmerName: string | null;
  amount: number;
  dieselBack: number;
  cash: number;
  isReversal: boolean;
}

export interface CommissionRow {
  bookingId: string;
  bookingNumber: string;
  date: string | null;
  farmerName: string;
  verifiedWork: number;
  commission: number;
}

/** Kaunsa card khula hua hai -- us ki asal qatarein neeche khulti hain. */
type Drill =
  | null
  | "booked" | "done" | "running" | "pending" | "next7" | "verify"
  | "earned" | "received" | "withArt" | "withFarmer" | "dieselAdvance" | "commission"
  | "dieselAll" | "dieselVendor" | "dieselFarmer" | "dieselArt";

export interface AlertRow {
  id: string;
  title: string;
  message: string;
  at: string;
}

export function VendorDashboardClient({
  alerts,
  vendorName,
  awaitingCheck,
  money,
  work,
  diesel,
  week,
  bookings,
  machines,
  locations,
  payments,
  commissionRows,
}: {
  alerts: AlertRow[];
  vendorName: string;
  awaitingCheck: number;
  money: Money;
  work: Work;
  diesel: Diesel;
  week: WeekRow[];
  bookings: Booking[];
  machines: MachineRow[];
  locations: LocationRow[];
  payments: PaymentRow[];
  commissionRows: CommissionRow[];
}) {
  const [drill, setDrill] = useState<Drill>(null);
  const [machineId, setMachineId] = useState<string>("all");

  function toggle(key: Drill) {
    setDrill((prev) => (prev === key ? null : key));
  }

  // Machine ka chunao sirf KAAM ki fehrist par lagta hai, paise par
  // nahi. Paisa vendor ka ek hi khata hai -- usay machine ke hisaab se
  // baant kar dikhana wo adad bana deta jo kisi khate mein hai hi nahi.
  const machineLabel = (m: MachineRow) => `${m.code} — ${m.type}${m.model ? ` (${m.model})` : ""}`;
  const selected = machines.find((m) => m.id === machineId) ?? null;
  const shown = selected
    ? bookings.filter((b) => (b.machineLabel ?? "").startsWith(selected.type))
    : bookings;

  const today = new Date().toISOString().slice(0, 10);
  const todays = bookings.filter((b) => b.harvestDate === today && !b.workDone);
  const pendingVerify = bookings.filter((b) => b.claimed > 0);
  const activeMachines = machines.filter((m) => !!m.runningBooking).length;

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  // Har card ki apni fehrist. Ye wohi bookings hain jin se card ka adad
  // bana -- koi alag hisaab nahi, sirf chhantai.
  const listFor: Record<string, Booking[]> = {
    booked: bookings,
    done: bookings.filter((b) => b.workDone),
    running: bookings.filter((b) => !!b.startedAt && !b.workDone),
    pending: bookings.filter((b) => !b.workDone),
    verify: pendingVerify,
    earned: bookings.filter((b) => (b.payable ?? 0) > 0),
    received: bookings.filter((b) => b.paid > 0),
    withArt: bookings.filter((b) => b.outstanding > 0),
    withFarmer: bookings.filter((b) => b.outstanding > 0),
    dieselAdvance: bookings.filter((b) => b.artDiesel > 0),
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ---------------------------------------------- Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Tractor className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold leading-tight text-surface-900">{vendorName}</h1>
              <p className="text-sm text-surface-500">Machinery Vendor Portal</p>
              <p className="mt-0.5 text-xs text-surface-400">
                {machines.length} machine{machines.length === 1 ? "" : "ein"}
                {activeMachines > 0 ? ` · ${activeMachines} kaam par` : ""} · Aaj {today}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {machines.length > 1 && (
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 shadow-sm"
              >
                <option value="all">Sab machinein</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {machineLabel(m)}
                  </option>
                ))}
              </select>
            )}
            <a
              href="#gosharah"
              className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-medium text-surface-700 shadow-sm hover:bg-surface-50"
            >
              Gosharah
            </a>
            {/* Nikalne ka raasta. Ye tha hi nahi -- vendor ko browser
                band karne ke ilawa koi chara nahi tha, aur sanjhe phone
                par wo khatarnak hai: agla banda usi ke khate mein
                andar hota hai. */}
            <div className="rounded-xl border border-surface-200 bg-white shadow-sm">
              <LogoutButton />
            </div>
          </div>
        </header>

        {/* Nayi khabrein -- sab se upar, hero se bhi pehle.
            Machine rawana hoti hai to khabar yahin milti hai. Pehle wo
            sirf WhatsApp par jati thi, aur jis din wo chaabi na lagi ho
            us din vendor ko kuch pata hi nahi chalta tha. */}
        {alerts.length > 0 && (
          <section className="mb-6 space-y-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3"
              >
                <BellDot className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-900">{a.title}</p>
                  {a.message && <p className="text-xs text-blue-800">{a.message}</p>}
                  {a.at && (
                    <p className="mt-0.5 text-[11px] text-blue-600">
                      {new Date(a.at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ---------------------------------------------- Hero
            Sab se ahem adad sab se upar aur akela: "net abhi milna
            hai" wo raqam hai jo waqai abhi di ja sakti hai. Baqi chaar
            adad us ki wajah batate hain -- is liye wo chhote hain, aur
            poora card hara nahi kiya gaya. */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
          <div className="grid gap-px bg-surface-200 lg:grid-cols-[1.4fr_2.6fr]">
            <div className="bg-brand-50 p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Net abhi milna hai</p>
              <p className="mt-2 font-display text-4xl font-bold leading-none text-brand-800">
                Rs {money.netNow.toLocaleString()}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-brand-700">
                Jo ART ke paas jama hai, us mein se ART ka diesel kaat kar.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-surface-200 lg:grid-cols-4">
              <HeroFigure label="ART ke paas jama" value={money.withArt} tone="brand" />
              <HeroFigure label="Farmer se pending" value={money.withFarmer} tone="amber" />
              <HeroFigure label="ART diesel katega" value={money.dieselAdvance} tone="plain" />
              <HeroFigure label="Mil chuka" value={money.received} tone="plain" />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------- Kaam */}
        <SectionHead title="Kaam" hint="Card par ungli rakhein — us ki asal bookings neeche khul jayengi." />
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            value={work.booked}
            label="Total Booked Acres"
            sub={`${work.done} mukammal`}
            barPct={pct(work.done, work.booked)}
            tone="neutral"
            onClick={() => toggle("booked")}
            active={drill === "booked"}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            value={work.done}
            label="Completed Acres"
            sub={`${pct(work.done, work.booked)}% ho chuka`}
            barPct={pct(work.done, work.booked)}
            tone="green"
            onClick={() => toggle("done")}
            active={drill === "done"}
          />
          <StatCard
            icon={<Loader2 className="h-4 w-4" />}
            value={work.running}
            label="In Progress Acres"
            sub={work.running > 0 ? "abhi chal rahe hain" : "koi kaam chal nahi raha"}
            barPct={pct(work.running, work.booked)}
            tone="purple"
            onClick={() => toggle("running")}
            active={drill === "running"}
          />
          <StatCard
            icon={<CircleDashed className="h-4 w-4" />}
            value={work.pending}
            label="Pending Acres"
            sub={`${pct(work.pending, work.booked)}% baqi`}
            barPct={pct(work.pending, work.booked)}
            tone="amber"
            onClick={() => toggle("pending")}
            active={drill === "pending"}
          />
          <StatCard
            icon={<CalendarDays className="h-4 w-4" />}
            value={work.next7}
            label="Next 7 Days Acres"
            sub={`${week.length} booking`}
            barPct={pct(work.next7, work.booked)}
            tone="blue"
            onClick={() => toggle("next7")}
            active={drill === "next7"}
          />
          <StatCard
            icon={<ShieldCheck className="h-4 w-4" />}
            value={awaitingCheck}
            label="Verification Pending"
            sub={awaitingCheck > 0 ? "ART ki tasdeeq ka intezar" : "kuch baqi nahi"}
            barPct={0}
            tone={awaitingCheck > 0 ? "amber" : "neutral"}
            onClick={() => toggle("verify")}
            active={drill === "verify"}
          />
        </div>

        {drill === "next7" && <DrillWeek rows={week} />}
        {drill !== null && drill !== "next7" && listFor[drill] && (
          <DrillBookings rows={listFor[drill]} kind={drill} />
        )}
        {drill === "commission" && <DrillCommission rows={commissionRows} />}
        {(drill === "dieselAll" || drill === "dieselVendor" || drill === "dieselFarmer" || drill === "dieselArt") && (
          <DrillDiesel rows={bookings} kind={drill} />
        )}

        {/* ---------------------------------------------- Paisa
            Chhe alag baatein, chhe alag card. In ko jor kar ek "baqi"
            dikhana wohi ghalti hai jis se jhagRa shuru hota hai: aadha
            paisa hamare paas aaya hi nahi hota. */}
        <SectionHead title="Paisa" hint="Har raqam apne naam se — koi mila-jula adad nahi." />
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MoneyCard label="Total Verified Earning" value={money.earned} emphasis tone="neutral" onClick={() => toggle("earned")} active={drill === "earned"} />
          <MoneyCard label="Vendor ko Mil Chuka" value={money.received} tone="neutral" onClick={() => toggle("received")} active={drill === "received"} />
          <MoneyCard label="ART ke Paas Jama" value={money.withArt} emphasis tone="green" onClick={() => toggle("withArt")} active={drill === "withArt"} />
          <MoneyCard label="Farmer se Pending" value={money.withFarmer} tone="amber" onClick={() => toggle("withFarmer")} active={drill === "withFarmer"} />
          <MoneyCard label="ART Diesel Recoverable" value={money.dieselAdvance} tone="neutral" onClick={() => toggle("dieselAdvance")} active={drill === "dieselAdvance"} />
          {/* Sirf raqam. Fisad kahin nahi -- na yahan, na tafseel mein. */}
          <MoneyCard label="ART Commission" value={money.commission} tone="neutral" onClick={() => toggle("commission")} active={drill === "commission"} />
        </div>

        {money.withFarmer > 0 && (
          <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Rs {money.withFarmer.toLocaleString()} abhi kisan ke paas hai — jaise hi wo hamein deta hai, wo aap ke jama
            mein aa jayega.
          </p>
        )}

        {/* ---------------------------------------------- Diesel */}
        <SectionHead title="Diesel" hint="Kis ne diya, kitna laga." />
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <DieselCard label="Total Litres" value={`${diesel.litres}`} big onClick={() => toggle("dieselAll")} active={drill === "dieselAll"} />
          <DieselCard label="Total Value" value={`Rs ${diesel.amount.toLocaleString()}`} big onClick={() => toggle("dieselAll")} active={drill === "dieselAll"} />
          <DieselCard label="Vendor Paid" value={`Rs ${diesel.byVendor.toLocaleString()}`} onClick={() => toggle("dieselVendor")} active={drill === "dieselVendor"} />
          <DieselCard label="Farmer Paid" value={`Rs ${diesel.byFarmer.toLocaleString()}`} onClick={() => toggle("dieselFarmer")} active={drill === "dieselFarmer"} />
          <DieselCard label="ART Paid" value={`Rs ${diesel.byArt.toLocaleString()}`} onClick={() => toggle("dieselArt")} active={drill === "dieselArt"} />
        </div>

        {/* ---------------------------------------------- Do sutoon
            Baayen taraf aaj ka kaam (jis ke liye vendor subah safha
            kholta hai), daayen taraf aane wala kaam aur jagah. */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div>
              <SectionHead title="Aaj ka Kaam" hint={today} />
              {todays.length === 0 ? (
                <EmptyCard icon={<Calendar className="h-5 w-5" />} title="Aaj ke liye koi kaam nahi" text="Agle dinon ka schedule daayen taraf hai." />
              ) : (
                <div className="space-y-3">
                  {todays.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
              )}
            </div>

            {pendingVerify.length > 0 && (
              <div>
                <SectionHead
                  title="Pending Verification"
                  hint={`${pendingVerify.length} job ART ki tasdeeq ke intezar mein`}
                />
                <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Ye kaam abhi kisi hisaab mein shamil NAHI hai — na mukammal acre mein, na kamai mein. ART ki tasdeeq
                  ke baad hi shamil hoga.
                </p>
                <div className="space-y-3">
                  {pendingVerify.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionHead
                title={selected ? `${machineLabel(selected)} ki bookings` : "Meri sab bookings"}
                hint={`${shown.length} booking`}
              />
              {shown.length === 0 ? (
                <EmptyCard icon={<Inbox className="h-5 w-5" />} title="Abhi koi booking nahi" text="Nayi booking aate hi yahan nazar aayegi." />
              ) : (
                <div className="space-y-3">
                  {shown.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Agle 7 din -- chhoti si timeline */}
            <div>
              <SectionHead title="Next 7 Days" hint={`${work.next7} acre`} />
              {week.length === 0 ? (
                <EmptyCard icon={<CalendarDays className="h-5 w-5" />} title="Agle 7 din khali hain" text="Nayi booking aate hi yahan aa jayegi." />
              ) : (
                <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
                  <ol className="space-y-3">
                    {week.map((w) => (
                      <li key={w.bookingId} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                          <span className="mt-1 w-px flex-1 bg-surface-200" />
                        </div>
                        <div className="min-w-0 flex-1 pb-1">
                          <p className="text-sm font-medium text-surface-900">
                            {w.date ?? "-"} — {w.area} acre
                          </p>
                          <p className="truncate text-xs text-surface-500">
                            {w.farmerName}
                            {w.village ? ` · ${w.village}` : ""}
                          </p>
                          <div className="mt-1 flex gap-2 text-xs">
                            {w.lat !== null && w.lng !== null && (
                              <a
                                href={`https://www.google.com/maps?q=${w.lat},${w.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-brand-600 hover:underline"
                              >
                                Jagah
                              </a>
                            )}
                            {w.farmerPhone && (
                              <a href={`tel:${w.farmerPhone}`} className="font-medium text-brand-600 hover:underline">
                                Call
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Jagah ke hisaab se -- vendor ek din mein ek hi taraf jata hai */}
            <div>
              <SectionHead title="Location-wise Work" hint="Baqi kaam, jagah ke hisaab se" />
              {locations.length === 0 ? (
                <EmptyCard icon={<MapPin className="h-5 w-5" />} title="Koi baqi kaam nahi" text="Sab jagah ka kaam mukammal hai." />
              ) : (
                <div className="rounded-2xl border border-surface-200 bg-white shadow-sm">
                  {locations.map((l, i) => (
                    <div
                      key={l.jagah}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        i > 0 ? "border-t border-surface-100" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-surface-900">{l.jagah}</p>
                        <p className="text-xs text-surface-500">
                          {l.farmers} kisan{l.firstDate ? ` · ${l.firstDate}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-display text-sm font-semibold text-surface-900">{l.acres} acre</span>
                        {l.lat !== null && l.lng !== null && (
                          <a
                            href={`https://www.google.com/maps?q=${l.lat},${l.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-surface-400 hover:text-brand-600"
                            title="Naqshe par"
                          >
                            <Navigation className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meri machinein */}
            <div>
              <SectionHead title="My Machines" hint={`${machines.length} machine`} />
              {machines.length === 0 ? (
                <EmptyCard icon={<Tractor className="h-5 w-5" />} title="Koi machine darj nahi" text="ART se kahein ke aap ki machine darj kar de." />
              ) : (
                <div className="space-y-2">
                  {machines.map((m) => (
                    <div key={m.id} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-surface-900">{m.code}</p>
                          <p className="truncate text-xs text-surface-500">
                            {m.type}
                            {m.model ? ` (${m.model})` : ""}
                            {m.driverName ? ` · ${m.driverName}` : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.runningBooking ? "bg-purple-50 text-purple-700" : "bg-surface-100 text-surface-600"
                          }`}
                        >
                          {m.runningBooking ? "Kaam par" : "Khali"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-500">
                        <span>{m.seasonAcres} acre is season</span>
                        {m.dieselLitres > 0 && <span>{m.dieselLitres} litre diesel</span>}
                        {m.runningFarmer && <span className="text-purple-700">{m.runningFarmer}</span>}
                        {m.lastLat !== null && m.lastLng !== null && (
                          <a
                            href={`https://www.google.com/maps?q=${m.lastLat},${m.lastLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-brand-600 hover:underline"
                          >
                            Aakhri jagah
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------- Adaigiyan */}
        <div className="mt-8">
          <SectionHead title="Recent Payments" hint="Mujhe hui adaigiyan" />
          {payments.length === 0 ? (
            <EmptyCard icon={<Banknote className="h-5 w-5" />} title="Abhi koi adaigi nahi hui" text="Pehli adaigi hote hi yahan qatar ban jayegi." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-surface-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 text-left">
                    <th className="px-4 py-3 font-medium text-surface-500">Tareekh</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Settlement</th>
                    <th className="px-4 py-3 font-medium text-surface-500">Booking</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">Raqam</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">Cash mila</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-surface-100 last:border-0">
                      <td className="px-4 py-3 text-surface-600">{p.date}</td>
                      <td className="px-4 py-3 text-surface-600">
                        {p.settlementId}
                        {p.isReversal && <span className="ml-1 text-xs text-red-600">(ulta kiya gaya)</span>}
                      </td>
                      <td className="px-4 py-3 text-surface-600">
                        {p.bookingNumber ?? "-"}
                        {p.farmerName && <span className="block text-xs text-surface-400">{p.farmerName}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-surface-900">Rs {p.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-surface-900">
                        Rs {p.cash.toLocaleString()}
                        {p.dieselBack > 0 && (
                          <span className="block text-xs text-surface-400">
                            diesel wapas Rs {p.dieselBack.toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ---------------------------------------------- Gosharah + season
            Ek hi qatar mein poora hisaab. Har lakeer upar kisi card se
            milti hai -- yahan koi naya adad nahi banta. */}
        <div id="gosharah" className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionHead title="Mera Gosharah" hint="Upar ke cards ka poora hisaab, ek qatar mein" />
            <div className="rounded-2xl border border-surface-200 bg-white p-5 text-sm shadow-sm">
              <Row3 label="Verified kaam se kamai" value={money.earned} strong />
              {money.dieselAdvance > 0 && (
                <Row3 label="ART ka diesel (katega)" value={-money.dieselAdvance} tone="text-red-600" />
              )}
              <Row3 label="Mil chuka" value={-money.received} />
              <div className="my-3 border-t border-surface-100" />
              <Row3 label="ART ke paas mera jama" value={money.withArt} tone="text-brand-700" />
              <Row3 label="Abhi kisan ke paas" value={money.withFarmer} tone="text-amber-700" />
              <div className="mt-3 flex items-center justify-between border-t-2 border-surface-200 pt-3">
                <span className="font-display text-base font-semibold text-surface-900">Net abhi milna hai</span>
                <span className="font-display text-2xl font-bold text-brand-700">
                  Rs {money.netNow.toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-xs text-surface-500">
                Commission verified kamai mein se pehle hi nikal chuka hai — is liye yahan dobara nahi kata.
              </p>
            </div>
          </div>

          <div>
            <SectionHead title="Mera Season" hint="Ab tak ka khulasa" />
            <div className="rounded-2xl border border-surface-200 bg-white shadow-sm">
              <SeasonRow label="Booked acres" value={`${work.booked}`} />
              <SeasonRow label="Completed acres" value={`${work.done}`} />
              <SeasonRow label="Remaining acres" value={`${work.pending}`} />
              <SeasonRow label="Verified earning" value={`Rs ${money.earned.toLocaleString()}`} />
              <SeasonRow label="Vendor received" value={`Rs ${money.received.toLocaleString()}`} />
              <SeasonRow label="Net outstanding" value={`Rs ${money.netNow.toLocaleString()}`} strong />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Section ka sar -- naam aur ek chhota sa jumla. */
function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-lg font-semibold text-surface-900">{title}</h2>
      {hint && <p className="text-xs text-surface-500">{hint}</p>}
    </div>
  );
}

function HeroFigure({ label, value, tone }: { label: string; value: number; tone: "brand" | "amber" | "plain" }) {
  const color = tone === "brand" ? "text-brand-700" : tone === "amber" ? "text-amber-700" : "text-surface-900";
  return (
    <div className="bg-white p-4">
      <p className="text-xs text-surface-500">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${color}`}>Rs {value.toLocaleString()}</p>
    </div>
  );
}

const TONE_ICON: Record<string, string> = {
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  purple: "bg-purple-50 text-purple-700",
  blue: "bg-blue-50 text-blue-700",
  neutral: "bg-surface-100 text-surface-600",
};
const TONE_BAR: Record<string, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  neutral: "bg-surface-400",
};

/** Kaam ka card -- nishan, baRa adad, naam, aur ek chhoti si lakeer. */
function StatCard({
  icon,
  value,
  label,
  sub,
  barPct,
  tone,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  sub: string;
  barPct: number;
  tone: "green" | "amber" | "purple" | "blue" | "neutral";
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-brand-300 hover:shadow ${
        active ? "border-brand-500 ring-1 ring-brand-200" : "border-surface-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE_ICON[tone]}`}>{icon}</span>
        <ArrowRight className={`h-4 w-4 ${active ? "text-brand-600" : "text-surface-300"}`} />
      </div>
      <p className="mt-3 font-display text-3xl font-bold leading-none text-surface-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-surface-700">{label}</p>
      <p className="mt-0.5 text-xs text-surface-500">{sub}</p>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-100">
        <div className={`h-full rounded-full ${TONE_BAR[tone]}`} style={{ width: `${Math.min(barPct, 100)}%` }} />
      </div>
    </button>
  );
}

/** Paise ka card. Ahem raqmein thoRi baRi -- baqi barabar. */
function MoneyCard({
  label,
  value,
  emphasis,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  tone: "green" | "amber" | "neutral";
  onClick: () => void;
  active: boolean;
}) {
  const color = tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : "text-surface-900";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col justify-between rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-brand-300 hover:shadow ${
        active ? "border-brand-500 ring-1 ring-brand-200" : "border-surface-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`font-display font-bold leading-none ${color} ${emphasis ? "text-3xl" : "text-2xl"}`}>
          Rs {value.toLocaleString()}
        </p>
        <ArrowRight className={`mt-1 h-4 w-4 shrink-0 ${active ? "text-brand-600" : "text-surface-300"}`} />
      </div>
      <p className="mt-2 text-sm font-medium text-surface-600">{label}</p>
    </button>
  );
}

function DieselCard({
  label,
  value,
  big,
  onClick,
  active,
}: {
  label: string;
  value: string;
  big?: boolean;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col rounded-2xl border p-4 text-left shadow-sm transition hover:border-brand-300 ${
        active ? "border-brand-500 ring-1 ring-brand-200" : "border-surface-200"
      } ${big ? "bg-white" : "bg-surface-50/60"}`}
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${big ? "bg-blue-50 text-blue-700" : "bg-surface-100 text-surface-500"}`}>
        <Droplets className="h-3.5 w-3.5" />
      </span>
      <p className={`mt-2 font-display font-bold leading-none text-surface-900 ${big ? "text-2xl" : "text-lg"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-surface-500">{label}</p>
    </button>
  );
}

function SeasonRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${strong ? "border-t-2 border-surface-200" : "border-t border-surface-100 first:border-t-0"}`}>
      <span className="text-sm text-surface-600">{label}</span>
      <span className={`font-display font-semibold ${strong ? "text-lg text-brand-700" : "text-sm text-surface-900"}`}>
        {value}
      </span>
    </div>
  );
}

/** Khali hissa bhi banaya hua ho -- sirf ek sookha jumla nahi. */
function EmptyCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-surface-300 bg-white px-4 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100 text-surface-400">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-surface-700">{title}</p>
      <p className="mt-1 text-xs text-surface-500">{text}</p>
    </div>
  );
}

const DRILL_TITLE: Record<string, string> = {
  booked: "Sab bookings",
  done: "Mukammal ho chuki",
  running: "Chal rahi hain",
  pending: "Abhi baqi hain",
  verify: "Tasdeeq ke intezar mein",
  earned: "Jin se kamai bani",
  received: "Jin par paisa mila",
  withArt: "Jin ka paisa baqi hai",
  withFarmer: "Jin ka paisa baqi hai",
  dieselAdvance: "Jin par ART ka diesel laga",
};

/** Card ke peeche ki asal qatarein -- koi naya hisaab nahi, sirf chhantai. */
function DrillBookings({ rows, kind }: { rows: Booking[]; kind: string }) {
  return (
    <div className="mb-4 rounded-card border border-brand-200 bg-brand-50/40 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-700">
        {DRILL_TITLE[kind] ?? "Tafseel"} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="py-2 text-center text-xs text-surface-400">Koi qatar nahi.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs">
              <span className="text-surface-800">
                {b.harvestDate ?? b.bookingDate} — {b.farmerName} — {b.bookedArea ?? 0} acre
                <span className="block text-surface-400">
                  {b.bookingNumber}
                  {b.village ? ` · ${b.village}` : ""}
                  {b.machineLabel ? ` · ${b.machineLabel}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {b.lat !== null && b.lng !== null && (
                  <a
                    href={`https://www.google.com/maps?q=${b.lat},${b.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    Jagah
                  </a>
                )}
                {b.farmerPhone && (
                  <a href={`tel:${b.farmerPhone}`} className="text-brand-600 hover:underline">
                    Call
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DrillWeek({ rows }: { rows: WeekRow[] }) {
  return (
    <div className="mb-4 rounded-card border border-brand-200 bg-brand-50/40 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-700">
        Agle 7 din ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="py-2 text-center text-xs text-surface-400">Agle 7 din mein koi kaam nahi.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((w) => (
            <div key={w.bookingId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs">
              <span className="text-surface-800">
                {w.date ?? "-"} — {w.farmerName} — {w.area} acre
                <span className="block text-surface-400">
                  {w.village ?? w.address ?? ""}
                  {w.machineLabel ? ` · ${w.machineLabel}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {w.lat !== null && w.lng !== null && (
                  <a
                    href={`https://www.google.com/maps?q=${w.lat},${w.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    Jagah
                  </a>
                )}
                {w.farmerPhone && (
                  <a href={`tel:${w.farmerPhone}`} className="text-brand-600 hover:underline">
                    Call
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Commission ki tafseel.
 *
 * Yahan bhi FISAD nahi hai -- na khana, na hisaab. Jis view se ye
 * aata hai (v_machinery_vendor_commission) us mein fisad ka khana hai
 * hi nahi, is liye ghalti se bhi nahi chhap sakta.
 */
function DrillCommission({ rows }: { rows: CommissionRow[] }) {
  return (
    <div className="mb-4 rounded-card border border-brand-200 bg-brand-50/40 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-700">
        ART commission ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="py-2 text-center text-xs text-surface-400">Abhi koi bill nahi bana.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((c) => (
            <div key={c.bookingId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs">
              <span className="text-surface-800">
                {c.bookingNumber} — {c.farmerName}
                <span className="block text-surface-400">
                  {c.date ?? "-"} · verified kaam Rs {c.verifiedWork.toLocaleString()}
                </span>
              </span>
              <span className="font-medium text-surface-900">Rs {c.commission.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DrillDiesel({ rows, kind }: { rows: Booking[]; kind: string }) {
  const label =
    kind === "dieselVendor" ? "Main ne diya" : kind === "dieselFarmer" ? "Kisan ne diya" : kind === "dieselArt" ? "ART ne diya" : "Sab diesel";
  const filtered =
    kind === "dieselFarmer"
      ? rows.filter((b) => b.farmerDiesel > 0)
      : kind === "dieselArt"
        ? rows.filter((b) => b.artDiesel > 0)
        : rows;
  return (
    <div className="mb-4 rounded-card border border-brand-200 bg-brand-50/40 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-700">{label}</p>
      {filtered.length === 0 ? (
        <p className="py-2 text-center text-xs text-surface-400">
          Is qism ka diesel booking ke hisaab se yahan nahi aata — har booking par diesel ka apna indraj us ke card
          par khulta hai.
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs">
              <span className="text-surface-800">
                {b.bookingNumber} — {b.farmerName}
              </span>
              <span className="text-surface-900">
                {kind === "dieselFarmer" && `Rs ${b.farmerDiesel.toLocaleString()}`}
                {kind === "dieselArt" && `Rs ${b.artDiesel.toLocaleString()} (mujh se wapas)`}
                {kind === "dieselAll" &&
                  `kisan Rs ${b.farmerDiesel.toLocaleString()} · ART Rs ${b.artDiesel.toLocaleString()}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row3({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between text-sm ${strong ? "font-medium" : ""}`}>
      <span className="text-surface-600">{label}</span>
      <span className={tone ?? "text-surface-800"}>
        {value < 0 ? `- Rs ${Math.abs(value).toLocaleString()}` : `Rs ${value.toLocaleString()}`}
      </span>
    </div>
  );
}

/**
 * Aane wale saat din.
 *
 * Do tarteebein ek sath, kyunke vendor ke do sawal hain: "kis din
 * kya hai" aur "ek hi taraf kitna kaam hai". Doosra sawal machine ka
 * raasta banata hai -- ek gaon mein chaar khet hon to machine ek
 * dafa jati hai, chaar dafa nahi.
 */
function BookingCard({ booking }: { booking: Booking }) {
  const [open, setOpen] = useState<null | "work" | "closing" | "fuel" | "cash">(null);
  const status = STATUS[booking.status] ?? { label: booking.status, color: "bg-surface-100 text-surface-600" };
  const canSubmitWork = ["ready_for_harvest", "in_progress"].includes(booking.status) && !booking.workDone;

  // Kaam mukammal ho chuka -- magar wo do sawal abhi baqi hain jo sirf
  // vendor jaanta hai. Ye us waqt bhi hota hai jab daftar ke bande ne
  // khud "mukammal" darj kiya ho: tab vendor se kabhi poochha hi nahi
  // jata tha, aur diesel aur kisan ki adaigi us ki yaad mein reh jati
  // thi (182).
  const needsClosing = booking.workDone && !booking.closingDone;

  // Diesel aur kisan se li hui raqam booking ke poore arse mein darj
  // ho sakti hain -- diesel kai dafa parta hai, aur kisan kabhi kabhi
  // kaam ke hafton baad paisa deta hai. Sirf band aur cancel booking
  // par darwaza band.
  const live = !["closed", "cancelled"].includes(booking.status);

  const mapLink =
    booking.lat !== null && booking.lng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${booking.lat},${booking.lng}`
      : null;

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-surface-400">{booking.bookingNumber}</p>
          <p className="font-medium text-surface-900">{booking.farmerName}</p>
          <p className="text-xs text-surface-500">{new Date(booking.bookingDate).toLocaleDateString()}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>{status.label}</span>
      </div>

      {/* Kaam se pehle ki tafseel.
          Ye sab WhatsApp par ek dafa jata hai -- ek dafa. Do din baad
          wo paighaam bees paighaamon ke neeche dab chuka hota hai, aur
          phir vendor phone karta hai aur hamara banda wohi baat dobara
          batata hai. Yahan wo hamesha maujood rehti hai. */}
      <div className="mt-3 space-y-1.5 rounded-lg border border-surface-100 bg-surface-50 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-surface-700">
          {booking.harvestDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-surface-400" />
              {new Date(booking.harvestDate).toLocaleDateString()}
              {booking.harvestTime ? ` — ${booking.harvestTime}` : ""}
            </span>
          )}
          {booking.bookedArea !== null && (
            <span>
              {booking.bookedArea} acre{booking.cropType ? ` — ${booking.cropType}` : ""}
            </span>
          )}
          {booking.machineLabel && <span className="text-surface-500">{booking.machineLabel}</span>}
        </div>

        {/* Rate. Vendor ko ye pehle se maloom hona chahiye -- khet par
            pahunch kar rate poochhna wo jagah hai jahan se jhagRe
            shuru hote hain. */}
        {booking.finalRate !== null && booking.rateFinal && (
          <p className="font-medium text-surface-800">Rate: Rs {booking.finalRate.toLocaleString()} per acre (final)</p>
        )}

        {(booking.locationAddress || booking.village) && (
          <p className="text-surface-600">{[booking.locationAddress, booking.village].filter(Boolean).join(", ")}</p>
        )}

        <div className="flex flex-wrap gap-3 pt-0.5">
          {mapLink && (
            <a
              href={mapLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" /> Khet ka naqsha
            </a>
          )}
          {booking.farmerPhone && (
            <a
              href={`tel:${booking.farmerPhone}`}
              className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" /> {booking.farmerPhone}
            </a>
          )}
        </div>
      </div>

      {/* Paisa.
          Commission ki lakeer yahan JAAN BOOJH KAR nahi hai (malik ka
          faisla). Us ki raqam upar "ART Commission" ke card mein alag
          dikhti hai; fisad vendor ko kahin nahi dikhta.

          "Verified Earning" wo raqam hai jo tasdeeq shuda kaam se bani
          -- commission us mein se pehle hi nikal chuka hai. Is liye
          neeche use dobara ghatana nahi. */}
      {booking.gross !== null && (
        <div className="mt-3 space-y-0.5 border-t border-surface-100 pt-2 text-sm">
          <Row label={`Kaam: ${booking.area} acre × Rs ${(booking.rate ?? 0).toLocaleString()}`} value={booking.gross} />
          <div className="flex justify-between border-t border-surface-100 pt-1 font-medium">
            <span>Aap ki verified earning</span>
            <span>Rs {(booking.payable ?? 0).toLocaleString()}</span>
          </div>
          {booking.farmerDiesel > 0 && (
            <p className="text-xs text-surface-500">
              (Kisan ka Rs {booking.farmerDiesel.toLocaleString()} ka diesel is mein se kat chuka — rate mein diesel
              shamil tha.)
            </p>
          )}
          {booking.artDiesel > 0 && (
            <>
              <Row label="ART ka diesel (adaigi par katega)" value={-booking.artDiesel} />
              <div className="flex justify-between border-t border-surface-100 pt-1 font-medium">
                <span>Net vendor earning</span>
                <span>Rs {Math.max((booking.payable ?? 0) - booking.artDiesel, 0).toLocaleString()}</span>
              </div>
            </>
          )}
          {booking.paid > 0 && <Row label="Aap ko mila" value={-booking.paid} />}
          <div className="flex justify-between font-display font-semibold">
            <span>Baqi</span>
            <span className={booking.outstanding > 0 ? "text-amber-700" : "text-brand-700"}>
              Rs {Math.max(booking.outstanding - booking.artDiesel, 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {booking.claimed > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Aap ka bheja hua kaam AgriBridge ki tasdeeq ke intezar mein hai. Tasdeeq ke baad hi wo bill ka hissa banega.
        </p>
      )}

      {booking.rejected.map((r) => (
        <p key={r.id} className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
          Ek indraj rad hua: {r.rejection_reason ?? "wajah nahi likhi"}
        </p>
      ))}

      {(booking.reachedAt || booking.startedAt) && (
        <p className="mt-2 text-xs text-surface-500">
          {booking.reachedAt && `Pahuncha: ${new Date(booking.reachedAt).toLocaleString()}`}
          {booking.reachedAt && booking.startedAt && " · "}
          {booking.startedAt && `Kaam shuru: ${new Date(booking.startedAt).toLocaleString()}`}
        </p>
      )}

      {booking.fuelClaimed > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Diesel ka {booking.fuelClaimed} indraj tasdeeq ke intezar mein hai.
        </p>
      )}

      {booking.fuelRejected.map((r) => (
        <p key={r.id} className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
          Diesel ka ek indraj rad hua: {r.rejection_reason ?? "wajah nahi likhi"}
        </p>
      ))}

      {/* Kisan se li hui raqam -- apna bheja hua indraj saamne rehna
          chahiye, warna vendor samajhta hai ke gaya hi nahi aur dobara
          bhejta hai. */}
      {booking.collections.map((c) => (
        <p
          key={c.id}
          className={`mt-2 rounded-lg px-2 py-1 text-xs ${
            c.status === "verified"
              ? "bg-brand-50 text-brand-800"
              : c.status === "rejected"
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          Kisan se Rs {c.amount.toLocaleString()} ({new Date(c.date).toLocaleDateString()}) —{" "}
          {c.settlement === "kept" ? "aap ne rakhe" : "hamein de rahe hain"} —{" "}
          {c.status === "verified"
            ? "tasdeeq ho gayi"
            : c.status === "rejected"
              ? `rad: ${c.reason ?? "wajah nahi likhi"}`
              : "tasdeeq baqi"}
        </p>
      ))}

      {live && (
        <div className="mt-3">
          {open === null ? (
            <div className="flex flex-wrap gap-2">
              {/* Do khabrein jo kisi hisaab par asar nahi daalteen,
                  magar jin ke bina kisan ke phone ka jawab nahi hota:
                  "machine pahunchi ya nahi". Ek dafa lag jane ke baad
                  button hat jata hai -- dobara lagne se waqt badal
                  jata aur "kab pahunche the" ka jawab har dafa naya
                  hota. */}
              {!booking.reachedAt && (
                <ProgressButton bookingId={booking.id} step="reached" label="Khet pahunch gaya" />
              )}
              {booking.reachedAt && !booking.startedAt && (
                <ProgressButton bookingId={booking.id} step="started" label="Kaam shuru" />
              )}
              {canSubmitWork && (
                <button
                  onClick={() => setOpen("work")}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Kattai ki tafseel bhejein
                </button>
              )}
              {needsClosing && (
                <button
                  onClick={() => setOpen("closing")}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Kattai mukammal — do sawal baqi
                </button>
              )}
              <button
                onClick={() => setOpen("fuel")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700"
              >
                <Fuel className="h-4 w-4" /> Diesel darj karein
              </button>
              <button
                onClick={() => setOpen("cash")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700"
              >
                <HandCoins className="h-4 w-4" /> Kisan ne paisa diya
              </button>
            </div>
          ) : open === "work" ? (
            <WorkForm bookingId={booking.id} harvestType={booking.harvestType} onClose={() => setOpen(null)} />
          ) : open === "closing" ? (
            <ClosingForm bookingId={booking.id} onClose={() => setOpen(null)} />
          ) : open === "fuel" ? (
            <FuelForm bookingId={booking.id} onClose={() => setOpen(null)} />
          ) : (
            <CollectionForm bookingId={booking.id} onClose={() => setOpen(null)} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Diesel ka indraj.
 *
 * "Kis ne dala" sab se ahem sawal hai aur sab se aasani se bhoola
 * jata hai. Kisan ne apne paise se dala ho aur hum us ka kharcha
 * likh lein, to wo raqam do dafa gin li jati hai -- ek dafa diesel
 * ke kharche mein aur ek dafa bill mein.
 */
function FuelForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [state, action] = useFormState(submitVendorFuel, initialState);
  const [litres, setLitres] = useState("");
  const [rate, setRate] = useState("");
  const total = Number(litres) > 0 && Number(rate) > 0 ? Number(litres) * Number(rate) : null;

  if (state.success) {
    return <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.notice}</p>;
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-surface-200 p-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      {state.error && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Tareekh">
          <input type="date" name="log_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </Field>
        <Field label="Kitne litre *">
          <input
            type="number"
            step="0.01"
            name="litres"
            required
            value={litres}
            onChange={(e) => setLitres(e.target.value)}
            className="w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
        </Field>
      </div>

      <Field label="Us din ka rate per litre (Rs) *">
        <input
          type="number"
          step="0.01"
          name="rate_per_litre"
          required
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-full rounded-lg border border-surface-200 p-2 text-sm"
        />
      </Field>

      {/* Raqam dikhti hai magar bhari nahi jati -- wo litre aur rate
          se khud banti hai. */}
      {total !== null && (
        <p className="rounded-lg bg-surface-50 px-3 py-2 text-sm">
          {litres} × Rs {rate} = <strong>Rs {total.toLocaleString()}</strong>
        </p>
      )}

      <Field label="Kis ne dala? *">
        <select name="paid_by" required defaultValue="" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">—</option>
          <option value="farmer">Kisan ne</option>
          <option value="vendor">Main ne (vendor)</option>
          <option value="company">Al Rana Traders ne</option>
        </select>
      </Field>

      <Field label="Koi baat (marzi se)">
        <input name="notes" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </Field>

      <p className="text-xs text-surface-500">
        Tasdeeq ke baad hi ye hisaab mein aayega. Diesel jitni dafa dala jaye, utni dafa darj karein.
      </p>

      <div className="flex gap-2">
        <Submit />
        <button type="button" onClick={onClose} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500">
          Rehne dein
        </button>
      </div>
    </form>
  );
}

/**
 * Kisan ne mujhe paisa diya.
 *
 * Doosra sawal us pehle jitna hi ahem hai: wo paisa aap ne apne hisse
 * mein rakh liya, ya hamein de rahe hain? Hisaab mein ye do bilkul
 * alag baatein hain, aur baad mein poochho to kisi ko theek yaad
 * nahi rehta.
 */
function CollectionForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [state, action] = useFormState(submitVendorCollection, initialState);

  if (state.success) {
    return <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.notice}</p>;
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-surface-200 p-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      {state.error && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Kitna diya (Rs) *">
          <input type="number" step="0.01" name="amount" required className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </Field>
        <Field label="Kab diya">
          <input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </Field>
      </div>

      <Field label="Us paise ka kya kiya? *">
        <select name="settlement" required defaultValue="" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">—</option>
          <option value="kept">Apne hisse mein rakh liya</option>
          <option value="handed_over">Al Rana Traders ko de raha hoon</option>
        </select>
      </Field>

      <Field label="Koi nishani (marzi se)">
        <input name="reference" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </Field>

      <p className="text-xs text-surface-500">
        Ye abhi sirf aap ki baat hai — tasdeeq ke baad hi kisan ka baqi kam hoga.
      </p>

      <div className="flex gap-2">
        <Submit />
        <button type="button" onClick={onClose} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500">
          Rehne dein
        </button>
      </div>
    </form>
  );
}

/**
 * Ek khabar, ek button.
 *
 * Koi form nahi, koi tareekh nahi, koi tafseel nahi -- kyunke ye
 * khabar khet par khare ho kar, ek haath se, dhoop mein di jati hai.
 * Waqt khud lag jata hai.
 */
function ProgressButton({ bookingId, step, label }: { bookingId: string; step: "reached" | "started"; label: string }) {
  const [state, action] = useFormState(markVendorProgress, initialState);
  const { pending } = useFormStatus();

  if (state.success) {
    return <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">{state.notice}</p>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="step" value={step} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-60"
      >
        <MapPin className="h-4 w-4" /> {label}
      </button>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-surface-600">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-surface-600">
      <span>{label}</span>
      <span>{value < 0 ? `- Rs ${Math.abs(value).toLocaleString()}` : `Rs ${value.toLocaleString()}`}</span>
    </div>
  );
}

function WorkForm({
  bookingId,
  harvestType,
  onClose,
}: {
  bookingId: string;
  harvestType: string | null;
  onClose: () => void;
}) {
  const [state, action] = useFormState(submitVendorWork, initialState);

  // Do qism ki booking par batwara wahin poochha jata hai (176). Baad
  // mein daftar ke bande ko yaad nahi hoga ke us din kitna sabit tha
  // aur kitna kutra -- aur yehi wo adad hai jis par bill banta hai.
  const isDono = harvestType === "dono";
  const [acres, setAcres] = useState("");
  // Kaam khatam hone par poochhe jane wale do sawal. Wo sawal ab
  // EndOfWorkQuestions ke paas hain -- kyunke kaam daftar ka banda darj
  // kar de tab bhi yehi sawal poochhe jate hain (182).
  const [isFinal, setIsFinal] = useState(false);
  const [kanal, setKanal] = useState("");
  const [sabit, setSabit] = useState("");
  const [kutra, setKutra] = useState("");
  const total = Math.round(((Number(acres) || 0) + (Number(kanal) || 0) / 8) * 10000) / 10000;
  const splitSum = Math.round(((Number(sabit) || 0) + (Number(kutra) || 0)) * 10000) / 10000;
  const splitOk = total > 0 && Math.round(splitSum * 10000) === Math.round(total * 10000);

  if (state.success) {
    return (
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{state.notice}</p>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-surface-200 p-3">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-xs text-surface-500">
        Jo WAQAI kaata gaya wohi likhein. AgriBridge ki team ise dekh kar tasdeeq karegi — tasdeeq ke baad hi ye bill
        mein aayega.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-surface-600">Kaam ki tareekh</label>
          <input
            type="date"
            name="work_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">Meter / ghante</label>
          <input type="number" step="0.01" name="meter_reading" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">Kitne acre</label>
          <input
            type="number"
            step="0.01"
            name="actual_area_acres"
            value={acres}
            onChange={(e) => setAcres(e.target.value)}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">Kanal</label>
          <input
            type="number"
            step="0.01"
            name="actual_area_kanal"
            value={kanal}
            onChange={(e) => setKanal(e.target.value)}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
        </div>
      </div>

      {isDono && (
        <div className="space-y-2 rounded-lg border border-surface-200 p-3">
          <p className="text-xs text-surface-500">
            Is booking mein dono qism hain — Sabit Parali aur Kutra alag alag likhein.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-surface-600">Sabit Parali ke acre</label>
              <input
                type="number"
                step="0.01"
                name="sabit_area"
                value={sabit}
                onChange={(e) => setSabit(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600">Kutra ke acre</label>
              <input
                type="number"
                step="0.01"
                name="kutra_area"
                value={kutra}
                onChange={(e) => setKutra(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
              />
            </div>
          </div>
          <p className={splitOk ? "text-xs text-green-700" : "text-xs text-amber-700"}>
            Jor: {splitSum} / {total} acre — {splitOk ? "theek hai" : "kul acre ke barabar hona chahiye"}
          </p>
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-surface-600">Kuch aur batana ho</label>
        <input name="notes" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
      </div>
      <label className="flex items-start gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 p-3 text-sm">
        <input
          type="checkbox"
          name="is_final"
          checked={isFinal}
          onChange={(e) => setIsFinal(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="font-medium text-surface-900">Kaam poora ho gaya</span>
          <span className="block text-xs text-surface-500">
            Sirf aakhri din nishaan lagayein. Kaam kai din chale to har din ka alag indraj bhejein.
          </span>
        </span>
      </label>

      {/* Kaam khatam hone par baqi do sawal.
          Ye dono cheezein alag buttonon se bhi darj ho sakti hain, magar
          wahin se bhool paida hoti thi: vendor kaam darj kar ke chala
          jata aur diesel ya kisan se li hui raqam kabhi darj hi na
          hoti. Ab wo aakhri lamhe mein poochhe jate hain -- jab vendor
          abhi khet par khaRa hai aur sach us ke saamne hai. */}
      {isFinal && <EndOfWorkQuestions />}
      <div className="flex gap-2">
        <Submit />
        <button type="button" onClick={onClose} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500">
          Rehne dein
        </button>
      </div>
    </form>
  );
}

/**
 * Kaam ke baad ke do sawal.
 *
 * Ye alag component is liye hai ke inhen do jagah poochha jata hai:
 * jab vendor khud kaam mukammal darj karta hai, aur jab kaam pehle hi
 * mukammal ho chuka ho (aksar daftar ke bande ne darj kiya) magar in
 * ka jawab kisi ne nahi diya. Dono jagah sawal, alfaz aur khanon ke
 * naam bilkul aik jaise rehne chahiyen -- warna do form do alag
 * kahaniyan bataney lagte hain.
 *
 * Diesel ki raqam haath se nahi likhi jati -- litre aur rate se khud
 * banti hai. Wahi jagah hai jahan ek sifar zyada lag jata hai.
 */
function EndOfWorkQuestions() {
  const [diesel, setDiesel] = useState("");
  const [dLitres, setDLitres] = useState("");
  const [dRate, setDRate] = useState("");
  const [paid, setPaid] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const dieselAmount = Math.round((Number(dLitres) || 0) * (Number(dRate) || 0));

  return (
    <div className="space-y-3 rounded-lg border border-surface-200 bg-surface-50/60 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Jane se pehle do baatein</p>

      <div>
        <p className="text-sm font-medium text-surface-800">Kisan ne diesel dala?</p>
        <div className="mt-1.5 flex gap-1.5">
          <Choice on={diesel === "haan"} onClick={() => setDiesel("haan")}>Haan</Choice>
          <Choice on={diesel === "nahi"} onClick={() => setDiesel("nahi")}>Nahi</Choice>
        </div>
        <input type="hidden" name="farmer_diesel" value={diesel} />
        {diesel === "haan" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-surface-600">Kitne litre</label>
              <input
                type="number"
                step="0.01"
                name="farmer_diesel_litres"
                value={dLitres}
                onChange={(e) => setDLitres(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600">Rate per litre</label>
              <input
                type="number"
                step="0.01"
                name="farmer_diesel_rate"
                value={dRate}
                onChange={(e) => setDRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
              />
            </div>
            {dieselAmount > 0 && (
              <p className="col-span-2 text-xs text-surface-500">
                {dLitres} × {dRate} = <strong>Rs {dieselAmount.toLocaleString()}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-surface-200 pt-3">
        <p className="text-sm font-medium text-surface-800">Kisan ne paisa diya?</p>
        <div className="mt-1.5 flex gap-1.5">
          <Choice on={paid === "haan"} onClick={() => setPaid("haan")}>Haan</Choice>
          <Choice on={paid === "nahi"} onClick={() => setPaid("nahi")}>Nahi — udhaar hai</Choice>
        </div>
        <input type="hidden" name="farmer_paid" value={paid} />
        {paid === "haan" && (
          <div className="mt-2">
            <label className="text-xs font-medium text-surface-600">Kitni raqam</label>
            <input
              type="number"
              step="0.01"
              name="farmer_paid_amount"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            />
            <p className="mt-1 text-xs text-surface-500">
              Ye paisa abhi aap ke paas hai. Jab AgriBridge ko dein to us ka apna qadam hai.
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-surface-400">
        Dono jawab tasdeeq ke liye jate hain — tasdeeq se pehle kisi hisaab mein shamil nahi hote.
      </p>
    </div>
  );
}

/**
 * Kaam mukammal ho chuka, magar do sawal baqi hain.
 *
 * Kaam ka indraj yahan dobara NAHI khulta -- do final indraj verified
 * ho jayen to raqba do dafa gina jata aur bill do guna ban jata hai.
 * Yahan sirf wo do baatein poochhi jati hain jo sirf vendor jaanta hai.
 *
 * "Nahi" bhi jawab hai: us ke baghair ye sawal har dafa saamne aate
 * rehte, aur vendor sawal khatam karne ke liye jhoota "haan" likh deta.
 */
function ClosingForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [state, action] = useFormState(submitVendorClosing, initialState);

  if (state.success) {
    return <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{state.notice}</p>;
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-xs text-surface-600">
        Is booking ka kaam mukammal darj ho chuka hai. Do baatein sirf aap jaante hain — bataye baghair bill adhoora
        rehta hai.
      </p>
      <EndOfWorkQuestions />
      <div className="flex gap-2">
        <Submit />
        <button type="button" onClick={onClose} className="rounded-lg border border-surface-200 px-3 text-sm text-surface-500">
          Abhi nahi
        </button>
      </div>
    </form>
  );
}

/** Haan/Nahi ka chhota sa button -- do jawab, aur koi teesra nahi. */
function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-surface-700 ring-1 ring-surface-200 hover:bg-surface-50"
      }
    >
      {children}
    </button>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Bhej raha hai..." : "Bhejein"}
    </button>
  );
}
