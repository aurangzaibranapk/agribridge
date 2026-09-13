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
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

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
  isUnrestricted = false,
}: {
  rows: Qatar[];
  mazdooriRows: MazdooriQatar[];
  khaate: { id: string; name: string; gl_code: string | null; balance: number; account_type?: string }[];
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
  /**
   * Malik (13 September): "staff ko sirf apni cash hand amount se allow
   * hai -- wo kisi bank, QR code, kisi card se kisi ko payment ya bill
   * nahi bhar sakta." Admin/Owner ko har khata (bank/wallet/cash) khulta
   * hai. Yahan sirf dropdown chhupta hai -- asal rok server par
   * (`kharchaDarj`) hai, ye UI to sirf ghalat button dikhana rokti hai.
   */
  isUnrestricted?: boolean;
}) {
  const lang = useLang();
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

  // Staff sirf "cash" wale khate se kharcha darj kar sakta hai -- bank,
  // wallet, card sirf admin/owner ke liye. Asal rok server par bhi hai
  // (kharchaDarj); ye sirf ghalat option dikhne se rokta hai.
  const khaateForDarj = isUnrestricted ? khaate : khaate.filter((k) => k.account_type === "cash");

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
          <Wallet className="h-3.5 w-3.5" /> {t("kh_khaton_mein", lang)}
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
          {khaate.length === 0 && <span className="text-sm text-surface-400">{t("kh_koi_khata_darj_nahi", lang)}</span>}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-surface-400">
          {t("kh_khaton_baare_mein", lang)}
          {intezarKiRaqam > 0 ? (
            <>
              {" "}
              {t("kh_abhi_rs_prefix", lang)} {Math.round(intezarKiRaqam).toLocaleString()} {t("kh_manzoori_intezar_suffix", lang)}
            </>
          ) : (
            ` ${t("kh_kuch_intezar_nahi", lang)}`
          )}
        </p>
      </div>
      )}

      {darjKarSakta && (
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              {t("kh_naya_darj_karein", lang)}
            </h2>
            <button
              type="button"
              onClick={() => setKhula((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {khula ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {khula ? t("kh_band_karein", lang) : t("kh_naya_darj_karein", lang)}
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
                {t("kh_mazdoori_info", lang)}
              </p>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_fehrist", lang)}</span>
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
                  {t("kh_kis_ne_kaam_kia", lang)}
                </span>
                <select
                  name="party_id"
                  required
                  value={mBanda}
                  onChange={(e) => setMBanda(e.target.value)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                >
                  <option value="">{t("kh_chunein_option", lang)}</option>
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
                    <span className="text-surface-400">{t("kh_haal_parha_ja_raha", lang)}</span>
                  ) : (
                    <>
                      <span className="text-surface-600 dark:text-surface-400">
                        {t("kh_advance_baqi_colon", lang)}{" "}
                        <b className="tabular-nums text-surface-900 dark:text-surface-100">
                          Rs {mHaal.advanceBaqi.toLocaleString()}
                        </b>
                      </span>
                      <span className="text-surface-600 dark:text-surface-400">
                        {t("kh_is_ko_dena_colon", lang)}{" "}
                        <b className="tabular-nums text-surface-900 dark:text-surface-100">
                          Rs {mHaal.denaBaqi.toLocaleString()}
                        </b>
                      </span>
                      <Link
                        href={`/admin/khata/banda/${mQism}/${mBanda}`}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        {t("kh_poora_khata", lang)} <ExternalLink className="h-3 w-3" />
                      </Link>
                      {mRaqam != null && mHaal.advanceBaqi > 0 && (
                        <span className="w-full text-emerald-700 dark:text-emerald-400">
                          {t("kh_is_mein_se_rs", lang)} {Math.min(mHaal.advanceBaqi, mRaqam).toLocaleString()} {t("kh_purane_advance_adjust", lang)} {Math.max(mRaqam - mHaal.advanceBaqi, 0).toLocaleString()} {t("kh_dena_banega", lang)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_kaam_kya_tha", lang)}</span>
                <input
                  name="work_detail"
                  required
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  placeholder={t("kh_ph_kaam_example", lang)}
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_tareekh", lang)}</span>
                <input
                  name="work_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_ginti", lang)}</span>
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
                    placeholder={t("kh_ph_bori", lang)}
                  />
                </span>
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_rate_rs", lang)}</span>
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
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_mazdoori_rs", lang)}</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  value={mRaqam ?? ""}
                  readOnly={mRaqam != null}
                  onChange={() => {}}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm read-only:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:read-only:bg-surface-800"
                  placeholder={t("kh_ph_ginti_rate_khud", lang)}
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  {t("kh_lene_wala_koi_aur", lang)}
                </span>
                <input
                  name="received_by_name"
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  placeholder={t("kh_ph_lene_wala_example", lang)}
                />
              </label>

              <div className="sm:col-span-2">
                <Dabao>{t("kh_bhejein_manzoori", lang)}</Dabao>
              </div>
            </form>
          )}

          {khula && !isMazdoori && (
            <form action={darjAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* 1) QISM — is khaane ki */}
              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  {t("kh_ye_kya_hai", lang)}
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
                  {t("kh_kaun_le_gaya_kis_se_aaya", lang)}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs text-surface-500">
                    <span className="mb-1 block">{t("kh_kis_fehrist_se", lang)}</span>
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
                    <span className="mb-1 block">{t("kh_naam_fehrist_se", lang)}</span>
                    <select
                      name="party_id"
                      required
                      defaultValue=""
                      className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    >
                      <option value="">{t("kh_chunein_option", lang)}</option>
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
                  {t("kh_jo_fehrist_mein_nahi", lang)}{" "}
                  <Link href="/admin/farmers" className="text-emerald-700 hover:underline dark:text-emerald-400">
                    {t("kh_farmers_membership", lang)}
                  </Link>{" "}
                  {t("kh_ya", lang)}{" "}
                  <Link href="/admin/crm" className="text-emerald-700 hover:underline dark:text-emerald-400">
                    {t("kh_customers", lang)}
                  </Link>
                  {t("kh_ek_dafa_ka_kaam", lang)}
                </p>
                {/*
                  Naam likhna aur khata banna do alag baatein hain -- aur
                  ye baat form par likhi hui hai, warna banda samajhta hai
                  ke har naam par udhaar chadh raha hai.
                */}
                <p className="mt-2 text-[11px] leading-snug text-surface-400">
                  {bandhiQism
                    ? `${t("kh_qism_ke_liye_banda_prefix", lang)} ${bandhiQism} ${t("kh_qism_ke_liye_banda_suffix", lang)}`
                    : t("kh_wohi_banda_kisan", lang)}
                </p>
              </div>

              {/* 3) QISM (bill ki) + apni qism */}
              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_kis_cheez_ka", lang)}</span>
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
                    {t("kh_apni_qism_ka_naam", lang)}
                  </span>
                  <input
                    name="category_apni"
                    required
                    className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    placeholder={t("kh_ph_apni_qism_example", lang)}
                  />
                  <span className="mt-1 block text-[11px] text-surface-400">
                    {t("kh_yehi_naam_qism_ban_kar", lang)}
                  </span>
                </label>
              ) : (
                <div className="hidden sm:block" />
              )}

              {/* 4) Raqam aur tareekh */}
              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_raqam_rs", lang)}</span>
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
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_tareekh", lang)}</span>
                <input
                  name="expense_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
                <span className="mt-1 block text-[11px] text-surface-400">
                  {t("kh_wo_din_likhein", lang)}
                </span>
              </label>

              {/* 5) Khata */}
              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  {t("kh_paisa_kis_khate_se", lang)}
                </span>
                <select
                  name="paid_from_account_id"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                >
                  <option value="">{t("kh_chunein_option", lang)}</option>
                  {khaateForDarj.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} — Rs {Math.round(k.balance).toLocaleString()}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-surface-400">
                  {isUnrestricted ? t("kh_is_ke_baghair_finance", lang) : "Sirf cash hand se — bank/wallet/card sirf admin/owner ke paas."}
                </span>
              </label>

              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">{t("kh_tafseel", lang)}</span>
                <input
                  name="description"
                  required
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  placeholder={t("kh_ph_tafseel_example", lang)}
                />
              </label>

              <label className="sm:col-span-2 text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  {t("kh_raseed_tasveer_marzi", lang)}
                </span>
                <input
                  name="document"
                  type="file"
                  accept="image/*,.pdf"
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
              </label>

              <div className="sm:col-span-2">
                <Dabao>{t("kh_bhejein_manzoori", lang)}</Dabao>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Mazdoori ki qatarein — usi tag ke andar */}
      {mazdooriRows.length > 0 && (
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <HardHat className="h-4 w-4 text-surface-400" /> {t("kh_mazdoori_heading", lang)} ({mazdooriRows.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500 dark:border-surface-800">
                  <th className="py-2 pr-3">{t("kh_tareekh", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_number", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_banda", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_kaam_header", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("kh_mazdoori_heading", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("kh_advance_adjust", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("kh_dena_bana", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_halat", lang)}</th>
                  {manzoorKarSakta && <th className="py-2 pr-3">{t("kh_faisla", lang)}</th>}
                </tr>
              </thead>
              <tbody>
                {mazdooriRows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 align-top last:border-0 dark:border-surface-800">
                    <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{r.work_date}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{r.entry_number}</td>
                    <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                      <Link href={`/admin/khata/banda/${r.party_type}/${r.party_id}`} className="hover:underline">
                        {naamMap[r.party_id] ?? t("kh_naam_nahi_mila", lang)}
                      </Link>
                      {r.received_by_name && (
                        <span className="block text-[11px] text-surface-400">{t("kh_liya_colon", lang)} {r.received_by_name}</span>
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
                                placeholder={t("kh_ph_aap_ki_raye", lang)}
                                className="w-32 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                              />
                              <Dabao tone="hara">
                                <span className="inline-flex items-center gap-1">
                                  <Check className="h-3 w-3" /> {t("kh_manzoor", lang)}
                                </span>
                              </Dabao>
                            </form>
                            {raddKaunsa === r.id ? (
                              <form action={mazdoorRaddAction} className="flex flex-col gap-1">
                                <input type="hidden" name="id" value={r.id} />
                                <input
                                  name="rejection_reason"
                                  required
                                  placeholder={t("kh_wajah", lang)}
                                  className="w-32 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                                />
                                <Dabao tone="laal">{t("kh_wapas_radd", lang)}</Dabao>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRaddKaunsa(r.id)}
                                className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                              >
                                {t("kh_wapas_bhejein", lang)}
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
          {t("kh_paisa_ki_qatarein", lang)} ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">{t("kh_abhi_koi_kharcha_nahi", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500 dark:border-surface-800">
                  <th className="py-2 pr-3">{t("kh_tareekh", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_number", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_ye_kya_hai_col", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_kis_cheez_ka", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_kaun_le_gaya_header", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_khata_header", lang)}</th>
                  <th className="py-2 pr-3 text-right">{t("kh_raqam_header", lang)}</th>
                  <th className="py-2 pr-3">{t("kh_halat", lang)}</th>
                  {(manzoorKarSakta || taseeqKarSakta) && <th className="py-2 pr-3">{t("kh_faisla", lang)}</th>}
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
                            aria-label={t("kh_raseed", lang)}
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
                        {r.paid_from_account_id ? (khataNaam[r.paid_from_account_id] ?? "—") : t("kh_darj_nahi_dash", lang)}
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
                                    <Check className="h-3 w-3" /> {t("kh_manzoor", lang)}
                                  </span>
                                </Dabao>
                              </form>
                              {raddKaunsa === r.id ? (
                                <form action={raddAction} className="flex flex-col gap-1">
                                  <input type="hidden" name="id" value={r.id} />
                                  <input
                                    name="rejection_reason"
                                    required
                                    placeholder={t("kh_wajah", lang)}
                                    className="w-32 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                                  />
                                  <Dabao tone="laal">{t("kh_radd_karein", lang)}</Dabao>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRaddKaunsa(r.id)}
                                  className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                                >
                                  {t("kh_radd", lang)}
                                </button>
                              )}
                            </div>
                          ) : !manzoorKarSakta && taseeqKarSakta && r.status === "pending" ? (
                            <div className="flex flex-col gap-1">
                              <form action={taseeqAction}>
                                <input type="hidden" name="id" value={r.id} />
                                <Dabao tone="hara">
                                  <span className="inline-flex items-center gap-1">
                                    <Check className="h-3 w-3" /> {t("kh_tasdeeq", lang)}
                                  </span>
                                </Dabao>
                              </form>
                              {raddKaunsa === r.id ? (
                                <form action={raddAction} className="flex flex-col gap-1">
                                  <input type="hidden" name="id" value={r.id} />
                                  <input
                                    name="rejection_reason"
                                    required
                                    placeholder={t("kh_wajah", lang)}
                                    className="w-32 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                                  />
                                  <Dabao tone="laal">{t("kh_radd_karein", lang)}</Dabao>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRaddKaunsa(r.id)}
                                  className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                                >
                                  {t("kh_radd", lang)}
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
