import assert from "node:assert/strict";
import {
  PAPER_SPECS,
  adjustedTotal,
  blankCertificateLines,
  grossTotal,
  lineSpecFlags,
  parseHandoverLines,
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

console.log("milk-handover lib: ok");
