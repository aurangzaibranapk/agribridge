import { notFound } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { CertificateSheet, type CertificateLineView } from "@/components/milk/certificate-sheet";
import { adjustedTotal, certificateShareFromInputs, grossTotal, lineSpecFlags, lrCorrection, tsOf, varianceForCertificate, type ParsedLine } from "@/lib/milk-handover";
import { HandoverVarianceCard } from "../../variance-card";
import { handoverGate, loadCertificate, loadHandoverOptions } from "@/lib/milk-handover-page";
import { CertificatePrintBar } from "../../print-bar";

export const dynamic = "force-dynamic";

export default async function HandoverPrintPage({ params }: { params: { id: string } }) {
  const lang = getLanguageFromCookies("rm");
  const gate = await handoverGate("view");
  if ("error" in gate) return <p className="p-8 text-center text-sm">{gate.error}</p>;
  const row = await loadCertificate(params.id);
  if ("error" in row) return <p className="p-8 text-center text-sm">{row.error}</p>;
  if ("missing" in row) notFound();
  if (gate.branchId && (gate.role === "manager" || gate.role === "milk_collection") && row.branchId !== gate.branchId) {
    return <p className="p-8 text-center text-sm">Ye aapki branch ki rawangi nahi.</p>;
  }

  const options = await loadHandoverOptions();
  const parsed: ParsedLine[] = row.lines.map((line) => ({
    chillerNo: line.chillerNo,
    milkType: line.milkType,
    grossL: Number(line.grossL),
    fat: line.fat === "" ? null : Number(line.fat),
    lr: line.lr === "" ? null : Number(line.lr),
    snf: line.snf === "" ? null : Number(line.snf),
    adjustedL: line.adjustedL === "" ? null : Number(line.adjustedL),
    temperatureC: line.temperatureC === "" ? null : Number(line.temperatureC),
    organo: line.organo || null,
  }));
  const lines: CertificateLineView[] = parsed.map((line) => {
    const corr = lrCorrection(line.lr, line.temperatureC, row.lrBaseline);
    return {
      ...line,
      ts: tsOf(line.fat, line.snf),
      flags: lineSpecFlags({ ...line, lr: corr?.corrected ?? line.lr }, options.specs),
    };
  });
  const flags = lines.flatMap((line) => line.flags);
  const share = certificateShareFromInputs({
    mccName: row.mccName,
    date: row.date,
    time: row.time,
    shiftLabel: row.shift === "evening" ? t("mh_evening", lang) : t("mh_morning", lang),
    vehicle: row.vehicle,
    driver: row.driver,
    lines: row.lines,
    accepted: row.accepted,
    rejectionReason: row.rejectionReason,
    grossFallback: row.priorGross,
    lrBaseline: row.lrBaseline,
    destination: row.destination,
    partyName: row.partyName,
    handoverReason: row.handoverReason || null,
  });
  const variance = varianceForCertificate(
    parsed.map((line) => ({ grossL: line.grossL, adjustedL: line.adjustedL })),
    row.priorGross,
    row.received
  );

  return (
    <div>
      <CertificatePrintBar
        lang={lang}
        editHref={`/admin/milk-collection/handover/${row.id}`}
        shareText={share.text}
        emailSubject={share.subject}
      />
      <HandoverVarianceCard
        lang={lang}
        title={t("mh_shift_title", lang)}
        variance={variance}
        grossLabel={t("mh_slip_gross", lang)}
        receivedLabel={t("mh_slip_receipt", lang)}
        gapLabel={t("mh_slip_gap", lang)}
      />
      <CertificateSheet
        cert={{
          mccName: row.mccName,
          date: row.date,
          time: row.time,
          shiftLabel: row.shift === "evening" ? t("mh_evening", lang) : t("mh_morning", lang),
          lines,
          grossTotal: parsed.length ? grossTotal(parsed) : row.priorGross,
          adjustedTotal: parsed.length ? adjustedTotal(parsed) : null,
          accepted: row.accepted === "" ? null : row.accepted === "yes",
          rejectionReason: row.rejectionReason || null,
          licenseeRep: row.licenseeRep || null,
          licenseeSignature: row.licenseeSignature || null,
          collectorSignature: row.collectorSignature || null,
          vehicle: row.vehicle || null,
          driver: row.driver || null,
          specs: options.specs,
          flags,
          lrBaseline: row.lrBaseline,
          destination: row.destination,
          partyName: row.partyName,
          handoverReason: row.handoverReason || null,
        }}
      />
    </div>
  );
}
