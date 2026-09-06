"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, X, Plus, Paperclip, Info } from "lucide-react";
import { kharchaDarj, kharchaManzoor, kharchaRadd, type ActionState } from "@/actions/kharche";
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
  khaate,
  bande,
  naamMap,
  khataNaam,
  darjKarSakta,
  manzoorKarSakta,
}: {
  rows: Qatar[];
  khaate: { id: string; name: string; gl_code: string | null }[];
  bande: Record<string, Banda[]>;
  naamMap: Record<string, string>;
  khataNaam: Record<string, string>;
  darjKarSakta: boolean;
  manzoorKarSakta: boolean;
}) {
  const [darjState, darjAction] = useFormState(kharchaDarj, KHALI);
  const [manzoorState, manzoorAction] = useFormState(kharchaManzoor, KHALI);
  const [raddState, raddAction] = useFormState(kharchaRadd, KHALI);

  const [khula, setKhula] = useState(false);
  const [kind, setKind] = useState("kharcha");
  const [category, setCategory] = useState("tea_food");
  const [bandeKiQism, setBandeKiQism] = useState<string>("staff");
  const [raddKaunsa, setRaddKaunsa] = useState<string | null>(null);

  const qism = useMemo(() => qismDhoondein(kind), [kind]);

  // Jis qism ka apna khata banta hai, wahan banda usi fehrist se aata
  // hai -- chunne ka mauqa hi nahi dena chahiye ke kisan ka advance
  // staff ke khate mein chala jaye.
  const bandhiQism = qism?.bandaKahanSe ?? null;
  const bandaZaroori = qism?.bandaZaroori === true;
  const chaliQism = bandhiQism ?? bandeKiQism;
  const fehrist = bande[chaliQism] ?? [];

  const paighaam = darjState.message ?? manzoorState.message ?? raddState.message;
  const kharabi = darjState.error ?? manzoorState.error ?? raddState.error;

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
  })).filter((kh) => kh.qismein.length > 0);

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

      {darjKarSakta && (
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              Naya kharcha / adaigi
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
            <form action={darjAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* 1) QISM — sab se pehle, kyunki baqi sab is par tay hota hai */}
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
                  {khaanoMein.map((kh) => (
                    <optgroup key={kh.value} label={`${kh.label} — ${kh.tafseel}`}>
                      {kh.qismein.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </optgroup>
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
                      defaultValue=""
                      className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    >
                      <option value="">— fehrist mein nahi —</option>
                      {fehrist.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.naam}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block text-xs text-surface-500">
                  <span className="mb-1 block">Ya phir naam likh dein (jaise: spray wala, Baba)</span>
                  <input
                    name="party_name"
                    className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    placeholder="Naam"
                  />
                </label>
                {/*
                  Naam likhna aur khata banna do alag baatein hain -- aur
                  ye baat form par likhi hui hai, warna banda samajhta hai
                  ke har naam par udhaar chadh raha hai.
                */}
                <p className="mt-2 text-[11px] leading-snug text-surface-400">
                  {bandaZaroori
                    ? bandhiQism
                      ? `Is qism mein paisa wapas aana ya jana hai, is liye banda ${bandhiQism} ki fehrist se chunna zaroori hai — sirf naam likhne se us ka khata nahi banta.`
                      : "Is qism mein us bande ka khata hilta hai, is liye fehrist se chunna zaroori hai. Fehrist koi bhi ho — wohi banda kisan bhi ho sakta hai, customer bhi aur mazdoor bhi; ID ek hi rehti hai."
                    : "Ye asal kharcha hai: naam sirf record ke liye jata hai, us bande par udhaar nahi chadhta. Registered banda chunein to wo qatar us ke naam se dhoondi ja sakegi."}
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
                      {k.name}
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

      {/* Fehrist */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Qatarein ({rows.length})
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
                  {manzoorKarSakta && <th className="py-2 pr-3">Faisla</th>}
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
                        {bandeKaNaam(r)}
                        {r.party_id && <span className="block text-[11px] text-surface-400">registered</span>}
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
