import { NextResponse } from "next/server";
import { PRODUCT_VERSION } from "@/lib/product-version";
import { readSupportWhatsapp } from "@/lib/mobile/whatsapp-config";

export const dynamic = "force-dynamic";

/** Login se pehle bhi WhatsApp support. Number settings se, code mein nahi. */
export async function GET() {
  const whatsapp = await readSupportWhatsapp();
  return NextResponse.json({ version: PRODUCT_VERSION, whatsapp });
}
