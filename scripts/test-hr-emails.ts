// Unit tests: HR ki rasmi emails (joining / contract closure) + action wiring.
// Koi asli email nahi jati: bhejne wala nakli (fake) hai. Live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  escapeHtml, todayPk, formatLongDate, isDeliverableEmail,
  buildJoiningEmail, buildSeparationEmail, sendJoiningEmail, sendSeparationEmail,
  hrMailAuditText, hrMailNotice, type HrMailSender,
} from "../src/lib/hr-emails";

// Asli SMTP kabhi na chhua jaye, chahe env lagi ho.
for (const k of ["HR_SMTP_USER", "HR_SMTP_PASS", "JOB_SMTP_USER", "JOB_SMTP_PASS"]) delete process.env[k];

(async () => {
  // ---- 1) HTML escape ----
  assert.equal(escapeHtml(`<script>alert("x")</script> & 'y'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
  assert.equal(escapeHtml(null), "");

  const evil = buildJoiningEmail({
    fullName: `Ali <img src=x onerror=alert(1)>`,
    designation: `<a href="https://evil.example">Manager</a>`,
    joiningDate: "2026-10-17",
  });
  assert.ok(!evil.body.includes("<img"), "naam ka HTML escape hona chahiye");
  assert.ok(!evil.body.includes(`<a href="https://evil.example">`), "ohde ka HTML escape hona chahiye");
  assert.ok(evil.body.includes("Ali &lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(evil.body.includes("17 October 2026"));

  const sepEvil = buildSeparationEmail({ fullName: `<b>X</b>`, designation: `"><script>`, lastWorkingDay: "2026-10-31" });
  assert.ok(!sepEvil.body.includes("<script>") && !sepEvil.body.includes("<b>X</b>"));
  assert.ok(sepEvil.body.includes("31 October 2026"));
  assert.equal(sepEvil.subject, "Notice of Contract Closure – Last Working Day 31 October 2026");

  // ---- 2) Khali naam/ohda par saaf fallback (undefined nahi) ----
  const blank = buildJoiningEmail({ fullName: "  ", designation: null, joiningDate: "2026-01-05" });
  assert.ok(blank.body.includes("Team Member") && blank.body.includes("Staff Member"));
  assert.ok(!/undefined|null/.test(blank.body), "template mein undefined/null nahi aana chahiye");

  // ---- 3) Tareekhein ----
  assert.equal(formatLongDate("2026-02-30"), null);
  assert.equal(formatLongDate("17/10/2026"), null);
  assert.equal(formatLongDate(undefined), null);
  // 19:30 UTC = agle din 00:30 Karachi.
  assert.equal(todayPk(new Date("2026-10-16T19:30:00Z")), "2026-10-17");
  assert.equal(todayPk(new Date("2026-10-16T18:59:00Z")), "2026-10-16");
  // Aakhri din khud se +7 nahi banta -- jo diya wohi aata hai.
  assert.ok(buildSeparationEmail({ fullName: "A", designation: "B", lastWorkingDay: "2026-12-01" }).body.includes("1 December 2026"));

  // ---- 4) Address ----
  assert.ok(isDeliverableEmail("staff@alranatraders.pk"));
  assert.ok(!isDeliverableEmail(""));
  assert.ok(!isDeliverableEmail("a@b.pk, boss@x.pk"));
  assert.ok(!isDeliverableEmail("no-at-sign"));
  assert.ok(!isDeliverableEmail("3001234567@phone.agribridge.local"), "phone-login ka nakli address");

  // ---- 5) Bhejna: nateeja wapas aata hai, fake sender ke sath ----
  const calls: Parameters<HrMailSender>[0][] = [];
  const okSender: HrMailSender = async (args) => { calls.push(args); return { sent: true, from: "hr@alranatraders.pk" }; };
  const r1 = await sendJoiningEmail({ toEmail: " new@alranatraders.pk ", fullName: "Anwar", designation: "Munshi", joiningDate: "2026-10-17" }, okSender);
  assert.deepEqual(r1, { sent: true, from: "hr@alranatraders.pk" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].dept, "hr");
  assert.equal(calls[0].to, "new@alranatraders.pk");
  assert.ok(calls[0].html.includes("Anwar") && calls[0].html.includes("Munshi"));
  assert.equal(hrMailNotice("joining", r1), undefined);
  assert.match(hrMailAuditText("joining", "new@alranatraders.pk", r1), /bhej di gayi.*new@alranatraders\.pk/);

  const failSender: HrMailSender = async () => ({ sent: false, error: "SMTP login failed." });
  const r2 = await sendSeparationEmail({ toEmail: "x@alranatraders.pk", fullName: "X", designation: null, lastWorkingDay: "2026-10-31" }, failSender);
  assert.equal(r2.sent, false);
  assert.match(hrMailNotice("separation", r2)!, /SMTP login failed/);
  assert.match(hrMailAuditText("separation", "x@alranatraders.pk", r2), /NAHI gayi.*SMTP login failed/);

  const throwSender: HrMailSender = async () => { throw new Error("boom"); };
  const r3 = await sendJoiningEmail({ toEmail: "y@alranatraders.pk", fullName: "Y", designation: null, joiningDate: "2026-10-17" }, throwSender);
  assert.deepEqual(r3, { sent: false, error: "boom" });

  // Email address na ho to bheja hi nahi jata, aur wajah wapas aati hai.
  let called = false;
  const r4 = await sendSeparationEmail({ toEmail: null, fullName: "Z", designation: null, lastWorkingDay: "2026-10-31" }, async () => { called = true; return { sent: true, from: "x" }; });
  assert.equal(called, false);
  assert.equal(r4.sent, false);

  // Asli mailer bina password ke: {sent:false} wapas, koi network nahi.
  const r5 = await sendJoiningEmail({ toEmail: "z@alranatraders.pk", fullName: "Z", designation: null, joiningDate: "2026-10-17" });
  assert.equal(r5.sent, false);

  // ---- 6) Wiring (static) ----
  const read = (p: string) => fs.readFileSync(p, "utf8");
  const hr = read("src/actions/hr.ts");
  const users = read("src/actions/users.ts");
  const prob = read("src/actions/hr-probation.ts");
  const lib = read("src/lib/hr-emails.ts");
  for (const [name, src] of [["hr.ts", hr], ["users.ts", users], ["hr-probation.ts", prob]] as const) {
    assert.equal(src.split("\n")[0].trim(), '"use server";', `${name}: "use server" sab se upar hona chahiye`);
  }
  const fnBody = (src: string, name: string) => {
    const i = src.indexOf(`export async function ${name}(`);
    assert.ok(i >= 0, `${name} nahi mila`);
    const j = src.indexOf("\nexport async function ", i + 10);
    return src.slice(i, j < 0 ? undefined : j);
  };
  assert.ok(!fnBody(hr, "recordSalaryPayment").includes("sendJoiningEmail"), "tankhwah par joining email nahi");
  assert.ok(fnBody(hr, "inviteStaffMember").includes("sendJoiningEmail("), "invite par joining email");
  assert.ok(fnBody(hr, "inviteStaffMember").includes("hrMailAuditText(\"joining\""), "joining email audit");
  assert.ok(/notice: hrMailNotice\("joining"/.test(fnBody(hr, "inviteStaffMember")), "joining nakami HR ko dikhe");
  const suspend = fnBody(users, "suspendStaff");
  assert.ok(!/send\w*Email|sendDeptMail/.test(suspend), "suspend par koi email nahi");
  assert.ok(suspend.includes('.neq("status", "suspended")'), "dobara suspend idempotent");
  assert.ok(!users.includes("hr-emails"), "users.ts email nahi bhejta");
  const decide = fnBody(prob, "decideProbation");
  assert.ok(decide.includes('if (decision === "end")') && decide.includes("sendClosureEmail("), "closure sirf 'end' par");
  assert.ok(decide.includes('.eq("employment_status", "probation")'), "closure faisla idempotent");
  assert.ok(prob.includes("auth.admin.getUserById"), "email auth.users se");
  assert.ok(!/select\([^)]*\bemail\b/.test(hr + users + prob), "profiles.email column maujood nahi");
  assert.ok(!/setDate\(|\+ 7/.test(lib), "aakhri din hardcode nahi");
  assert.ok(!/reason/.test(lib.slice(lib.indexOf("export function buildSeparationEmail"))), "reason param hata diya");

  console.log("test:hr-emails OK");
})().catch((e) => { console.error(e); process.exit(1); });
