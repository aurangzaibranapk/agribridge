import assert from "node:assert/strict";
import { chillerDayIntake, dayDestinationSummary } from "../src/lib/milk-handover";
import { parseChillerTotal } from "../src/lib/milk-chiller-total";
import { phoneLab, phoneSnfConstant, roundPhone3 } from "../src/lib/milk-phone-lab";

const phone = phoneLab(1, 4.3, 27, 13, 0.806);
assert.ok(phone);
assert.equal(phone.snf, 8.416);
assert.equal(phone.ts, 12.717);
assert.equal(phone.adjusted, 0.979);
assert.equal(phone.specificGravity, 1.027);
assert.equal(phone.kilograms, 1.027);
assert.equal(phone.snf.toFixed(3), "8.416");
assert.equal(phone.ts.toFixed(3), "12.717");
assert.equal(phone.adjusted.toFixed(3), "0.979");

assert.equal(roundPhone3(8.416), 8.416);
assert.equal(roundPhone3(12.716000000000001), 12.717);
assert.equal(roundPhone3(0.9781538461538463), 0.979);

assert.equal(phoneSnfConstant(null), 0.806);
assert.equal(phoneSnfConstant(0.805), 0.806);
assert.equal(phoneSnfConstant(0.72), 0.72);

const fromLegacy = parseChillerTotal({
  chillerNo: "1",
  grossL: "1",
  fat: "4.3",
  lr: "27",
  snfConstant: 0.805,
  referenceTs: 13,
});
assert.ok(!("error" in fromLegacy));
if (!("error" in fromLegacy)) {
  assert.equal(fromLegacy.lab.snf, 8.416);
  assert.equal(fromLegacy.lab.ts, 12.717);
  assert.equal(fromLegacy.lab.adjusted, 0.979);
  assert.equal(fromLegacy.snfConstant, 0.806);
}

const custom = phoneLab(10, 6, 30, 13, 0.72);
assert.ok(custom);
assert.equal(custom.snf, 9.42);
assert.equal(custom.ts, 15.42);
assert.equal(custom.adjusted, 11.862);

const tank = phoneLab(100, 4, 28, 13, 0.806);
assert.ok(tank);
assert.equal(tank.snf, 8.606);
assert.equal(tank.ts, 12.606);
assert.equal(tank.adjusted, 96.97);
assert.equal(tank.adjusted.toFixed(3), "96.970");

assert.equal("error" in parseChillerTotal({
  chillerNo: "",
  grossL: "1",
  fat: "4.3",
  lr: "27",
  snfConstant: null,
  referenceTs: null,
}), true);

const day = dayDestinationSummary({
  intake: chillerDayIntake([{ grossL: 1000 }, { grossL: 200 }]),
  slips: [
    { destination: "company", grossL: 700, adjustedL: 680, receivedL: null },
    { destination: "vendor", grossL: 100, adjustedL: 90, receivedL: 100 },
    { destination: "party", grossL: 50, adjustedL: 48, receivedL: null },
  ],
});
assert.equal(day.inL, 1200);
assert.equal(day.company.grossL, 700);
assert.equal(day.vendor.grossL, 100);
assert.equal(day.party.grossL, 50);
assert.equal(day.varianceL, 350, "farq = aaya − (company+vendor+party)");

const none = dayDestinationSummary({ intake: chillerDayIntake([]), slips: [] });
assert.equal(none.inL, null);
assert.equal(none.varianceL, null, "total na ho to farq sifar nahi");
assert.equal(none.company.grossL, null);

const onlyOut = dayDestinationSummary({
  intake: chillerDayIntake([{ grossL: 500 }]),
  slips: [],
});
assert.equal(onlyOut.varianceL, 500, "slip na ho to gaya 0, farq aaya hi hai");

console.log("milk-chiller-total ok");
