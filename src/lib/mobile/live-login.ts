/**
 * Phone login jab portal ka mobile route abhi live par na ho.
 *
 * Email seedha live Supabase password grant se chalti hai (public anon key).
 * Mobile, CNIC, aur username `fn_login_resolve` mangte hain, jo sirf
 * service role ke paas hai — wo portal route ke baghair nahi chal sakte.
 * Service role app mein kabhi nahi jata.
 */

import { appRoleFor, type AppRole } from "./roles";

export const LIVE_SUPABASE_URL = "https://ktskwawkslaznkjjacni.supabase.co";

export const LOGIN_TEXT: Record<string, string> = {
  e_bad: "ID ya password ghalat hai.",
  e_rate: "Thori der baad koshish karein.",
  e_locked: "Account kuch der ke liye band hai.",
  e_first_time: "Pehle portal par password set karein.",
  e_inactive: "Ye account band hai.",
  e_identifier: "ID, mobile ya CNIC sahi likhein.",
  e_try_again: "Dobara koshish karein.",
};

const PHONE_NEEDS_PORTAL = "Mobile ya CNIC se login tab chalega jab portal ka naya build live ho. Email se abhi login ho sakta hai.";
const PRODUCTION_EMAIL_FAIL = "Login nahi hua. Thori der baad koshish karein.";

export type MobileChannel = "debug" | "internal" | "production";

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ status: number; text: () => Promise<string> }>;

export type MobileSession = {
  access_token: string;
  refresh_token: string;
  user_id: string;
  role: string;
  appRole: AppRole;
  expires_at: number | null;
};

export type SignInResult =
  | { ok: true; session: MobileSession }
  | { ok: false; message: string; offline: boolean };

type Json = Record<string, unknown> | unknown[] | null;

export function showsHttpDetail(channel: MobileChannel): boolean {
  return channel === "debug" || channel === "internal";
}

export function isEmailIdentifier(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/** Sirf live project. Testing ya koi aur host app se call nahi hota. */
export function acceptedSupabaseUrl(raw: string | null | undefined): string | null {
  const url = String(raw ?? "").trim().replace(/\/$/, "");
  return url === LIVE_SUPABASE_URL ? url : null;
}

export function clipDetail(raw: string, secrets: string[] = []): string {
  let text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  for (const secret of secrets) {
    if (secret && secret.length >= 4) text = text.split(secret).join("[hidden]");
  }
  text = text.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[token]");
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [hidden]");
  return text.length > 140 ? text.slice(0, 140) : text;
}

export function failureLine(input: {
  channel: MobileChannel;
  fallback: string;
  status?: number | null;
  detail?: string | null;
  secrets?: string[];
}): string {
  if (!showsHttpDetail(input.channel)) return input.fallback;
  const parts = [input.fallback];
  if (input.status) parts.push(`HTTP ${input.status}`);
  const detail = input.detail ? clipDetail(input.detail, input.secrets ?? []) : "";
  if (detail) parts.push(detail);
  return parts.join(" · ");
}

function parseJson(text: string): Json {
  try {
    const value = JSON.parse(text) as unknown;
    if (value && typeof value === "object") return value as Json;
    return null;
  } catch {
    return null;
  }
}

async function readBody(res: { status: number; text: () => Promise<string> }) {
  const text = await res.text();
  return { status: res.status, text, json: parseJson(text) };
}

function asRecord(value: Json): Record<string, unknown> | null {
  if (!value || Array.isArray(value)) return null;
  return value;
}

function sessionFromPortal(json: Record<string, unknown>): MobileSession {
  const role = String(json.role ?? "");
  const explicit = typeof json.appRole === "string" ? json.appRole : "";
  return {
    access_token: String(json.access_token),
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : "",
    user_id: String(json.user_id ?? ""),
    role,
    appRole: isAppRole(explicit) ? explicit : appRoleFor({ role }),
    expires_at: typeof json.expires_at === "number" ? json.expires_at : null,
  };
}

function isAppRole(value: string): value is AppRole {
  return ["farmer", "customer", "staff", "supplier", "dealer", "mca", "mco", "admin", "vet"].includes(value);
}

function authCode(status: number, json: Record<string, unknown> | null): string {
  const msg = String(json?.msg ?? json?.error_description ?? json?.error_code ?? json?.error ?? "").toLowerCase();
  if (status === 429 || msg.includes("rate")) return "e_rate";
  if (msg.includes("invalid") || msg.includes("credential") || status === 400) return "e_bad";
  return "e_try_again";
}

async function fetchStaff(input: {
  supabase: string;
  anon: string;
  token: string;
  userId: string;
  fetchImpl: FetchLike;
}): Promise<{ designation: string | null; fieldAppRole: string | null }> {
  const headers = {
    apikey: input.anon,
    authorization: `Bearer ${input.token}`,
    accept: "application/json",
  };
  const base = `${input.supabase}/rest/v1/staff_details?profile_id=eq.${encodeURIComponent(input.userId)}`;
  const first = await readBody(await input.fetchImpl(`${base}&select=designation,field_app_role`, { method: "GET", headers }));
  const chosen = first.status === 400
    ? await readBody(await input.fetchImpl(`${base}&select=designation`, { method: "GET", headers }))
    : first;
  const row = Array.isArray(chosen.json) ? chosen.json[0] as Record<string, unknown> | undefined : undefined;
  return {
    designation: row && typeof row.designation === "string" ? row.designation : null,
    fieldAppRole: row && typeof row.field_app_role === "string" ? row.field_app_role : null,
  };
}

async function supabaseEmailLogin(input: {
  identifier: string;
  password: string;
  supabase: string;
  anon: string;
  channel: MobileChannel;
  fetchImpl: FetchLike;
  secrets: string[];
}): Promise<SignInResult> {
  const headers = {
    "content-type": "application/json",
    accept: "application/json",
    apikey: input.anon,
    authorization: `Bearer ${input.anon}`,
  };
  let auth: { status: number; text: string; json: Json };
  try {
    auth = await readBody(await input.fetchImpl(`${input.supabase}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: input.identifier, password: input.password }),
    }));
  } catch (err) {
    return {
      ok: false,
      offline: true,
      message: failureLine({
        channel: input.channel,
        fallback: "Network nahi mila.",
        detail: err instanceof Error ? err.message : "fetch failed",
        secrets: input.secrets,
      }),
    };
  }

  const authJson = asRecord(auth.json);
  const access = authJson && typeof authJson.access_token === "string" ? authJson.access_token : "";
  if (!access || auth.status >= 400) {
    const code = authCode(auth.status, authJson);
    const detail = String(authJson?.msg ?? authJson?.error_description ?? authJson?.error ?? auth.text);
    return {
      ok: false,
      offline: false,
      message: failureLine({
        channel: input.channel,
        fallback: LOGIN_TEXT[code],
        status: auth.status,
        detail,
        secrets: input.secrets,
      }),
    };
  }

  const user = authJson && typeof authJson.user === "object" && authJson.user ? authJson.user as Record<string, unknown> : null;
  const userId = user && typeof user.id === "string" ? user.id : "";
  if (!userId) {
    return {
      ok: false,
      offline: false,
      message: failureLine({ channel: input.channel, fallback: "Login nahi hua.", status: auth.status, detail: "user id nahi aayi", secrets: input.secrets }),
    };
  }

  let profile: { status: number; text: string; json: Json };
  try {
    profile = await readBody(await input.fetchImpl(
      `${input.supabase}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role,is_active`,
      {
        method: "GET",
        headers: { apikey: input.anon, authorization: `Bearer ${access}`, accept: "application/json" },
      }
    ));
  } catch (err) {
    return {
      ok: false,
      offline: true,
      message: failureLine({
        channel: input.channel,
        fallback: "Network nahi mila.",
        detail: err instanceof Error ? err.message : "profile fetch failed",
        secrets: input.secrets,
      }),
    };
  }

  const row = Array.isArray(profile.json) ? profile.json[0] as Record<string, unknown> | undefined : undefined;
  if (profile.status >= 400 || !row || typeof row.role !== "string") {
    return {
      ok: false,
      offline: false,
      message: failureLine({
        channel: input.channel,
        fallback: "Profile nahi mili.",
        status: profile.status,
        detail: profile.text,
        secrets: input.secrets,
      }),
    };
  }
  if (row.is_active === false) {
    return {
      ok: false,
      offline: false,
      message: failureLine({ channel: input.channel, fallback: LOGIN_TEXT.e_inactive, status: profile.status, detail: "is_active false", secrets: input.secrets }),
    };
  }

  let designation: string | null = null;
  let fieldAppRole: string | null = null;
  try {
    const staff = await fetchStaff({ supabase: input.supabase, anon: input.anon, token: access, userId, fetchImpl: input.fetchImpl });
    designation = staff.designation;
    fieldAppRole = staff.fieldAppRole;
  } catch {
    designation = null;
    fieldAppRole = null;
  }

  return {
    ok: true,
    session: {
      access_token: access,
      refresh_token: typeof authJson?.refresh_token === "string" ? authJson.refresh_token : "",
      user_id: userId,
      role: row.role,
      appRole: appRoleFor({ role: row.role, designation, fieldAppRole }),
      expires_at: typeof authJson?.expires_at === "number" ? authJson.expires_at : null,
    },
  };
}

export async function signInMobile(input: {
  identifier: string;
  password: string;
  portalUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  channel: MobileChannel;
  fetchImpl: FetchLike;
}): Promise<SignInResult> {
  const identifier = input.identifier.trim();
  const password = input.password;
  const secrets = [password, input.supabaseAnonKey].filter((item) => item.length >= 4);
  const portal = input.portalUrl.replace(/\/$/, "");
  const email = isEmailIdentifier(identifier);
  const supabase = acceptedSupabaseUrl(input.supabaseUrl);
  const anon = input.supabaseAnonKey.trim();

  if (!identifier || !password) {
    return { ok: false, offline: false, message: failureLine({ channel: input.channel, fallback: LOGIN_TEXT.e_bad, secrets }) };
  }

  let portalNote = "";
  let portalThrew = false;

  if (portal) {
    try {
      const res = await input.fetchImpl(`${portal}/api/mobile/v1/session`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const body = await readBody(res);
      const json = asRecord(body.json);
      if (json && json.ok === true && typeof json.access_token === "string" && res.status < 400) {
        return { ok: true, session: sessionFromPortal(json) };
      }
      if (json && typeof json.error === "string" && json.error.startsWith("e_") && res.status !== 404) {
        const code = LOGIN_TEXT[json.error] ? json.error : "e_try_again";
        return {
          ok: false,
          offline: false,
          message: failureLine({
            channel: input.channel,
            fallback: LOGIN_TEXT[code],
            status: res.status,
            detail: json.error,
            secrets,
          }),
        };
      }
      portalNote = failureLine({
        channel: input.channel,
        fallback: "Portal login route maujood nahi.",
        status: res.status,
        detail: body.text,
        secrets,
      });
    } catch (err) {
      portalThrew = true;
      portalNote = failureLine({
        channel: input.channel,
        fallback: "Portal tak request nahi gayi.",
        detail: err instanceof Error ? err.message : "fetch failed",
        secrets,
      });
    }
  } else {
    portalNote = failureLine({ channel: input.channel, fallback: "Portal URL build mein set nahi.", secrets });
  }

  if (email && supabase && anon) {
    return supabaseEmailLogin({ identifier, password, supabase, anon, channel: input.channel, fetchImpl: input.fetchImpl, secrets });
  }

  if (!email) {
    return {
      ok: false,
      offline: false,
      message: showsHttpDetail(input.channel) ? `${PHONE_NEEDS_PORTAL} · ${portalNote}` : PHONE_NEEDS_PORTAL,
    };
  }

  let why = portalNote;
  if (!supabase) {
    why = failureLine({
      channel: input.channel,
      fallback: input.supabaseUrl.trim() ? "Supabase URL live project nahi hai." : "Supabase URL build mein nahi.",
      detail: portalNote,
      secrets,
    });
  } else if (!anon) {
    why = failureLine({
      channel: input.channel,
      fallback: "Supabase anon key build mein nahi.",
      detail: portalNote,
      secrets,
    });
  }
  return {
    ok: false,
    offline: portalThrew,
    message: showsHttpDetail(input.channel) ? why : PRODUCTION_EMAIL_FAIL,
  };
}
