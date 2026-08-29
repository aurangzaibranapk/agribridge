import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { processFarmerAiMessage } from "@/lib/farmer-ai-processor";
import { sendWhatsAppMessage, downloadWhatsAppMedia, normalizeWhatsAppPhone } from "@/lib/whatsapp-client";
import { nextFarmerCode } from "@/actions/registration";
import { handleStaffMessage } from "@/lib/staff-whatsapp-router";
import { handleMachineryConfirmation } from "@/lib/machinery-whatsapp-confirm";

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

/**
 * Meta har webhook ke sath x-hub-signature-256 bhejta hai: raw body ka
 * HMAC-SHA256, app secret se banaya hua. Iske baghair koi bhi jhoota
 * payload bhej kar naye "kisan" bana sakta hai ya kisi asli kisan ka
 * phone number de kar us ka roop dhar sakta hai — kyunke neeche wala
 * code service client se chalta hai (jo saari bandhishein bypass karta
 * hai) aur message.from par aankh band kar ke bharosa karta hai.
 *
 * Agar WHATSAPP_APP_SECRET set nahi hai to purana rawaiya barqarar
 * rehta hai, taake live WhatsApp achanak band na ho jaye. Secret set
 * karte hi tasdeeq khud-ba-khud chalu ho jayegi.
 */
function signatureIsValid(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;

  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  // Lambai alag ho to timingSafeEqual phenk deta hai, is liye pehle check.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    // Raw text chahiye — JSON parse karne ke baad asal bytes nahi milte,
    // aur HMAC bilkul unhi bytes par banta hai jo Meta ne bheje the.
    const rawBody = await request.text();
    if (!signatureIsValid(rawBody, request.headers.get("x-hub-signature-256"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const serviceClient = createServiceClient();

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const fromPhone = normalizeWhatsAppPhone(message.from);

    // Pehle dekho ke ye staff to nahi. Staff ka raasta AI se nahi guzarta:
    // un ke kaam (hazri waghera) gine chune hain aur unhein bilkul waisa
    // hi chalna chahiye jaisa likha gaya. null aaye to ye staff nahi —
    // neeche farmer wala purana raasta chalega.
    // Tasveer sirf staff ke liye utarte hain — farmer wala raasta abhi
    // photo istemal nahi karta, aur har aane wali image download karna
    // bekar ka kharcha hai.
    let staffImage: { base64: string; mimeType: string } | null = null;
    if (message.type === "image" && message.image?.id) {
      const media = await downloadWhatsAppMedia(message.image.id);
      if (media) staffImage = { base64: media.base64, mimeType: media.mimeType };
    }

    const staffReply = await handleStaffMessage({
      fromPhone,
      // Image ke sath jo likha ho wo caption mein aata hai, text mein nahi.
      text: message.type === "text" ? message.text.body : (message.image?.caption ?? null),
      latitude: message.location?.latitude ?? null,
      longitude: message.location?.longitude ?? null,
      image: staffImage,
    });
    if (staffReply) {
      await sendWhatsAppMessage(fromPhone, staffReply);
      return NextResponse.json({ ok: true });
    }

    // Machinery ka rate confirmation. Ye AI se pehle is liye hai ke
    // "CONFIRM" ka matlab hamesha tasdeeq hi hona chahiye -- AI ka is par
    // raye qaim karna wahi ek jagah hai jahan ghalti ka natija ye hota
    // hai ke machine bina tasdeeq ke khet par pahunch jaye.
    //
    // Ye tabhi pakaRta hai jab kisan ki koi booking waqai jawab ki
    // muntazir ho AUR paigham CONFIRM/ISSUE jaisa ho; warna null de kar
    // purana raasta chalne deta hai.
    const machineryReply = await handleMachineryConfirmation({
      fromPhone,
      text: message.type === "text" ? message.text.body : (message.image?.caption ?? null),
    });
    if (machineryReply) {
      await sendWhatsAppMessage(fromPhone, machineryReply);
      return NextResponse.json({ ok: true });
    }

    let { data: farmer } = await serviceClient.from("farmers").select("id, is_profile_complete").eq("whatsapp_number", fromPhone).maybeSingle();

    if (!farmer) {
      // is_profile_complete yahan bhi uthana zaroori hai: warna phone se
      // milne wale purane kisan ko har baar "profile adhoora" samajh kar
      // dobara registration poochh li jayegi.
      const { data: byPhone } = await serviceClient.from("farmers").select("id, is_profile_complete").eq("phone_number", fromPhone).maybeSingle();
      if (byPhone) {
        await serviceClient.from("farmers").update({ whatsapp_number: fromPhone }).eq("id", byPhone.id);
        farmer = byPhone;
      } else {
        const farmerCode = await nextFarmerCode(serviceClient);
        const { data: newFarmer } = await serviceClient
          .from("farmers")
          .insert({ farmer_code: farmerCode, full_name: `WhatsApp Farmer ${fromPhone.slice(-4)}`, phone_number: fromPhone, whatsapp_number: fromPhone })
          .select("id, is_profile_complete")
          .single();
        farmer = newFarmer;
      }
    }

    if (!farmer) {
      await sendWhatsAppMessage(fromPhone, "Maaf kijiye, aapka account set up nahi ho saka. Dobara koshish karein.");
      return NextResponse.json({ ok: true });
    }

    const isProfileComplete = (farmer as any).is_profile_complete ?? false;

    let result;
    if (message.type === "audio" || message.type === "voice") {
      const mediaId = message.audio?.id ?? message.voice?.id;
      const media = await downloadWhatsAppMedia(mediaId);
      if (!media) {
        await sendWhatsAppMessage(fromPhone, "Voice note download nahi ho saki, dobara bhejein.");
        return NextResponse.json({ ok: true });
      }
      result = await processFarmerAiMessage(serviceClient, farmer.id, { audioBase64: media.base64, audioMimeType: media.mimeType, isProfileComplete });
    } else if (message.type === "text") {
      result = await processFarmerAiMessage(serviceClient, farmer.id, { text: message.text.body, isProfileComplete });
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
