import assert from "node:assert/strict";
import {
  PAPER_FORMULA,
  PAPER_SPECS,
  adjustedTotal,
  applyAutoLab,
  blankCertificateLines,
  certificateShareText,
  dayMilkVariance,
  absorbChillerStock,
  canSeeHandoverRate,
  chillerStockRows,
  formulaFromRateRow,
  handoverAmount,
  internalAmountTotal,
  milkDensity,
  baselineForDestination,
  chillerIntake,
  dayDestinationSummary,
  gapKind,
  grossTotal,
  initialBaseline,
  lineSpecFlags,
  lrCorrectionLabel,
  lrCorrectionPoints,
  milkVariance,
  parseHandoverLines,
  parseHandoverReason,
  specFlagText,
  suggestLab,
  tsOf,
  type HandoverLineInput,
} from "../src/lib/milk-handover";

function line(patch: Partial<HandoverLineInput> = {}): HandoverLineInput {
  return {
    chillerNo: "",
    milkType: "",
    grossL: "",
    fat: "",
    lr: "",
    snf: "",
    adjustedL: "",
    temperatureC: "",
    organo: "",
    ...patch,
  };
}

const empty = parseHandoverLines(blankCertificateLines());
assert.ok("error" in empty, "khali certificate rukna chahiye");

const blanks = parseHandoverLines([line(), line({ organo: "   " })]);
assert.ok("error" in blanks);

const one = parseHandoverLines([
  line(),
  line({
    chillerNo: "1",
    milkType: "Cow",
    grossL: "120.5",
    fat: "3.8",
    lr: "27",
    snf: "8.4",
    adjustedL: "",
    temperatureC: "4",
    organo: "Normal",
  }),
]);
assert.ok("lines" in one);
assert.equal(one.lines.length, 1);
assert.equal(one.lines[0].grossL, 120.5);
assert.equal(one.lines[0].adjustedL, null, "khali adjusted 0 nahi banta");
assert.equal(one.lines[0].fat, 3.8);

const flags = lineSpecFlags(one.lines[0], PAPER_SPECS);
assert.deepEqual(flags.map((f) => f.field), ["fat"]);
assert.match(specFlagText(flags[0]), /min 4\.1/);
assert.equal(lineSpecFlags({ chillerNo: "1", fat: 4.1, lr: 27, snf: 8.4 }, PAPER_SPECS).length, 0);
assert.equal(tsOf(4.2, 8.5), 12.7);
assert.equal(tsOf(4.2, null), null);

const partial = [
  { grossL: 10, adjustedL: 9 },
  { grossL: 5, adjustedL: null },
];
assert.equal(grossTotal(partial), 15);
assert.equal(adjustedTotal(partial), null, "aadha adjusted total jhoot hai");
assert.equal(adjustedTotal([{ grossL: 10, adjustedL: 9 }, { grossL: 5, adjustedL: 4 }]), 13);

assert.deepEqual(suggestLab(100, 4, 28, null, null), { snf: null, adjusted: null });
const hinted = suggestLab(100, 4, 28, null, { snfConstant: 0.805, referenceTs: 13 });
assert.ok(hinted.snf != null && hinted.adjusted != null);
assert.equal(suggestLab(100, 4, 28, 8.6, { snfConstant: 0.805, referenceTs: 13 }).snf, null);

const bad = parseHandoverLines([line({ chillerNo: "2", milkType: "Cow", grossL: "abc" })]);
assert.ok("error" in bad);

assert.equal(lrCorrectionPoints(20, 20), 0);
assert.equal(lrCorrectionPoints(20.1, 20), 1);
assert.equal(lrCorrectionPoints(23, 20), 1);
assert.equal(lrCorrectionPoints(23.1, 20), 2);
assert.equal(lrCorrectionPoints(26, 20), 2);
assert.equal(lrCorrectionPoints(29, 20), 3);
assert.equal(lrCorrectionPoints(32, 20), 4);
assert.equal(lrCorrectionPoints(32.1, 20), 5);
assert.equal(lrCorrectionPoints(35, 20), 5);
assert.equal(lrCorrectionPoints(38, 20), 6);
assert.equal(lrCorrectionPoints(40, 20), 7);
assert.equal(lrCorrectionPoints(41, 20), 7);
assert.equal(lrCorrectionPoints(15, 20), 0, "thande doodh par minus nahi");
assert.equal(lrCorrectionPoints(32, 22), 3, "vendor 32°C +3, company +4 nahi");
assert.equal(lrCorrectionPoints(23, 22), 0);
assert.equal(lrCorrectionPoints(26, 22), 1);
assert.equal(lrCorrectionLabel(24, 32, 20), "company agreement 20°C: 24+4=28");
assert.equal(lrCorrectionLabel(24, 32, 22), "vendor 22°C: 24+3=27");

const company = applyAutoLab(
  line({ chillerNo: "1", milkType: "Cow", grossL: "100", fat: "4", lr: "24", temperatureC: "32" }),
  null,
  "inputs",
  20
);
assert.equal(company.snf, "8.606");
assert.equal(company.adjustedL, "96.970");
assert.equal(company.chillerNo, "1");
assert.equal(company.temperatureC, "32");
assert.equal(company.organo, "");
assert.deepEqual(formulaFromRateRow(null), PAPER_FORMULA);

const vendor = applyAutoLab(
  line({ chillerNo: "1", milkType: "Cow", grossL: "100", fat: "4", lr: "24", temperatureC: "32" }),
  null,
  "inputs",
  22
);
assert.equal(vendor.snf, "8.356");
assert.equal(vendor.adjustedL, "95.047");
const custom = applyAutoLab({ ...company, snf: "8.6" }, PAPER_FORMULA, "snf", 20);
assert.equal(custom.snf, "8.6");
assert.equal(custom.adjustedL, "96.924");
assert.equal(applyAutoLab({ ...company, fat: "" }, null, "inputs", 20).snf, company.snf);

const open = milkVariance(1000, 980, null);
assert.equal(open.grossGapL, null, "raseed na ho to farq sifar nahi");
assert.equal(gapKind(open.grossGapL), "pending");
const loss = milkVariance(1000, 980, 950);
assert.equal(loss.grossGapL, 50);
assert.equal(loss.adjustedGapL, 30);
assert.equal(gapKind(loss.grossGapL), "loss");
const gain = milkVariance(1000, null, 1020);
assert.equal(gain.grossGapL, -20);
assert.equal(gain.adjustedGapL, null);
assert.equal(gapKind(gain.grossGapL), "gain");
const day = dayMilkVariance([
  { grossL: 100, adjustedL: 97, receivedL: 90 },
  { grossL: 50, adjustedL: 48, receivedL: null },
]);
assert.equal(day.receiptPending, 1);
assert.equal(day.receivedL, null);
assert.equal(day.grossGapL, null);
assert.equal(day.grossL, 150);

const slip = certificateShareText({
  mccName: "Kisaan",
  date: "2026-10-26",
  time: "06:30",
  shiftLabel: "Subah",
  vehicle: null,
  driver: null,
  lines: [{
    chillerNo: "1",
    milkType: "Cow",
    grossL: 100,
    fat: 4,
    lr: 24,
    temperatureC: 32,
    snf: 8.36,
    ts: 12.36,
    adjustedL: 95.08,
    organo: "Pass",
  }],
  grossTotal: 100,
  adjustedTotal: 95.08,
  accepted: null,
  rejectionReason: null,
  lrBaseline: 22,
});
assert.match(slip, /Kisan Pakistan/);
assert.match(slip, /vendor 22°C \+3/);
assert.match(slip, /LR recipe: vendor 22°C/);
assert.doesNotMatch(slip, /Kisan ka Wasela|کسان کا وسیلہ/);
assert.doesNotMatch(slip, /Rate|Amount/);
assert.match(slip, /Sp\. Gravity/);

assert.equal(baselineForDestination("company", 22), 20);
assert.equal(baselineForDestination("vendor", 20), 22);
assert.equal(baselineForDestination("party", null), 20);
assert.equal(baselineForDestination("party", 22), 22);
assert.equal(initialBaseline("party", 22, false), 22);
assert.equal(initialBaseline("party", 22, true), 22);
assert.equal(initialBaseline("company", 22, false), 20);
assert.equal(initialBaseline("company", 22, true), 22);
assert.equal(parseHandoverReason(""), null);
assert.equal(parseHandoverReason("spoil"), "spoil");
assert.equal(parseHandoverReason("nope"), "invalid");

const none = chillerIntake([], []);
assert.equal(none.inL, null);
assert.equal(none.status, "none");
const intakePartial = chillerIntake([{ routeName: "A", receivedL: null }], [{ source: "mca_field", routeName: "A", liters: 10 }]);
assert.equal(intakePartial.status, "partial");
assert.equal(intakePartial.inL, null);
const full = chillerIntake(
  [{ routeName: "A", receivedL: 900 }],
  [{ source: "mca_field", routeName: "A", liters: 920 }, { source: "self_delivery", routeName: null, liters: 100 }]
);
assert.equal(full.inL, 1000);
const dayOut = dayDestinationSummary({
  intake: full,
  slips: [
    { destination: "company", grossL: 600, adjustedL: 590, receivedL: 580 },
    { destination: "vendor", grossL: 300, adjustedL: 290, receivedL: null },
    { destination: "party", grossL: 80, adjustedL: 80, receivedL: 80 },
  ],
});
assert.equal(dayOut.varianceL, 20);
assert.equal(dayOut.company.receivedL, 580);
assert.equal(dayOut.vendor.receivedL, null);
assert.equal(dayOut.vendor.receiptPending, 1);
const noVendor = dayDestinationSummary({
  intake: full,
  slips: [{ destination: "company", grossL: 600, adjustedL: 590, receivedL: 600 }],
});
assert.equal(noVendor.vendor.grossL, null);
assert.equal(noVendor.varianceL, 400);
const untracked = dayDestinationSummary({
  intake: none,
  slips: [{ destination: "company", grossL: 10, adjustedL: 10, receivedL: 10 }],
});
assert.equal(untracked.varianceL, null);
assert.equal(untracked.inL, null);

const partySlip = certificateShareText({
  mccName: "Kisaan",
  date: "2026-10-31",
  time: "",
  shiftLabel: "Subah",
  vehicle: null,
  driver: null,
  lines: [],
  grossTotal: 40,
  adjustedTotal: null,
  accepted: true,
  rejectionReason: null,
  lrBaseline: 22,
  destination: "party",
  partyName: "Ali Dairy",
  handoverReason: null,
});
assert.match(partySlip, /Manzil: Party — Ali Dairy/);
assert.match(partySlip, /LR recipe: vendor 22°C/);
assert.doesNotMatch(partySlip, /Wajah:/);
const partySpoil = certificateShareText({
  mccName: "Kisaan",
  date: "2026-10-31",
  time: "",
  shiftLabel: "Subah",
  vehicle: null,
  driver: null,
  lines: [],
  grossTotal: 40,
  adjustedTotal: null,
  accepted: true,
  rejectionReason: null,
  lrBaseline: 20,
  destination: "party",
  partyName: "Ali Dairy",
  handoverReason: "spoil",
});
assert.match(partySpoil, /LR recipe: company agreement 20°C/);
assert.match(partySpoil, /Wajah: Kharab \(spoil\)/);
assert.doesNotMatch(partySlip, /Kisan ka Wasela|کسان کا وسیلہ/);

const phoneLine = applyAutoLab(
  line({ chillerNo: "HM", milkType: "Cow", grossL: "1", fat: "4.3", lr: "27" }),
  null,
  "inputs",
  20
);
assert.equal(phoneLine.chillerNo, "HM");
assert.equal(phoneLine.snf, "8.416");
assert.equal(phoneLine.adjustedL, "0.979");
assert.equal(tsOf(4.3, 8.416), 12.717);
assert.equal(milkDensity(27, 1).specificGravity, 1.027);
assert.equal(milkDensity(27, 1).milkKg, 1.027);
assert.deepEqual(formulaFromRateRow({ snf_constant: 0.805, reference_ts: 13 }), PAPER_FORMULA);
assert.equal(formulaFromRateRow({ snf_constant: 0.72, reference_ts: 13 }).snfConstant, 0.72);
assert.equal(PAPER_FORMULA.snfConstant, 0.806);
assert.equal(canSeeHandoverRate("owner"), true);
assert.equal(canSeeHandoverRate("admin"), true);
assert.equal(canSeeHandoverRate("super_admin"), true);
assert.equal(canSeeHandoverRate("manager"), false);
assert.equal(canSeeHandoverRate("milk_collection"), false);
assert.equal(handoverAmount(0.979, 200), 195.8);
assert.equal(handoverAmount(null, 200), null);
assert.equal(internalAmountTotal([195.8, null]), null);
assert.equal(internalAmountTotal([10, 20.5]), 30.5);

const kept = absorbChillerStock(
  [line({ chillerNo: "HM", milkType: "Cow", grossL: "1", fat: "4.3", lr: "27", snf: "8.416", adjustedL: "0.979" })],
  chillerStockRows([{ chillerNo: "ZZ", milkType: "Buffalo" }], ["HM"])
);
assert.equal(kept[0].chillerNo, "HM");
assert.equal(kept[0].fat, "4.3");
assert.equal(kept.some((row) => row.chillerNo === "ZZ"), true);

const phoneSlip = certificateShareText({
  mccName: "Kisaan",
  date: "2026-10-31",
  time: "",
  shiftLabel: "Subah",
  vehicle: null,
  driver: null,
  lines: [{
    chillerNo: "HM",
    milkType: "Cow",
    grossL: 1,
    fat: 4.3,
    lr: 27,
    temperatureC: null,
    snf: 8.416,
    ts: 12.717,
    adjustedL: 0.979,
    organo: null,
  }],
  grossTotal: 1,
  adjustedTotal: 0.979,
  accepted: null,
  rejectionReason: null,
  lrBaseline: 20,
  destination: "company",
});
assert.match(phoneSlip, /Chiller HM/);
assert.match(phoneSlip, /SNF 8\.416/);
assert.match(phoneSlip, /TS 12\.717/);
assert.match(phoneSlip, /Adjusted 0\.979/);
assert.match(phoneSlip, /Sp\. Gravity 1\.027/);
assert.match(phoneSlip, /Milk kg 1\.027/);
assert.doesNotMatch(phoneSlip, /Rate|Amount|Rs/);

console.log("milk-handover lib: ok");
