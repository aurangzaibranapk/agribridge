import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { processFarmerAiMessage } from "@/lib/farmer-ai-processor";
import { sendWhatsAppMessage, downloadWhatsAppMedia, normalizeWhatsAppPhone } from "@/lib/whatsapp-client";
import { nextFarmerCode } from "@/actions/registration";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const serviceClient = createServiceClient();

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const fromPhone = normalizeWhatsAppPhone(message.from);

    let { data: farmer } = await serviceClient.from("farmers").select("id").eq("whatsapp_number", fromPhone).maybeSingle();

    if (!farmer) {
      const { data: byPhone } = await serviceClient.from("farmers").select("id").eq("phone_number", fromPhone).maybeSingle();
      if (byPhone) {
        await serviceClient.from("farmers").update({ whatsapp_number: fromPhone }).eq("id", byPhone.id);
        farmer = byPhone;
      } else {
        const farmerCode = await nextFarmerCode(serviceClient);
        const { data: newFarmer } = await serviceClient
          .from("farmers")
          .insert({ farmer_code: farmerCode, full_name: `WhatsApp Farmer ${fromPhone.slice(-4)}`, phone_number: fromPhone, whatsapp_number: fromPhone })
          .select("id")
          .single();
        farmer = newFarmer;
      }
    }

    if (!farmer) {
      await sendWhatsAppMessage(fromPhone, "Maaf kijiye, aapka account set up nahi ho saka. Dobara koshish karein.");
      return NextResponse.json({ ok: true });
    }

    let result;
    if (message.type === "audio" || message.type === "voice") {
      const mediaId = message.audio?.id ?? message.voice?.id;
      const media = await downloadWhatsAppMedia(mediaId);
      if (!media) {
        await sendWhatsAppMessage(fromPhone, "Voice note download nahi ho saki, dobara bhejein.");
        return NextResponse.json({ ok: true });
      }
      result = await processFarmerAiMessage(serviceClient, farmer.id, { audioBase64: media.base64, audioMimeType: media.mimeType });
    } else if (message.type === "text") {
      result = await processFarmerAiMessage(serviceClient, farmer.id, { text: message.text.body });
    } else {
      await sendWhatsAppMessage(fromPhone, "Abhi sirf Text ya Voice message samajh sakte hain.");
      return NextResponse.json({ ok: true });
    }

    await sendWhatsAppMessage(fromPhone, result.answer);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}