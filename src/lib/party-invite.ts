/**
 * Admin dealer / buyer (aur isi tarah ke non-self-signup roles) invite.
 *
 * Khud-signup (kisan / public website) is file se nahi guzarta.
 * Account yahan banta hai, paigham baad mein — pehle wahi text jo
 * timeline mein poora darj hota hai (Dekhein).
 */

export const PARTY_INVITE_ROLES = ["dealer", "buyer", "investor", "machinery_vendor"] as const;
export type PartyRoleKey = (typeof PARTY_INVITE_ROLES)[number];
export const INVITE_CHANNELS = ["whatsapp", "email", "sms"] as const;
export type InviteChannel = (typeof INVITE_CHANNELS)[number];

export interface PartyRoleSpec {
  key: PartyRoleKey;
  /** Screen par tab. */
  label: string;
  /** profiles.role — portal jis darje ko andar aane deta hai. */
  profileRole: "dealer" | "customer" | "machinery_vendor";
  table: "dealers" | "buyers" | "investors" | "machinery_vendors";
  codePrefix: "DLR" | "BUY" | "INV" | "VND";
}

/**
 * Buyer aur sarmayakar ka login darja `customer` hai.
 * Customer portal (CustomerShell) baghair customers qatar ke sirf
 * role customer ko andar lata hai. `buyer` enum nahi hai.
 * Dealer ka apna safha /dealer hai, vendor ka /vendor.
 */
export const PARTY_ROLES: PartyRoleSpec[] = [
  { key: "dealer", label: "Dealer", profileRole: "dealer", table: "dealers", codePrefix: "DLR" },
  { key: "buyer", label: "Buyer", profileRole: "customer", table: "buyers", codePrefix: "BUY" },
  { key: "investor", label: "Sarmayakar", profileRole: "customer", table: "investors", codePrefix: "INV" },
  { key: "machinery_vendor", label: "Vendor", profileRole: "machinery_vendor", table: "machinery_vendors", codePrefix: "VND" },
];

export interface InviteAccount {
  id: string;
  role: PartyRoleKey;
  fullName: string;
  phone: string;
  email: string | null;
  branchName: string;
  createdAt: string;
}

export interface InviteSend {
  id: string;
  accountId: string;
  channel: InviteChannel;
  recipient: string;
  subject: string | null;
  content: string;
  status: "sent" | "failed";
  error: string | null;
  createdAt: string;
}

export interface PartyForm {
  role: PartyRoleKey;
  fullName: string;
  phone: string;
  email: string | null;
  branchId: string;
}

const ADMIN_ROLES = new Set(["owner", "super_admin", "admin"]);

export function canCreatePartyInvite(role: string | null | undefined): boolean {
  return ADMIN_ROLES.has(String(role ?? ""));
}

export function roleSpec(key: string | null | undefined): PartyRoleSpec | null {
  return PARTY_ROLES.find((r) => r.key === key) ?? null;
}

/** Aakhri 10 hindse. Database fn_phone_key jaisa. */
export function phoneKey(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function partyCode(role: PartyRoleKey, now: number, rand: string): string {
  const spec = roleSpec(role);
  const prefix = spec?.codePrefix ?? "PTY";
  const tail = rand.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4).padEnd(4, "X");
  return `${prefix}-${String(now).slice(-4)}${tail}`;
}

export function loginEmailFor(key: string, email: string | null): string {
  return email ?? `${key}@phone.agribridge.local`;
}

export function parsePartyForm(input: {
  role?: unknown;
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  branchId?: unknown;
}): { ok: true; value: PartyForm } | { ok: false; error: string } {
  const spec = roleSpec(String(input.role ?? ""));
  if (!spec) return { ok: false, error: "Role Dealer, Buyer, Sarmayakar ya Vendor honi chahiye." };
  const fullName = String(input.fullName ?? "").trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 120) return { ok: false, error: "Naam likhein." };
  const phone = String(input.phone ?? "").trim();
  if (!phoneKey(phone)) return { ok: false, error: "Mobile poora likhein — misal +92 301 7654321." };
  const emailRaw = String(input.email ?? "").trim().toLowerCase();
  let email: string | null = null;
  if (emailRaw) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) || emailRaw.length > 160) {
      return { ok: false, error: "Email theek likhein, ya khali chhor dein." };
    }
    if (emailRaw.endsWith("@phone.agribridge.local")) {
      return { ok: false, error: "Ye email istemal nahi ho sakti." };
    }
    email = emailRaw;
  }
  const branchId = String(input.branchId ?? "").trim();
  if (!branchId) return { ok: false, error: "Branch chunein." };
  return { ok: true, value: { role: spec.key, fullName, phone, email, branchId } };
}

export function buildInviteMessage(input: {
  fullName: string;
  role: PartyRoleKey;
  branchName: string;
  phone: string;
  email: string | null;
  loginUrl: string;
}): { subject: string; text: string } {
  const spec = roleSpec(input.role);
  const label = spec?.label ?? "account";
  const emailLine = input.email ? `Email: ${input.email}` : null;
  const text = [
    `Assalam-o-Alaikum ${input.fullName},`,
    "",
    `AgriBridge (Kisan ka Wasela) par aap ka ${label} account ban gaya hai.`,
    `Branch: ${input.branchName}`,
    "",
    `Login: ${input.loginUrl}`,
    "Pehli dafa sign-in OTP se hoga.",
    `Mobile: ${input.phone}`,
    emailLine,
    "Login kholen, mobile ya email likhein — code aayega.",
    "",
    "AgriBridge",
    "Kisan ka Wasela",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  return { subject: `AgriBridge — ${label} account`, text };
}

/** UI aur paigham mein sirf AgriBridge + Kisan ka Wasela. */
export function brandProblem(text: string): string | null {
  if (/al\s*rana/i.test(text) || /\bART\b/.test(text)) {
    return "Paigham mein sirf AgriBridge aur Kisan ka Wasela ho sakta hai.";
  }
  if (!text.includes("AgriBridge") || !text.includes("Kisan ka Wasela")) {
    return "Brand ka naam paigham mein nahi.";
  }
  return null;
}

export function inviteEmailHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = text
    .split("\n")
    .map((line) => `<p style="margin:0 0 8px;line-height:1.45">${line ? esc(line) : "&nbsp;"}</p>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;color:#143024;max-width:520px">
    <p style="font-size:18px;font-weight:700;margin:0">AgriBridge</p>
    <p style="margin:0 0 16px;color:#1f7a4d">Kisan ka Wasela</p>
    ${body}
  </div>`;
}

export function planSend(input: {
  channel: string;
  fullName: string;
  role: PartyRoleKey;
  branchName: string;
  phone: string;
  email: string | null;
  loginUrl: string;
}): { ok: boolean; error: string | null; channel: InviteChannel | null; recipient: string; subject: string | null; text: string } {
  const channel = INVITE_CHANNELS.find((c) => c === input.channel) ?? null;
  const built = buildInviteMessage(input);
  const brand = brandProblem(built.text);
  if (!channel) {
    return { ok: false, error: "Channel WhatsApp, Email ya SMS honi chahiye.", channel: null, recipient: "", subject: null, text: built.text };
  }
  if (brand) {
    return { ok: false, error: brand, channel, recipient: "", subject: built.subject, text: built.text };
  }
  if (channel === "email") {
    if (!input.email) {
      return {
        ok: false,
        error: "Email bhejne ke liye email zaroori hai.",
        channel,
        recipient: "",
        subject: built.subject,
        text: built.text,
      };
    }
    return { ok: true, error: null, channel, recipient: input.email, subject: built.subject, text: built.text };
  }
  return { ok: true, error: null, channel, recipient: input.phone, subject: null, text: built.text };
}

export function smsFailReason(reason: string): string {
  if (/not configured/i.test(reason)) {
    return "SMS nahi ja saka: Veevo (SMS_PROVIDER aur VEEVO_API_KEY) server par set nahi.";
  }
  if (reason === "INVALID_NUMBER") return "Ye mobile SMS ke qabil nahi.";
  if (reason === "CONTENT_TOO_LONG") return "SMS bohot lamba hai (800 harf se zyada).";
  if (reason === "SMS_TEXT_MISSING") return "SMS ka paigham khali hai.";
  if (reason === "sent") return "";
  return `SMS nahi gaya: ${reason}`;
}

export interface SendDeps {
  sendWhatsapp(phone: string, text: string): Promise<void>;
  sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }>;
  sendSms(phone: string, text: string): Promise<{ sent: boolean; reason: string }>;
}

/** Asal bhejna. WhatsApp SMS par nahi girta, SMS WhatsApp par nahi. */
export async function dispatchInvite(
  channel: InviteChannel,
  recipient: string,
  text: string,
  subject: string | null,
  deps: SendDeps
): Promise<{ ok: boolean; error: string | null }> {
  if (channel === "whatsapp") {
    try {
      await deps.sendWhatsapp(recipient, text);
      return { ok: true, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "WhatsApp nahi gaya.";
      return { ok: false, error: message };
    }
  }
  if (channel === "email") {
    const result = await deps.sendEmail(recipient, subject ?? "AgriBridge", inviteEmailHtml(text));
    return result.sent ? { ok: true, error: null } : { ok: false, error: result.error || "Email nahi gayi." };
  }
  const sms = await deps.sendSms(recipient, text);
  if (sms.sent) return { ok: true, error: null };
  return { ok: false, error: smsFailReason(sms.reason) };
}

export function partyRow(input: {
  role: PartyRoleKey;
  userId: string;
  organizationId: string;
  fullName: string;
  phone: string;
  code: string;
  createdBy: string;
}): Record<string, unknown> {
  const spec = roleSpec(input.role);
  if (!spec) throw new Error("role");
  if (spec.table === "dealers") {
    return {
      user_id: input.userId,
      organization_id: input.organizationId,
      dealer_code: input.code,
      business_name: input.fullName,
      contact_person: input.fullName,
      phone_number: input.phone,
      verification_status: "verified",
      is_active: true,
      status: "active",
    };
  }
  if (spec.table === "buyers") {
    return {
      user_id: input.userId,
      organization_id: input.organizationId,
      buyer_code: input.code,
      business_name: input.fullName,
      contact_person: input.fullName,
      phone_number: input.phone,
      is_active: true,
      status: "active",
    };
  }
  if (spec.table === "investors") {
    return {
      user_id: input.userId,
      organization_id: input.organizationId,
      investor_code: input.code,
      full_name: input.fullName,
      phone_number: input.phone,
      is_active: true,
    };
  }
  return {
    user_id: input.userId,
    vendor_name: input.fullName,
    contact_person: input.fullName,
    phone: input.phone,
    is_active: true,
    created_by: input.createdBy,
  };
}

export function mapAccount(row: {
  id: string;
  party_role: string;
  full_name: string;
  phone: string;
  email: string | null;
  branch_name: string | null;
  created_at: string;
}): InviteAccount | null {
  const spec = roleSpec(row.party_role);
  if (!spec) return null;
  return {
    id: row.id,
    role: spec.key,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    branchName: row.branch_name ?? "",
    createdAt: row.created_at,
  };
}

export function mapSend(row: {
  id: string;
  account_id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: string;
  error: string | null;
  created_at: string;
}): InviteSend | null {
  const channel = INVITE_CHANNELS.find((c) => c === row.channel);
  if (!channel || (row.status !== "sent" && row.status !== "failed")) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    channel,
    recipient: row.recipient,
    subject: row.subject,
    content: row.content,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  };
}

export const PREVIEW_LOGIN = "https://agribridge.pk/login";

export function previewAccount(): InviteAccount {
  return {
    id: "preview-bilal",
    role: "dealer",
    fullName: "Bilal Traders",
    phone: "+92 301 7654321",
    email: "bilal.traders@gmail.com",
    branchName: "Mahabali",
    createdAt: "2026-10-26T08:20:00.000Z",
  };
}

export function previewSends(): InviteSend[] {
  const account = previewAccount();
  const built = buildInviteMessage({
    fullName: account.fullName,
    role: account.role,
    branchName: account.branchName,
    phone: account.phone,
    email: account.email,
    loginUrl: PREVIEW_LOGIN,
  });
  return [
    {
      id: "preview-wa",
      accountId: account.id,
      channel: "whatsapp",
      recipient: account.phone,
      subject: null,
      content: built.text,
      status: "sent",
      error: null,
      createdAt: "2026-10-26T08:21:00.000Z",
    },
    {
      id: "preview-sms",
      accountId: account.id,
      channel: "sms",
      recipient: account.phone,
      subject: null,
      content: built.text,
      status: "failed",
      error: smsFailReason("SMS provider not configured yet."),
      createdAt: "2026-10-26T08:22:00.000Z",
    },
  ];
}
