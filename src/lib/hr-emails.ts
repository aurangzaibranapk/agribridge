import { sendDeptMail, mailWrapper, type MailResult } from "@/lib/mailer";

/**
 * HR ki rasmi emails: joining aur contract khatam hone ka notice.
 *
 * Teen usool:
 *  1. Har naam/ohda jo form ya database se aata hai, HTML mein jaane se
 *     pehle escape hota hai. Naam mein `<script>` ya `<a href>` likh kar
 *     koi HR ki asli email mein apna link nahi chipka sakta.
 *  2. Nateeja (sent / not sent) WAPAS aata hai, chhupaya nahi jata --
 *     bulane wala usay audit mein likhta aur HR ko dikhata hai.
 *  3. Template sirf data se banta hai. "Aakhri din" khud se +7 nahi
 *     ghara jata; wohi tareekh jo record (staff_details.exit_date) mein hai.
 *
 * Suspend par koi email nahi jati: suspend wapas ho sakta hai, aur
 * "contract khatam" ki email wapas nahi hoti.
 */

const SITE_URL = "https://alranatraders.pk";
const COMPANY = "AgriBridge / AgriBridge";

export type HrMailKind = "joining" | "separation";
export type HrMailSender = typeof sendDeptMail;

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Aaj ki tareekh Pakistan ke waqt se (YYYY-MM-DD). Server UTC par ho sakta hai. */
export function todayPk(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "2026-10-17" -> "17 October 2026". Ghalat tareekh ho to null. */
export function formatLongDate(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function cleanText(value: string | null | undefined, fallback: string): string {
  const v = String(value ?? "").replace(/\s+/g, " ").trim();
  return v || fallback;
}

/** Email ka "to" sirf ek saaf address ho -- comma ya naya line nahi. */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  // Mobile-login wale accounts ka nakli address (`03xx@phone.agribridge.local`)
  // kisi inbox tak nahi pohanchta.
  if (e.endsWith(".local")) return false;
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(e);
}

export type BuiltEmail = { subject: string; body: string };

export function buildJoiningEmail(args: {
  fullName: string | null | undefined;
  designation: string | null | undefined;
  joiningDate: string;
}): BuiltEmail {
  const name = escapeHtml(cleanText(args.fullName, "Team Member"));
  const role = escapeHtml(cleanText(args.designation, "Staff Member"));
  const date = escapeHtml(formatLongDate(args.joiningDate) ?? args.joiningDate);
  const subject = `Welcome to ${COMPANY} – Your Joining Details`;
  const body = `
      <p>Dear <strong>${name}</strong>,</p>
      <p>We are pleased to confirm your joining with <strong>${COMPANY}</strong> as <strong>${role}</strong>, effective <strong>${date}</strong>.</p>
      <p>Please find the key details below:</p>
      <ul>
        <li><strong>Position:</strong> ${role}</li>
        <li><strong>Joining Date:</strong> ${date}</li>
      </ul>
      <p>Your login details for the staff portal are sent in a separate email. On your first day, please bring the required documents (CNIC, certificates, bank details and photographs).</p>
      <p>We look forward to your contribution and wish you a successful journey with the team.</p>
      <p>Warm regards,<br/>HR Department<br/>${COMPANY}<br/><a href="${SITE_URL}">${SITE_URL}</a></p>
    `;
  return { subject, body };
}

export function buildSeparationEmail(args: {
  fullName: string | null | undefined;
  designation: string | null | undefined;
  lastWorkingDay: string;
}): BuiltEmail {
  const name = escapeHtml(cleanText(args.fullName, "Team Member"));
  const role = escapeHtml(cleanText(args.designation, "Staff Member"));
  const lastDayText = formatLongDate(args.lastWorkingDay) ?? args.lastWorkingDay;
  const lastDay = escapeHtml(lastDayText);
  const subject = `Notice of Contract Closure – Last Working Day ${lastDayText}`;
  const body = `
      <p>Dear <strong>${name}</strong>,</p>
      <p>This email is to formally inform you that your engagement with <strong>${COMPANY}</strong> as <strong>${role}</strong> is coming to a close.</p>
      <p>Please accept this email as your formal notice of contract closure. Your <strong>last working day is ${lastDay}</strong>.</p>
      <p>To ensure a smooth transition, please note the following:</p>
      <ul>
        <li><strong>Handover:</strong> Please complete a proper handover of all pending tasks and return all company assets by your last working day.</li>
        <li><strong>Final Settlement:</strong> Your final settlement will be processed in the payroll cycle after your last working day, once all departmental clearances are complete.</li>
      </ul>
      <p>We sincerely thank you for your work and dedication during your time with the team, and wish you the very best in your next chapter.</p>
      <p>Warm regards,<br/>HR Department<br/>${COMPANY}<br/><a href="${SITE_URL}">${SITE_URL}</a></p>
    `;
  return { subject, body };
}

async function deliver(
  toEmail: string | null | undefined,
  built: BuiltEmail,
  send: HrMailSender
): Promise<MailResult> {
  if (!isDeliverableEmail(toEmail)) {
    return { sent: false, error: "Is mulazim ka sahi email address record mein nahi hai." };
  }
  try {
    return await send({
      dept: "hr",
      to: toEmail.trim(),
      subject: built.subject,
      html: mailWrapper(built.body, "hr"),
    });
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Email bhejne mein masla hua." };
  }
}

export function sendJoiningEmail(
  args: { toEmail: string | null | undefined; fullName: string; designation: string | null; joiningDate: string },
  send: HrMailSender = sendDeptMail
): Promise<MailResult> {
  return deliver(args.toEmail, buildJoiningEmail(args), send);
}

export function sendSeparationEmail(
  args: { toEmail: string | null | undefined; fullName: string; designation: string | null; lastWorkingDay: string },
  send: HrMailSender = sendDeptMail
): Promise<MailResult> {
  return deliver(args.toEmail, buildSeparationEmail(args), send);
}

const KIND_LABEL: Record<HrMailKind, string> = {
  joining: "Joining email",
  separation: "Contract closure email",
};

/** Audit log ki ek line: kya bheja, kis ko, aur hua ya nahi. */
export function hrMailAuditText(kind: HrMailKind, to: string | null | undefined, result: MailResult): string {
  const label = KIND_LABEL[kind];
  return result.sent
    ? `${label} bhej di gayi: ${to ?? "?"} (from ${result.from})`
    : `${label} NAHI gayi${to ? ` (${to})` : ""}: ${result.error}`;
}

/** HR ko safhe par dikhane wali baat. Email chali gayi to kuch nahi. */
export function hrMailNotice(kind: HrMailKind, result: MailResult): string | undefined {
  if (result.sent) return undefined;
  return `${KIND_LABEL[kind]} nahi ja saki: ${result.error} Kaam ho gaya hai; email khud bhej dein ya server ka HR email setup check karein.`;
}
