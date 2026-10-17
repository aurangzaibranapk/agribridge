import { sendDeptMail, mailWrapper } from "@/lib/mailer";

const SITE_URL = "https://alranatraders.pk";

export async function sendJoiningEmail(toEmail: string, fullName: string, designation: string, joiningDate: string) {
  const subject = `Welcome to Al Rana Traders / AgriBridge – Your Joining Details`;
  const body = `
    <p>Dear <strong>${fullName}</strong>,</p>
    <p>We are pleased to confirm your joining with <strong>Al Rana Traders / AgriBridge</strong> as <strong>${designation || "Staff Member"}</strong>, effective <strong>${joiningDate}</strong>.</p>
    <p>Please find the key details below:</p>
    <ul>
      <li><strong>Position:</strong> ${designation || "Staff Member"}</li>
      <li><strong>Joining Date:</strong> ${joiningDate}</li>
      <li><strong>Work Location:</strong> As discussed</li>
    </ul>
    <p>On your first day, please bring the required documents (CNIC, certificates, bank details, photographs).</p>
    <p>We look forward to your contribution and wish you a successful journey with the team.</p>
    <p>Warm regards,<br/>HR Department<br/>Al Rana Traders / AgriBridge<br/><a href="${SITE_URL}">${SITE_URL}</a></p>
  `;
  await sendDeptMail({
    dept: "hr",
    to: toEmail,
    subject,
    html: mailWrapper(body, "hr"),
  });
}

export async function sendSeparationEmail(toEmail: string, fullName: string, designation: string, lastWorkingDay: string, reason: string) {
  const subject = `Notice of Contract Closure – Last Working Day ${lastWorkingDay}`;
  const body = `
    <p>Dear <strong>${fullName}</strong>,</p>
    <p>As Al Rana Traders / AgriBridge continues to evolve and focus on operational efficiency, we regret to inform you that your position as <strong>${designation || "Staff Member"}</strong> has been discontinued.</p>
    <p>Please accept this email as your formal notice of contract closure. Pursuant to the terms of your employment, your <strong>last working day will be ${lastWorkingDay}</strong>.</p>
    <p>We sincerely thank you for your hard work and dedication during your time with the team.</p>
    <p>To ensure a smooth transition, please note the following:</p>
    <ul>
      <li><strong>Next Steps:</strong> Please continue your duties through the notice period, complete a proper handover of all pending tasks, and return all company assets by your last working day.</li>
      <li><strong>Final Settlement:</strong> Your final clear-out payment will be processed in the next payroll cycle after your last day, once all departmental clearances are complete.</li>
    </ul>
    <p>Thank you again for everything you have brought to the team. We wish you the very best in your next professional chapter.</p>
    <p>Warm regards,<br/>HR Department<br/>Al Rana Traders / AgriBridge<br/><a href="${SITE_URL}">${SITE_URL}</a></p>
  `;
  await sendDeptMail({
    dept: "hr",
    to: toEmail,
    subject,
    html: mailWrapper(body, "hr"),
  });
}
