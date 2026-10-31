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
