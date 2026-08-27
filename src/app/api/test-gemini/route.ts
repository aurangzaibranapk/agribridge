import { NextResponse } from "next/server";
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not found in environment" }, { status: 500 });
  }
  try {
    // Test 1: plain text (already confirmed working)
    const textResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say hello in one word." }] }],
        }),
      }
    );
    const textData = await textResponse.json();

    // Test 2: JSON mode - same config Crop Doctor / Product Extraction use
    const jsonResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with ONLY this JSON object: {"status": "ok"}' }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    const jsonData = await jsonResponse.json();

    return NextResponse.json({
      keyFound: true,
      keyPrefix: apiKey.substring(0, 8),
      textMode: { status: textResponse.status, data: textData },
      jsonMode: { status: jsonResponse.status, data: jsonData },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}