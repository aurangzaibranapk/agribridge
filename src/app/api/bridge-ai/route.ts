import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { bridgeToolDeclarations, executeBridgeTool, classifyAgent, AGENT_SYSTEM_INSTRUCTIONS } from "@/lib/utils/bridge-tools";
import { requireStaff } from "@/lib/api-auth";
import { buildCoachContext, coachInstruction } from "@/lib/ai/work-coach";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { loadNeedsAttention, filterAttention } from "@/lib/access/needs-attention";
import { t } from "@/lib/i18n/translations";
import { Type, type FunctionDeclaration } from "@google/genai";
import { SUGGESTION_TOOL, executeSuggestionTool } from "@/lib/ai/suggestion-tool";
import { ACCESS_TOOL, CONFLICT_TOOL, executeAccessTool, executeConflictTool } from "@/lib/ai/access-tool";
import { createServiceClient } from "@/lib/supabase/service";
import { aiKeyOrNull, AI_KEY_MISSING, aiErrorMessage } from "@/lib/ai/ai-failure";
import { recordAiUsage } from "@/lib/ai/usage";

export async function POST(request: NextRequest) {
  // Bridge AI sirf admin panel se chalta hai. Middleware /api ko nahi bachata,
  // is liye rok yahan lagani parti hai.
  const auth = await requireStaff();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const shuru = Date.now();
  try {
    const body = await request.json();
    const message: string = typeof body?.message === "string" ? body.message : "";
    // Screenshot help (Guided ERP C): tasveer + sawal.
    const image: { mimeType: string; data: string } | null =
      body?.image && typeof body.image.data === "string" && typeof body.image.mimeType === "string" && body.image.mimeType.startsWith("image/")
        ? { mimeType: body.image.mimeType, data: body.image.data }
        : null;
    if (!message && !image) {
      return NextResponse.json({ error: "Message zaroori hai" }, { status: 400 });
    }

    const supabase = createClient();

    // Chaabi dono naamon se qabool (`gemini-key.ts`). Pehle yahan seedha
    // `BRIDGE_AI_GEMINI_API_KEY!` likha tha -- aur Live par sirf doosra
    // naam laga hua tha, is liye bill reader chalta tha magar ye panel
    // har sawal par "kuch masla ho gaya" kehta tha.
    const apiKey = aiKeyOrNull();
    if (!apiKey) return NextResponse.json({ error: AI_KEY_MISSING }, { status: 503 });

    const ai = new GoogleGenAI({ apiKey });

    const agent = classifyAgent(message);
    const lang = getLanguageFromCookies("rm");
    // Kaun pooch raha hai, kya khulta hai, system ka naqsha, aaj kya
    // baqi -- sab AI ke saamne (Work Coach, C).
    const ctx = await buildCoachContext(auth.caller.userId, lang);
    const systemInstruction = AGENT_SYSTEM_INSTRUCTIONS[agent] + (ctx ? "\n" + coachInstruction(ctx) : "");

    // Pichhli baat (269): tajweez ka draft -> "haan" -> darj, is ke liye
    // AI ko pichhle 8 paighaam bhi milte hain.
    const rawHistory: { role: string; text: string }[] = Array.isArray(body?.history) ? body.history : [];
    const history = rawHistory
      .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.text === "string" && h.text.trim())
      .slice(-8)
      .map((h) => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text.slice(0, 4000) }] }));

    const chat = ai.chats.create({
      model: "gemini-3.6-flash",
      history,
      config: {
        tools: [{ functionDeclarations: [...bridgeToolDeclarations, ...COACH_TOOLS, SUGGESTION_TOOL, ACCESS_TOOL, CONFLICT_TOOL] }],
        systemInstruction,
      },
    });

    const parts: any[] = [];
    if (message) parts.push({ text: message });
    if (image) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
      if (!message) parts.push({ text: "Ye safha mujhe samjhao." });
    }
    const result = await chat.sendMessage({ message: parts });
    const functionCalls = result.functionCalls;
    const toolsCalled: string[] = [];
    let answer: string;
    let result2Usage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | null = null;

    if (functionCalls && functionCalls.length > 0) {
      const functionResponseParts = await Promise.all(
        functionCalls.map(async (call) => {
          toolsCalled.push(call.name!);
          const toolResult =
            call.name === "submit_suggestion"
              ? await executeSuggestionTool(call.args ?? {}, ctx)
              : call.name === "request_access"
                ? await executeAccessTool(call.args ?? {}, ctx)
              : call.name === "check_access_conflicts"
                ? await executeConflictTool(call.args ?? {}, ctx)
              : COACH_TOOL_NAMES.has(call.name!)
                ? await executeCoachTool(call.name!, call.args ?? {}, ctx)
                : await executeBridgeTool(call.name!, supabase, call.args);
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
      result2Usage = jodTokens(result?.usageMetadata, result2?.usageMetadata);
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

    // AI ka khata (317). Tasveer bhej kar poocha gaya ho to us ki qeemat
    // alag hoti hai -- is liye alag qism.
    await recordAiUsage({
      feature: "chat",
      kind: image ? "tasveer-parhna" : "likhai",
      model: "gemini-3.6-flash",
      ok: Boolean(answer),
      // Ek sawal par do dafa baat hoti hai jab AI koi tool chalata hai;
      // token dono ka jama hai.
      usage: (result2Usage ?? result?.usageMetadata) ?? null,
      ms: Date.now() - shuru,
      actorId: auth.caller.userId,
      note: message.slice(0, 120),
    });

    return NextResponse.json({ answer, agent, role: ctx?.role ?? auth.caller.role });
  } catch (error: any) {
    // Poora stack log mein, aur bande ke saamne wo jumla jis se agla
    // qadam maloom ho.
    console.error("Bridge AI error:", error);
    await recordAiUsage({
      feature: "chat",
      kind: "likhai",
      model: "gemini-3.6-flash",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - shuru,
    });
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 500 });
  }
}

// =====================================================================
// Work Coach ke tools (C): sirf parhte hain aur raasta batate hain.
// =====================================================================
const COACH_TOOLS: FunctionDeclaration[] = [
  {
    name: "get_my_work",
    description: "Is shakhs ke liye aaj kya baqi hai -- asal ginti aur har kaam ka safha. 'Ab kya karoon', 'mera kaam', 'kya pending hai' jaise sawal par.",
  },
  {
    name: "explain_page",
    description: "Kisi safhe/feature ki likhi hui maloomat: maqsad, kaun, kab, qadam, aage kya, ghaltiyan, FAQ. Feature ka naam, key ya raasta (/admin/...) dein. Screenshot samjhane ke liye bhi yehi.",
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING, description: "Feature ka naam, key ya raasta, jaise 'Product Setup' ya '/admin/products/setup'" } },
      required: ["query"],
    },
  },
  {
    name: "open_page",
    description: "Kaam ke liye sahi safha dhoondna: naam ya kaam batayein (jaise 'payment jama karni hai', 'stock bhejna'), jawab mein raasta aur ye ke is shakhs ko khulta hai ya nahi.",
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING, description: "Kaam ya safhe ka naam" } },
      required: ["query"],
    },
  },
  {
    name: "start_guide",
    description: "Training guide shuru karna: qadam ba qadam, asal button roshan hota hai aur 'Next' aage le jata hai (Training Mode). 'Mujhe purchase sikhao', 'warehouse ka kaam kaise', 'guide chalao' jaise sawal par. Jawab mein link -- staff us par click kare.",
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING, description: "Module ya kaam ka naam: purchase, warehouse, sales, finance, milk, machinery, hr, products" } },
      required: ["query"],
    },
  },
];
const COACH_TOOL_NAMES = new Set(COACH_TOOLS.map((d) => d.name!));

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();
}

async function executeCoachTool(name: string, args: Record<string, any>, ctx: Awaited<ReturnType<typeof buildCoachContext>>) {
  if (!ctx) return { error: "Context nahi mila." };
  if (name === "start_guide") {
    const service = createServiceClient();
    const { data: mods } = await service.from("training_modules" as never).select("key, title, title_en, department_key, summary, steps, try_route, guide").eq("is_active", true);
    const qn = norm(String(args.query ?? ""));
    const list = ((mods ?? []) as any[])
      .map((m) => {
        const hay = norm(`${m.key} ${m.title} ${m.title_en ?? ""} ${m.department_key ?? ""} ${m.summary ?? ""}`);
        let score = 0;
        for (const w of qn.split(" ")) if (w.length >= 3 && hay.includes(w)) score += 1;
        if (norm(m.key) === qn || norm(m.title) === qn) score += 5;
        return { m, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (list.length === 0) return { found: false, modules: ((mods ?? []) as any[]).map((m) => `${m.title} (${m.key})`) };
    const m = list[0].m;
    const guide = Array.isArray(m.guide) && m.guide.length ? (m.guide as any[]) : ((m.steps as string[]) ?? []).map((text) => ({ path: (text.match(/\/admin[\w\-\/?=&.]*/) ?? [m.try_route])[0], text }));
    const first = guide[0]?.path ?? m.try_route ?? "/admin/academy";
    const link = `${first}${String(first).includes("?") ? "&" : "?"}guide=${m.key}&step=1`;
    return {
      found: true,
      module: m.title,
      steps: guide.map((g: any, i: number) => `${i + 1}. ${g.text}`),
      start_link: link,
      instruction: "Staff ko ye link dein (system usay button bana deta hai): us par click karte hi pehla qadam roshan hoga aur 'Next' aage le jayega. Qadam bhi chhote lafzon mein bata dein.",
    };
  }
  if (name === "get_my_work") {
    const all = await loadNeedsAttention();
    const items = filterAttention(all, ctx.allowedRoutes).map((a) => ({ count: a.count, what: t(a.label, "rm"), page: a.href }));
    return { role: ctx.role, department: ctx.departmentLabel, items, note: "count null = ginti nahi mil saki, sifar nahi" };
  }
  const q = norm(String(args.query ?? ""));
  if (!q) return { found: false };
  const scored = ctx.features
    .map((f) => {
      const hay = norm(`${f.label} ${f.key} ${f.route} ${f.purpose ?? ""}`);
      let score = 0;
      if (q.startsWith("/admin") && (f.route === q.split(" ")[0] || q.startsWith(f.route))) score += 10;
      for (const w of q.split(" ")) if (w.length >= 3 && hay.includes(w)) score += 1;
      if (norm(f.label) === q) score += 5;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (scored.length === 0) return { found: false, message: "Aisa koi safha fehrist mein nahi." };
  const allowed = (route: string) => !ctx.allowedRoutes || ctx.allowedRoutes.some((r) => route === r || route.startsWith(r + "/"));
  if (name === "open_page") {
    return {
      found: true,
      matches: scored.map(({ f }) => ({ label: f.label, page: f.route, opens_for_this_user: allowed(f.route), who: f.who })),
    };
  }
  // explain_page
  const f = scored[0].f;
  return {
    found: true,
    label: f.label,
    page: f.route,
    opens_for_this_user: allowed(f.route),
    purpose: f.purpose,
    who: f.who,
    steps: f.how,
    next: f.next,
    help_panel: "Safhe par upar daayen '? Samjhein' dabane se yehi maloomat panel mein khulti hai.",
  };
}


/**
 * Do baaton ke token ek sath.
 *
 * AI koi tool chalaye to ek hi sawal par do dafa baat hoti hai. Sirf
 * doosri ginna adha sach hota -- aur bill poore par aata hai.
 */
function jodTokens(
  a: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined,
  b: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined
) {
  const add = (x?: number, y?: number) => (x == null && y == null ? undefined : (x ?? 0) + (y ?? 0));
  return {
    promptTokenCount: add(a?.promptTokenCount, b?.promptTokenCount),
    candidatesTokenCount: add(a?.candidatesTokenCount, b?.candidatesTokenCount),
    totalTokenCount: add(a?.totalTokenCount, b?.totalTokenCount),
  };
}
