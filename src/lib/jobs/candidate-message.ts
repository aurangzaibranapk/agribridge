/**
 * Candidate ko bheja gaya har paighaam — email, SMS, ya WhatsApp.
 * Timeline isi shape ko dikhati hai. Database insert alag jagah hai.
 */

export const MESSAGE_CHANNELS = ["email", "sms", "whatsapp"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
export type MessageStatus = "sent" | "failed";

export type CandidateDispatch = {
  channel: MessageChannel;
  to: string | null;
  subject: string | null;
  body: string | null;
  linkUrl: string | null;
  attachmentName: string | null;
  status: MessageStatus;
  error: string | null;
};

export const NO_EMAIL_NOTE = "Email nahi bheji: candidate ka email darj nahi.";
export const BAD_EMAIL_NOTE = "Email nahi bheji: address sahih nahi.";
export const NO_NUMBER_NOTE = "Message nahi bheja: candidate ka number darj nahi.";

export function failedDispatch(args: {
  channel?: MessageChannel;
  to: string | null;
  subject?: string | null;
  body?: string | null;
  linkUrl?: string | null;
  attachmentName?: string | null;
  missing: boolean;
}): CandidateDispatch {
  const channel = args.channel ?? "email";
  const error = channel === "email" ? (args.missing ? NO_EMAIL_NOTE : BAD_EMAIL_NOTE) : NO_NUMBER_NOTE;
  return {
    channel,
    to: args.to,
    subject: args.subject ?? null,
    body: args.body ?? null,
    linkUrl: args.linkUrl ?? null,
    attachmentName: args.attachmentName ?? null,
    status: "failed",
    error,
  };
}

export function sentOrFailed(args: {
  channel?: MessageChannel;
  to: string;
  subject: string | null;
  body: string | null;
  linkUrl?: string | null;
  attachmentName?: string | null;
  ok: boolean;
  error?: string | null;
}): CandidateDispatch {
  return {
    channel: args.channel ?? "email",
    to: args.to,
    subject: args.subject,
    body: args.body,
    linkUrl: args.linkUrl ?? null,
    attachmentName: args.attachmentName ?? null,
    status: args.ok ? "sent" : "failed",
    error: args.ok ? null : args.error || "Send failed",
  };
}

/** Login email ka password timeline mein save nahi hota. */
export function redactSecrets(body: string | null, secrets: Array<string | null | undefined>): string | null {
  if (!body) return body;
  let out = body;
  for (const secret of secrets) {
    const value = String(secret ?? "");
    if (value.length < 4) continue;
    out = out.split(value).join("••••••");
  }
  return out;
}

export function dispatchNotice(mail: CandidateDispatch | null | undefined): string | undefined {
  if (!mail || mail.status === "sent") return undefined;
  return mail.error ?? (mail.channel === "email" ? NO_EMAIL_NOTE : NO_NUMBER_NOTE);
}
