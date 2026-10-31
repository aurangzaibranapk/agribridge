import assert from "node:assert/strict";
import { presetRange, slotsBetween } from "../src/lib/milk-shift-range";

// Presets, aaj 31 October ke hisaab se.
{
  const today = "2026-10-31";
  const a = slotsBetween(...Object.values(presetRange("evening_to_morning", today)) as [any, any]);
  assert.deepEqual(a, [
    { date: "2026-10-30", shift: "evening" },
    { date: "2026-10-31", shift: "morning" },
  ]);
  const b = slotsBetween(...(Object.values(presetRange("morning_to_evening", today)) as [any, any]));
  assert.deepEqual(b, [
    { date: "2026-10-31", shift: "morning" },
    { date: "2026-10-31", shift: "evening" },
  ]);
  const c = slotsBetween(...(Object.values(presetRange("morning", today)) as [any, any]));
  assert.deepEqual(c, [{ date: "2026-10-31", shift: "morning" }]);
  const d = slotsBetween(...(Object.values(presetRange("evening", today)) as [any, any]));
  assert.deepEqual(d, [{ date: "2026-10-31", shift: "evening" }]);
}

// Lambi range: 28 subah se 31 shaam tak = 8 shifts. Ulti range khali.
{
  const s = slotsBetween({ date: "2026-10-28", shift: "morning" }, { date: "2026-10-31", shift: "evening" });
  assert.equal(s.length, 8);
  assert.deepEqual(s[0], { date: "2026-10-28", shift: "morning" });
  assert.deepEqual(s[7], { date: "2026-10-31", shift: "evening" });
  assert.deepEqual(slotsBetween({ date: "2026-10-31", shift: "evening" }, { date: "2026-10-31", shift: "morning" }), []);
}

// Mahine ka aakhri din se agle mahine tak.
{
  const s = slotsBetween({ date: "2026-10-31", shift: "evening" }, { date: "2026-11-01", shift: "morning" });
  assert.equal(s.length, 2);
}

console.log("milk-shift-range: all assertions passed");

import { aggregateRange } from "../src/lib/milk-shift-range";

// Teen shifts, do chiller: gross jama, FAT aur LR gross ke wazan se.
{
  const slots = [
    { date: "2026-10-30", shift: "evening" as const },
    { date: "2026-10-31", shift: "morning" as const },
  ];
  const rows = [
    { entryDate: "2026-10-30", shift: "evening" as const, chillerNo: "1", grossL: 100, fat: 4.0, lr: 26 },
    { entryDate: "2026-10-31", shift: "morning" as const, chillerNo: "1", grossL: 300, fat: 4.4, lr: 28 },
    { entryDate: "2026-10-31", shift: "evening" as const, chillerNo: "1", grossL: 999, fat: 9, lr: 9 },
    { entryDate: "2026-10-31", shift: "morning" as const, chillerNo: "2", grossL: 50, fat: 5.0, lr: 24 },
  ];
  const out = aggregateRange(rows, slots, ["1", "2", "3"]);
  assert.equal(out[0].grossL, 400);
  assert.equal(out[0].fat, 4.3);
  assert.equal(out[0].shifts, 2);
  assert.equal(out[1].grossL, 50);
  assert.equal(out[2].grossL, 0);
  assert.equal(out[2].fat, null);
}
console.log("milk-shift-range aggregate: all assertions passed");
