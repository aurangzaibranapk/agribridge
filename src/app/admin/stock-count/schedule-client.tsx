"use client";

import { Fragment, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CalendarClock, Pencil, AlertTriangle, CheckCircle2, PauseCircle } from "lucide-react";
import { saveCountSchedule, type ScheduleState } from "@/actions/stock-count-schedule";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select } from "@/components/ui/form";
import { CYCLE_LABEL, type CountSchedule, type CycleKind } from "@/lib/ledger/stock-count";

const initialState: ScheduleState = {};

function rs(v: number): string {
  return `Rs ${Math.round(v).toLocaleString()}`;
}

/** Tarteeb ek jumle mein — jaise banda bolta hai, khaanon mein nahi. */
function tarteebKaJumla(s: CountSchedule): string {
  switch (s.cycleKind) {
    case "band":
      return "Ginti band";
    case "mahine_ke_aakhir":
      return "Har mahine ke aakhir";
    case "mahine_ki_tareekh":
      return `Har mahine ki ${s.mahineKiTareekh} tareekh`;
    default:
      return `Har ${s.harNDin ?? 30} din baad`;
  }
}

function TarteebKaKhana({
  godam,
  log,
  band,
}: {
  godam: CountSchedule;
  log: { id: string; naam: string }[];
  band: () => void;
}) {
  const [state, action] = useFormState(saveCountSchedule, initialState);
  const [kism, setKism] = useState<CycleKind>(godam.cycleKind);

  return (
    <form
      action={action}
      className="my-2 grid gap-2 rounded-lg border border-brand-200 bg-brand-50/50 p-3 sm:grid-cols-2 dark:border-brand-800 dark:bg-brand-950/20"
    >
      <input type="hidden" name="warehouse_id" value={godam.warehouseId} />

      <div>
        <Label>Kitne din baad ginna hai</Label>
        <Select name="cycle_kind" value={kism} onChange={(e) => setKism(e.target.value as CycleKind)}>
          {(Object.keys(CYCLE_LABEL) as CycleKind[]).map((k) => (
            <option key={k} value={k}>
              {CYCLE_LABEL[k]}
            </option>
          ))}
        </Select>
      </div>

      {kism === "har_n_din" && (
        <div>
          <Label>Kitne din</Label>
          <Input
            type="number"
            name="har_n_din"
            min={1}
            max={365}
            defaultValue={godam.harNDin ?? 30}
            required
          />
          <p className="mt-1 text-[11px] text-surface-400">Jaise 15 = har do haftay baad.</p>
        </div>
      )}

      {kism === "mahine_ki_tareekh" && (
        <div>
          <Label>Mahine ki kaun si tareekh</Label>
          <Input
            type="number"
            name="mahine_ki_tareekh"
            min={1}
            max={28}
            defaultValue={godam.mahineKiTareekh ?? 1}
            required
          />
          <p className="mt-1 text-[11px] text-surface-400">
            1 se 28 tak — har mahine mein 29, 30 ya 31 nahi hote.
          </p>
        </div>
      )}

      {kism === "mahine_ke_aakhir" && (
        <div className="flex items-end">
          <p className="text-xs text-surface-500 dark:text-surface-400">
            Har mahine ke aakhri din ginti due ho jayegi.
          </p>
        </div>
      )}

      {kism === "band" && (
        <div className="sm:col-span-2">
          <Label>Band karne ki wajah</Label>
          <Input
            name="band_ki_wajah"
            defaultValue={godam.bandKiWajah ?? ""}
            placeholder="Jaise: ye godam band para hai, is mein maal hi nahi"
            required
            minLength={5}
          />
          <p className="mt-1 text-[11px] text-surface-400">
            Ginti band karna ek faisla hai — wajah ke baghair kal koi nahi bata sakega ke ye tay hua tha ya
            bhool gaye the.
          </p>
        </div>
      )}

      <div className={kism === "band" ? "sm:col-span-2" : ""}>
        <Label>Ginti kis ke zimme</Label>
        <Select name="zimmedar" defaultValue={godam.zimmedar ?? ""}>
          <option value="">— kisi ke naam nahi —</option>
          {log.map((p) => (
            <option key={p.id} value={p.id}>
              {p.naam}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-[11px] text-surface-400">
          Zimmedar bana dene se sirf <strong>isi godam ki ginti</strong> ka darwaza khulta hai — poore nizam
          ka ikhtiyar nahi milta.
        </p>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 sm:col-span-2 dark:bg-red-950/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 sm:col-span-2 dark:bg-brand-950/30 dark:text-brand-300">
          {state.notice}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <MehfoozButton />
        <button
          type="button"
          onClick={band}
          className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
        >
          Band karein
        </button>
      </div>
    </form>
  );
}

function MehfoozButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Mehfooz ho rahi hai…" : "Mehfooz karein"}
    </Button>
  );
}

/**
 * Har godam ki apni tarteeb — aur pichhli ginti ka farq.
 *
 * Malik (6 September): *"Main Branch har 15 din mein ek dafa stock count
 * report de, doosri branch har month 30 din baad ya month end par... hum
 * kisi ko bhi access dein ke stock count karwa sakein. Hamein pata ho ga
 * audit hua, kya farq aaya hai."*
 *
 * Do baatein jo har qatar par saaf likhi hain:
 *
 * 1. **"Default" aur "aap ka chuna hua" alag likhe jate hain.** Jis
 *    godam ki tarteeb darj na ho, us par 30 din ka purana qanoon chalta
 *    hai. Bina is nishan ke malik samajhte ke har godam ki tarteeb un ki
 *    apni lagayi hui hai.
 *
 * 2. **"Kabhi gina hi nahi" aur "gina, farq nahi tha" alag hain.**
 *    Pehle wale par farq NULL hai aur us jagah "—" likha aata hai, Rs 0
 *    nahi. Rs 0 likhna kehta ke gina gaya tha aur sab theek nikla.
 */
export function ScheduleSection({
  rows,
  log,
  canEdit,
}: {
  rows: CountSchedule[];
  log: { id: string; naam: string }[];
  canEdit: boolean;
}) {
  const [khula, setKhula] = useState<string | null>(null);

  const late = rows.filter((r) => (r.dinLate ?? 0) > 0).length;
  const bandGodam = rows.filter((r) => r.cycleKind === "band").length;
  const binaTarteeb = rows.filter((r) => !r.tarteebDarj).length;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CalendarClock className="h-4 w-4 text-surface-500" />
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">
          Kis godam ki ginti kab
        </h2>
        {late > 0 && <Badge tone="red">{late} late</Badge>}
        {binaTarteeb > 0 && <Badge tone="amber">{binaTarteeb} par default chal raha hai</Badge>}
        {bandGodam > 0 && <Badge tone="gray">{bandGodam} band</Badge>}
      </div>

      <p className="mb-3 text-xs leading-relaxed text-surface-500 dark:text-surface-400">
        Har godam ki apni tarteeb hai — daily ginti ki zarurat nahi. Jis godam ki tarteeb darj na ho, us par{" "}
        <strong>30 din ka default</strong> chalta hai; wo aap ka chuna hua nahi.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400 dark:border-surface-800">
              <th className="py-2">Godam</th>
              <th className="py-2">Tarteeb</th>
              <th className="py-2">Aakhri ginti</th>
              <th className="py-2">Haalat</th>
              <th className="py-2 text-right">Pichhla farq</th>
              {canEdit && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              // Fragment par key lazmi hai -- `<>` par nahi lag sakti,
              // aur us ke baghair React har badalne par poori qatar
              // dobara banata hai.
              <Fragment key={r.warehouseId}>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  <td className="py-2 font-medium text-surface-900 dark:text-white">
                    {r.warehouseName}
                    {r.zimmedarNaam && (
                      <span className="ms-2 text-xs font-normal text-surface-400">· {r.zimmedarNaam}</span>
                    )}
                  </td>
                  <td className="py-2 text-surface-700 dark:text-surface-300">
                    {tarteebKaJumla(r)}
                    {!r.tarteebDarj && <Badge tone="amber" className="ms-2">default</Badge>}
                  </td>
                  <td className="py-2 text-surface-600 dark:text-surface-400">
                    {r.aakhriGinti ?? <span className="text-amber-600">kabhi nahi</span>}
                  </td>
                  <td className="py-2">
                    {r.cycleKind === "band" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                        <PauseCircle className="h-3.5 w-3.5" /> band
                      </span>
                    ) : (r.dinLate ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> {r.dinLate} din late
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> waqt par
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {/* NULL = kabhi gina hi nahi. Rs 0 likhna kehta ke
                        gine the aur farq nahi nikla -- do alag baatein. */}
                    {r.pichhlaFarq === null ? (
                      <span className="text-surface-400">—</span>
                    ) : (
                      <span
                        className={
                          r.pichhlaFarq === 0
                            ? "text-surface-500"
                            : r.pichhlaFarq < 0
                              ? "font-medium text-red-700 dark:text-red-400"
                              : "font-medium text-amber-700 dark:text-amber-400"
                        }
                      >
                        {rs(r.pichhlaFarq)}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setKhula(khula === r.warehouseId ? null : r.warehouseId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-xs font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
                      >
                        <Pencil className="h-3 w-3" /> Badlein
                      </button>
                    </td>
                  )}
                </tr>
                {canEdit && khula === r.warehouseId && (
                  <tr>
                    <td colSpan={6} className="pb-2">
                      <TarteebKaKhana godam={r} log={log} band={() => setKhula(null)} />
                    </td>
                  </tr>
                )}
                {r.cycleKind === "band" && r.bandKiWajah && (
                  <tr>
                    <td colSpan={6} className="pb-2 ps-2 text-xs text-surface-400">
                      Band ki wajah: {r.bandKiWajah}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-surface-400">
                  Koi active godam nahi mila.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!canEdit && (
        <p className="mt-3 text-xs text-surface-400">
          Tarteeb sirf Admin ya Malik badal sakte hain. Ye rok jaan boojh kar hai: ginne wala apni hi tareekh
          aage kar sake to ginti hamesha &quot;kal&quot; hoti rehti hai.
        </p>
      )}
    </Card>
  );
}
