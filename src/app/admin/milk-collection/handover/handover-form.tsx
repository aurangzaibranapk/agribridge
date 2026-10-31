"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { lookupChillerStock, saveMilkHandover, type HandoverState } from "@/actions/milk-handover";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import {
  absorbChillerStock,
  adjustedTotal,
  applyAutoLab,
  blankCertificateLines,
  emptyLine,
  formatLab,
  formatQty,
  grossTotal,
  handoverAmount,
  lineSpecFlags,
  lrCorrection,
  lrCorrectionLabel,
  parseHandoverLines,
  destinationShareLine,
  initialBaseline,
  milkDensity,
  seedAutoLab,
  type HandoverDestination,
  type HandoverReason,
  type LrBaseline,
  specFlagText,
  tsOf,
  type HandoverLineInput,
  type HandoverSpecs,
  type LabFormula,
} from "@/lib/milk-handover";

const initial: HandoverState = {};

export interface HandoverShop {
  id: string;
  name: string;
  code: string | null;
  branchId: string | null;
}

export interface HandoverPartyOption {
  id: string;
  name: string;
  contact: string | null;
  active: boolean;
}

export interface HandoverFormProps {
  lang: Lang;
  canSeeRate?: boolean;
  destination: HandoverDestination;
  parties?: HandoverPartyOption[];
  partyError?: string | null;
  carriers?: { id: string; name: string }[];
  carrierError?: string | null;
  branches: { id: string; name: string }[];
  shops: HandoverShop[];
  specs: HandoverSpecs;
  formula: LabFormula | null;
  myName: string;
  locked: boolean;
  priorGross: number | null;
  hadLines: boolean;
  dispatchId: string | null;
  defaults: {
    branchId: string;
    shopId: string;
    date: string;
    shift: string;
    time: string;
    mccName: string;
    vehicle: string;
    driver: string;
    notes: string;
    accepted: "" | "yes" | "no";
    rejectionReason: string;
    licenseeRep: string;
    licenseeSignature: string;
    collectorSignature: string;
    lines: HandoverLineInput[];
    lrBaseline?: LrBaseline;
    partyId?: string;
    handoverReason?: "" | HandoverReason;
    rate?: string;
  };
}

function numOrNull(raw: string): number | null {
  const text = raw.trim();
  if (!text || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function HandoverForm(props: HandoverFormProps) {
  const { lang, specs, formula, locked } = props;
  const [state, action] = useFormState(saveMilkHandover, initial);
  const [branchId, setBranchId] = useState(props.defaults.branchId);
  const [shopId, setShopId] = useState(props.defaults.shopId);
  const [mccName, setMccName] = useState(props.defaults.mccName);
  const [accepted, setAccepted] = useState(props.defaults.accepted);
  const [licenseeSignature, setLicenseeSignature] = useState(props.defaults.licenseeSignature);
  const [collectorSignature, setCollectorSignature] = useState(props.defaults.collectorSignature);
  const [partyId, setPartyId] = useState(props.defaults.partyId ?? "");
  const [carrierChoice, setCarrierChoice] = useState("");
  const [reason, setReason] = useState<"" | HandoverReason>(props.defaults.handoverReason ?? "");
  const [date, setDate] = useState(props.defaults.date);
  const [shift, setShift] = useState(props.defaults.shift || "morning");
  const [rate, setRate] = useState(props.defaults.rate ?? "");
  const [chillerOpen, setChillerOpen] = useState<Record<number, boolean>>({});
  const skipStock = useRef(true);
  const destination = props.destination;
  const opening = initialBaseline(destination, props.defaults.lrBaseline, props.locked);
  const [baseline, setBaseline] = useState<LrBaseline>(opening);
  const [lines, setLines] = useState<HandoverLineInput[]>(() => {
    const start = props.defaults.lines.length > 0 ? props.defaults.lines : blankCertificateLines();
    const recipe = initialBaseline(destination, props.defaults.lrBaseline, props.locked);
    if (props.locked) return start;
    const saved = props.defaults.lrBaseline;
    if (destination !== "party" && saved && saved !== recipe) {
      return start.map((line) => applyAutoLab(line, props.formula, "inputs", recipe));
    }
    return start.map((line) => seedAutoLab(line, props.formula, recipe));
  });

  useEffect(() => {
    if (props.dispatchId || locked) return;
    if (skipStock.current) {
      skipStock.current = false;
      return;
    }
    if (!branchId) return;
    let cancel = false;
    void lookupChillerStock(branchId, date, shift).then((stock) => {
      if (cancel) return;
      setLines((prev) => absorbChillerStock(prev, stock));
    });
    return () => {
      cancel = true;
    };
  }, [branchId, date, shift, locked, props.dispatchId]);
  const parties = (props.parties ?? []).filter((party) => party.active || party.id === partyId);

  const parsed = useMemo(() => parseHandoverLines(lines), [lines]);
  const liveLines = "lines" in parsed ? parsed.lines : [];
  const flags = liveLines.flatMap((line) => lineSpecFlags(line, specs));
  const gross = liveLines.length ? grossTotal(liveLines) : null;
  const adjusted = liveLines.length ? adjustedTotal(liveLines) : null;
  const amount = props.canSeeRate ? handoverAmount(adjusted, numOrNull(rate)) : null;

  function patchLine(index: number, patch: Partial<HandoverLineInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function onLabSource(index: number, patch: Partial<HandoverLineInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? applyAutoLab({ ...line, ...patch }, formula, "inputs", baseline) : line)));
  }

  function onSnf(index: number, value: string) {
    setLines((prev) => prev.map((line, i) => (i === index ? applyAutoLab({ ...line, snf: value }, formula, "snf", baseline) : line)));
  }

  function onBaseline(next: LrBaseline) {
    setBaseline(next);
    setLines((prev) => prev.map((line) => applyAutoLab(line, formula, "inputs", next)));
  }

  function onShop(id: string) {
    setShopId(id);
    const shop = props.shops.find((s) => s.id === id);
    if (!shop) return;
    if (shop.branchId) setBranchId(shop.branchId);
    setMccName(shop.name);
  }

  const cell = "h-8 rounded-none px-1 text-xs";

  return (
    <form action={action} className="space-y-3 bg-white p-3 text-black dark:bg-white dark:text-black">
      {props.dispatchId && <input type="hidden" name="dispatch_id" value={props.dispatchId} />}
      {locked && (
        <>
          <input type="hidden" name="litres_locked" value="yes" />
          <input type="hidden" name="branch_id" value={branchId} />
          <input type="hidden" name="shop_id" value={shopId} />
          <input type="hidden" name="dispatch_date" value={date} />
          <input type="hidden" name="shift" value={shift} />
          <input type="hidden" name="collection_time" value={props.defaults.time} />
          <input type="hidden" name="mcc_name" value={mccName} />
          <input type="hidden" name="vehicle_name" value={props.defaults.vehicle} />
          <input type="hidden" name="driver_name" value={props.defaults.driver} />
        </>
      )}
      {!locked && <input type="hidden" name="lines_json" value={JSON.stringify(lines)} />}
      <input type="hidden" name="licensee_signature" value={licenseeSignature} />
      <input type="hidden" name="collector_signature" value={collectorSignature} />
      <input type="hidden" name="destination" value={destination} />
      <input type="hidden" name="lr_baseline" value={String(baseline)} />
      {destination === "party" && locked && (
        <>
          <input type="hidden" name="party_id" value={partyId} />
          <input type="hidden" name="handover_reason" value={reason} />
        </>
      )}

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {locked && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("mh_locked", lang)}</p>}
      {!props.hadLines && props.priorGross != null && props.priorGross > 0 && (
        <p className="rounded-lg bg-surface-50 px-3 py-2 text-sm text-surface-700">
          {t("mh_no_lines", lang)} ({formatQty(props.priorGross)} L)
        </p>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,0.8fr)]">
        <table className="w-full border-collapse border border-black text-xs">
          <tbody>
            <tr>
              <th className="w-36 border border-black px-1.5 py-1 text-left">Date:</th>
              <td className="border border-black p-1">
                <Input className={cell} type="date" name={locked ? undefined : "dispatch_date"} value={date} required disabled={locked} onChange={(e) => setDate(e.target.value)} />
              </td>
            </tr>
            <tr>
              <th className="border border-black px-1.5 py-1 text-left">MCC Name:</th>
              <td className="border border-black p-1">
                <Input className={cell} name={locked ? undefined : "mcc_name"} value={mccName} onChange={(e) => setMccName(e.target.value)} disabled={locked} />
              </td>
            </tr>
            <tr>
              <th className="border border-black px-1.5 py-1 text-left">Time of Collection:</th>
              <td className="border border-black p-1">
                <Input className={cell} type="time" name={locked ? undefined : "collection_time"} defaultValue={props.defaults.time} disabled={locked} />
              </td>
            </tr>
          </tbody>
        </table>
        <div className="px-2 pt-4 text-center">
          <h1 className="text-lg font-bold">Milk Handover Certificate</h1>
          <p className="text-sm font-semibold" data-testid="handover-destination">{destinationShareLine(destination)}</p>
        </div>
        <div className="justify-self-end pt-2 text-right leading-none">
          <div className="font-serif text-3xl font-bold text-[#e36f12]" dir="rtl">کسان</div>
          <div className="mt-1 text-[11px] font-semibold text-[#e36f12]">Kisan Pakistan</div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label>{t("mh_branch", lang)}</Label>
          <Select name={locked ? undefined : "branch_id"} value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={locked} required>
            <option value="">—</option>
            {props.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>MCC</Label>
          <Select name={locked ? undefined : "shop_id"} value={shopId} onChange={(e) => onShop(e.target.value)} disabled={locked}>
            <option value="">—</option>
            {props.shops.map((s) => (
              <option key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ""}{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("mh_shift", lang)}</Label>
          <Select name={locked ? undefined : "shift"} value={shift} disabled={locked} onChange={(e) => setShift(e.target.value)}>
            <option value="morning">{t("mh_morning", lang)}</option>
            <option value="evening">{t("mh_evening", lang)}</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Vehicle</Label>
            <Input name={locked ? undefined : "vehicle_name"} defaultValue={props.defaults.vehicle} disabled={locked} />
          </div>
          <div>
            <Label>Driver</Label>
            <Input name={locked ? undefined : "driver_name"} defaultValue={props.defaults.driver} disabled={locked} />
          </div>
        </div>
      </div>

      {!locked && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Kis ne uthaya (carrier)</Label>
            <select
              name="carrier_id"
              value={carrierChoice === "__new__" ? "" : carrierChoice}
              onChange={(e) => setCarrierChoice(e.target.value)}
              className="w-full rounded border px-2 py-2 text-sm"
            >
              <option value="">— chunein —</option>
              {(props.carriers ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ Naya vendor / transporter</option>
            </select>
            {props.carrierError && <p className="mt-1 text-xs text-amber-700">{props.carrierError}</p>}
          </div>
          {carrierChoice === "__new__" && (
            <div>
              <Label>Naya naam</Label>
              <Input name="new_carrier_name" maxLength={120} placeholder="Vendor ka naam" />
            </div>
          )}
        </div>
      )}

      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded border border-black px-3 py-2 text-sm" data-testid="handover-recipe">
        <legend className="px-1 font-semibold">{t("mh_recipe", lang)}</legend>
        {destination === "party" ? (
          <>
            <p className="w-full text-xs text-neutral-700">{t("mh_recipe_party_note", lang)}</p>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="party_lr_choice" checked={baseline === 20} disabled={locked} onChange={() => onBaseline(20)} />
              {t("mh_recipe_20", lang)}
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="party_lr_choice" checked={baseline === 22} disabled={locked} onChange={() => onBaseline(22)} />
              {t("mh_recipe_22", lang)}
            </label>
          </>
        ) : (
          <p data-testid="handover-recipe-fixed">
            {destination === "vendor" ? t("mh_recipe_22", lang) : t("mh_recipe_20", lang)}
            {" — "}
            {destination === "vendor" ? t("mh_recipe_fixed_22", lang) : t("mh_recipe_fixed_20", lang)}
          </p>
        )}
      </fieldset>
      {!locked && destination === "company" && props.defaults.lrBaseline === 22 && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">{t("mh_was_22", lang)}</p>
      )}

      {destination === "party" && (
        <div className="grid gap-2 rounded border border-black p-2 sm:grid-cols-2" data-testid="handover-party">
          {props.partyError && <p className="sm:col-span-2 text-sm text-red-700">{props.partyError}</p>}
          <div>
            <Label>{t("mh_party_pick", lang)}</Label>
            <Select name={locked ? undefined : "party_id"} value={partyId} onChange={(e) => setPartyId(e.target.value)} disabled={locked}>
              <option value="">—</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}{party.contact ? ` · ${party.contact}` : ""}{party.active ? "" : " (band)"}
                </option>
              ))}
              {!locked && <option value="new">{t("mh_party_new", lang)}</option>}
            </Select>
          </div>
          <div>
            <Label>{t("mh_reason", lang)}</Label>
            <Select name={locked ? undefined : "handover_reason"} value={reason} onChange={(e) => setReason(e.target.value as "" | HandoverReason)} disabled={locked}>
              <option value="">{t("mh_reason_none", lang)}</option>
              <option value="sale">{t("mh_reason_sale", lang)}</option>
              <option value="given">{t("mh_reason_given", lang)}</option>
              <option value="spoil">{t("mh_reason_spoil", lang)}</option>
              <option value="other">{t("mh_reason_other", lang)}</option>
            </Select>
          </div>
          {partyId === "new" && !locked && (
            <>
              <div>
                <Label>{t("mh_party_name", lang)}</Label>
                <Input name="party_name" />
              </div>
              <div>
                <Label>{t("mh_party_contact", lang)}</Label>
                <Input name="party_contact" />
              </div>
            </>
          )}
          <p className="sm:col-span-2 text-xs text-neutral-600">{t("mh_reason_hint", lang)}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse border border-black text-center text-xs">
          <thead>
            <tr>
              {["Chiller No.", "Milk Type", "Gross Vol (L)", "Fat %", "LR", "SNF", "TS (SNF+FAT%)", "Sp. Gravity", "Milk (kg)", "Adjusted Volume (L)", "Temperature", "Organo", ""].map((h) => (
                <th key={h || "x"} className="border border-black px-1 py-1 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const fat = numOrNull(line.fat);
              const rawLr = numOrNull(line.lr);
              const temp = numOrNull(line.temperatureC);
              const corr = lrCorrection(rawLr, temp, baseline);
              const snf = numOrNull(line.snf);
              const lrNote = lrCorrectionLabel(rawLr, temp, baseline);
              const flagsFor = lineSpecFlags(
                { chillerNo: line.chillerNo || String(index + 1), fat, lr: corr?.corrected ?? rawLr, snf },
                specs
              );
              const bad = new Set(flagsFor.map((f) => f.field));
              const warn = (field: "fat" | "lr" | "snf") => (bad.has(field) ? "bg-amber-100" : "");
              const labLr = corr?.corrected ?? null;
              const density = labLr != null && labLr > 0 ? milkDensity(labLr, numOrNull(line.grossL)) : null;
              const chillerLocked = true; // naam sirf master list se (admin badalta hai)
              return (
                <tr key={index}>
                  <td className="border border-black p-0.5">
                    <div className="flex items-center gap-0.5">
                      <Input
                        className={cell}
                        value={line.chillerNo}
                        readOnly={chillerLocked || locked}
                        disabled={locked}
                        onChange={(e) => patchLine(index, { chillerNo: e.target.value })}
                        onBlur={() => {
                          if (line.chillerNo.trim()) setChillerOpen((prev) => ({ ...prev, [index]: false }));
                        }}
                        aria-label={`Chiller ${index + 1}`}
                      />
                    </div>
                  </td>
                  <td className="border border-black p-0.5">
                    <Input className={cell} list="milk-types" value={line.milkType} disabled={locked} onChange={(e) => patchLine(index, { milkType: e.target.value })} aria-label={`Milk type ${index + 1}`} />
                  </td>
                  <td className="border border-black p-0.5">
                    <Input className={cell} inputMode="decimal" value={line.grossL} disabled={locked} onChange={(e) => onLabSource(index, { grossL: e.target.value })} aria-label={`Gross ${index + 1}`} />
                  </td>
                  <td className="border border-black p-0.5">
                    <Input className={`${cell} ${warn("fat")}`} inputMode="decimal" value={line.fat} disabled={locked} onChange={(e) => onLabSource(index, { fat: e.target.value })} aria-label={`FAT ${index + 1}`} />
                  </td>
                  <td className="border border-black p-0.5">
                    <Input className={`${cell} ${warn("lr")}`} inputMode="decimal" value={line.lr} disabled={locked} title="Lactometer reading (raw). 20°C correction shows under the box." onChange={(e) => onLabSource(index, { lr: e.target.value })} aria-label={`LR ${index + 1}`} />
                    {lrNote && <p className="px-0.5 text-[10px] leading-tight text-neutral-700">{lrNote}</p>}
                    {corr?.tempMissing && <p className="px-0.5 text-[10px] leading-tight text-neutral-500">{t("mh_lr_need_temp", lang)}</p>}
                  </td>
                  <td className="border border-black p-0.5">
                    <Input className={`${cell} ${warn("snf")}`} inputMode="decimal" value={line.snf} disabled={locked} onChange={(e) => onSnf(index, e.target.value)} aria-label={`SNF ${index + 1}`} />
                  </td>
                  <td className="border border-black px-1 py-1">{formatLab(tsOf(fat, snf))}</td>
                  <td className="border border-black px-1 py-1">{density ? formatLab(density.specificGravity) : "—"}</td>
                  <td className="border border-black px-1 py-1">{density ? formatLab(density.milkKg) : "—"}</td>
                  <td className="border border-black p-0.5">
                    <Input className={cell} inputMode="decimal" value={line.adjustedL} disabled={locked} onChange={(e) => patchLine(index, { adjustedL: e.target.value })} aria-label={`Adjusted ${index + 1}`} />
                  </td>
                  <td className="border border-black p-0.5">
                    <Input className={cell} inputMode="decimal" value={line.temperatureC} disabled={locked} onChange={(e) => onLabSource(index, { temperatureC: e.target.value })} aria-label={`Temperature ${index + 1}`} />
                  </td>
                  <td className="border border-black p-0.5">
                    <Input className={cell} list="organo-values" placeholder="Pass / Fail" value={line.organo} disabled={locked} onChange={(e) => patchLine(index, { organo: e.target.value })} aria-label={`Organo ${index + 1}`} />
                  </td>
                  <td className="border border-black p-0.5">
                    {!locked && lines.length > 1 && (
                      <button
                        type="button"
                        className="px-1 text-neutral-500"
                        onClick={() => {
                          setLines((prev) => prev.filter((_, i) => i !== index));
                          setChillerOpen((prev) => {
                            const next: Record<number, boolean> = {};
                            for (const [key, open] of Object.entries(prev)) {
                              const at = Number(key);
                              if (at === index) continue;
                              next[at > index ? at - 1 : at] = open;
                            }
                            return next;
                          });
                        }}
                        aria-label="Hataen"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-neutral-200 font-semibold">
              <td className="border border-black px-1 py-1" colSpan={2}>Total</td>
              <td className="border border-black px-1 py-1">{gross == null ? "—" : formatQty(gross)}</td>
              <td className="border border-black px-1 py-1" colSpan={6} />
              <td className="border border-black bg-neutral-300 px-1 py-1">{adjusted == null ? "—" : formatLab(adjusted)}</td>
              <td className="border border-black px-1 py-1" colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
      <datalist id="milk-types">
        <option value="Cow" />
        <option value="Buffalo" />
        <option value="Mixed" />
      </datalist>
      <datalist id="organo-values">
        <option value="Pass" />
        <option value="Fail" />
      </datalist>

      {/* Chiller ki qatarein master list se hain. Naya chiller sirf master list mein admin jorta hai. */}

      <p className="text-[11px] text-neutral-500">{t("mh_chiller_lock", lang)} {t("mh_suggest", lang)}</p>
      {props.canSeeRate && (
        <div className="grid max-w-md gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="handover-internal-rate">
          <div>
            <Label>{t("mh_rate", lang)}</Label>
            <Input name="internal_rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <p>
            <span className="font-semibold">{t("mh_amount", lang)}: </span>
            {amount == null ? t("mh_amount_pending", lang) : `Rs ${amount.toFixed(2)}`}
          </p>
          <p className="text-xs text-neutral-600">{t("mh_rate_private", lang)}</p>
        </div>
      )}
      {flags.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-semibold">{t("mh_spec_warn", lang)}</p>
          <ul className="mt-1 list-disc pl-4">
            {flags.map((flag) => (
              <li key={`${flag.chillerNo}-${flag.field}`}>{specFlagText(flag)}</li>
            ))}
          </ul>
        </div>
      )}
      {"error" in parsed && liveLines.length === 0 && lines.some((l) => l.chillerNo || l.grossL) && (
        <p className="text-xs text-red-700">{parsed.error}</p>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">Accepted :</span>
          <label className="inline-flex items-center gap-1">
            <input type="radio" name="accepted" value="" checked={accepted === ""} onChange={() => setAccepted("")} />
            {t("mh_pending", lang)}
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="radio" name="accepted" value="yes" checked={accepted === "yes"} onChange={() => setAccepted("yes")} />
            YES
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="radio" name="accepted" value="no" checked={accepted === "no"} onChange={() => setAccepted("no")} />
            NO
          </label>
        </div>
        <div>
          <Label>Rejected (Reasons)</Label>
          <Input name="rejection_reason" defaultValue={props.defaults.rejectionReason} disabled={accepted === "yes"} />
        </div>
      </div>

      <div className="grid items-end gap-4 lg:grid-cols-[1.1fr_1.4fr_0.7fr]">
        <div className="border border-black p-2">
          <Label>Licensee/Rep Name</Label>
          <Input name="licensee_rep_name" defaultValue={props.defaults.licenseeRep} />
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs">Licensee Signature</p>
            <Input value={licenseeSignature} onChange={(e) => setLicenseeSignature(e.target.value)} />
          </div>
          <div>
            <p className="text-xs">Collector Signature</p>
            <div className="flex gap-2">
              <Input value={collectorSignature} onChange={(e) => setCollectorSignature(e.target.value)} />
              {props.myName && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setCollectorSignature(props.myName)}>
                  {t("mh_sign_me", lang)}
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="justify-self-end text-xs">
          <p className="border-b border-black text-right italic">Min Specs</p>
          <table className="border-collapse border border-black">
            <tbody>
              <tr>
                <th className="border border-black px-2 py-0.5 text-left">FAT %</th>
                <td className="border border-black px-2 py-0.5 text-right">{specs.minFat}</td>
              </tr>
              <tr>
                <th className="border border-black px-2 py-0.5 text-left">LR</th>
                <td className="border border-black px-2 py-0.5 text-right">{specs.minLr}</td>
              </tr>
              <tr>
                <th className="border border-black px-2 py-0.5 text-left">SNF</th>
                <td className="border border-black px-2 py-0.5 text-right">{specs.minSnf}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Input name="notes" defaultValue={props.defaults.notes} />
      </div>

      <SubmitButton lang={lang} />
    </form>
  );
}

function SubmitButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("mh_saving", lang) : t("mh_save", lang)}
    </Button>
  );
}
