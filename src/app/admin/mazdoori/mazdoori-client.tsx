"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Check, Plus, X, Search, HardHat, ExternalLink } from "lucide-react";
import { mazdooriDarj, mazdooriManzoor, mazdooriRadd, bandeKaHaal, type ActionState } from "@/actions/mazdoori";
import { BANDE_KI_QISMEIN, HALAT_LABEL } from "@/lib/kharche";

interface Qatar {
  id: string;
  entry_number: string;
  party_type: string;
  party_id: string;
  party_naam: string;
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
 * Mazdoori darj karne ka safha.
 *
 * Do baatein jaan boojh kar aisi hain:
 *
 * 1. **Banda chunte hi us ka haal saamne aa jata hai** -- kitna advance
 *    baqi hai aur kitna us ko dena hai. Malik: *"Staff ko calculation
 *    manually nahi karni."* Us ke baghair banda khud jorr lagata hai,
 *    aur wo jorr aksar ghalat hota hai.
 *
 * 2. **Raqam ginti × rate se banti hai.** Dono khane bhare hon to raqam
 *    khud ban jati hai aur haath se badli nahi ja sakti -- warna ginti
 *    kuch aur kehti hai aur raqam kuch aur, aur agle mahine "bori ka
 *    rate kya tha" ka jawab kahin se nahi milta.
 */
export function MazdooriClient({
  rows,
  bande,
  darjKarSakta,
  manzoorKarSakta,
}: {
  rows: Qatar[];
  bande: Record<string, { id: string; naam: string }[]>;
  darjKarSakta: boolean;
  manzoorKarSakta: boolean;
}) {
  const [darjState, darjAction] = useFormState(mazdooriDarj, KHALI);
  const [manzoorState, manzoorAction] = useFormState(mazdooriManzoor, KHALI);
  const [raddState, raddAction] = useFormState(mazdooriRadd, KHALI);

  const [khula, setKhula] = useState(false);
  const [qism, setQism] = useState("farmer");
  const [bandaId, setBandaId] = useState("");
  const [talaash, setTalaash] = useState("");
  const [ginti, setGinti] = useState("");
  const [rate, setRate] = useState("");
  const [haal, setHaal] = useState<{ advanceBaqi: number; denaBaqi: number } | null>(null);
  const [raddKaunsa, setRaddKaunsa] = useState<string | null>(null);

  const fehrist = bande[qism] ?? [];
  const dikhne = useMemo(() => {
    const t = talaash.trim().toLowerCase();
    const list = t ? fehrist.filter((b) => b.naam.toLowerCase().includes(t)) : fehrist;
    return list.slice(0, 200);
  }, [fehrist, talaash]);

  // Banda chunte hi us ka haal.
  useEffect(() => {
    let ruk = false;
    if (!bandaId) {
      setHaal(null);
      return;
    }
    bandeKaHaal(qism, bandaId).then((h) => {
      if (!ruk) setHaal(h);
    });
    return () => {
      ruk = true;
    };
  }, [qism, bandaId]);

  const raqam = useMemo(() => {
    const g = Number(ginti);
    const r = Number(rate);
    if (Number.isFinite(g) && Number.isFinite(r) && g > 0 && r > 0) return Math.round(g * r * 100) / 100;
    return null;
  }, [ginti, rate]);

  const paighaam = darjState.message ?? manzoorState.message ?? raddState.message;
  const kharabi = darjState.error ?? manzoorState.error ?? raddState.error;

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
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              <HardHat className="h-4 w-4 text-surface-400" /> Nayi mazdoori
            </h2>
            <button
              type="button"
              onClick={() => setKhula((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {khula ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {khula ? "Band karein" : "Darj karein"}
            </button>
          </div>

          {khula && (
            <form action={darjAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-lg border border-surface-100 p-3 dark:border-surface-800">
                <p className="mb-2 text-sm font-medium text-surface-700 dark:text-surface-300">Banda kaun?</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="text-xs text-surface-500">
                    <span className="mb-1 block">Fehrist</span>
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
                  <label className="text-xs text-surface-500">
                    <span className="mb-1 block">Dhoondein (naam / mobile)</span>
                    <span className="flex items-center gap-2 rounded-lg border border-surface-200 px-2 py-1.5 dark:border-surface-700">
                      <Search className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                      <input
                        value={talaash}
                        onChange={(e) => setTalaash(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none"
                        placeholder="Aslam ya 0300..."
                      />
                    </span>
                  </label>
                  <label className="text-xs text-surface-500">
                    <span className="mb-1 block">Banda</span>
                    <select
                      name="party_id"
                      required
                      value={bandaId}
                      onChange={(e) => setBandaId(e.target.value)}
                      className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                    >
                      <option value="">— chunein —</option>
                      {dikhne.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.naam}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Us ka haal -- chunte hi */}
                {bandaId && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-surface-50 p-3 text-xs dark:bg-surface-800">
                    {haal === null ? (
                      // "Maloom nahi" aur "sifar" ek cheez nahi.
                      <span className="text-surface-400">Is ka haal parha ja raha hai...</span>
                    ) : (
                      <>
                        <span className="text-surface-600 dark:text-surface-400">
                          Advance baqi:{" "}
                          <b className="tabular-nums text-surface-900 dark:text-surface-100">
                            Rs {haal.advanceBaqi.toLocaleString()}
                          </b>
                        </span>
                        <span className="text-surface-600 dark:text-surface-400">
                          Is ko dena:{" "}
                          <b className="tabular-nums text-surface-900 dark:text-surface-100">
                            Rs {haal.denaBaqi.toLocaleString()}
                          </b>
                        </span>
                        <Link
                          href={`/admin/khata/banda/${qism}/${bandaId}`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Poora khata <ExternalLink className="h-3 w-3" />
                        </Link>
                        {raqam != null && haal.advanceBaqi > 0 && (
                          <span className="w-full text-emerald-700 dark:text-emerald-400">
                            Is mazdoori mein se Rs {Math.min(haal.advanceBaqi, raqam).toLocaleString()} purane advance
                            mein se adjust hoga; Rs {Math.max(raqam - haal.advanceBaqi, 0).toLocaleString()} dena
                            banega.
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

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
                    value={ginti}
                    onChange={(e) => setGinti(e.target.value)}
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
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
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
                  value={raqam ?? ""}
                  readOnly={raqam != null}
                  onChange={() => {}}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm read-only:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:read-only:bg-surface-800"
                  placeholder="Ginti × rate se khud ban jayegi"
                />
                <span className="mt-1 block text-[11px] text-surface-400">
                  Ginti aur rate dono bhar dein to raqam khud banti hai. Sirf raqam likhni ho to wo khane khali
                  chhorein.
                </span>
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">
                  Kaam / paisa lene wala (agar koi aur ho)
                </span>
                <input
                  name="received_by_name"
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
                  placeholder="jaise: Ali (beta)"
                />
                <span className="mt-1 block text-[11px] text-surface-400">
                  Khata phir bhi usi bande ka rehta hai — lene wale ka naya khata nahi banta.
                </span>
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-surface-700 dark:text-surface-300">Note</span>
                <input
                  name="received_by_note"
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

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Qatarein ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">Abhi koi mazdoori darj nahi hui.</p>
        ) : (
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
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 align-top last:border-0 dark:border-surface-800">
                    <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{r.work_date}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-surface-500">{r.entry_number}</td>
                    <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                      <Link
                        href={`/admin/khata/banda/${r.party_type}/${r.party_id}`}
                        className="hover:underline"
                      >
                        {r.party_naam}
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
                            <form action={manzoorAction} className="flex flex-col gap-1">
                              <input type="hidden" name="id" value={r.id} />
                              {/* Malik ka usool: manzoori par raye lazmi. */}
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
        )}
      </div>
    </div>
  );
}
