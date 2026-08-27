import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase/service";
import { generateOfferLetterPDF } from "@/lib/offer-letter-pdf";

const SITE_URL = "https://alranatraders.pk";

function getJobTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "mail.alranatraders.pk",
    port: 587,
    secure: false,
    auth: {
      user: process.env.JOB_SMTP_USER ?? "job@alranatraders.pk",
      pass: process.env.JOB_SMTP_PASS,
    },
  });
}

function emailWrapper(bodyHtml: string): string {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#f4f6f4; padding:32px 16px;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:#1a1f36; padding:24px; text-align:center;">
        <p style="margin:0; color:#ffffff; font-size:20px; font-weight:700;">Al Rana Traders</p>
        <p style="margin:4px 0 0; color:#94a3b8; font-size:12px;">Human Resources Department</p>
      </div>
      <div style="padding:28px 24px; color:#1f2937; font-size:14px; line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="background:#f9fafb; padding:18px 24px; text-align:center; border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 6px; font-size:12px; color:#6b7280;">
          alranatraders.pk &nbsp;|&nbsp; job@alranatraders.pk
        </p>
        <p style="margin:0; font-size:11px; color:#9ca3af;">
          &copy; ${new Date().getFullYear()} Al Rana Traders. All rights reserved.
        </p>
      </div>
    </div>
  </div>`;
}

async function send(toEmail: string, subject: string, html: string, attachments?: { filename: string; content: Buffer }[]) {
  try {
    const transporter = getJobTransporter();
    await transporter.sendMail({
      from: `"Al Rana Traders - HR" <${process.env.JOB_SMTP_USER ?? "job@alranatraders.pk"}>`,
      to: toEmail,
      subject,
      html,
      attachments,
    });
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

async function getCustomTemplate(key: string): Promise<{ subject: string; body: string } | null> {
  try {
    const serviceClient = createServiceClient();
    const { data } = await serviceClient.from("email_templates").select("subject, body_html").eq("template_key", key).maybeSingle();
    return data ? { subject: data.subject, body: data.body_html } : null;
  } catch {
    return null;
  }
}

function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

async function sendWithTemplate(templateKey: string, toEmail: string, vars: Record<string, string>, fallbackSubject: string, fallbackBody: string) {
  const custom = await getCustomTemplate(templateKey);
  if (custom) {
    await send(toEmail, fillPlaceholders(custom.subject, vars), emailWrapper(fillPlaceholders(custom.body, vars)));
  } else {
    await send(toEmail, fallbackSubject, emailWrapper(fallbackBody));
  }
}

export async function sendApplicationReceivedEmail(toEmail: string, fullName: string, jobTitle: string, applicationId: string) {
  const vars = { fullName, jobTitle, applicationId: applicationId.slice(0, 8).toUpperCase(), date: new Date().toLocaleDateString() };
  await sendWithTemplate(
    "application_received",
    toEmail,
    vars,
    `Application Received - ${jobTitle} | Al Rana Traders`,
    `<p>Dear <strong>${fullName}</strong>,</p>
    <p>Thank you for applying for the position of <strong>${jobTitle}</strong> at Al Rana Traders.</p>
    <p>We have successfully received your application. Our HR team will review your qualifications and experience, and if your profile is shortlisted, we will contact you regarding the next stage.</p>
    <div style="background:#f9fafb; border-radius:8px; padding:14px; margin:16px 0; font-size:13px;">
      <p style="margin:0;"><strong>Position:</strong> ${jobTitle}</p>
      <p style="margin:4px 0 0;"><strong>Application ID:</strong> ${vars.applicationId}</p>
      <p style="margin:4px 0 0;"><strong>Date:</strong> ${vars.date}</p>
    </div>
    <p>We appreciate your interest in joining Al Rana Traders.</p>`
  );
}

export async function sendUnderReviewEmail(toEmail: string, fullName: string, jobTitle: string) {
  const vars = { fullName, jobTitle };
  await sendWithTemplate(
    "under_review",
    toEmail,
    vars,
    `Application Update - ${jobTitle} | Al Rana Traders`,
    `<p>Dear <strong>${fullName}</strong>,</p>
    <p>Your application for the position of <strong>${jobTitle}</strong> is currently under review by our Human Resources team.</p>
    <p>We appreciate your patience while we complete the screening process. You will be notified once a decision has been made regarding the next stage of your application.</p>`
  );
}

export async function sendEligibilityEmail(toEmail: string, fullName: string, jobTitle: string, eligible: boolean) {
  const vars = { fullName, jobTitle };
  if (eligible) {
    await sendWithTemplate(
      "eligibility_shortlisted",
      toEmail,
      vars,
      `You Have Been Shortlisted - ${jobTitle}`,
      `<p>Dear <strong>${fullName}</strong>,</p>
      <p>We are pleased to inform you that your application for the position of <strong>${jobTitle}</strong> has been shortlisted after the initial screening process.</p>
      <p>Our HR team will contact you shortly with details of the next stage.</p>`
    );
  } else {
    await sendWithTemplate(
      "eligibility_rejected",
      toEmail,
      vars,
      `Application Status - ${jobTitle}`,
      `<p>Dear <strong>${fullName}</strong>,</p>
      <p>Thank you for your interest in the <strong>${jobTitle}</strong> position at Al Rana Traders.</p>
      <p>After careful consideration, we regret to inform you that your application has not been selected to proceed further at this time. We encourage you to apply for future opportunities matching your profile.</p>`
    );
  }
}

export async function sendInterviewInvitationEmail(toEmail: string, fullName: string, jobTitle: string, interviewDate: string) {
  const formattedDate = new Date(interviewDate).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const vars = { fullName, jobTitle, interviewDate: formattedDate };
  await sendWithTemplate(
    "interview_invitation",
    toEmail,
    vars,
    `Interview Invitation - ${jobTitle} | Al Rana Traders`,
    `<p>Dear <strong>${fullName}</strong>,</p>
    <p>We are pleased to invite you for an interview for the position of <strong>${jobTitle}</strong> at Al Rana Traders.</p>
    <div style="background:#f9fafb; border-radius:8px; padding:14px; margin:16px 0; font-size:13px;">
      <p style="margin:0;"><strong>Date:</strong> ${formattedDate}</p>
    </div>
    <p>Please bring a valid copy of your CV and relevant documents. If you are unable to attend, please contact our HR team as soon as possible.</p>
    <p>We look forward to meeting you.</p>`
  );
}

export async function sendInterviewRescheduledEmail(toEmail: string, fullName: string, jobTitle: string, newDate: string) {
  const formattedDate = new Date(newDate).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const vars = { fullName, jobTitle, interviewDate: formattedDate };
  await sendWithTemplate(
    "interview_rescheduled",
    toEmail,
    vars,
    `Interview Rescheduled - ${jobTitle} | Al Rana Traders`,
    `<p>Dear <strong>${fullName}</strong>,</p>
    <p>Please be informed that your interview for the position of <strong>${jobTitle}</strong> has been rescheduled.</p>
    <div style="background:#f9fafb; border-radius:8px; padding:14px; margin:16px 0; font-size:13px;">
      <p style="margin:0;"><strong>New Date:</strong> ${formattedDate}</p>
    </div>
    <p>We apologize for any inconvenience and appreciate your understanding.</p>`
  );
}

export async function sendInterviewReminderEmail(toEmail: string, fullName: string, jobTitle: string, interviewDate: string) {
  const formattedDate = new Date(interviewDate).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const vars = { fullName, jobTitle, interviewDate: formattedDate };
  await sendWithTemplate(
    "interview_reminder",
    toEmail,
    vars,
    `Interview Reminder - ${jobTitle} | Tomorrow`,
    `<p>Dear <strong>${fullName}</strong>,</p>
    <p>This is a reminder that your interview for the position of <strong>${jobTitle}</strong> is scheduled for tomorrow.</p>
    <div style="background:#f9fafb; border-radius:8px; padding:14px; margin:16px 0; font-size:13px;">
      <p style="margin:0;"><strong>Date:</strong> ${formattedDate}</p>
    </div>
    <p>Please be available at least 10 minutes before the scheduled time.</p>
    <p>We look forward to meeting you.</p>`
  );
}

export async function sendInterviewResultEmail(toEmail: string, fullName: string, jobTitle: string, selected: boolean) {
  const vars = { fullName, jobTitle };
  if (selected) {
    await sendWithTemplate(
      "interview_result_pass",
      toEmail,
      vars,
      `Interview Outcome - ${jobTitle} | Al Rana Traders`,
      `<p>Dear <strong>${fullName}</strong>,</p>
      <p>We are pleased to inform you that you have successfully completed the interview process for the position of <strong>${jobTitle}</strong>.</p>
      <p>Your profile has been selected to proceed to the final stage of our recruitment process. Our HR team will contact you shortly regarding next steps.</p>
      <p>Congratulations, and thank you for your interest in joining Al Rana Traders.</p>`
    );
  } else {
    await sendWithTemplate(
      "interview_result_fail",
      toEmail,
      vars,
      `Interview Outcome - ${jobTitle} | Al Rana Traders`,
      `<p>Dear <strong>${fullName}</strong>,</p>
      <p>Thank you for taking the time to interview for the position of <strong>${jobTitle}</strong> at Al Rana Traders.</p>
      <p>After careful consideration, we regret to inform you that we have decided not to proceed with your application at this time.</p>
      <p>We wish you the very best in your future career.</p>`
    );
  }
}

// Job offer email now generates and attaches a proper PDF Offer Letter
// (via pdf-lib, no external service needed) alongside the accept/view
// link in the email body.
export async function sendJobOfferEmail(
  toEmail: string,
  fullName: string,
  offerToken: string,
  designation: string,
  extra?: { proposedSalary?: number | null; branchName?: string | null; offerMessage?: string | null; expiryDate?: string | null }
) {
  const link = `${SITE_URL}/job-offer/${offerToken}`;
  const vars = { fullName, designation, link };

  const pdfBuffer = await generateOfferLetterPDF({
    fullName,
    designation,
    proposedSalary: extra?.proposedSalary ?? null,
    branchName: extra?.branchName ?? null,
    offerMessage: extra?.offerMessage ?? null,
    expiryDate: extra?.expiryDate ?? null,
  });

  const custom = await getCustomTemplate("job_offer");
  const subject = custom ? fillPlaceholders(custom.subject, vars) : `Job Offer - ${designation} at Al Rana Traders`;
  const body = custom
    ? fillPlaceholders(custom.body, vars)
    : `<p>Dear <strong>${fullName}</strong>,</p>
      <p>We are pleased to offer you the position of <strong>${designation}</strong> at Al Rana Traders.</p>
      <p>Please find your formal Employment Offer Letter attached to this email.</p>
      <p style="text-align:center; margin:24px 0;">
        <a href="${link}" style="background:#16a34a; color:#ffffff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
          Offer Dekhein
        </a>
      </p>
      <p style="color:#6b7280; font-size:12px;">Agar button kaam na kare, ye link browser mein paste karein:<br/>${link}</p>`;

  await send(toEmail, subject, emailWrapper(body), [{ filename: `Offer-Letter-${fullName.replace(/\s+/g, "-")}.pdf`, content: pdfBuffer }]);
}

export async function sendOfferExpiredEmail(toEmail: string, fullName: string, jobTitle: string) {
  const vars = { fullName, jobTitle };
  await sendWithTemplate(
    "offer_expired",
    toEmail,
    vars,
    `Employment Offer Status - ${jobTitle}`,
    `<p>Dear <strong>${fullName}</strong>,</p>
    <p>This is to inform you that the acceptance period for the employment offer for the position of <strong>${jobTitle}</strong> has expired.</p>
    <p>If you still wish to proceed with the opportunity, please contact our HR department at the earliest.</p>`
  );
}

export async function sendWelcomeEmail(toEmail: string, fullName: string, designation: string) {
  const vars = { fullName, designation };
  await sendWithTemplate(
    "welcome",
    toEmail,
    vars,
    `Welcome to Al Rana Traders`,
    `<p>Dear <strong>${fullName}</strong>,</p>
    <p>Thank you for confirming your acceptance of our employment offer for the position of <strong>${designation}</strong>.</p>
    <p>We are pleased to welcome you to Al Rana Traders. You will shortly receive a separate email to set up your account password.</p>
    <p>We look forward to having you as part of our team.</p>`
  );
}

export async function sendOfficialLoginEmail(toEmail: string, fullName: string, officialEmail: string, password: string) {
  const html = emailWrapper(`
    <p>Dear <strong>${fullName}</strong>,</p>
    <p>Welcome to Al Rana Traders! Your official company account has been created.</p>
    <p style="margin:16px 0 6px; font-weight:600;">1) Website/System Login:</p>
    <div style="background:#f9fafb; border-radius:8px; padding:14px; margin:0 0 16px; font-size:13px;">
      <p style="margin:0;"><strong>URL:</strong> ${SITE_URL}/login</p>
      <p style="margin:4px 0 0;"><strong>Email:</strong> ${officialEmail}</p>
      <p style="margin:4px 0 0;"><strong>Password:</strong> ${password}</p>
    </div>
    <p style="margin:16px 0 6px; font-weight:600;">2) Email Account Access (Outlook/Gmail/Phone app mein use karein):</p>
    <div style="background:#f9fafb; border-radius:8px; padding:14px; margin:0 0 16px; font-size:13px;">
      <p style="margin:0;"><strong>Username:</strong> ${officialEmail}</p>
      <p style="margin:4px 0 0;"><strong>Password:</strong> ${password}</p>
      <p style="margin:4px 0 0;"><strong>POP/IMAP Server:</strong> mail.alranatraders.pk</p>
      <p style="margin:4px 0 0;"><strong>SMTP Server:</strong> mail.alranatraders.pk (Port 587)</p>
    </div>
    <p style="color:#b91c1c; font-size:13px;">Barah-e-meherbani apna password pehli login ke baad badal lein, aur ye details kisi ke sath share na karein.</p>
  `);
  await send(toEmail, "Aapka Official Login - Al Rana Traders", html);
}

export async function sendPasswordResetEmail(toEmail: string, fullName: string, resetLink: string) {
  const html = emailWrapper(`
    <p>Dear <strong>${fullName}</strong>,</p>
    <p>Aap ne apna password reset karne ki request ki hai. Neeche button dabayein - ye link 1 ghante ke liye valid hai.</p>
    <p style="text-align:center; margin:24px 0;">
      <a href="${resetLink}" style="background:#16a34a; color:#ffffff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
        Naya Password Set Karein
      </a>
    </p>
    <p style="color:#6b7280; font-size:12px;">Agar button kaam na kare, ye link browser mein paste karein:<br/>${resetLink}</p>
    <p style="color:#6b7280; font-size:12px;">Agar aap ne ye request nahi ki, is email ko nazar-andaz kar dein.</p>
  `);
  await send(toEmail, "Password Reset - Al Rana Traders", html);
}

export const EMAIL_TEMPLATE_DEFAULTS: { key: string; name: string; subject: string; body: string }[] = [
  { key: "application_received", name: "Application Received", subject: "Application Received - {{jobTitle}} | Al Rana Traders", body: "<p>Dear {{fullName}},</p><p>Thank you for applying for {{jobTitle}}. Application ID: {{applicationId}}, Date: {{date}}.</p>" },
  { key: "under_review", name: "Application Under Review", subject: "Application Update - {{jobTitle}}", body: "<p>Dear {{fullName}},</p><p>Your application for {{jobTitle}} is under review.</p>" },
  { key: "eligibility_shortlisted", name: "Shortlisted After Screening", subject: "You Have Been Shortlisted - {{jobTitle}}", body: "<p>Dear {{fullName}},</p><p>You've been shortlisted for {{jobTitle}}.</p>" },
  { key: "eligibility_rejected", name: "Rejected After Screening", subject: "Application Status - {{jobTitle}}", body: "<p>Dear {{fullName}},</p><p>We will not be proceeding with your application for {{jobTitle}}.</p>" },
  { key: "interview_invitation", name: "Interview Invitation", subject: "Interview Invitation - {{jobTitle}}", body: "<p>Dear {{fullName}},</p><p>Interview for {{jobTitle}} on {{interviewDate}}.</p>" },
  { key: "interview_rescheduled", name: "Interview Rescheduled", subject: "Interview Rescheduled - {{jobTitle}}", body: "<p>Dear {{fullName}},</p><p>Your interview for {{jobTitle}} moved to {{interviewDate}}.</p>" },
  { key: "interview_reminder", name: "Interview Reminder (24hr)", subject: "Interview Reminder - {{jobTitle}} | Tomorrow", body: "<p>Dear {{fullName}},</p><p>Reminder: your interview for {{jobTitle}} is tomorrow, {{interviewDate}}.</p>" },
  { key: "interview_result_pass", name: "Interview Passed", subject: "Interview Outcome - {{jobTitle}}", body: "<p>Dear {{fullName}},</p><p>Congratulations, you passed the interview for {{jobTitle}}.</p>" },
  { key: "interview_result_fail", name: "Interview Not Selected", subject: "Interview Outcome - {{jobTitle}}", body: "<p>Dear {{fullName}},</p><p>We will not be proceeding after your interview for {{jobTitle}}.</p>" },
  { key: "job_offer", name: "Job Offer", subject: "Job Offer - {{designation}} at Al Rana Traders", body: "<p>Dear {{fullName}},</p><p>We offer you the position of {{designation}}. See attached offer letter. <a href='{{link}}'>View Offer</a></p>" },
  { key: "offer_expired", name: "Offer Expired", subject: "Employment Offer Status - {{jobTitle}}", body: "<p>Dear {{fullName}},</p><p>The acceptance period for {{jobTitle}} has expired.</p>" },
  { key: "welcome", name: "Offer Accepted / Welcome", subject: "Welcome to Al Rana Traders", body: "<p>Dear {{fullName}},</p><p>Welcome as our new {{designation}}!</p>" },
];