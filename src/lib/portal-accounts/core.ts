// Portal Accounts: saaf (pure) helpers -- DB ya network nahi, is liye test aasaan.

export const PHONE_LOGIN_DOMAIN = "@phone.agribridge.local";
export const DELETE_CONFIRM_WORD = "DELETE";
export const WHATSAPP_RESEND_HOURS = 24;
export const PREVIEW_VALID_MINUTES = 10;
export const MAX_BULK_SEND = 50;
export const SUSPEND_DURATION = "876000h"; // ~100 saal

export type PortalStatus = "active" | "suspended" | "no_profile";

export interface PortalAccountRow {
  user_id: string;
  login_email: string | null;
  auth_phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  role: string | null;
  has_profile: boolean;
  profile_active: boolean;
  record_type: string | null;
  record_id: string | null;
  record_code: string | null;
  record_name: string | null;
  record_phone: string | null;
  last_whatsapp_at: string | null;
  pending_delete_id: string | null;
  pending_delete_by: string | null;
}

export interface PortalAccount extends PortalAccountRow {
  status: PortalStatus;
  phone: string | null; // 03xxxxxxxxx
  loginId: string;
  name: string;
}

export function isBanned(bannedUntil: string | null | undefined, now = new Date()): boolean {
  return !!bannedUntil && new Date(bannedUntil).getTime() > now.getTime();
}

export function accountStatus(r: Pick<PortalAccountRow, "banned_until" | "has_profile">, now = new Date()): PortalStatus {
  if (isBanned(r.banned_until, now)) return "suspended";
  if (!r.has_profile) return "no_profile";
  return "active";
}

/** Kisi bhi shakal ka Pakistani mobile -> 03xxxxxxxxx, warna null. */
export function normalizePkMobile(raw: string | null | undefined): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  const last10 = d.length >= 10 ? d.slice(-10) : "";
  if (!/^3\d{9}$/.test(last10)) return null;
  if (d.length > 12) return null;
  return "0" + last10;
}

export function phoneFromLoginEmail(email: string | null | undefined): string | null {
  const e = String(email ?? "").toLowerCase();
  if (!e.endsWith(PHONE_LOGIN_DOMAIN)) return null;
  return normalizePkMobile(e.slice(0, -PHONE_LOGIN_DOMAIN.length));
}

export function displayLoginId(email: string | null | undefined): string {
  const p = phoneFromLoginEmail(email);
  if (p) return `${p} (mobile)`;
  return email || "—";
}

export function toAccount(r: PortalAccountRow, now = new Date()): PortalAccount {
  const phone = phoneFromLoginEmail(r.login_email) ?? normalizePkMobile(r.auth_phone) ?? normalizePkMobile(r.record_phone);
  return {
    ...r,
    status: accountStatus(r, now),
    phone,
    loginId: displayLoginId(r.login_email),
    name: (r.record_name || "").trim() || "—",
  };
}

export const ROLE_LABEL: Record<string, string> = {
  farmer: "Kisan", customer: "Customer", dealer: "Dealer", machinery_vendor: "Vendor",
  investor: "Investor", company_rep: "Company Rep",
};
export function roleLabel(role: string | null): string {
  return role ? ROLE_LABEL[role] ?? role : "—";
}

export interface Filters { q?: string; role?: string; status?: string }
export function filterAccounts(list: PortalAccount[], f: Filters): PortalAccount[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const qd = q.replace(/\D/g, "");
  return list.filter((a) => {
    if (f.role && f.role !== "all") {
      if (f.role === "none" ? a.role !== null : a.role !== f.role) return false;
    }
    if (f.status && f.status !== "all" && a.status !== f.status) return false;
    if (!q) return true;
    const hay = [a.name, a.record_code, a.login_email, a.phone].filter(Boolean).join(" ").toLowerCase();
    if (hay.includes(q)) return true;
    return qd.length >= 4 && (a.phone ?? "").replace(/\D/g, "").includes(qd);
  });
}

export function summarize(list: PortalAccount[]) {
  return {
    total: list.length,
    farmer: list.filter((a) => a.role === "farmer").length,
    other: list.filter((a) => a.role && a.role !== "farmer").length,
    noProfile: list.filter((a) => a.status === "no_profile").length,
    suspended: list.filter((a) => a.status === "suspended").length,
  };
}

// ---------- WhatsApp ----------
export const SITE_LOGIN = "alranatraders.pk/login";
export const SITE_RESET = "alranatraders.pk/forgot-password";

/** Approved template ka matn ({{1}} = naam, {{2}} = number) -- preview isi se banta hai. */
export function accountNoticeText(name: string, phone: string): string {
  return `Assalam o Alaikum ${name}, aap ke number ${phone} se AgriBridge account bana hai. Login: ${SITE_LOGIN}. Password bhool gaye to yahan reset karein: ${SITE_RESET}`;
}
export function accountNoticeParams(name: string, phone: string): string[] {
  return [name, phone];
}

export type SkipReason = "no_phone" | "suspended" | "recent" | null;
export function whatsappSkipReason(a: PortalAccount, now = new Date()): SkipReason {
  if (!a.phone) return "no_phone";
  if (a.status === "suspended") return "suspended";
  if (a.last_whatsapp_at && now.getTime() - new Date(a.last_whatsapp_at).getTime() < WHATSAPP_RESEND_HOURS * 3600_000) return "recent";
  return null;
}
export const SKIP_LABEL: Record<Exclude<SkipReason, null>, string> = {
  no_phone: "Phone number nahi",
  suspended: "Account band hai",
  recent: `Pichle ${WHATSAPP_RESEND_HOURS} ghante mein bheja ja chuka`,
};

export function templateConfig(env: Record<string, string | undefined> = process.env) {
  const name = env.WHATSAPP_ACCOUNT_TEMPLATE?.trim() || null;
  return {
    name,
    lang: env.WHATSAPP_ACCOUNT_TEMPLATE_LANG?.trim() || "en",
    ready: !!(name && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN),
  };
}

// ---------- Delete ----------
export function deleteConfirmError(typed: string, reason: string): string | null {
  if (String(typed ?? "").trim() !== DELETE_CONFIRM_WORD) return `Tasdeeq ke liye ${DELETE_CONFIRM_WORD} likhein.`;
  if (String(reason ?? "").trim().length < 3) return "Wajah likhna zaroori hai.";
  return null;
}
/** Juda khata ho to doosre admin ki manzoori (maker-checker) chahiye. */
export function deleteNeedsChecker(a: Pick<PortalAccountRow, "record_id">): boolean {
  return !!a.record_id;
}
