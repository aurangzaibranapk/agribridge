import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { bridgeToolDeclarations, executeBridgeTool, classifyAgent, AGENT_SYSTEM_INSTRUCTIONS } from "@/lib/utils/bridge-tools";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message zaroori hai" }, { status: 400 });
    }

    const supabase = createClient();
    const ai = new GoogleGenAI({ apiKey: process.env.BRIDGE_AI_GEMINI_API_KEY! });

    const agent = classifyAgent(message);
    const systemInstruction = AGENT_SYSTEM_INSTRUCTIONS[agent];

    const chat = ai.chats.create({
      model: "gemini-3.6-flash",
      config: {
        tools: [{ functionDeclarations: bridgeToolDeclarations }],
        systemInstruction,
      },
    });

    const result = await chat.sendMessage({ message });
    const functionCalls = result.functionCalls;
    const toolsCalled: string[] = [];
    let answer: string;

    if (functionCalls && functionCalls.length > 0) {
      const functionResponseParts = await Promise.all(
        functionCalls.map(async (call) => {
          toolsCalled.push(call.name!);
          const toolResult = await executeBridgeTool(call.name!, supabase, call.args);
          return {
            functionResponse: {
              name: call.name!,
              response: toolResult as any,
            },
          };
        })
      );
      const result2 = await chat.sendMessage({ message: functionResponseParts });
      answer = result2.text ?? "";
    } else {
      answer = result.text ?? "";
    }

    try {
      await supabase
        .from("bridge_ai_activity_log")
        .insert({ question: message, tools_called: toolsCalled, answer, agent_type: agent });
    } catch {
      // Logging failure should never break the user-facing answer
    }

    return NextResponse.json({ answer, agent });
  } catch (error: any) {
    console.error("Bridge AI error:", error);
    return NextResponse.json(
      { error: "Kuch masla ho gaya, dobara koshish karein." },
      { status: 500 }
    );
  }
}