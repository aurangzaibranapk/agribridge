"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Check, Plus, X, Scale, AlertTriangle, ExternalLink } from "lucide-react";
import {
  settlementMaangein,
  settlementManzoor,
  settlementRadd,
  donoTarafKaBaqi,
  type ActionState,
} from "@/actions/settlements";
import { BANDE_KI_QISMEIN, HALAT_LABEL } from "@/lib/kharche";

interface Qatar {
  id: string;
  number: string;
  party_type: string;
  party_id: string;
  party_naam: string;
  lena_khata: string;
  lena_naam: string;
  dena_khata: string;
  dena_naam: string;
  amount: number;
  wajah: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

const KHALI: ActionState = {};

function Dabao({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "hara" | "laal" }) {
  const { pending } = useFormStatus();
  const rang =
    tone === "brand"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "hara"
        ? "border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-surface-700 dark:hover:bg-surface-800"
        : "border border-red-200 text-red-700 hover:bg-red-50 dark:border-surface-700 dark:hover:bg-surface-800";
  return (
    <button type="submit" disabled={pending} className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${rang}`}>
      {pending ? "..." : children}
    </button>
  );
}

/**
 * Adjustment maangne ka safha.
 *
 * Do baatein jaan boojh kar aisi hain:
 *
 * 1. **Dono taraf ka baqi chunte hi saamne aata hai**, aur us ke sath
 *    HADD bhi — dono mein se chhoti raqam. Us se zyada adjust karne se
 *    ek khata ULTA ho jata hai, aur wo ghalti kabhi khud nazar nahi
 *    aati.
 *
 * 2. **Ye "wasooli" nahi hai** — ye baat form par likhi hui hai. Cash
 *    kahin nahi hilta; sirf do khate kam hote hain. Banda isay wasooli
 *    samajh kar cash bhi darj kar de to paisa do dafa gin jata.
 */
export function SettlementsClient({
  rows,
  khate,
  bande,
  maangSakta,
  manzoorKarSakta,
}: {
  rows: Qatar[];
  khate: { lena: { code: string; name: string }[]; dena: { code: string; name: string }[] };
  bande: Record<string, { id: string; naam: string }[]>;
  maangSakta: boolean;
  manzoorKarSakta: boolean;
}) {
  const [maangState, maangAction] = useFormState(settlementMaangein, KHALI);
  const [manzoorState, manzoorAction] = useFormState(settlementManzoor, KHALI);
  const [raddState, raddAction] = useFormState(settlementRadd, KHALI);

  const [khula, setKhula] = useState(false);
  const [qism, setQism] = useState("farmer");
  const [bandaId, setBandaId] = useState("");
  const [lenaKhata, setLenaKhata] = useState(khate.lena[0]?.code ?? "");
  const [denaKhata, setDenaKhata] = useState(khate.dena[0]?.code ?? "");
  const [baqi, setBaqi] = useState<{ lena: number; dena: number } | null>(null);
  const [raddKaunsa, setRaddKaunsa] = useState<string | null>(null);

  const fehrist = bande[qism] ?? [];

  useEffect(() => {
    let ruk = false;
    if (!bandaId || !lenaKhata || !denaKhata) {
      setBaqi(null);
      return;
    }
    donoTarafKaBaqi(qism, bandaId, lenaKhata, denaKhata).then((b) => {
      if (!ruk) setBaqi(b);
    });
    return () => {
      ruk = true;
    };
  }, [qism, bandaId, lenaKhata, denaKhata]);

  const hadd = useMemo(() => (baqi ? Math.min(baqi.lena, baqi.dena) : null), [baqi]);

  const paighaam = maangState.message ?? manzoorState.message ?? raddState.message;
  const kharabi = maangState.error ?? manzoorState.error ?? raddState.error;

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

      {maangSakta && (
        <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              <Scale className="h-4 w-4 text-surface-400" /> Naya adjustment
            </h2>
            <button
              type="button"
              onClick={() => setKhula((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {khula ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {khula ? "Band karein" : "Adjustment maangein"}
            </button>
          </div>

          {khula && (
            <form action={maangAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Fehrist</span>
                <select
                  name="party_type"
                  value={qism}
                  onChange={(e) => {
                    setQism(e.target.value);
                    setBandaId("");
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
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Banda</span>
                <select
                  name="party_id"
                  required
                  value={bandaId}
                  onChange={(e) => setBandaId(e.target.value)}
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

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  Jahan se LENA hai (ye kam hoga)
                </span>
                <select
                  name="lena_khata"
                  required
                  value={lenaKhata}
                  onChange={(e) => setLenaKhata(e.target.value)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                >
                  {khate.lena.map((k) => (
                    <option key={k.code} value={k.code}>
                      {k.code} — {k.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  Jahan DENA hai (ye bhi kam hoga)
                </span>
                <select
                  name="dena_khata"
                  required
                  value={denaKhata}
                  onChange={(e) => setDenaKhata(e.target.value)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                >
                  {khate.dena.map((k) => (
                    <option key={k.code} value={k.code}>
                      {k.code} — {k.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Dono taraf ka baqi -- aur hadd */}
              {bandaId && (
                <div className="sm:col-span-2 rounded-lg bg-surface-50 p-3 text-xs dark:bg-surface-800">
                  {baqi === null ? (
                    <span className="text-surface-400">Baqi parha ja raha hai...</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-surface-600 dark:text-surface-400">
                        Lena:{" "}
                        <b className="tabular-nums text-emerald-700 dark:text-emerald-400">
                          Rs {baqi.lena.toLocaleString()}
                        </b>
                      </span>
                      <span className="text-surface-600 dark:text-surface-400">
                        Dena:{" "}
                        <b className="tabular-nums text-amber-700 dark:text-amber-400">
                          Rs {baqi.dena.toLocaleString()}
                        </b>
                      </span>
                      <span className="text-surface-600 dark:text-surface-400">
                        Zyada se zyada adjust:{" "}
                        <b className="tabular-nums text-surface-900 dark:text-surface-100">
                          Rs {(hadd ?? 0).toLocaleString()}
                        </b>
                      </span>
                      <Link
                        href={`/admin/khata/banda/${qism}/${bandaId}`}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Poora khata <ExternalLink className="h-3 w-3" />
                      </Link>
                      {hadd === 0 && (
                        <span className="w-full text-amber-700 dark:text-amber-400">
                          Adjust karne ke liye DONO taraf raqam honi chahiye. Abhi ek taraf sifar hai.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Raqam (Rs)</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={hadd ?? undefined}
                  required
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Wajah (lazmi)</span>
                <input
                  name="wajah"
                  required
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  placeholder="jaise: Aslam se baat ho gayi, mazdoori khaad ke khaate mein adjust"
                />
              </label>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <Dabao>Finance ko bhejein</Dabao>
                {/*
                  Ye baat form par likhi hui hai, madad ke safhe par nahi.
                  Banda isay wasooli samajh kar cash bhi darj kar de to
                  paisa DO DAFA gin jata hai.
                */}
                <span className="flex items-start gap-1.5 text-[11px] leading-snug text-surface-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  Ye wasooli NAHI hai — cash kahin nahi hilta, sirf do khate kam hote hain. Cash waqai aaya ho to
                  usay Paisa &amp; Khata se darj karein.
                </span>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Qatarein ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">Abhi koi adjustment nahi hua.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500 dark:border-surface-800">
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Banda</th>
                  <th className="py-2 pr-3">Kis se kis mein</th>
                  <th className="py-2 pr-3 text-right">Raqam</th>
                  <th className="py-2 pr-3">Wajah</th>
                  <th className="py-2 pr-3">Halat</th>
                  {manzoorKarSakta && <th className="py-2 pr-3">Faisla</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 align-top last:border-0 dark:border-surface-800">
                    <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{r.number}</td>
                    <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                      <Link href={`/admin/khata/banda/${r.party_type}/${r.party_id}`} className="hover:underline">
                        {r.party_naam}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-surface-600 dark:text-surface-400">
                      {r.lena_naam}
                      <span className="block text-[11px] text-surface-400">→ {r.dena_naam}</span>
                    </td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums text-surface-900 dark:text-surface-100">
                      Rs. {r.amount.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-surface-600 dark:text-surface-400">{r.wajah}</td>
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
                            <form action={manzoorAction} className="flex flex-col gap-1">
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                name="comment"
                                required
                                placeholder="Aap ki raye (lazmi)"
                                className="w-36 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                              />
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
                                  className="w-36 rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
