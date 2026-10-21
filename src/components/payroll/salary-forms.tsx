"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { proposeIncrement, recordCounter, sendItemizedOffer, setOfferStatus, setLinePayment, type OfferState } from "@/actions/salary-offer";
import { incrementPreview, PAY_METHODS } from "@/lib/payroll/salary-offer";
import { pkr } from "@/lib/recovery/credit-report";
import { Chip, SO_BTN, SO_BTN2, SO_INPUT, SO_LABEL, SO_MUTED } from "./salary-ui";

const init: OfferState = {};
function Msg({ s }: { s: OfferState }) {
  if (s.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{s.error}</p>;
  if (s.success) return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">{s.success}</p>;
  return null;
}
function Btn({ label, secondary, name, value, formAction }: { label: string; secondary?: boolean; name?: string; value?: string; formAction?: (fd: FormData) => void }) {
  const { pending } = useFormStatus();
  return <button type="submit" name={name} value={value} formAction={formAction} disabled={pending} className={secondary ? SO_BTN2 : SO_BTN}>{pending ? "..." : label}</button>;
}
const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div><label className={SO_LABEL}>{label}</label>{children}</div>;

export interface OfferDefaults {
  basic?: number | null; house_rent?: number | null; travel?: number | null; mobile?: number | null;
  bonus?: string | null; incentive_pct?: number | null; incentive_rule?: string | null;
  probation_months?: number | null; joining_date?: string | null; designation?: string | null;
}

/** Mockup 1, daayan card: "Hamari offer bhejein / badlein". */
export function OfferForm({ applicationId, offerId, status, d, canWrite }: { applicationId: string; offerId: string | null; status: string | null; d: OfferDefaults; canWrite: boolean }) {
  const [sState, sAction] = useFormState(sendItemizedOffer, init);
  const [cState, cAction] = useFormState(recordCounter, init);
  const [tState, tAction] = useFormState(setOfferStatus, init);
  const v = (x: unknown) => (x == null ? "" : String(x));
  const accepted = status === "accepted";
  return (
    <form action={sAction} className="space-y-3">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="designation" value={v(d.designation)} />
      {offerId && <input type="hidden" name="offer_id" value={offerId} />}
      <div className="grid grid-cols-2 gap-4">
        <F label="Basic"><input name="basic" type="number" min={1} defaultValue={v(d.basic)} className={SO_INPUT} disabled={!canWrite || accepted} /></F>
        <F label="Ghar ka kiraya"><input name="house_rent" type="number" min={0} defaultValue={v(d.house_rent)} className={SO_INPUT} disabled={!canWrite || accepted} /></F>
        <F label="Safar"><input name="travel" type="number" min={0} defaultValue={v(d.travel)} className={SO_INPUT} disabled={!canWrite || accepted} /></F>
        <F label="Mobile"><input name="mobile" type="number" min={0} defaultValue={v(d.mobile)} className={SO_INPUT} disabled={!canWrite || accepted} /></F>
        <F label="Bonus"><input name="bonus" placeholder="1 basic / saal" defaultValue={v(d.bonus)} className={SO_INPUT} disabled={!canWrite || accepted} /></F>
        <F label="Achhe kaam ka inaam">
          <div className="flex gap-2">
            <input name="incentive_pct" type="number" step="0.1" min={0} max={100} placeholder="%" defaultValue={v(d.incentive_pct)} className={`${SO_INPUT} w-20`} disabled={!canWrite || accepted} />
            <input name="incentive_rule" placeholder="target 100%+" defaultValue={v(d.incentive_rule)} className={SO_INPUT} disabled={!canWrite || accepted} />
          </div>
        </F>
        <F label="Probation muddat (maah)"><input name="probation_months" type="number" min={0} max={24} defaultValue={v(d.probation_months)} className={SO_INPUT} disabled={!canWrite || accepted} /></F>
        <F label="Joining tareekh"><input name="joining_date" type="date" defaultValue={v(d.joining_date)} className={SO_INPUT} disabled={!canWrite || accepted} /></F>
      </div>
      <div>
        <label className={SO_LABEL}>Offer status</label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={status === "pending" ? "ring-2 ring-blue-300 rounded-full" : ""}><Chip tone="bl">Bheji</Chip></span>
          {offerId && canWrite && !accepted ? (
            <>
              <button type="submit" formAction={tAction} name="status" value="accepted" className="rounded-full"><Chip tone="gr">Qubool ✓</Chip></button>
              <button type="submit" formAction={tAction} name="status" value="rejected" className="rounded-full"><Chip tone="rd">Radd</Chip></button>
            </>
          ) : (
            <><span className={accepted ? "ring-2 ring-green-300 rounded-full" : ""}><Chip tone="gr">Qubool ✓</Chip></span><span className={status === "rejected" ? "ring-2 ring-red-300 rounded-full" : ""}><Chip tone="rd">Radd</Chip></span></>
          )}
          <span className={status === "countered" ? "ring-2 ring-amber-300 rounded-full" : ""}><Chip tone="am">Mol-tol counter</Chip></span>
        </div>
      </div>
      <Msg s={sState} /><Msg s={cState} /><Msg s={tState} />
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {accepted ? (
            <>
              <button type="button" disabled className={SO_BTN} title="Offer qubool ho chuki">Chalu karein — offer bhejein</button>
              <button type="button" disabled className={SO_BTN2} title="Offer qubool ho chuki">Counter darj karein</button>
            </>
          ) : (
            <>
              <Btn label="Chalu karein — offer bhejein" />
              {offerId && <Btn secondary label="Counter darj karein" formAction={cAction} />}
            </>
          )}
        </div>
      )}
      {canWrite && !accepted && offerId && <p className={SO_MUTED}>Counter: upar candidate ki maangi hui raqamein likh kar &quot;Counter darj karein&quot; dabayein.</p>}
      {accepted && <p className={SO_MUTED}>Offer qubool ho chuki. Ab Tankhwah ka Dhancha par &quot;Qubool offer se structure banao&quot;.</p>}
    </form>
  );
}

/** Mockup 3, daayan card: "Barhotri tay karein". */
export function IncrementForm({ profileId, current, dueDate, canWrite }: { profileId: string; current: number; dueDate: string | null; canWrite: boolean }) {
  const [s, a] = useFormState(proposeIncrement, init);
  const [basic, setBasic] = useState<string>("");
  const [pct, setPct] = useState<string>("");
  const pv = incrementPreview(current, basic ? Number(basic) : null, pct ? Number(pct) : null);
  return (
    <form action={a} className="space-y-3">
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="current_basic" value={current} />
      <div className="grid grid-cols-2 gap-4">
        <F label="Laagu tareekh"><input name="effective_from" type="date" required defaultValue={dueDate ?? ""} className={SO_INPUT} /></F>
        <F label="Wajah">
          <select name="change_reason" defaultValue="annual" className={SO_INPUT}>
            <option value="annual">Saalana</option><option value="performance">Performance</option><option value="promotion">Promotion</option><option value="inflation">Mehngai</option>
          </select>
        </F>
        <F label="Naya basic"><input name="basic" type="number" min={1} value={basic} onChange={(e) => { setBasic(e.target.value); if (e.target.value) setPct(""); }} className={SO_INPUT} /></F>
        <F label="ya %"><input name="pct" type="number" step="0.1" min={0} value={pct} onChange={(e) => { setPct(e.target.value); if (e.target.value) setBasic(""); }} className={SO_INPUT} /></F>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Chip tone="gy">{pkr(current)}</Chip><span className="text-gray-400">→</span>
        {pv ? <Chip tone="gr">{pkr(pv.basic)} ({pv.amount >= 0 ? "+" : "−"}{pkr(Math.abs(pv.amount))} · {pv.pct >= 0 ? "+" : ""}{pv.pct}%)</Chip> : <Chip tone="gy">—</Chip>}
      </div>
      <F label="Note"><textarea name="notes" rows={2} className={SO_INPUT} /></F>
      <Msg s={s} />
      {canWrite ? <Btn label="Chalu karein — Draft structure banao" /> : <p className={SO_MUTED}>Apni barhotri khud tay nahi ki ja sakti.</p>}
      <p className={SO_MUTED}>Naya structure Draft banega, doosre admin ki approval ke baad laagu.</p>
    </form>
  );
}

/** Slip par adaigi ka tareeqa/hawala (Admin/Owner). */
export function LinePaymentForm({ lineId, method, reference }: { lineId: string; method: string | null; reference: string | null }) {
  const [s, a] = useFormState(setLinePayment, init);
  return (
    <form action={a} className="flex flex-wrap items-center gap-2 print:hidden">
      <input type="hidden" name="line_id" value={lineId} />
      <select name="pay_method" defaultValue={method ?? "bank_transfer"} className={`${SO_INPUT} w-auto`}>
        {Object.entries(PAY_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <input name="pay_ref" defaultValue={reference ?? ""} placeholder="Ref / TXN" className={`${SO_INPUT} w-40`} />
      <Btn secondary label="Hawala save" />
      <Msg s={s} />
    </form>
  );
}
