import assert from "node:assert/strict";
import { carrierTotals, dispatchTotals } from "../src/lib/milk-carrier";

// Ek dispatch: do chiller lines, rate 150 par amount = adjusted x rate.
{
  const t = dispatchTotals(
    [
      { gross_volume_l: 100, adjusted_volume_l: 98, fat_percentage: 4.0, snf_percentage: 8.0, lr: 26, ts_percentage: 12.0 },
      { gross_volume_l: 300, adjusted_volume_l: 294, fat_percentage: 4.4, snf_percentage: 8.4, lr: 28, ts_percentage: 12.8 },
    ],
    150
  );
  assert.equal(t.grossL, 400);
  assert.equal(t.adjustedL, 392);
  // Wazan: (4.0*100 + 4.4*300)/400 = 4.3
  assert.equal(t.fat, 4.3);
  assert.equal(t.amount, 58800);
}

// Rate nahi: amount null, sifar nahi.
{
  const t = dispatchTotals([{ gross_volume_l: 50, adjusted_volume_l: 49, fat_percentage: 4, snf_percentage: 8, lr: 26, ts_percentage: 12 }], null);
  assert.equal(t.amount, null);
  assert.equal(t.adjustedL, 49);
}

// Lines nahi: sab null, amount null.
{
  const t = dispatchTotals([], 150);
  assert.equal(t.grossL, 0);
  assert.equal(t.fat, null);
  assert.equal(t.amount, null);
}

// Carrier ka jama: jin dispatch par rate nahi unhe amount mein shamil nahi karte, aur ginti dikhate hain.
{
  const a = dispatchTotals([{ gross_volume_l: 100, adjusted_volume_l: 100, fat_percentage: 4, snf_percentage: 8, lr: 26, ts_percentage: 12 }], 150);
  const b = dispatchTotals([{ gross_volume_l: 100, adjusted_volume_l: 100, fat_percentage: 5, snf_percentage: 9, lr: 27, ts_percentage: 14 }], null);
  const c = carrierTotals([
    { totals: a, lines: 1 },
    { totals: b, lines: 1 },
  ]);
  assert.equal(c.grossL, 200);
  assert.equal(c.adjustedL, 200);
  assert.equal(c.amount, 15000);
  assert.equal(c.unratedCount, 1);
}

console.log("milk-carrier: all assertions passed");
