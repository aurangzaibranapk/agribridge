import { NextRequest, NextResponse } from "next/server";
import { phoneKey } from "@/lib/farmers/identity";
import { createServiceClient } from "@/lib/supabase/service";
import { processFarmerAiMessage } from "@/lib/farmer-ai-processor";
import { sendWhatsAppMessage, downloadWhatsAppMedia, normalizeWhatsAppPhone } from "@/lib/whatsapp-client";
import { handleStaffMessage } from "@/lib/staff-whatsapp-router";
import { handleMachineryConfirmation } from "@/lib/machinery-whatsapp-confirm";
import { parityEnabled, runParity } from "@/lib/whatsapp/parity/webhook";
import { inboxEnabled } from "@/lib/whatsapp/inbox/flag";
import { mirrorInbound } from "@/lib/whatsapp/inbox/ingest";
import { draftReplyAi } from "@/lib/whatsapp/inbox/ai";
import { transcribeVoice, classifyIntentAi } from "@/lib/whatsapp/parity/transcribe";
import { loadNav, routeAllowed } from "@/lib/access/nav";
import { buildReplyDraftRow, canAutoReplyToStaff, checkSignature, readInbound, WHATSAPP_REPLY_INTENT } from "@/lib/whatsapp/inbound-policy";

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
 * HMAC-SHA256, app secret se banaya hua. Qaide (go-live 5) aur un ki
 * wajah: src/lib/whatsapp/inbound-policy.ts
 *
 *  - WHATSAPP_APP_SECRET set: ghalat / ghaib signature = 401.
 *  - Set nahi: inbound band nahi hota (warning log), magar is raaste se
 *    KOI paighaam bahar nahi jata -- jhoota payload kisi ko message na
 *    bhijwa sake.
 *  - Kisan / gahak ko AI kabhi khud jawab nahi deta; mashwara staff ke
 *    liye mehfooz hota hai (/admin/whatsapp-replies) aur staff dekh kar
 *    "Confirm send" karta hai.
 *  - Anjaan number se farmer record nahi banta; number admin ki
 *    "unknown sender" qatar mein jata hai.
 */
export async function POST(request: NextRequest) {
  try {
    // Raw text chahiye — JSON parse karne ke baad asal bytes nahi milte,
    // aur HMAC bilkul unhi bytes par banta hai jo Meta ne bheje the.
    const rawBody = await request.text();
    const sig = checkSignature(rawBody, request.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET);
    if (sig === "invalid") {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    if (sig === "unsigned") {
      console.warn("[whatsapp-webhook] WHATSAPP_APP_SECRET set nahi -- signature check nahi hua. Paighaam qubool, magar koi jawab nahi bheja jayega.");
    }

    const body = JSON.parse(rawBody);
    // Broadcast: delivery status + STOP/START (sirf signed). Ghalti ho to purana raasta chalta rahe.
    if (sig === "valid") {
      const svc = createServiceClient();
      await import("@/lib/broadcast/webhook")
        .then((m) => m.recordBroadcastWebhook(async (fn, args) => (await svc.rpc(fn as never, args as never)).data, body))
        .catch((e) => console.error("[whatsapp-webhook] broadcast hook error", e));
    }
    const inbound = readInbound(body);
    if (!inbound) {
      return NextResponse.json({ ok: true });
    }
    const message = inbound.raw;
    const serviceClient = createServiceClient();
    const fromPhone = normalizeWhatsAppPhone(message.from);
    const msg = { ...inbound.msg, fromPhone };

    // Staff / machinery ke tay-shuda jawab: sirf signed paighaam par
    // bheje jate hain. Kisan ko AI ka jawab is function se kabhi nahi jata.
    const replyToStaff = async (text: string) => {
      if (!canAutoReplyToStaff(sig)) {
        console.warn("[whatsapp-webhook] unsigned: staff/machinery jawab nahi bheja gaya.");
        return;
      }
      await sendWhatsAppMessage(fromPhone, text);
    };

    // WhatsApp Chat Inbox (614-618): har inbound DARJ (bhejta kuch nahi).
    // Flag band ya migration na lagi ho to chup -- purana raasta waisa hi.
    if (inboxEnabled()) {
      await mirrorInbound({
        rpc: async (fn, args) => {
          const { data, error } = await serviceClient.rpc(fn as never, args as never);
          return { data, error: error ? { message: error.message } : null };
        },
        download: async (id) => {
          const m = await downloadWhatsAppMedia(id);
          return m ? { base64: m.base64, mimeType: m.mimeType } : null;
        },
        upload: async (path, b64, mime) => {
          const { error } = await serviceClient.storage.from("wa-media").upload(path, Buffer.from(b64, "base64"), { contentType: mime, upsert: false });
          return !error;
        },
        setMediaPath: async (id, path) => { await serviceClient.from("wa_messages" as never).update({ media_path: path } as never).eq("id", id); },
        conversationOf: async (id) => {
          const { data } = await serviceClient.from("wa_messages" as never).select("conversation_id").eq("id", id).maybeSingle();
          return (data as { conversation_id?: string } | null)?.conversation_id ?? null;
        },
        transcribe: transcribeVoice,
        draftReply: draftReplyAi,
      }, message, phoneKey(fromPhone), fromPhone, msg.profileName ?? null).catch((e) => {
        console.error("[whatsapp-webhook] inbox mirror error -- purana raasta", e);
      });
    }

    // WhatsApp = App (Phase 1, sirf parhna). Flag band ho, ya 610/613
    // na lage hon, to ye kuch nahi karta aur purana raasta chalta hai.
    if (parityEnabled()) {
      const p = await runParity(message, phoneKey(fromPhone), canAutoReplyToStaff(sig), {
        rpc: async (fn, args) => {
          const { data, error } = await serviceClient.rpc(fn as never, (args ?? {}) as never);
          return { data, error: error ? { message: error.message } : null };
        },
        allowedRoutes: async (uid, role) => {
          const nav = await loadNav(uid, role);
          return nav.unrestricted ? null : nav.allowedRoutes;
        },
        routeAllowed,
        transcribe: transcribeVoice,
        aiIntent: classifyIntentAi,
        download: async (id) => {
          const m = await downloadWhatsAppMedia(id);
          return m ? { base64: m.base64, mimeType: m.mimeType } : null;
        },
        send: replyToStaff, // wohi signed-only bhejne wala
      }).catch((e) => {
        console.error("[whatsapp-webhook] parity error -- purana raasta", e);
        return null;
      });
      if (p?.handled) return NextResponse.json({ ok: true });
    }

    // Pehle dekho ke ye staff to nahi. Staff ka raasta AI se nahi guzarta:
    // un ke kaam (hazri waghera) gine chune hain aur unhein bilkul waisa
    // hi chalna chahiye jaisa likha gaya. null aaye to ye staff nahi.
    // Tasveer sirf staff ke liye utarte hain.
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
      await replyToStaff(staffReply);
      return NextResponse.json({ ok: true });
    }

    // Machinery ka rate confirmation ("CONFIRM" ka matlab hamesha
    // tasdeeq). Ye AI nahi, tay-shuda jawab hai -- signed par hi jata hai.
    const machineryReply = await handleMachineryConfirmation({
      fromPhone,
      text: message.type === "text" ? message.text.body : (message.image?.caption ?? null),
    });
    if (machineryReply) {
      await replyToStaff(machineryReply);
      return NextResponse.json({ ok: true });
    }

    // WhatsApp se aane wala number kabhi 92 se, kabhi 0 se, kabhi + se --
    // phoneKey sab ko ek bana deta hai.
    const key = phoneKey(fromPhone);
    const { data: farmer } = await serviceClient
      .from("farmers")
      .select("id")
      .eq("phone_key", key ?? "")
      .eq("is_deleted", false)
      .maybeSingle();

    if (!farmer) {
      // Malik (go-live 5): anjaan number se farmer record KHUD nahi banta,
      // aur us ko koi paighaam nahi jata. Number admin ki "unknown sender"
      // qatar mein (whatsapp_onboarding, sirf service role) -- staff dekh
      // kar khud farmer banaye ya hata de.
      if (key) {
        const { data: seen } = await serviceClient.from("whatsapp_onboarding").select("phone_key").eq("phone_key", key).maybeSingle();
        if (!seen) {
          await serviceClient.from("whatsapp_onboarding").insert({ phone_key: key, phone_number: fromPhone, full_name: msg.profileName ?? null });
        }
      }
      return NextResponse.json({ ok: true });
    }

    // Purana kisan mil gaya -- WhatsApp number darj (agli baar seedha mile).
    await serviceClient.from("farmers").update({ whatsapp_number: fromPhone }).eq("id", farmer.id);

    const isVoice = message.type === "audio" || message.type === "voice";
    if (!isVoice && message.type !== "text") {
      // Tasveer / location waghera: kisan ki taraf se abhi sirf text aur
      // voice samjhe jate hain. Koi jawab nahi bheja jata.
      return NextResponse.json({ ok: true });
    }

    // Meta kabhi wohi paighaam dobara bhejta hai -- ek message, ek qatar.
    if (msg.waMessageId) {
      const { data: dupe } = await serviceClient
        .from("farmer_ai_requests")
        .select("id")
        .eq("intent_type", WHATSAPP_REPLY_INTENT)
        .eq("details->>wa_message_id", msg.waMessageId)
        .maybeSingle();
      if (dupe) return NextResponse.json({ ok: true });
    }

    // AI sirf mashwara likhta hai (aur pehle ki tarah kisan ke liye draft,
    // jo kisan portal ke "Pending Approvals" mein jata hai). Bhejta nahi.
    let ai: { answer: string | null; draftId?: string | null; error?: string | null } = { answer: null };
    try {
      if (isVoice) {
        const mediaId = message.audio?.id ?? message.voice?.id;
        const media = mediaId ? await downloadWhatsAppMedia(mediaId) : null;
        if (!media) {
          ai = { answer: null, error: "Voice note download nahi ho saki." };
        } else {
          const r = await processFarmerAiMessage(serviceClient, farmer.id, { audioBase64: media.base64, audioMimeType: media.mimeType });
          ai = { answer: r.answer, draftId: r.draftId ?? null };
        }
      } else {
        const r = await processFarmerAiMessage(serviceClient, farmer.id, { text: message.text.body });
        ai = { answer: r.answer, draftId: r.draftId ?? null };
      }
    } catch (e) {
      ai = { answer: null, error: e instanceof Error ? e.message : "AI se mashwara nahi mila." };
    }

    await serviceClient.from("farmer_ai_requests").insert(buildReplyDraftRow(farmer.id, msg, sig, ai) as any);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
