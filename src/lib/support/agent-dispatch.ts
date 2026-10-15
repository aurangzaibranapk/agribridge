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

function githubIssueNumber(externalTaskId: string): string | null {
  const config = githubConfig();
  if (!config) return null;
  const match = externalTaskId.match(new RegExp(`^https://github\\.com/${config.repository.replace("/", "\\/")}/issues/(\\d+)$`, "i"));
  return match?.[1] ?? null;
}

export async function postSupportAgentComment(
  agentKey: string,
  externalTaskId: string,
  message: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (agentKey !== CODEX_SUBSCRIPTION_KEY) return { ok: true };
  const config = githubConfig();
  const issueNumber = githubIssueNumber(externalTaskId);
  if (!config || !issueNumber) return { ok: false, error: "Connected GitHub issue nahi mila." };

  try {
    const response = await fetch(`https://api.github.com/repos/${config.repository}/issues/${issueNumber}/comments`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "User-Agent": "AgriBridge-Support-Bridge",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ body: message }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: String(result?.message ?? `GitHub comment HTTP ${response.status}`) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "GitHub comment post nahi hua." };
  }
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
    "## AgriBridge professional support workflow",
    "",
    `**Ticket:** ${issueRef}`,
    `**Priority:** ${priority}`,
    pageUrl ? `**ERP page:** ${pageUrl}` : "",
    "",
    "### Reported problem",
    description || "No description supplied.",
    screenshotUrl ? `\n### Screenshot\n[Open temporary screenshot](${screenshotUrl})` : "",
    deviceInfo ? `\n### Device information\n\`\`\`json\n${deviceInfo}\n\`\`\`` : "",
    "",
    "### Mandatory staged protocol",
    "Do not edit code yet. First investigate and post one analysis comment containing:",
    "1. What the issue is, in clear Roman Urdu.",
    "2. Where it occurs and which users/modules/data are affected.",
    "3. Root cause with file/function evidence.",
    "4. Risk level and whether existing data can be affected.",
    "5. Exact proposed fix, files likely to change, tests, migration impact, and rollback plan.",
    "6. Any question that must be answered before work starts.",
    "",
    "End the analysis comment with this exact marker on its own line:",
    `[AGRIBRIDGE:APPROVAL_REQUIRED:${issueRef}]`,
    "",
    "STOP after analysis. Do not change code until the GitHub issue receives this exact marker:",
    `[AGRIBRIDGE:APPROVED:${issueRef}]`,
    "",
    "After approval, report every stage using one marker per GitHub comment:",
    `[AGRIBRIDGE:WORKING:${issueRef}] - root-cause fix started`,
    `[AGRIBRIDGE:TESTING:${issueRef}] - tests/build running with results`,
    `[AGRIBRIDGE:FIXED:${issueRef}] - fix complete, branch and PR link included`,
    "",
    "### Engineering rules after approval",
    "- Make the smallest safe fix on a new branch.",
    "- Preserve existing data and tenant/RLS boundaries.",
    "- Never apply a live migration or merge without Owner/Admin approval.",
    "- Run relevant tests, TypeScript check, and production build.",
    "- Open a pull request and include this issue reference in the PR body.",
    "- Admin/Owner verifies the fix and closes the ERP ticket.",
  ].filter(Boolean).join("\n");

  try {
    const repositoryResponse = await fetch(`https://api.github.com/repos/${config.repository}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "AgriBridge-Support-Bridge",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const repositoryInfo = await repositoryResponse.json().catch(() => ({}));
    if (!repositoryResponse.ok) {
      return { ok: false, error: String(repositoryInfo?.message ?? `GitHub repository HTTP ${repositoryResponse.status}`) };
    }
    if (repositoryInfo?.private !== true) {
      return {
        ok: false,
        error: "Customer aur staff evidence ki hifazat ke liye SUPPORT_AGENT_REPOSITORY private hona zaroori hai. Public repository mein support issue create nahi kiya gaya.",
      };
    }

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
      assignmentStatus: "analysis_requested",
      ticketStatus: "investigating",
      message: `GitHub Issue #${issueNumber || "?"} ban gaya. Agent se pehle analysis aur approval plan manga gaya hai.`,
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
        workflow: {
          approvalRequired: true,
          stages: ["analysis", "approval_required", "approved", "working", "testing", "fixed"],
        },
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
      assignmentStatus: "analysis_requested",
      ticketStatus: "investigating",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Agent se rabta nahi ho saka." };
  }
}
