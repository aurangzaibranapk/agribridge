/** WhatsApp Chat Inbox: default BAND. Live par tab tak kuch nahi jab tak malik WHATSAPP_INBOX=1 na kare (aur 614-618 na lagein). */
export function inboxEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.WHATSAPP_INBOX === "1";
}
/** Screenshot / design preview (namoona data) -- production mein kabhi nahi. */
export function inboxPreviewAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" && env.WHATSAPP_INBOX_PREVIEW === "1";
}
