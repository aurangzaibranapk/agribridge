import assert from "node:assert/strict";
import { dispatchAlerts, summarizeEntries } from "../src/lib/milk-control-room";

// Entries: shift wise ginti, status wise ginti, aur galat shift total mein to jaaye magar kisi shift mein nahi.
{
  const s = summarizeEntries([
    { shift: "morning", quantity_liters: "10.5", status: "pending_fat" },
    { shift: "morning", quantity_liters: 4, status: "priced" },
    { shift: "morning", quantity_liters: 6, status: "verified" },
    { shift: "evening", quantity_liters: 3, status: "rejected" },
    { shift: "night", quantity_liters: 2, status: "verified" },
  ]);
  assert.equal(s.byShift.morning.entries, 3);
  assert.equal(s.byShift.morning.liters, 20.5);
  assert.equal(s.byShift.morning.pendingFat, 1);
  assert.equal(s.byShift.morning.priced, 1);
  assert.equal(s.byShift.morning.verified, 1);
  assert.equal(s.byShift.evening.rejected, 1);
  assert.equal(s.byShift.evening.liters, 3);
  // total mein unknown shift bhi shamil
  assert.equal(s.total.entries, 5);
  assert.equal(s.total.liters, 25.5);
  assert.equal(s.total.verified, 2);
}

// Khali din: sab sifar, lekin ye sifar ginti ke taur par hai (kuch data nahi tha), NULL nahi.
{
  const s = summarizeEntries([]);
  assert.equal(s.total.entries, 0);
  assert.equal(s.total.liters, 0);
}

// Null / ghair adad liters sifar ginay jaate hain, crash nahi.
{
  const s = summarizeEntries([{ shift: "morning", quantity_liters: null, status: "priced" }]);
  assert.equal(s.byShift.morning.liters, 0);
  assert.equal(s.byShift.morning.priced, 1);
}

// Dispatch alerts: raseed baqi aur kami, sahi tarteeb ke saath; theek raseed par koi alert nahi.
{
  const alerts = dispatchAlerts([
    { id: "a", shift: "morning", destination: "company", dispatched_liters: 100, received_liters: null, shortage_percentage: null },
    { id: "b", shift: "evening", destination: "vendor", dispatched_liters: "50", received_liters: "49", shortage_percentage: "2" },
    { id: "c", shift: "morning", destination: "party", dispatched_liters: 20, received_liters: 20, shortage_percentage: 0 },
  ]);
  assert.equal(alerts.length, 2);
  assert.deepEqual(alerts[0], {
    id: "a",
    shift: "morning",
    destination: "company",
    dispatchedLiters: 100,
    shortagePercentage: null,
    kind: "raseed_baqi",
  });
  assert.equal(alerts[1].kind, "kami");
  assert.equal(alerts[1].shortagePercentage, 2);
}

console.log("milk-control-room: all assertions passed");

import { buildDayReport } from "../src/lib/milk-control-room";

// Din ki report: chiller totals, farmer ka dena, aur farq.
{
  const r = buildDayReport({
    chillers: [
      { chiller_no: "HM-2", shift: "evening", gross_liters: 980, fat_percentage: 4.1, lr: 26, snf_percentage: 8.2, ts_percentage: 12.5, adjusted_liters: 940 },
      { chiller_no: "HM-1", shift: "morning", gross_liters: 1000, fat_percentage: 4.3, lr: 27, snf_percentage: 8.4, ts_percentage: 12.7, adjusted_liters: 980 },
    ],
    entries: [
      { shift: "morning", quantity_liters: 600, status: "verified", total_amount: 30000 },
      { shift: "morning", quantity_liters: 300, status: "priced", total_amount: 15000 },
      { shift: "evening", quantity_liters: 100, status: "pending_fat", total_amount: null },
      { shift: "evening", quantity_liters: 50, status: "rejected", total_amount: null },
    ],
  });
  // Chiller sorted: morning (HM-1) pehle, phir evening (HM-2)
  assert.deepEqual(r.chillers.map((c) => c.chillerNo), ["HM-1", "HM-2"]);
  assert.equal(r.chillerTotal.grossL, 1980);
  assert.equal(r.chillerTotal.adjustedL, 1920);
  assert.equal(r.chillerTotal.count, 2);
  // SNF wazan-wala: (8.4*1000 + 8.2*980)/1980
  assert.equal(r.chillerTotal.snfAvg, 8.301);
  assert.equal(r.farmer.entries, 4);
  assert.equal(r.farmer.litersAll, 1050);
  assert.equal(r.farmer.payableRs, 45000);
  assert.equal(r.farmer.litersPayable, 900);
  assert.equal(r.farmer.avgRatePerL, 50);
  assert.equal(r.farmer.pendingFat, 1);
  assert.equal(r.farmer.rejected, 1);
  // Chiller gross 1980 − farmer 1050 = 930
  assert.equal(r.farmerVsChillerL, 930);
}

// Chiller total hai, farmer entry nahi (abhi ka tareeqa): farmer ka farq null, poora chiller gross nahi.
{
  const r = buildDayReport({
    chillers: [{ chiller_no: "HM-1", shift: "morning", gross_liters: 1240, fat_percentage: 4.3, lr: 27, snf_percentage: 8.416, ts_percentage: 12.717, adjusted_liters: 1213 }],
    entries: [],
  });
  assert.equal(r.farmer.entries, 0);
  assert.equal(r.farmerVsChillerL, null);
  assert.equal(r.chillerTotal.grossL, 1240);
}

// Chiller total nahi: farq null, sifar nahi. Farmer average bhi null.
{
  const r = buildDayReport({ chillers: [], entries: [] });
  assert.equal(r.farmerVsChillerL, null);
  assert.equal(r.farmer.avgRatePerL, null);
  assert.equal(r.chillerTotal.snfAvg, null);
}

console.log("milk-control-room day report: all assertions passed");
