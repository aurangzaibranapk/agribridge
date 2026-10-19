import assert from "node:assert/strict";
import { whatsappCheckInBlockedMessage as m } from "../src/lib/staff-attendance";
assert.match(m({ status: "leave", check_in_at: null, source: "leave" }), /manzoor shuda chhutti/);
assert.match(m({ status: "absent", check_in_at: null, source: "correction" }), /pehle se maujood hai \(absent\)/);
assert.match(m({ status: "present", check_in_at: "2026-10-17T04:00:00Z", source: "web" }), /pehle hi lag chuki/);
console.log("whatsapp check-in message: theek");
