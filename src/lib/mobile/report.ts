export interface ReportContext {
  screen: string;
  route: string;
  userId: string | null;
  role: string | null;
  appRole: string | null;
  deviceModel: string;
  os: string;
  appVersion: string;
  network: string;
  channel: string;
}

export function reportContext(input: Partial<ReportContext> & { screen: string; route: string }): ReportContext {
  return {
    screen: input.screen.slice(0, 120),
    route: input.route.slice(0, 200),
    userId: input.userId ?? null,
    role: input.role ?? null,
    appRole: input.appRole ?? null,
    deviceModel: String(input.deviceModel ?? "unknown").slice(0, 120),
    os: String(input.os ?? "unknown").slice(0, 80),
    appVersion: String(input.appVersion ?? "").slice(0, 40),
    network: String(input.network ?? "unknown").slice(0, 20),
    channel: String(input.channel ?? "production").slice(0, 20),
  };
}

export function reportTitle(ctx: ReportContext): string {
  return `App · ${ctx.screen}`.slice(0, 160);
}

export function reportDescription(text: string, ctx: ReportContext): string {
  const body = text.trim().slice(0, 3500);
  const lines = [
    body,
    "",
    `Screen: ${ctx.screen}`,
    `Route: ${ctx.route}`,
    `User: ${ctx.userId ?? "—"}`,
    `Role: ${ctx.role ?? "—"} / ${ctx.appRole ?? "—"}`,
    `Device: ${ctx.deviceModel}`,
    `OS: ${ctx.os}`,
    `App: ${ctx.appVersion}`,
    `Network: ${ctx.network}`,
    `Channel: ${ctx.channel}`,
  ];
  return lines.join("\n").slice(0, 5000);
}
