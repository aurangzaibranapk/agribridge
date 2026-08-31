const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/**
 * WhatsApp par paighaam bhejna.
 *
 * Ye function pehle KABHI nakaam nahi hota tha -- aur yahi us ka sab se
 * baRa masla tha. fetch ka jawab dekha hi nahi jata tha, is liye Meta
 * chahe 400 de ya 401, yahan sab theek lagta aur bulane wala apne record
 * mein "WhatsApp par bheja gaya" likh deta. Kisan ke paas kuch nahi
 * pahunchta aur hamare khate mein likha hota ke pahunch gaya.
 *
 * Testing wale nizaam par ye aur bura tha: wahan WHATSAPP_* khali hain,
 * to pata "graph.facebook.com/v21.0/undefined/messages" ban'ta, Meta 400
 * deta, aur har paighaam "bheja gaya" darj ho jata.
 *
 * Ab teen cheezein:
 *   1. Chaabi na ho to saaf batata hai ke nahi bheja ja saka
 *   2. Number ko Pakistan ke andaz mein karta hai (03xx -> 923xx)
 *   3. Meta ka jawab theek na ho to nakaam hota hai
 *
 * Bulane wale sab is nakami ko pakaR kar timeline mein likh dete hain --
 * kaam nahi rukta, magar record sach bolta hai.
 */
export async function sendWhatsAppMessage(toPhoneNumber: string, text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp ki chaabi (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN) set nahi hai.");
  }

  const to = toWhatsAppNumber(toPhoneNumber);
  if (!to) throw new Error(`Ye number WhatsApp ke qabil nahi: ${toPhoneNumber}`);

  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    // Meta ki wajah sath rakhi jati hai: "nahi gaya" se agla sawal hamesha
    // "kyun nahi gaya" hota hai, aur us ka jawab sirf yahan milta hai.
    const body = await res.text().catch(() => "");
    throw new Error(`WhatsApp ne paighaam nahi liya (${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * Manzoor shuda template par paighaam.
 *
 * Ye upar wale se ALAG kyun hai, aur is ka jawab OTP ne diya:
 *
 * Meta saada matn sirf us soorat mein pahunchata hai jab bande ne
 * pichhle CHAUBEES GHANTE mein khud hamein kuch likha ho. Bill ki raseed
 * aksar us daayre ke andar jati hai (kisan ne abhi baat ki hoti hai),
 * magar OTP to usay bhejna hai jis ne kuch nahi likha -- wo hamesha
 * daayre se bahar hota hai. Wahan saada matn kabhi nahi jayega, chahe
 * chaabi theek ho.
 *
 * Us soorat ka ek hi raasta hai: pehle se manzoor shuda template. Meta
 * us ke matn ko pehle dekh chuka hota hai, is liye wo chaubees ghante
 * ki shart se bahar hai.
 *
 * OTP wale template ka apna qaida hai: code ka khana body mein bhi
 * jata hai aur button mein bhi, aur dono jagah wohi ek adad.
 */
export async function sendWhatsAppTemplate(
  toPhoneNumber: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
  otpButtonParam?: string
): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp ki chaabi (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN) set nahi hai.");
  }

  const to = toWhatsAppNumber(toPhoneNumber);
  if (!to) throw new Error(`Ye number WhatsApp ke qabil nahi: ${toPhoneNumber}`);

  const components: unknown[] = [];
  if (bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    });
  }
  if (otpButtonParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: otpButtonParam }],
    });
  }

  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 ? { components } : {}),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`WhatsApp ne template nahi liya (${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * Pakistani number ko us shakal mein jis mein WhatsApp use qubool karta
 * hai: mulk ka code sath, koi sifar nahi, koi nishan nahi.
 *
 *   0300-1234567     -> 923001234567
 *   +92 300 1234567  -> 923001234567
 *   923001234567     -> waise hi
 *
 * Farmers ke khaton mein teenon andaz likhe milte hain. Pehle number
 * jaisa likha tha waisa hi bhej diya jata tha, aur 0300... par Meta
 * kuch nahi bhejta.
 */
export function toWhatsAppNumber(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;

  // Aage ke saare sifar pehle hata diye jate hain. Do tarah ke sifar
  // aate hain aur dono yahan bekaar hain: "00" jo bahar mulk milane ka
  // purana tareeqa hai, aur "0" jo mulk ke andar milane ka. Ek ek kar ke
  // hatane se "0092 300 1234567" par galti hoti thi -- sirf ek sifar
  // hata kar us par 92 lag jata aur number 920923001234567 ban jata.
  const rest = digits.replace(/^0+/, "");
  if (rest.length < 10) return null;

  // Pakistani mobile trunk sifar ke baad 3 se shuru hota hai, is liye
  // "92" se shuru hone wala number hamesha mulk ka code hi hai -- kisi
  // asal number ka pehla hissa nahi.
  if (rest.startsWith("92")) return rest;
  if (rest.length === 10) return "92" + rest;

  // Koi aur mulk ka number -- jaisa hai waisa hi.
  return rest;
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