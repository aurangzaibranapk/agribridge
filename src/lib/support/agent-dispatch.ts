export type SupportAgent = { key: string; label: string };

type AgentRoute = SupportAgent & { url: string; token?: string };
type DispatchSuccess = {
  ok: true;
  externalTaskId?: string;
  message?: string;
  assignmentStatus?: string;
  ticketStatus?: "assigned" | "investigating";
};

const CODEX_SUBSCRIPTION_KEY = "codex_subscription";
const CODEX_SUBSCRIPTION_LABEL = "ChatGPT / Codex (Subscription)";

function githubConfig(): { repository: string; token: string } | null {
  const repository = String(process.env.SUPPORT_AGENT_REPOSITORY ?? "").trim();
  const token = String(process.env.SUPPORT_GITHUB_TOKEN ?? "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token) return null;
  return { repository, token };
}

function routes(): AgentRoute[] {
  try {
    const raw = JSON.parse(process.env.SUPPORT_AGENT_ROUTES ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item: any) => {
      const key = String(item?.key ?? "").trim().toLowerCase();
      const label = String(item?.label ?? "").trim();
      const url = String(item?.url ?? "").trim();
      if (!/^[a-z0-9_-]{2,40}$/.test(key) || !label || !/^https:\/\//i.test(url)) return [];
      return [{ key, label: label.slice(0, 80), url, token: String(item?.token ?? "").trim() || undefined }];
    });
  } catch {
    return [];
  }
}

export function configuredSupportAgents(): SupportAgent[] {
  const agents = routes().map(({ key, label }) => ({ key, label }));
  if (githubConfig()) agents.unshift({ key: CODEX_SUBSCRIPTION_KEY, label: CODEX_SUBSCRIPTION_LABEL });
  return agents;
}

async function createCodexSubscriptionIssue(
  ticket: Record<string, unknown>
): Promise<DispatchSuccess | { ok: false; error: string }> {
  const config = githubConfig();
  if (!config) {
    return { ok: false, error: "Codex subscription bridge ke liye SUPPORT_GITHUB_TOKEN aur SUPPORT_AGENT_REPOSITORY configure karein." };
  }

  const ticketNo = String(ticket.ticketNo ?? "").trim();
  const title = String(ticket.title ?? "Support issue").trim().slice(0, 140);
  const description = String(ticket.description ?? "").trim();
  const priority = String(ticket.priority ?? "normal").trim();
  const pageUrl = String(ticket.pageUrl ?? "").trim();
  const screenshotUrl = String(ticket.screenshotUrl ?? "").trim();
  const deviceInfo = ticket.deviceInfo && typeof ticket.deviceInfo === "object"
    ? JSON.stringify(ticket.deviceInfo, null, 2).slice(0, 4000)
    : "";
  const issueRef = `ISS-${new Date().getFullYear()}-${ticketNo.padStart(5, "0")}`;
  const body = [
    "## AgriBridge support ticket",
    "",
    `**Ticket:** ${issueRef}`,
    `**Priority:** ${priority}`,
    pageUrl ? `**ERP page:** ${pageUrl}` : "",
    "",
    "### Problem",
    description || "No description supplied.",
    screenshotUrl ? `\n### Screenshot\n[Open temporary screenshot]("${screenshotUrl}")` : "",
    deviceInfo ? `\n### Device information\n\`\`\`json\n${deviceInfo}\n\`\`\`` : "",
    "",
    "### Codex instructions",
    "- Reproduce and identify the root cause.",
    "- Make the smallest safe fix on a new branch.",
    "- Preserve existing data and tenant/RLS boundaries.",
    "- Run relevant tests, TypeScript check, and production build.",
    "- Open a pull request and include this issue reference in the PR body.",
    "- Do not merge; Owner/Admin will verify and approve.",
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch(`https://api.github.com/repos/${config.repository}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "User-Agent": "AgriBridge-Support-Bridge",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ title: `[${issueRef}] ${title}`, body }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: String(result?.message ?? `GitHub Issue HTTP ${response.status}`) };
    }
    const issueUrl = String(result?.html_url ?? "").trim();
    const issueNumber = String(result?.number ?? "").trim();
    return {
      ok: true,
      externalTaskId: issueUrl || (issueNumber ? `github-issue-${issueNumber}` : undefined),
      assignmentStatus: "waiting_for_codex",
      ticketStatus: "assigned",
      message: `GitHub Issue #${issueNumber || "?"} ban gaya. Codex mein ${config.repository} khol kar is issue par kaam shuru karein.`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "GitHub Issue create nahi hua." };
  }
}

export async function dispatchSupportTicket(
  agentKey: string,
  ticket: Record<string, unknown>,
  callbackUrl: string
): Promise<DispatchSuccess | { ok: false; error: string }> {
  if (agentKey === CODEX_SUBSCRIPTION_KEY) return createCodexSubscriptionIssue(ticket);

  const route = routes().find((item) => item.key === agentKey);
  if (!route) return { ok: false, error: "Ye AI agent abhi connect nahi hai. Pehle us ka secure webhook configure karein." };

  try {
    const response = await fetch(route.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(route.token ? { Authorization: `Bearer ${route.token}` } : {}),
      },
      body: JSON.stringify({
        event: "support.ticket.assigned",
        ticket,
        repository: process.env.SUPPORT_AGENT_REPOSITORY || null,
        callback: {
          url: callbackUrl,
          authorization: process.env.SUPPORT_AGENT_CALLBACK_SECRET
            ? `Bearer ${process.env.SUPPORT_AGENT_CALLBACK_SECRET}`
            : null,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: String(body?.error ?? `Agent webhook HTTP ${response.status}`) };
    return {
      ok: true,
      externalTaskId: String(body?.taskId ?? body?.id ?? "").trim() || undefined,
      message: String(body?.message ?? "").trim() || undefined,
      assignmentStatus: "dispatched",
      ticketStatus: "investigating",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Agent se rabta nahi ho saka." };
  }
}
