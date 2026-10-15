export type SupportAgent = { key: string; label: string };

type AgentRoute = SupportAgent & { url: string; token?: string };

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
  return routes().map(({ key, label }) => ({ key, label }));
}

export async function dispatchSupportTicket(
  agentKey: string,
  ticket: Record<string, unknown>,
  callbackUrl: string
): Promise<{ ok: true; externalTaskId?: string; message?: string } | { ok: false; error: string }> {
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
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Agent se rabta nahi ho saka." };
  }
}
