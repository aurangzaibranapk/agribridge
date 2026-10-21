// 691: Bharti offer / barhotri / salary slip ke pure hisaab + wiring.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  amountInWords, daysBetween, fmtDate, fmtDayMonth, gapVsExpected, incrementBucket, incrementPreview, maskAccount, nextAnniversary, offerTotal, verifyUrl,
} from "../src/lib/payroll/salary-offer";
import { buildSlip } from "../src/lib/payroll/slip-data";
import { pdfSafe, salarySlipPdf } from "../src/lib/payroll/slip-pdf";

let n = 0;
const t = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => { n++; console.log(`  ✓ ${name}`); });

(async () => {
  await t("offer ka kul: hissay ya purani proposed_salary", () => {
    assert.equal(offerTotal({ basic: 34000, house_rent: 8500, travel: 5000, mobile: 2500 }), 50000);
    assert.equal(offerTotal({ proposed_salary: 46500 }), 46500);
    assert.equal(offerTotal({ basic: null, proposed_salary: null }), null);
    assert.equal(offerTotal(null), null);
  });
  await t("maang se farq", () => {
    assert.deepEqual(gapVsExpected(48500, 55000), { diff: -6500, pct: -11.8 });
    assert.equal(gapVsExpected(48500, null), null);
  });
  await t("tareekh ki shakl", () => {
    assert.equal(fmtDate("2026-11-01"), "01 Nov 2026");
    assert.equal(fmtDayMonth("2026-10-18"), "18 Okt");
    assert.equal(fmtDate(null), "—");
  });
  await t("bank account chhupta hai", () => {
    assert.equal(maskAccount("PK00MSAL0000001234"), "PK00 **** **** 1234");
    assert.equal(maskAccount(null), null);
    assert.ok(!maskAccount("PK36SCBL0000001123456702")!.includes("0000001123"));
  });
  await t("barhotri: basic ya %", () => {
    assert.deepEqual(incrementPreview(40000, 44000, null), { basic: 44000, amount: 4000, pct: 10 });
    assert.deepEqual(incrementPreview(34000, null, 10), { basic: 37400, amount: 3400, pct: 10 });
    assert.equal(incrementPreview(0, 1000, null), null);
    assert.equal(incrementPreview(40000, null, null), null);
  });
  await t("barhotri ka darja aur saalgirah", () => {
    assert.equal(incrementBucket("2028-10-28", "2028-10-30"), "late");
    assert.equal(incrementBucket("2028-10-31", "2028-10-20"), "this_month");
    assert.equal(incrementBucket("2028-11-05", "2028-10-20"), "next_month");
    assert.equal(incrementBucket("2029-01-05", "2028-12-20"), "next_month");
    assert.equal(incrementBucket("2029-03-05", "2028-12-20"), "later");
    assert.equal(incrementBucket(null, "2028-12-20"), "unknown");
    assert.equal(nextAnniversary("2026-11-01", "2026-12-01"), "2027-11-01");
    assert.equal(nextAnniversary("2020-03-10", "2026-10-21"), "2027-03-10");
    assert.equal(nextAnniversary("2020-11-10", "2026-10-21"), "2026-11-10");
    assert.equal(daysBetween("2028-10-20", "2028-11-01"), 12);
  });
  await t("raqam lafzon mein (mockup wali)", () => {
    assert.equal(amountInWords(52497), "Fifty-Two Thousand Four Hundred Ninety-Seven Rupees Only");
    assert.equal(amountInWords(0), "Zero Rupees Only");
    assert.equal(amountInWords(1250000), "One Million Two Hundred Fifty Thousand Rupees Only");
    assert.equal(amountInWords(100), "One Hundred Rupees Only");
  });
  await t("verify link", () => assert.equal(verifyUrl("https://agribridge.pk/", "VRF-7K3Q-92XM"), "https://agribridge.pk/verify/VRF-7K3Q-92XM"));

  const line = { id: "11111111-2222-3333-4444-555555555555", profile_id: "p1", basic: 40000, days_basis: 30, absent_days: 1, unpaid_leave_days: 0, missing_days: 0, half_days: 0,
    absent_deduction: 1333, advance_deduction: 5000, gross: 59200, net: 52497, slip_no: "ART-2026-11-0042", verify_code: "VRF-7K3Q-92XM",
    components: [{ code: "HOUSE_RENT", name: "Ghar ka kiraya", kind: "earning", amount: 8500 }, { code: "TRAVEL", name: "Safar", kind: "earning", amount: 5000 },
      { code: "MOBILE", name: "Mobile", kind: "earning", amount: 2500 }, { code: "EOBI", name: "EOBI", kind: "deduction", amount: 370 }] };
  const run = { pay_year: 2026, pay_month: 11, status: "paid", paid_at: "2026-12-01T10:00:00Z", pay_txn_id: null };
  const slip = buildSlip(line, run, { full_name: "Anwar Ul Hassan", father_name: "Muhammad Hassan", cnic: "36302-0000000-1", designation: "Sales Staff", bank_account: "PK00MSAL0000001234" });
  await t("slip ki rows aur net", () => {
    assert.equal(slip.month, "November 2026");
    assert.equal(slip.workDays, "29 / 30");
    assert.equal(slip.totalDeductions, 59200 - 52497);
    assert.equal(slip.earnings[0].label, "Basic");
    assert.ok(slip.deductions.some((d) => d.label === "Absent cut (1 din)" && d.amount === 1333));
    assert.equal(slip.staff.account, "PK00 **** **** 1234");
    assert.equal(slip.paidAt, "2026-12-01");
    assert.equal(slip.netWords, "Fifty-Two Thousand Four Hundred Ninety-Seven Rupees Only");
  });
  await t("PDF banta hai (Urdu harf bhi nahi girate)", async () => {
    assert.equal(pdfSafe("Anwar — حسن"), "Anwar -");
    const bytes = await salarySlipPdf({ ...slip, staff: { ...slip.staff, name: "انور Anwar" } }, "https://agribridge.pk/verify/VRF-7K3Q-92XM", "agribridge.pk/verify");
    assert.ok(bytes.length > 1500);
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  });

  await t("wiring: buttons, routes, migration", () => {
    const rd = (p: string) => fs.readFileSync(p, "utf8");
    assert.match(rd("src/app/admin/hr/payroll/payroll-client.tsx"), /🧾 Salary Slip[\s\S]*⬇ PDF/);
    assert.match(rd("src/app/admin/my-hr/page.tsx"), /Meri tankhwah parchiyan/);
    assert.match(rd("src/app/admin/hr/salary-structure/salary-structure-client.tsx"), /Bharti ke waqt tay hua[\s\S]*Qubool offer se structure banao/);
    assert.match(rd("src/app/admin/hr/increments/page.tsx"), /Aane wali barhotriyan/);
    assert.match(rd("src/components/payroll/salary-forms.tsx"), /Chalu karein — Draft structure banao/);
    assert.ok(fs.existsSync("src/app/verify/[code]/page.tsx"));
    assert.ok(fs.existsSync("src/app/api/hr/payslip/[id]/pdf/route.ts"));
    const sql = rd("supabase/migrations/691_salary_offer_increments_slip.sql");
    for (const k of ["job_offer_events", "v_upcoming_increments", "fn_verify_salary_slip", "verify_code", "source_offer_id", "next_increment_due", "superseded_by", "'countered'", "'withdrawn'", "enable row level security"]) assert.ok(sql.includes(k), k);
    assert.ok(!/\bdrop\s+table\b/i.test(sql.replace(/--.*$/gm, "")), "691 additive");
    assert.ok(fs.existsSync("supabase/migrations/691_salary_offer_increments_slip.rollback.sql"));
    // Public tasdeeq mein CNIC/bank nahi
    const verify = sql.slice(sql.indexOf("function public.fn_verify_salary_slip"));
    const body = verify.slice(0, verify.indexOf("$$;", verify.indexOf("$$") + 2));
    assert.ok(!/cnic|bank_account|bank_name/.test(body), "verify mein maloomat mehdood");
  });
  console.log(`salary-offer: ${n} ok`);
})().catch((e) => { console.error(e); process.exit(1); });
