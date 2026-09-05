import nodemailer from "nodemailer";

/**
 * Har mehkame ki apni email — ek hi jagah se.
 *
 * Malik ka kehna (5 September): *"machinery ki mail machinery se jani
 * chahiye, job al rana traders se nahi — sirf job ke hawale se mail job
 * se jayein, HR ke hawale se HR se jayein."*
 *
 * Wajah saaf hai. Kisan ko machinery ki slip milti thi aur bhejne wale
 * ki jagah `job@alranatraders.pk` likha hota tha — yani naukri wala
 * khata. Jawab dene wala jawab wahin bhejta, aur wo naukriyon ke inbox
 * mein ja kar gum ho jata. Address sirf naam nahi hota; wo ye batata hai
 * ke JAWAB KAHAN AAYEGA.
 *
 * Pehle chhe alag jaghon par wohi paanch lakeerein copy hui thin
 * (`nodemailer.createTransport({ ... job@ ... })`). Ek jagah address
 * badalna baqi paanch ko chhor deta — is liye ab ek hi jagah hai.
 *
 * -------------------------------------------------------------------
 * EK USOOL JO TORNA NAHI:
 *
 * `from` mein WOHI address jata hai jis se hum ne login kiya. cPanel
 * kisi aur ka naam le kar bhejne nahi deta, aur agar de bhi de to SPF
 * aur DMARC us mail ko spam mein daal dete hain. Is liye jis mehkame ki
 * chaabi (env) nahi lagi, us ki mail purane khate se jayegi aur `from`
 * mein bhi wohi purana khata likha hoga — mehkame ka naam sirf
 * dikhawe ke liye nahi chipkaya jayega.
 */

export type MailDept =
  | "jobs"
  | "hr"
  | "machinery"
  | "grain"
  | "accounts"
  | "rent"
  | "sales";

type DeptConfig = {
  /** cPanel ka mailbox jo is mehkame ke liye banana hai. */
  address: string;
  /** Bhejne wale ka naam jo wasool karne wale ko nazar aata hai. */
  label: string;
  /** Email ke neeche mehkame ka naam. */
  footer: string;
  /** Is mehkame ke apne env: user aur pass. */
  userEnv: string;
  passEnv: string;
};

const DEPTS: Record<MailDept, DeptConfig> = {
  jobs: {
    address: "job@alranatraders.pk",
    label: "Al Rana Traders — Jobs",
    footer: "Recruitment",
    userEnv: "JOB_SMTP_USER",
    passEnv: "JOB_SMTP_PASS",
  },
  hr: {
    address: "hr@alranatraders.pk",
    label: "Al Rana Traders — HR",
    footer: "Human Resources Department",
    userEnv: "HR_SMTP_USER",
    passEnv: "HR_SMTP_PASS",
  },
  machinery: {
    address: "machinery@alranatraders.pk",
    label: "Al Rana Traders — Machinery",
    footer: "Machinery & Rental",
    userEnv: "MACHINERY_SMTP_USER",
    passEnv: "MACHINERY_SMTP_PASS",
  },
  grain: {
    address: "grain@alranatraders.pk",
    label: "Al Rana Traders — Grain",
    footer: "Grain Procurement",
    userEnv: "GRAIN_SMTP_USER",
    passEnv: "GRAIN_SMTP_PASS",
  },
  accounts: {
    address: "accounts@alranatraders.pk",
    label: "Al Rana Traders — Accounts",
    footer: "Accounts & Finance",
    userEnv: "ACCOUNTS_SMTP_USER",
    passEnv: "ACCOUNTS_SMTP_PASS",
  },
  rent: {
    address: "rent@alranatraders.pk",
    label: "Al Rana Traders — Rent",
    footer: "Property & Rent",
    userEnv: "RENT_SMTP_USER",
    passEnv: "RENT_SMTP_PASS",
  },
  sales: {
    address: "sales@alranatraders.pk",
    label: "Al Rana Traders — Sales",
    footer: "Sales & Store",
    userEnv: "SALES_SMTP_USER",
    passEnv: "SALES_SMTP_PASS",
  },
};

/**
 * Jis mehkame ki chaabi nahi lagi, us ki mail yahan se jati hai.
 *
 * Ye "koi bhi khata chalega" wali baat nahi hai — ye wohi purana khata
 * hai jo pehle se chal raha hai, taake mail rukay nahi. Jis din us
 * mehkame ka mailbox ban kar env mein aa jayega, us din ki mail apne
 * ghar se jane lagegi. Koi code badalne ki zaroorat nahi.
 */
const FALLBACK_USER_ENV = "JOB_SMTP_USER";
const FALLBACK_PASS_ENV = "JOB_SMTP_PASS";
const FALLBACK_ADDRESS = "job@alranatraders.pk";

type Sender = {
  address: string;
  label: string;
  footer: string;
  pass: string | undefined;
  /** Kya ye mehkame ka apna khata hai, ya purana sanjha khata. */
  ownBox: boolean;
};

function senderFor(dept: MailDept): Sender {
  const cfg = DEPTS[dept];
  const user = process.env[cfg.userEnv];
  const pass = process.env[cfg.passEnv];

  // Dono chahiyein. Sirf user likha ho aur password na ho to login hi
  // nahi hoga -- aur us soorat mein mail chup chaap ruk jati, jo is
  // project mein sab se buri shakal hai.
  if (user && pass) {
    return { address: user, label: cfg.label, footer: cfg.footer, pass, ownBox: true };
  }

  return {
    address: process.env[FALLBACK_USER_ENV] ?? FALLBACK_ADDRESS,
    // Naam mein mehkama phir bhi rehta hai (wo jhoot nahi -- mail waqai
    // machinery ki hai), magar ADDRESS wohi jis se login hua.
    label: cfg.label,
    footer: cfg.footer,
    pass: process.env[FALLBACK_PASS_ENV],
    ownBox: false,
  };
}

function transporterFor(sender: Sender) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "mail.alranatraders.pk",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user: sender.address, pass: sender.pass },
  });
}

/**
 * Email ka dhaancha — mehkame ke naam ke sath.
 *
 * Pehle is ke sar par hamesha "Human Resources Department" likha hota
 * tha, chahe andar machinery ki slip ho. Ab wo naam usi mehkame ka
 * hota hai jis ne mail bheji.
 */
export function mailWrapper(bodyHtml: string, dept: MailDept): string {
  const sender = senderFor(dept);
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#f4f6f4; padding:32px 16px;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:#1a1f36; padding:24px; text-align:center;">
        <p style="margin:0; color:#ffffff; font-size:20px; font-weight:700;">Al Rana Traders</p>
        <p style="margin:4px 0 0; color:#94a3b8; font-size:12px;">${sender.footer}</p>
      </div>
      <div style="padding:28px 24px; color:#1f2937; font-size:14px; line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="background:#f9fafb; padding:18px 24px; text-align:center; border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 6px; font-size:12px; color:#6b7280;">
          alranatraders.pk &nbsp;|&nbsp; ${sender.address}
        </p>
        <p style="margin:0; font-size:11px; color:#9ca3af;">
          &copy; ${new Date().getFullYear()} Al Rana Traders. All rights reserved.
        </p>
      </div>
    </div>
  </div>`;
}

export type MailResult = { sent: true; from: string } | { sent: false; error: string };

/**
 * Mail bhejne ka WAHID raasta.
 *
 * Nateeja WAPAS aata hai — chhupaya nahi jata. Pehle har jagah
 * `catch {}` tha aur mail chup chaap gum ho jati thi; bhejne wale ko
 * lagta ke chali gayi. Ab bulane wala khud tay karta hai ke us
 * nakami ka kya karna hai.
 */
export async function sendDeptMail(args: {
  dept: MailDept;
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<MailResult> {
  const sender = senderFor(args.dept);

  if (!sender.pass) {
    return {
      sent: false,
      error: `Email nahi ja saki: ${DEPTS[args.dept].address} ka password server par darj nahi hai.`,
    };
  }

  try {
    await transporterFor(sender).sendMail({
      from: `"${sender.label}" <${sender.address}>`,
      to: args.to,
      subject: args.subject,
      html: args.html,
      attachments: args.attachments,
    });
    return { sent: true, from: sender.address };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Email bhejne mein masla hua.",
    };
  }
}

/**
 * Kaun se mehkame ka apna mailbox ban chuka hai aur kaun sa abhi purane
 * khate se ja raha hai.
 *
 * Ye sawal setup ke waqt bar bar aata hai, aur is ka jawab andaze se
 * nahi milta. Yahan har mehkama apna sach batata hai.
 */
export function mailboxStatus(): {
  dept: MailDept;
  chahiye: string;
  chal_raha: string;
  apna_box: boolean;
}[] {
  return (Object.keys(DEPTS) as MailDept[]).map((dept) => {
    const sender = senderFor(dept);
    return {
      dept,
      chahiye: DEPTS[dept].address,
      chal_raha: sender.address,
      apna_box: sender.ownBox,
    };
  });
}
