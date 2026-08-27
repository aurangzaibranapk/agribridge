const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function sendWhatsAppMessage(toPhoneNumber: string, text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhoneNumber,
      type: "text",
      text: { body: text },
    }),
  });
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) return null;
  const meta = await metaRes.json();

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) return null;

  const arrayBuffer = await fileRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return { base64, mimeType: meta.mime_type ?? "audio/ogg" };
}

function normalizeWhatsAppPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

export { normalizeWhatsAppPhone };