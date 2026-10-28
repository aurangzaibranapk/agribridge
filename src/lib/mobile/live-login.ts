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
export const TEST_SUPABASE_URL = "https://hwaiuwxqldxsoukkfefn.supabase.co";

export type DataFlavor = "live" | "test";

/** Sirf exact "test". Baqi sab live, taake ghalat env live ko testing na bana de. */
export function dataFlavor(raw: string | null | undefined): DataFlavor {
  return raw === "test" ? "test" : "live";
}

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

export type SignUpResult =
  | { ok: true; session: MobileSession | null; message: string }
  | { ok: false; message: string; offline: boolean };

type Json = Record<string, unknown> | unknown[] | null;

/** Raw HTTP/JSON sirf debug build par. Internal sideload par Urdu hi. */
export function showsHttpDetail(channel: MobileChannel): boolean {
  return channel === "debug";
}

export function isEmailIdentifier(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/** Live flavor sirf live host. Test flavor sirf testing host. Doosra host null. */
export function acceptedSupabaseUrl(raw: string | null | undefined, flavor: DataFlavor = "live"): string | null {
  const url = String(raw ?? "").trim().replace(/\/$/, "");
  const allowed = flavor === "test" ? TEST_SUPABASE_URL : LIVE_SUPABASE_URL;
  return url === allowed ? url : null;
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

function expiresAtFrom(json: Record<string, unknown> | null): number | null {
  if (!json) return null;
  if (typeof json.expires_at === "number") return json.expires_at;
  if (typeof json.expires_in === "number") return Math.floor(Date.now() / 1000) + json.expires_in;
  return null;
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
      expires_at: expiresAtFrom(json),
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
      expires_at: expiresAtFrom(authJson),
    },
  };
}

/** OAuth/deep-link ya signup token ko app role/profile session mein badalta hai. */
export async function sessionFromAccessToken(input: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number | null;
  supabaseUrl: string;
  supabaseAnonKey: string;
  channel: MobileChannel;
  flavor?: DataFlavor;
  fetchImpl: FetchLike;
}): Promise<SignInResult> {
  const flavor = dataFlavor(input.flavor);
  const supabase = acceptedSupabaseUrl(input.supabaseUrl, flavor);
  const anon = input.supabaseAnonKey.trim();
  const access = input.accessToken.trim();
  const secrets = [access, anon];
  if (!supabase || !anon || !access) return { ok: false, offline: false, message: "Login configuration mukammal nahi." };
  try {
    const userBody = await readBody(await input.fetchImpl(`${supabase}/auth/v1/user`, {
      method: "GET",
      headers: { apikey: anon, authorization: `Bearer ${access}`, accept: "application/json" },
    }));
    const user = asRecord(userBody.json);
    const userId = typeof user?.id === "string" ? user.id : "";
    if (!userId || userBody.status >= 400) return { ok: false, offline: false, message: failureLine({ channel: input.channel, fallback: "Social login session nahi mili.", status: userBody.status, detail: userBody.text, secrets }) };
    const profileBody = await readBody(await input.fetchImpl(`${supabase}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role,is_active`, {
      method: "GET",
      headers: { apikey: anon, authorization: `Bearer ${access}`, accept: "application/json" },
    }));
    const profile = Array.isArray(profileBody.json) ? profileBody.json[0] as Record<string, unknown> | undefined : undefined;
    if (!profile || typeof profile.role !== "string") return { ok: false, offline: false, message: failureLine({ channel: input.channel, fallback: "Profile nahi mili.", status: profileBody.status, detail: profileBody.text, secrets }) };
    if (profile.is_active === false) return { ok: false, offline: false, message: LOGIN_TEXT.e_inactive };
    let designation: string | null = null;
    let fieldAppRole: string | null = null;
    try {
      const staff = await fetchStaff({ supabase, anon, token: access, userId, fetchImpl: input.fetchImpl });
      designation = staff.designation;
      fieldAppRole = staff.fieldAppRole;
    } catch { /* role falls back to profile */ }
    return { ok: true, session: {
      access_token: access,
      refresh_token: input.refreshToken || "",
      user_id: userId,
      role: profile.role,
      appRole: appRoleFor({ role: profile.role, designation, fieldAppRole }),
      expires_at: input.expiresIn ? Math.floor(Date.now() / 1000) + input.expiresIn : null,
    } };
  } catch (err) {
    return { ok: false, offline: true, message: failureLine({ channel: input.channel, fallback: "Network nahi mila.", detail: err instanceof Error ? err.message : "fetch failed", secrets }) };
  }
}

export async function signUpMobile(input: {
  fullName: string;
  email: string;
  phone: string;
  cnic: string;
  password: string;
  emailRedirectTo?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  channel: MobileChannel;
  flavor?: DataFlavor;
  fetchImpl: FetchLike;
}): Promise<SignUpResult> {
  const flavor = dataFlavor(input.flavor);
  const supabase = acceptedSupabaseUrl(input.supabaseUrl, flavor);
  const anon = input.supabaseAnonKey.trim();
  const email = input.email.trim().toLowerCase();
  if (!supabase || !anon) return { ok: false, offline: false, message: "Signup configuration mukammal nahi." };
  if (!input.fullName.trim() || !isEmailIdentifier(email) || input.password.length < 8) return { ok: false, offline: false, message: "Naam, sahi email aur kam az kam 8 digit password likhein." };
  try {
    const signupUrl = `${supabase}/auth/v1/signup${input.emailRedirectTo ? `?redirect_to=${encodeURIComponent(input.emailRedirectTo)}` : ""}`;
    const body = await readBody(await input.fetchImpl(signupUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", apikey: anon, authorization: `Bearer ${anon}` },
      body: JSON.stringify({ email, password: input.password, data: { full_name: input.fullName.trim(), phone: input.phone.trim(), cnic: input.cnic.trim(), requested_role: "farmer" } }),
    }));
    const json = asRecord(body.json);
    const access = typeof json?.access_token === "string" ? json.access_token : "";
    if (body.status >= 400) return { ok: false, offline: false, message: failureLine({ channel: input.channel, fallback: String(json?.msg || json?.error_description || "Signup nahi hua."), status: body.status, detail: body.text, secrets: [input.password, anon] }) };
    if (!access) return { ok: true, session: null, message: "Account ban gaya. Email confirm karke Login karein." };
    const resolved = await sessionFromAccessToken({ accessToken: access, refreshToken: typeof json?.refresh_token === "string" ? json.refresh_token : "", expiresIn: typeof json?.expires_in === "number" ? json.expires_in : null, supabaseUrl: supabase, supabaseAnonKey: anon, channel: input.channel, flavor, fetchImpl: input.fetchImpl });
    return resolved.ok ? { ok: true, session: resolved.session, message: "Account ban gaya." } : resolved;
  } catch (err) {
    return { ok: false, offline: true, message: failureLine({ channel: input.channel, fallback: "Network nahi mila.", detail: err instanceof Error ? err.message : "fetch failed", secrets: [input.password, anon] }) };
  }
}

export async function signInMobile(input: {
  identifier: string;
  password: string;
  portalUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  channel: MobileChannel;
  flavor?: DataFlavor;
  fetchImpl: FetchLike;
}): Promise<SignInResult> {
  const identifier = input.identifier.trim();
  const password = input.password;
  const secrets = [password, input.supabaseAnonKey].filter((item) => item.length >= 4);
  const portal = input.portalUrl.replace(/\/$/, "");
  const email = isEmailIdentifier(identifier);
  const flavor = dataFlavor(input.flavor);
  const supabase = acceptedSupabaseUrl(input.supabaseUrl, flavor);
  const anon = input.supabaseAnonKey.trim();

  if (!identifier || !password) {
    return { ok: false, offline: false, message: failureLine({ channel: input.channel, fallback: LOGIN_TEXT.e_bad, secrets }) };
  }

  let portalNote = "";
  let portalThrew = false;

  if (flavor === "test") {
    portalNote = failureLine({ channel: input.channel, fallback: "TEST build portal ko nahi poochti.", secrets });
  } else if (portal) {
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
    const wrongHost = flavor === "test" ? "Supabase URL testing project nahi hai." : "Supabase URL live project nahi hai.";
    why = failureLine({
      channel: input.channel,
      fallback: input.supabaseUrl.trim() ? wrongHost : "Supabase URL build mein nahi.",
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
    message: why,
  };
}
