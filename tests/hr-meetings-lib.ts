// HR Meetings -- pure helpers + wiring (DB ke baghair).
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  actionState, addDays, getMeetProvider, hasFullAccess, isLive, meetingWarnings, monthGrid, overlaps,
  parseMeetingForm, pktDate, pktTime, pktToIso, seriesDates, shiftDate, viewRange, weekDays, weekStart,
} from "../src/lib/hr-meetings";

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${name}`); };
function form(o: Record<string, string | string[]>) {
  return { get: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[])[0] : o[k]) ?? null, getAll: (k: string) => (Array.isArray(o[k]) ? o[k] as string[] : o[k] ? [o[k] as string] : []) };
}
const U1 = "00000000-0000-0000-0000-00000000b001";

console.log("Calendar:");
ok("1 Oct 2026 Thursday -> grid Monday 28 Sep se", () => { const g = monthGrid("2026-10-17"); assert.equal(g[0].date, "2026-09-28"); assert.equal(g.length % 7, 0); assert.equal(g.filter((c) => c.inMonth).length, 31); });
ok("hafta Monday se Sunday", () => { assert.deepEqual([weekDays("2026-10-17")[0], weekDays("2026-10-17")[6]], ["2026-10-12", "2026-10-18"]); assert.equal(weekStart("2026-10-12"), "2026-10-12"); });
ok("view range + aage/peeche", () => { assert.deepEqual(viewRange("today", "2026-10-17"), { from: "2026-10-17", to: "2026-10-17" }); assert.equal(shiftDate("month", "2026-01-31", 1), "2026-02-01"); assert.equal(shiftDate("week", "2026-10-17", -1), "2026-10-10"); });
ok("PKT: raat 11 baje UTC = agla din PKT", () => { assert.equal(pktDate("2026-10-16T20:30:00Z"), "2026-10-17"); assert.equal(pktTime(pktToIso("2026-10-17", "10:00")), "10:00 AM"); });
console.log("Form jaanch:");
const good = { title: "Season plan", date: "2026-10-17", time: "10:00", duration_min: "45", attendees: [U1, U1] };
ok("sahi form + attendees dedupe", () => { const r = parseMeetingForm(form(good)); assert.ok(r.ok); if (r.ok) { assert.equal(r.value.attendees.length, 1); assert.equal(r.value.repeat, "none"); } });
ok("chhota unwan ruk jata hai", () => assert.equal(parseMeetingForm(form({ ...good, title: "ab" })).ok, false));
ok("ghalat Meet link ruk jata hai", () => assert.equal(parseMeetingForm(form({ ...good, meet_url: "https://zoom.us/j/1" })).ok, false));
ok("sahi Meet link chalta hai", () => assert.equal(parseMeetingForm(form({ ...good, meet_url: "https://meet.google.com/abc-defg-hij" })).ok, true));
ok("bina staff ruk jata hai", () => assert.equal(parseMeetingForm(form({ ...good, attendees: [] })).ok, false));
ok("dorania 5-480", () => { assert.equal(parseMeetingForm(form({ ...good, duration_min: "600" })).ok, false); assert.equal(parseMeetingForm(form({ ...good, time: "25:00" })).ok, false); });
ok("weekly repeat = 4 tareekhen", () => assert.deepEqual(seriesDates("2026-10-17", "weekly"), ["2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07"]));
console.log("Warnings / kaam:");
ok("held + 0 faisle = no_decision", () => assert.deepEqual(meetingWarnings({ status: "held", reschedule_count: 0, decisions: 0 }), ["no_decision"]));
ok("2 reschedule = warning; scheduled meeting bina faisle = koi warning nahi", () => { assert.ok(meetingWarnings({ status: "scheduled", reschedule_count: 2, decisions: 0 }).includes("rescheduled")); assert.deepEqual(meetingWarnings({ status: "scheduled", reschedule_count: 1, decisions: 0 }), []); });
ok("kaam overdue / due_soon / done", () => { assert.equal(actionState({ status: "open", due_date: "2026-10-15" }, "2026-10-17"), "overdue"); assert.equal(actionState({ status: "open", due_date: addDays("2026-10-17", 2) }, "2026-10-17"), "due_soon"); assert.equal(actionState({ status: "done", due_date: "2026-10-01" }, "2026-10-17"), "done"); });
ok("overlap + live", () => { assert.ok(overlaps("2026-10-17T05:00:00Z", 60, "2026-10-17T05:30:00Z", 30)); assert.ok(!overlaps("2026-10-17T05:00:00Z", 30, "2026-10-17T05:30:00Z", 30)); assert.ok(isLive("2026-10-17T05:00:00Z", 60, new Date("2026-10-17T05:10:00Z"))); });
ok("full access: hr/admin/owner/super_admin; staff nahi", () => { for (const r of ["hr", "admin", "owner", "super_admin"]) assert.ok(hasFullAccess(r)); assert.ok(!hasFullAccess("sales_staff")); assert.ok(!hasFullAccess("manager")); });
ok("Google Meet hook abhi manual (koi API call nahi)", async () => { const p = getMeetProvider(); assert.equal(p.id, "manual"); assert.equal(p.available, false); });
console.log("Wiring:");
const actions = fs.readFileSync("src/actions/hr-meetings.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
ok("actions: 'use server' pehli line, koi WhatsApp/email nahi", () => { assert.match(actions, /^"use server";/); assert.doesNotMatch(actions, /whatsapp|sendMail|nodemailer|smtp|sendDeptMail|notifyUser|notifyRoles/i); });
ok("actions: service-role key istemal nahi (sirf RLS session)", () => assert.doesNotMatch(actions, /SERVICE_ROLE|createAdminClient|admin-client/i));
ok("dashboard par widget laga hai", () => assert.match(fs.readFileSync("src/app/admin/hr-dashboard/page.tsx", "utf8"), /<HrMeetingsTodayWidget/));
ok("middleware: /admin/hr/meetings shamil staff ke liye khula (RLS rokta hai)", () => assert.match(fs.readFileSync("src/middleware.ts", "utf8"), /"\/admin\/hr\/meetings"/));
for (const p of ["page.tsx", "new/page.tsx", "[id]/page.tsx", "actions/page.tsx"]) ok(`page mojood: meetings/${p}`, () => assert.ok(fs.existsSync(`src/app/admin/hr/meetings/${p}`)));
ok("migrations 600-603 + rollbacks mojood", () => { for (const f of ["600_hr_meetings", "601_hr_meeting_outcomes", "602_hr_meeting_notifications", "603_hr_meetings_rls"]) { assert.ok(fs.existsSync(`supabase/migrations/${f}.sql`)); assert.ok(fs.existsSync(`supabase/rollbacks/${f}.rollback.sql`)); } });
ok("603: anon se revoke + notifications insert band", () => { const s = fs.readFileSync("supabase/migrations/603_hr_meetings_rls.sql", "utf8"); assert.match(s, /from anon/); assert.match(s, /revoke insert, delete on public\.hr_notifications from authenticated/); });
console.log(`\nhr-meetings-lib: ${n} checks pass`);
