import { NextRequest, NextResponse } from "next/server";
import { diagnoseCropFromImage } from "@/lib/ai/crop-doctor-client";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const diagnosis = await diagnoseCropFromImage(base64Image, mimeType);

    if (!diagnosis) {
      return NextResponse.json({ notConfigured: true }, { status: 200 });
    }

    return NextResponse.json({ diagnosis });
  } catch (err) {
    console.error("Crop doctor route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}