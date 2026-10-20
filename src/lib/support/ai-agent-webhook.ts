export const AI_DISCONNECTED_LABEL = "AI agent connected nahi";
export const AI_SCREENSHOT_TTL_SECONDS = 600;

export interface AiTicketPayload {
  id: string;
  title: string;
  description: string;
  category: string | null;
  screenshots: { url: string; expiresIn: number }[];
  link: string;
}

export function buildAiTicketBody(input: {
  id: string;
  title: string;
  description: string;
  category: string | null;
  screenshotUrls: string[];
  link: string;
}): AiTicketPayload {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    category: input.category,
    screenshots: input.screenshotUrls.map((url) => ({ url, expiresIn: AI_SCREENSHOT_TTL_SECONDS })),
    link: input.link,
  };
}

export function aiAgentConnected(env: { AI_AGENT_WEBHOOK_URL?: string | null }): boolean {
  return Boolean(env.AI_AGENT_WEBHOOK_URL?.trim());
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

/**
 * URL khali ho to koi request nahi. Secret sirf header mein, body mein kabhi nahi.
 */
export async function postComplaintToAiAgent(input: {
  payload: AiTicketPayload;
  env: { AI_AGENT_WEBHOOK_URL?: string | null; AI_AGENT_WEBHOOK_SECRET?: string | null };
  fetchImpl?: FetchLike;
}): Promise<{ ok: true; connected: true } | { ok: false; connected: boolean; message: string }> {
  const url = input.env.AI_AGENT_WEBHOOK_URL?.trim() ?? "";
  if (!url) return { ok: false, connected: false, message: AI_DISCONNECTED_LABEL };
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = input.env.AI_AGENT_WEBHOOK_SECRET?.trim() ?? "";
  if (secret) headers["x-agribridge-webhook-secret"] = secret;
  const body = JSON.stringify(input.payload);
  const fetchImpl = input.fetchImpl ?? ((u, init) => fetch(u, init));
  const res = await fetchImpl(url, { method: "POST", headers, body });
  if (!res.ok) return { ok: false, connected: true, message: `AI agent ne ${res.status} diya.` };
  return { ok: true, connected: true };
}

/** Callback ka secret alag env hai. Khali secret par koi token qabool nahi. */
export function callbackAuthorized(header: string | null | undefined, envSecret: string | null | undefined): "ok" | "unset" | "denied" {
  const expected = envSecret?.trim() ?? "";
  if (!expected) return "unset";
  const got = header?.trim() ?? "";
  if (!got || got !== expected) return "denied";
  return "ok";
}
