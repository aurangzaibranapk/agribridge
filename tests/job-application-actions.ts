import assert from "node:assert/strict";
import fs from "node:fs";
import { GENDERS } from "../src/lib/hr-kpi/core";
import { APPLY_GENDERS, staffGenderOrNull } from "../src/lib/jobs/apply-input";
import {
  BAD_EMAIL_NOTE,
  NO_EMAIL_NOTE,
  NO_NUMBER_NOTE,
  dispatchNotice,
  failedDispatch,
  redactSecrets,
  sentOrFailed,
} from "../src/lib/jobs/candidate-message";
import { interviewDay, isDuplicateInterviewSchedule, shouldLogStatusChange } from "../src/lib/jobs/status-guard";

assert.deepEqual([...APPLY_GENDERS], [...GENDERS]);
assert.equal(staffGenderOrNull(" Male "), "male");
assert.equal(staffGenderOrNull("nope"), null);
assert.equal(staffGenderOrNull(null), null);

assert.equal(shouldLogStatusChange("under_review", "eligible"), true);
assert.equal(shouldLogStatusChange("eligible", "eligible"), false);
assert.equal(shouldLogStatusChange(null, "under_review"), true);
assert.equal(shouldLogStatusChange("offered", "offered"), false);

assert.equal(interviewDay("2026-10-22"), "2026-10-22");
assert.equal(interviewDay("2026-10-22T09:44:00+05:00"), "2026-10-22");
assert.equal(interviewDay("  "), null);
assert.equal(isDuplicateInterviewSchedule({ status: "interview_scheduled", interview_date: "2026-10-22" }, "2026-10-22"), true);
assert.equal(isDuplicateInterviewSchedule({ status: "interview_scheduled", interview_date: "2026-10-22" }, "2026-10-23"), false);
assert.equal(isDuplicateInterviewSchedule({ status: "eligible", interview_date: "2026-10-22" }, "2026-10-22"), false);
assert.equal(isDuplicateInterviewSchedule(null, "2026-10-22"), false);

const missing = failedDispatch({ to: "", subject: "Hello", body: "<p>Hi</p>", missing: true });
assert.equal(missing.status, "failed");
assert.equal(missing.error, NO_EMAIL_NOTE);
assert.equal(dispatchNotice(missing), NO_EMAIL_NOTE);
assert.equal(failedDispatch({ to: "not-an-email", missing: false }).error, BAD_EMAIL_NOTE);
assert.equal(failedDispatch({ channel: "sms", to: null, missing: true }).error, NO_NUMBER_NOTE);

const sent = sentOrFailed({ to: "a@b.c", subject: "Offer", body: "<p>See link</p>", linkUrl: "https://alranatraders.pk/job-offer/abc", attachmentName: "Offer.pdf", ok: true });
assert.equal(sent.status, "sent");
assert.equal(sent.error, null);
assert.equal(sent.linkUrl, "https://alranatraders.pk/job-offer/abc");
assert.equal(sent.attachmentName, "Offer.pdf");
assert.equal(dispatchNotice(sent), undefined);
const failed = sentOrFailed({ to: "a@b.c", subject: "Offer", body: "x", ok: false, error: "smtp down" });
assert.equal(failed.status, "failed");
assert.equal(dispatchNotice(failed), "smtp down");

assert.equal(redactSecrets("Password: hunter2", ["hunter2"]), "Password: ••••••");
assert.equal(redactSecrets("short", ["ab"]), "short");
assert.equal(redactSecrets(null, ["hunter2"]), null);

const jobs = fs.readFileSync("src/actions/jobs.ts", "utf8");
assert.match(jobs, /neq\("status", "under_review"\)/);
assert.match(jobs, /neq\("status", target\)/);
assert.match(jobs, /isDuplicateInterviewSchedule/);
assert.match(jobs, /saveCandidateMessage/);
assert.match(jobs, /staffGenderOrNull/);
assert.equal(jobs.includes("gender,"), true);
const guard = fs.readFileSync("src/app/admin/job-applications/application-detail.tsx", "utf8");
assert.match(guard, /useTransition/);
assert.match(guard, /PendingSubmit/);
assert.match(guard, /ActionFeedback/);
const readSql = fs.readFileSync("supabase/manual/job_application_shortlist_duplicate_20261022_read.sql", "utf8");
const deleteSql = fs.readFileSync("supabase/manual/job_application_shortlist_duplicate_20261022_delete.sql", "utf8");
assert.match(readSql, /^select /m);
assert.doesNotMatch(readSql, /^\s*delete\b/im);
assert.match(deleteSql, /^delete /m);
assert.match(readSql, /Usama Saleem/);
assert.match(deleteSql, /Usama Saleem/);
assert.match(readSql, /2026-10-22 14:40:00\+05/);
assert.equal(fs.readFileSync("supabase/migrations/20261022100000_job_application_gender.sql", "utf8").toLowerCase().includes("update public.job_applications"), false);

console.log("job application actions ok");
