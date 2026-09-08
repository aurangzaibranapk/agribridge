"use client";
import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Check, X, Plus, Paperclip, Info, Wallet, ExternalLink, HardHat } from "lucide-react";
import { kharchaDarj, kharchaManzoor, kharchaVerify, kharchaRadd, type ActionState } from "@/actions/kharche";
import { mazdooriDarj, mazdooriManzoor, mazdooriRadd, bandeKaHaal } from "@/actions/mazdoori";
import {
  KHARCHA_QISMEIN,
  PAISA_KHAANE,
  BILL_QISMEIN,
  BANDE_KI_QISMEIN,
  APNI_QISM,
  HALAT_LABEL,
  qismDhoondein,
} from "@/lib/kharche";

interface Qatar {
  id: string;
  expense_number: string;
  kind: string;
  category: string | null;
  categoryLabel: string;
  amount: number;
  description: string;
  status: string;
  rejection_reason: string | null;
  party_type: string | null;
  party_id: string | null;
  party_name: string | null;
  document_url: string | null;
  expense_date: string;
  paid_from_account_id: string | null;
  created_at: string;
}

interface Banda {
  id: string;
  naam: string;
}

interface MazdooriQatar {
  id: string;
  entry_number: string;
  party_type: string;
  party_id: string;
  work_date: string;
  work_detail: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number;
  advance_adjusted: number;
  payable_added: number;
  received_by_name: string | null;
  status: string;
  rejection_reason: string | null;
}

const KHALI: ActionState = {};

function Dabao({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "khali" | "laal" | "hara";
}) {
  const { pending } = useFormStatus();
  const rang =
    tone === "brand"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "hara"
        ? "border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-surface-700 dark:hover:bg-surface-800"
        : tone === "laal"
          ? "border border-red-200 text-red-700 hover:bg-red-50 dark:border-surface-700 dark:hover:bg-surface-800"
          : "border border-surface-200 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800";
  return (
    <button type="submit" disabled={pending} className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${rang}`}>
      {pending ? "..." : children}
    </button>
  );
}

/**
 * Kharche ka safha.
 *
 * Form ki tarteeb jaan boojh kar aise hai: pehle QISM, phir baqi sab.
 * Qism hi tay karti hai ke banda chunna zaroori hai ya nahi, aur us ka
 * asar kya hoga -- wo asar qism ke neeche usi waqt likha aa jata hai,
 * bhejne ke baad nahi. Bhejne ke baad batana der ho chuki hoti hai.
 */
export function KharcheClient({
  rows,
  mazdooriRows,
  khaate,
  bande,
  naamMap,
  khataNaam,
  darjKarSakta,
  manzoorKarSakta,
  taseeqKarSakta,
  showCompanyBalances = true,
}: {
  rows: Qatar[];
  mazdooriRows: MazdooriQatar[];
  khaate: { id: string; name: string; gl_code: string | null; balance: number }[];
  bande: Record<string, Banda[]>;
  naamMap: Record<string, string>;
  khataNaam: Record<string, string>;
  darjKarSakta: boolean;
  manzoorKarSakta: boolean;
  /** Branch Manager: sirf apni branch ki tasdeeq -- final manzoori nahi. */
  taseeqKarSakta: boolean;
  /**
   * Shop par baithe staff ko company ka combined balance nahi dikhana
   * (malik, 8 September) -- us ki apni shop ka hisaab safhe ke upar
   * alag se dikhta hai. Dropdown ke liye `khaate` phir bhi chahiye
   * (paid_from_account_id chunne ke liye), sirf ye strip chhupti hai.
   */
  showCompanyBalances?: boolean;
}) {
  const [darjState, darjAction] = useFormState(kharchaDarj, KHALI);
  const [manzoorState, manzoorAction] = useFormState(kharchaManzoor, KHALI);
  const [taseeqState, taseeqAction] = useFormState(kharchaVerify, KHALI);
  const [raddState, raddAction] = useFormState(kharchaRadd, KHALI);

  const [mazdoorDarjState, mazdoorDarjAction] = useFormState(mazdooriDarj, KHALI);
  const [mazdoorManzoorState, mazdoorManzoorAction] = useFormState(mazdooriManzoor, KHALI);
  const [mazdoorRaddState, mazdoorRaddAction] = useFormState(mazdooriRadd, KHALI);

  const [khula, setKhula] = useState(false);
  /**
   * Ooper paanch khaane — malik ka apna naqsha.
   *
   * *"Paisa Diya | Paisa Mila | Udhaar | Mazdoori | Kharcha"* — aur
   * "Mazdoori" chunne par form badal jata hai, kyunke us mein cash hilta
   * hi nahi: wahan sirf kaam darj hota hai (ginti aur rate ke sath) aur
   * kharcha us DIN banta hai. Baqi chaar khaanon mein paisa hilta hai,
   * is liye wahan khata poochha jata hai.
   */
  const [khaana, setKhaana] = useState<string>("kharcha");
  const [kind, setKind] = useState("kharcha");
  const [category, setCategory] = useState("tea_food");
  const [bandeKiQism, setBandeKiQism] = useState<string>("staff");
  const [raddKaunsa, setRaddKaunsa] = useState<string | null>(null);

  // Mazdoori ka form
  const [mBanda, setMBanda] = useState("");
  const [mQism, setMQism] = useState("farmer");
  const [mGinti, setMGinti] = useState("");
  const [mRate, setMRate] = useState("");
  const [mHaal, setMHaal] = useState<{ advanceBaqi: number; denaBaqi: number } | null>(null);

  useEffect(() => {
    let ruk = false;
    if (!mBanda) {
      setMHaal(null);
      return;
    }
    bandeKaHaal(mQism, mBanda).then((h) => {
      if (!ruk) setMHaal(h);
    });
    return () => {
      ruk = true;
    };
  }, [mQism, mBanda]);

  const mRaqam = useMemo(() => {
    const g = Number(mGinti);
    const r = Number(mRate);
    if (Number.isFinite(g) && Number.isFinite(r) && g > 0 && r > 0) return Math.round(g * r * 100) / 100;
    return null;
  }, [mGinti, mRate]);

  const qism = useMemo(() => qismDhoondein(kind), [kind]);

  // Jis qism ka apna khata banta hai, wahan banda usi fehrist se aata
  // hai -- chunne ka mauqa hi nahi dena chahiye ke kisan ka advance
  // staff ke khate mein chala jaye.
  const bandhiQism = qism?.bandaKahanSe ?? null;
  const bandaZaroori = qism?.bandaZaroori === true;
  const chaliQism = bandhiQism ?? bandeKiQism;
  const fehrist = bande[chaliQism] ?? [];

  const paighaam =
    darjState.message ??
    manzoorState.message ??
    taseeqState.message ??
    raddState.message ??
    mazdoorDarjState.message ??
    mazdoorManzoorState.message ??
    mazdoorRaddState.message;
  const kharabi =
    darjState.error ??
    manzoorState.error ??
    taseeqState.error ??
    raddState.error ??
    mazdoorDarjState.error ??
    mazdoorManzoorState.error ??
    mazdoorRaddState.error;

  function bandeKaNaam(r: Qatar) {
    if (r.party_id && naamMap[r.party_id]) return naamMap[r.party_id];
    if (r.party_name) return r.party_name;
    return "—";
  }

  /**
   * Qismein malik ke paanch khaanon mein.
   *
   * Malik (6 September): *"Staff ko debit/credit, receivable/payable
   * jaise accounting terms nahi dikhayenge."* Is liye ooper wale naam
   * "Paisa Diya / Paisa Mila / Udhaar / Mazdoori / General Kharcha"
   * hain, aur asal qism un ke andar chunni parti hai.
   */
  const khaanoMein = PAISA_KHAANE.map((kh) => ({
    ...kh,
    qismein: KHARCHA_QISMEIN.filter((q) => q.khaana === kh.value),
  }));

  // Khaana badalte hi us khaane ki pehli qism chun li jati hai -- warna
  // banda "Paisa Mila" chun kar bhi "Kharcha" bhejta rehta.
  function khaanaChunein(value: string) {
    setKhaana(value);
    const pehli = KHARCHA_QISMEIN.find((q) => q.khaana === value);
    if (pehli) setKind(pehli.value);
  }

  const isMazdoori = khaana === "mazdoori";

  // Manzoori ke intezar mein kitna paisa hai -- dono jagah ka.
  const intezarKiRaqam =
    rows.filter((r) => r.status === "pending").reduce((s2, r) => s2 + r.amount, 0) +
    mazdooriRows.filter((r) => r.status === "pending").reduce((s2, r) => s2 + r.amount, 0);

  return (
    <div className="mt-6 space-y-4">
      {paighaam && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-surface-800 dark:bg-surface-900 dark:text-emerald-300">
          {paighaam}
        </p>
      )}
      {kharabi && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-surface-800 dark:bg-surface-900 dark:text-red-300">
          {kharabi}
        </p>
      )}

      {/*
        Har khate ka LIVE balance.

        Malik (6 September): *"wo realtime shop ke balance ke sath
        chalega."*

        Ye adad `finance_accounts.current_balance` se aata hai, jo SIRF
        Cash Book se banta hai (127) -- yani wohi adad jo Finance ke safhe
        par nazar aata hai. Do jagah alag hisaab lagane se ek din do alag
        jawab aa jate hain.

        Ek baat saaf likhi hui hai: ye khate poori company ke hain, har
        dukan ke apne nahi. Chhupa dene se dukan par baitha banda samajhta
        ke ye us ki apni golak hai.
      */}
      {showCompanyBalances && (
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
          <Wallet className="h-3.5 w-3.5" /> Is waqt khaton mein
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {khaate.map((k) => (
            <span key={k.id} className="text-sm">
              <span className="text-surface-500">{k.name}</span>{" "}
              <b className="tabular-nums text-surface-900 dark:text-surface-100">
                Rs {Math.round(k.balance).toLocaleString()}
              </b>
            </span>
          ))}
          {khaate.length === 0 && <span className="text-sm text-surface-400">Koi khata darj nahi.</span>}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-surface-400">
          Ye khate poori company ke hain, har dukan ke apne nahi. Manzoori ke baad hi ye adad hilte hain —
          {intezarKiRaqam > 0 ? (
            <>
              {" "}
              abhi Rs {Math.round(intezarKiRaqam).toLocaleString()} manzoori ke intezar mein hai.
            </>
          ) : (
            " abhi kuch intezar mein nahi."
          )}
        </p>
      </div>
      )}

      {darjKarSakta && (
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              Naya darj karein
            </h2>
            <button
              type="button"
              onClick={() => setKhula((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {khula ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {khula ? "Band karein" : "Naya darj karein"}
            </button>
          </div>

          {khula && (
            <>
              {/* Paanch khaane — malik ka apna naqsha */}
              <div className="mt-4 flex flex-wrap gap-2">
                {khaanoMein.map((kh) => (
                  <button
                    key={kh.value}
                    type="button"
                    onClick={() => khaanaChunein(kh.value)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                      khaana === kh.value
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-surface-800 dark:text-emerald-300"
                        : "border-surface-200 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
                    }`}
                  >
                    <span className="block font-medium">{kh.label}</span>
                    <span className="block text-[11px] text-surface-400">{kh.tafseel}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {khula && isMazdoori && (
            /* ---------------- MAZDOORI ---------------- */
            <form action={mazdoorDarjAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <p className="sm:col-span-2 flex items-start gap-1.5 rounded-lg bg-sky-50 p-2 text-xs text-sky-800 dark:bg-surface-800 dark:text-sky-300">
                <HardHat className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Yahan cash nahi hilta — sirf kaam darj hota hai. Purana advance is mein se KHUD adjust ho jata hai;
                jo bacha wo us bande ko dena ban jata hai.
              </p>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Fehrist</span>
                <select
                  name="party_type"
                  value={mQism}
                  onChange={(e) => {
                    setMQism(e.target.value);
                    setMBanda("");
                  }}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                >
                  {BANDE_KI_QISMEIN.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  Kis ne kaam kia
                </span>
                <select
                  name="party_id"
                  required
                  value={mBanda}
                  onChange={(e) => setMBanda(e.target.value)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                >
                  <option value="">— chunein —</option>
                  {(bande[mQism] ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.naam}
                    </option>
                  ))}
                </select>
              </label>

              {mBanda && (
                <div className="sm:col-span-2 flex flex-wrap items-center gap-4 rounded-lg bg-surface-50 p-3 text-xs dark:bg-surface-800">
                  {mHaal === null ? (
                    <span className="text-surface-400">Is ka haal parha ja raha hai...</span>
                  ) : (
                    <>
                      <span className="text-surface-600 dark:text-surface-400">
                        Advance baqi:{" "}
                        <b className="tabular-nums text-surface-900 dark:text-surface-100">
                          Rs {mHaal.advanceBaqi.toLocaleString()}
                        </b>
                      </span>
                      <span className="text-surface-600 dark:text-surface-400">
                        Is ko dena:{" "}
                        <b className="tabular-nums text-surface-900 dark:text-surface-100">
                          Rs {mHaal.denaBaqi.toLocaleString()}
                        </b>
                      </span>
                      <Link
                        href={`/admin/khata/banda/${mQism}/${mBanda}`}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Poora khata <ExternalLink className="h-3 w-3" />
                      </Link>
                      {mRaqam != null && mHaal.advanceBaqi > 0 && (
                        <span className="w-full text-emerald-700 dark:text-emerald-400">
                          Is mein se Rs {Math.min(mHaal.advanceBaqi, mRaqam).toLocaleString()} purane advance mein se
                          adjust hoga; Rs {Math.max(mRaqam - mHaal.advanceBaqi, 0).toLocaleString()} dena banega.
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Kaam kya tha</span>
                <input
                  name="work_detail"
                  required
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  placeholder="jaise: 150 khaad ki boriyan unloading"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Tareekh</span>
                <input
                  name="work_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Ginti</span>
                <span className="flex gap-2">
                  <input
                    name="quantity"
                    type="number"
                    step="0.001"
                    value={mGinti}
                    onChange={(e) => setMGinti(e.target.value)}
                    className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    placeholder="100"
                  />
                  <input
                    name="unit"
                    className="w-24 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    placeholder="bori"
                  />
                </span>
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Rate (Rs)</span>
                <input
                  name="rate"
                  type="number"
                  step="0.01"
                  value={mRate}
                  onChange={(e) => setMRate(e.target.value)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  placeholder="20"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Mazdoori (Rs)</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  value={mRaqam ?? ""}
                  readOnly={mRaqam != null}
                  onChange={() => {}}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm read-only:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:read-only:bg-surface-800"
                  placeholder="Ginti × rate se khud ban jayegi"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  Lene wala koi aur ho to
                </span>
                <input
                  name="received_by_name"
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  placeholder="jaise: Ali (beta)"
                />
              </label>

              <div className="sm:col-span-2">
                <Dabao>Bhejein (manzoori ke liye)</Dabao>
              </div>
            </form>
          )}

          {khula && !isMazdoori && (
            <form action={darjAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* 1) QISM — is khaane ki */}
              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  Ye kya hai?
                </span>
                <select
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                >
                  {(khaanoMein.find((kh) => kh.value === khaana)?.qismein ?? []).map((q) => (
                    <option key={q.value} value={q.value}>
                      {q.label}
                    </option>
                  ))}
                </select>
                {qism && (
                  <span
                    className={`mt-2 flex items-start gap-1.5 rounded-lg p-2 text-xs ${
                      qism.asalKharcha
                        ? "bg-red-50 text-red-800 dark:bg-surface-800 dark:text-red-300"
                        : "bg-sky-50 text-sky-800 dark:bg-surface-800 dark:text-sky-300"
                    }`}
                  >
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {qism.asar}
                  </span>
                )}
              </label>

              {/* 2) KAUN LE GAYA */}
              <div className="sm:col-span-2 rounded-lg border border-surface-100 p-3 dark:border-surface-800">
                <p className="mb-2 text-sm font-medium text-surface-700 dark:text-surface-300">
                  Kaun le gaya / kis se aaya?
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs text-surface-500">
                    <span className="mb-1 block">Kis fehrist se</span>
                    <select
                      name="party_type"
                      value={chaliQism}
                      disabled={bandhiQism != null}
                      onChange={(e) => setBandeKiQism(e.target.value)}
                      className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:opacity-60 dark:border-surface-700 dark:bg-surface-900"
                    >
                      {BANDE_KI_QISMEIN.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-surface-500">
                    <span className="mb-1 block">Naam (fehrist se)</span>
                    <select
                      name="party_id"
                      required
                      defaultValue=""
                      className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    >
                      <option value="">— chunein —</option>
                      {fehrist.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.naam}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {/*
                  Naam ka khali khana yahan se HAT gaya.

                  Malik (6 September): *"Jo paisa le gaya us ka registered
                  hona lazmi hai. Us ke ledger, finance ledger, money
                  trail — sab par aana chahiye."*

                  Wajah unhon ne khud batayi: ledger sirf ID pehchanta
                  hai, naam nahi. Naam likh kar chhorne se wo qatar us
                  bande ke khaate mein KABHI nazar nahi aati.
                */}
                <p className="mt-3 text-[11px] leading-snug text-surface-400">
                  Jo fehrist mein nahi, usay pehle darj karein —{" "}
                  <Link href="/admin/farmers" className="text-emerald-700 hover:underline dark:text-emerald-400">
                    Farmers / Membership
                  </Link>{" "}
                  ya{" "}
                  <Link href="/admin/crm" className="text-emerald-700 hover:underline dark:text-emerald-400">
                    Customers
                  </Link>
                  . Ek dafa ka kaam hai; us ke baad us ka poora hisaab khud jurta rehta hai.
                </p>
                {/*
                  Naam likhna aur khata banna do alag baatein hain -- aur
                  ye baat form par likhi hui hai, warna banda samajhta hai
                  ke har naam par udhaar chadh raha hai.
                */}
                <p className="mt-2 text-[11px] leading-snug text-surface-400">
                  {bandhiQism
                    ? `Is qism ke liye banda ${bandhiQism} ki fehrist se chunein — us ka khata usi fehrist se juda hua hai.`
                    : "Wohi banda kisan bhi ho sakta hai, customer bhi aur mazdoor bhi — ID ek hi rehti hai, is liye fehrist koi bhi chunein."}
                </p>
              </div>

              {/* 3) QISM (bill ki) + apni qism */}
              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Kis cheez ka</span>
                <select
                  name="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                >
                  {BILL_QISMEIN.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>

              {category === APNI_QISM ? (
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                    Apni qism ka naam
                  </span>
                  <input
                    name="category_apni"
                    required
                    className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    placeholder="jaise: nehar ki safai"
                  />
                  <span className="mt-1 block text-[11px] text-surface-400">
                    Yehi naam qism ban kar mehfooz hoga — agli dafa report mein apni alag qatar bana lega.
                  </span>
                </label>
              ) : (
                <div className="hidden sm:block" />
              )}

              {/* 4) Raqam aur tareekh */}
              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Raqam (Rs)</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Tareekh</span>
                <input
                  name="expense_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
                <span className="mt-1 block text-[11px] text-surface-400">
                  Wo din likhein jis din kharcha hua — darj karne ka din nahi.
                </span>
              </label>

              {/* 5) Khata */}
              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  Paisa kis khate se
                </span>
                <select
                  name="paid_from_account_id"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                >
                  <option value="">— chunein —</option>
                  {khaate.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} — Rs {Math.round(k.balance).toLocaleString()}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-surface-400">
                  Is ke baghair Finance ke safhe par khate ka adad nahi hilta.
                </span>
              </label>

              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Tafseel</span>
                <input
                  name="description"
                  required
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  placeholder="jaise: dukan ke generator ka diesel"
                />
              </label>

              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  Raseed ki tasveer (marzi)
                </span>
                <input
                  name="document"
                  type="file"
                  accept="image/*,.pdf"
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
              </label>

              <div className="sm:col-span-2">
                <Dabao>Bhejein (manzoori ke liye)</Dabao>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Mazdoori ki qatarein — usi tag ke andar */}
      {mazdooriRows.length > 0 && (
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <HardHat className="h-4 w-4 text-surface-400" /> Mazdoori ({mazdooriRows.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500 dark:border-surface-800">
                  <th className="py-2 pr-3">Tareekh</th>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Banda</th>
                  <th className="py-2 pr-3">Kaam</th>
                  <th className="py-2 pr-3 text-right">Mazdoori</th>
                  <th className="py-2 pr-3 text-right">Advance adjust</th>
                  <th className="py-2 pr-3 text-right">Dena bana</th>
                  <th className="py-2 pr-3">Halat</th>
                  {manzoorKarSakta && <th className="py-2 pr-3">Faisla</th>}
                </tr>
              </thead>
              <tbody>
                {mazdooriRows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 align-top last:border-0 dark:border-surface-800">
                    <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{r.work_date}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{r.entry_number}</td>
                    <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                      <Link href={`/admin/khata/banda/${r.party_type}/${r.party_id}`} className="hover:underline">
                        {naamMap[r.party_id] ?? "(naam nahi mila)"}
                      </Link>
                      {r.received_by_name && (
                        <span className="block text-[11px] text-surface-400">liya: {r.received_by_name}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-surface-600 dark:text-surface-400">
                      {r.work_detail}
                      {r.quantity != null && r.rate != null && (
                        <span className="block text-[11px] text-surface-400">
                          {r.quantity} {r.unit ?? ""} × Rs {r.rate}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">
                      Rs. {r.amount.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-sky-700 dark:text-sky-400">
                      {r.advance_adjusted > 0 ? `Rs. ${r.advance_adjusted.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {r.payable_added > 0 ? `Rs. ${r.payable_added.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          r.status === "approved"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-surface-800 dark:text-emerald-300"
                            : r.status === "rejected"
                              ? "bg-red-100 text-red-800 dark:bg-surface-800 dark:text-red-300"
                              : "bg-amber-100 text-amber-800 dark:bg-surface-800 dark:text-amber-300"
                        }`}
                      >
                        {HALAT_LABEL[r.status] ?? r.status}
                      </span>
                      {r.rejection_reason && (
                        <span className="mt-1 block text-[11px] text-red-600">{r.rejection_reason}</span>
                      )}
                    </td>
                    {manzoorKarSakta && (
                      <td className="py-2 pr-3">
                        {r.status === "pending" ? (
                          <div className="flex flex-col gap-1">
                            <form action={mazdoorManzoorAction} className="flex flex-col gap-1">
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                name="comment"
                                required
                                placeholder="Aap ki raye (lazmi)"
                                className="w-32 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                              />
                              <Dabao tone="hara">
                                <span className="inline-flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Manzoor
                                </span>
                              </Dabao>
                            </form>
                            {raddKaunsa === r.id ? (
                              <form action={mazdoorRaddAction} className="flex flex-col gap-1">
                                <input type="hidden" name="id" value={r.id} />
                                <input
                                  name="rejection_reason"
                                  required
                                  placeholder="Wajah"
                                  className="w-32 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                                />
                                <Dabao tone="laal">Wapas / Radd</Dabao>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRaddKaunsa(r.id)}
                                className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                              >
                                Wapas bhejein
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-surface-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fehrist */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Paisa ki qatarein ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">Abhi koi kharcha darj nahi hua.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500 dark:border-surface-800">
                  <th className="py-2 pr-3">Tareekh</th>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Ye kya hai</th>
                  <th className="py-2 pr-3">Kis cheez ka</th>
                  <th className="py-2 pr-3">Kaun le gaya</th>
                  <th className="py-2 pr-3">Khata</th>
                  <th className="py-2 pr-3 text-right">Raqam</th>
                  <th className="py-2 pr-3">Halat</th>
                  {(manzoorKarSakta || taseeqKarSakta) && <th className="py-2 pr-3">Faisla</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const q = qismDhoondein(r.kind);
                  return (
                    <tr key={r.id} className="border-b border-surface-50 align-top last:border-0 dark:border-surface-800">
                      <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{r.expense_date}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-surface-500">
                        {r.expense_number}
                        {r.document_url && (
                          <a
                            href={r.document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-1 inline-flex text-emerald-700 hover:underline"
                            aria-label="Raseed"
                          >
                            <Paperclip className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                        {q?.label ?? r.kind}
                        <span className="block text-[11px] text-surface-400">{r.description}</span>
                      </td>
                      <td className="py-2 pr-3 text-surface-600 dark:text-surface-400">{r.categoryLabel}</td>
                      <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                        {r.party_id && r.party_type ? (
                          <Link
                            href={`/admin/khata/banda/${r.party_type}/${r.party_id}`}
                            className="hover:underline"
                          >
                            {bandeKaNaam(r)}
                          </Link>
                        ) : (
                          bandeKaNaam(r)
                        )}
                      </td>
                      <td className="py-2 pr-3 text-surface-600 dark:text-surface-400">
                        {r.paid_from_account_id ? (khataNaam[r.paid_from_account_id] ?? "—") : "— (darj nahi)"}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right font-medium tabular-nums ${
                          q?.rukh === "aaya" ? "text-emerald-700 dark:text-emerald-400" : "text-surface-900 dark:text-surface-100"
                        }`}
                      >
                        {q?.rukh === "aaya" ? "+" : "−"} Rs. {r.amount.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            r.status === "approved"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-surface-800 dark:text-emerald-300"
                              : r.status === "rejected"
                                ? "bg-red-100 text-red-800 dark:bg-surface-800 dark:text-red-300"
                                : r.status === "verified"
                                  ? "bg-sky-100 text-sky-800 dark:bg-surface-800 dark:text-sky-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-surface-800 dark:text-amber-300"
                          }`}
                        >
                          {HALAT_LABEL[r.status] ?? r.status}
                        </span>
                        {r.rejection_reason && (
                          <span className="mt-1 block text-[11px] text-red-600">{r.rejection_reason}</span>
                        )}
                      </td>
                      {(manzoorKarSakta || taseeqKarSakta) && (
                        <td className="py-2 pr-3">
                          {manzoorKarSakta && (r.status === "pending" || r.status === "verified") ? (
                            <div className="flex flex-col gap-1">
                              <form action={manzoorAction}>
                                <input type="hidden" name="id" value={r.id} />
                                <Dabao tone="hara">
                                  <span className="inline-flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Manzoor
                                  </span>
                                </Dabao>
                              </form>
                              {raddKaunsa === r.id ? (
                                <form action={raddAction} className="flex flex-col gap-1">
                                  <input type="hidden" name="id" value={r.id} />
                                  <input
                                    name="rejection_reason"
                                    required
                                    placeholder="Wajah"
                                    className="w-32 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                                  />
                                  <Dabao tone="laal">Radd karein</Dabao>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRaddKaunsa(r.id)}
                                  className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                                >
                                  Radd
                                </button>
                              )}
                            </div>
                          ) : !manzoorKarSakta && taseeqKarSakta && r.status === "pending" ? (
                            <div className="flex flex-col gap-1">
                              <form action={taseeqAction}>
                                <input type="hidden" name="id" value={r.id} />
                                <Dabao tone="hara">
                                  <span className="inline-flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Tasdeeq
                                  </span>
                                </Dabao>
                              </form>
                              {raddKaunsa === r.id ? (
                                <form action={raddAction} className="flex flex-col gap-1">
                                  <input type="hidden" name="id" value={r.id} />
                                  <input
                                    name="rejection_reason"
                                    required
                                    placeholder="Wajah"
                                    className="w-32 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                                  />
                                  <Dabao tone="laal">Radd karein</Dabao>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRaddKaunsa(r.id)}
                                  className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                                >
                                  Radd
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-surface-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
