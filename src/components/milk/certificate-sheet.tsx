import { formatQty, specFlagText, type HandoverSpecs, type SpecFlag } from "@/lib/milk-handover";

export interface CertificateLineView {
  chillerNo: string;
  milkType: string;
  grossL: number | null;
  fat: number | null;
  lr: number | null;
  snf: number | null;
  ts: number | null;
  adjustedL: number | null;
  temperatureC: number | null;
  organo: string | null;
  flags: SpecFlag[];
}

export interface CertificateView {
  mccName: string;
  date: string;
  time: string;
  shiftLabel: string;
  lines: CertificateLineView[];
  grossTotal: number | null;
  adjustedTotal: number | null;
  accepted: boolean | null;
  rejectionReason: string | null;
  licenseeRep: string | null;
  licenseeSignature: string | null;
  collectorSignature: string | null;
  vehicle: string | null;
  driver: string | null;
  specs: HandoverSpecs;
  flags: SpecFlag[];
}

function cell(value: string) {
  return value || "\u00a0";
}

/**
 * Kaghaz jaisa certificate. Public naam Kisan Pakistan.
 * Slogan yahan nahi.
 */
export function CertificateSheet({ cert }: { cert: CertificateView }) {
  const rows = cert.lines.length > 0 ? cert.lines : [];
  const pad = Math.max(0, 6 - rows.length);
  return (
    <article className="mx-auto max-w-[1100px] bg-white p-3 text-[11px] text-black print:max-w-none print:p-0">
      <header className="mb-2 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr>
              <th className="w-28 border border-black px-1.5 py-1 text-left font-semibold">Date:</th>
              <td className="border border-black px-1.5 py-1">{cell(cert.date)}</td>
            </tr>
            <tr>
              <th className="border border-black px-1.5 py-1 text-left font-semibold">MCC Name:</th>
              <td className="border border-black px-1.5 py-1">{cell(cert.mccName)}</td>
            </tr>
            <tr>
              <th className="border border-black px-1.5 py-1 text-left font-semibold">Time of Collection:</th>
              <td className="border border-black px-1.5 py-1">
                {cell(cert.time)}
                {cert.shiftLabel ? <span className="text-neutral-600"> · {cert.shiftLabel}</span> : null}
              </td>
            </tr>
          </tbody>
        </table>
        <h1 className="pt-6 text-center text-lg font-bold tracking-tight">Milk Handover Certificate</h1>
        <div className="justify-self-end pt-4 text-right leading-none">
          <div className="font-serif text-3xl font-bold text-[#e36f12]" dir="rtl">
            کسان
          </div>
          <div className="mt-1 text-[10px] font-semibold tracking-wide text-[#e36f12]">Kisan Pakistan</div>
        </div>
      </header>

      <table className="w-full border-collapse border border-black text-center">
        <thead>
          <tr>
            {[
              "Chiller No.",
              "Milk Type",
              "Gross Vol (L)",
              "Fat %",
              "LR",
              "SNF",
              "TS (SNF+FAT%)",
              "Adjusted Volume (L)",
              "Temperature",
              "Organo",
            ].map((h) => (
              <th key={h} className="border border-black px-1 py-1 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((line, i) => {
            const bad = new Set(line.flags.map((f) => f.field));
            const mark = (field: SpecFlag["field"], text: string) => (
              <span className={bad.has(field) ? "bg-amber-200 px-0.5 font-semibold" : undefined}>{text}</span>
            );
            return (
              <tr key={`${line.chillerNo}-${i}`}>
                <td className="border border-black px-1 py-1">{cell(line.chillerNo)}</td>
                <td className="border border-black px-1 py-1">{cell(line.milkType)}</td>
                <td className="border border-black px-1 py-1">{line.grossL == null ? "\u00a0" : formatQty(line.grossL)}</td>
                <td className="border border-black px-1 py-1">{mark("fat", line.fat == null ? "\u00a0" : formatQty(line.fat))}</td>
                <td className="border border-black px-1 py-1">{mark("lr", line.lr == null ? "\u00a0" : formatQty(line.lr))}</td>
                <td className="border border-black px-1 py-1">{mark("snf", line.snf == null ? "\u00a0" : formatQty(line.snf))}</td>
                <td className="border border-black px-1 py-1">{line.ts == null ? "\u00a0" : formatQty(line.ts)}</td>
                <td className="border border-black px-1 py-1">{line.adjustedL == null ? "\u00a0" : formatQty(line.adjustedL)}</td>
                <td className="border border-black px-1 py-1">{line.temperatureC == null ? "\u00a0" : formatQty(line.temperatureC)}</td>
                <td className="border border-black px-1 py-1">{cell(line.organo ?? "")}</td>
              </tr>
            );
          })}
          {Array.from({ length: pad }, (_, i) => (
            <tr key={`pad-${i}`}>
              {Array.from({ length: 10 }, (__, c) => (
                <td key={c} className="border border-black px-1 py-2">
                  {"\u00a0"}
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-neutral-200 font-semibold">
            <td className="border border-black px-1 py-1 text-center" colSpan={2}>
              Total
            </td>
            <td className="border border-black px-1 py-1">{cert.grossTotal == null ? "\u00a0" : formatQty(cert.grossTotal)}</td>
            <td className="border border-black px-1 py-1" colSpan={4} />
            <td className="border border-black bg-neutral-300 px-1 py-1">
              {cert.adjustedTotal == null ? "\u00a0" : formatQty(cert.adjustedTotal)}
            </td>
            <td className="border border-black px-1 py-1" colSpan={2} />
          </tr>
        </tbody>
      </table>

      {cert.flags.length > 0 && (
        <p className="mt-1 text-[10px] text-amber-800">
          Min spec se neeche: {cert.flags.map(specFlagText).join(" · ")}
        </p>
      )}

      <div className="mt-3 space-y-2">
        <p>
          <span className="font-semibold">Accepted :</span>{" "}
          <span className={cert.accepted === true ? "font-bold underline" : "text-neutral-500"}>YES</span>
          {" / "}
          <span className={cert.accepted === false ? "font-bold underline" : "text-neutral-500"}>NO</span>
          {cert.accepted == null ? <span className="text-neutral-500"> — faisla baqi</span> : null}
        </p>
        <p className="flex gap-2">
          <span className="shrink-0 font-semibold">Rejected (Reasons) :</span>
          <span className="min-h-[1.25rem] flex-1 border-b border-black">{cert.rejectionReason || "\u00a0"}</span>
        </p>
      </div>

      <footer className="mt-6 grid grid-cols-[1.1fr_1.4fr_0.8fr] items-end gap-4">
        <div className="border border-black px-2 py-3">
          <p className="text-[10px] font-semibold">Licensee/Rep Name:</p>
          <p className="mt-2 min-h-[1.25rem]">{cert.licenseeRep || "\u00a0"}</p>
        </div>
        <div className="space-y-3 text-center">
          <div>
            <p className="text-[10px]">Licensee Signature</p>
            <p className="mx-auto mt-1 min-h-[1.5rem] w-48 border-b border-black font-serif text-sm italic">
              {cert.licenseeSignature || "\u00a0"}
            </p>
          </div>
          <div>
            <p className="text-[10px]">Collector Signature</p>
            <p className="mx-auto mt-1 min-h-[1.5rem] w-48 border-b border-black font-serif text-sm italic">
              {cert.collectorSignature || "\u00a0"}
            </p>
          </div>
        </div>
        <div className="justify-self-end">
          <p className="border-b border-black text-right text-[10px] italic">Min Specs</p>
          <table className="border-collapse border border-black">
          <tbody>
            <tr>
              <th className="border border-black px-2 py-0.5 text-left font-semibold">FAT %</th>
              <td className="border border-black px-2 py-0.5 text-right">{cert.specs.minFat}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-0.5 text-left font-semibold">LR</th>
              <td className="border border-black px-2 py-0.5 text-right">{cert.specs.minLr}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-0.5 text-left font-semibold">SNF</th>
              <td className="border border-black px-2 py-0.5 text-right">{cert.specs.minSnf}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </footer>

      {(cert.vehicle || cert.driver) && (
        <p className="mt-3 text-[10px] text-neutral-600">
          {cert.vehicle ? `Vehicle: ${cert.vehicle}` : ""}
          {cert.vehicle && cert.driver ? " · " : ""}
          {cert.driver ? `Driver: ${cert.driver}` : ""}
        </p>
      )}
    </article>
  );
}
