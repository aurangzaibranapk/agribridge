import { Type, type FunctionDeclaration } from "@google/genai";
import { createServiceClient } from "@/lib/supabase/service";
import { createSuggestion } from "@/lib/suggestions";
import { CATEGORIES } from "@/lib/suggestions-const";
import { bestMatches } from "@/lib/product-match";
import type { CoachContext } from "@/lib/ai/work-coach";

/**
 * Work Coach ka tool: staff ki baat se tajweez (269).
 *
 * Do qadam, ek hi tool:
 *   confirmed = false -> draft wapas (department, feature, qism, masla,
 *                        behtari, priority) + milti julti purani
 *                        tajweezein ("ye masla N logon ne bataya").
 *                        AI ye draft staff ko dikhata hai, tasdeeq
 *                        poochta hai.
 *   confirmed = true  -> darj. Number milta hai.
 * AI kabhi khud confirmed=true nahi bhejta jab tak staff "haan" na kahe.
 */
export const SUGGESTION_TOOL: FunctionDeclaration = {
  name: "submit_suggestion",
  description:
    "Staff ki tajweez, masla ya behtari ka idea darj karna (Improvements Center). PEHLE confirmed=false ke sath bhejein: jawab mein draft aur milti julti purani tajweezein aayengi -- wo staff ko dikhayein aur poochein 'darj kar doon?'. Staff HAAN kahe TAB confirmed=true ke sath wahi fields dobara bhejein. Staff ki baat se khud fields bharein: title (ek jumla), problem (kya masla), improvement (kya hona chahiye), category, priority.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      confirmed: { type: Type.BOOLEAN, description: "false = sirf draft dikhao; true = staff ne haan kaha, darj karo" },
      title: { type: Type.STRING, description: "Ek jumle ka unwaan" },
      problem: { type: Type.STRING, description: "Kya masla hai / kya kami hai" },
      improvement: { type: Type.STRING, description: "Kya hona chahiye" },
      category: { type: Type.STRING, description: `Ek: ${CATEGORIES.join(" | ")}` },
      priority: { type: Type.STRING, description: "low | medium | high -- kaam rukta ho to high" },
      page_route: { type: Type.STRING, description: "Jis safhe ki baat hai us ka raasta, jaise /admin/inventory/receiving (maloom ho to)" },
    },
    required: ["confirmed", "title"],
  },
};

export async function executeSuggestionTool(args: Record<string, any>, ctx: CoachContext | null) {
  if (!ctx) return { ok: false, message: "Context nahi mila." };
  const title = String(args.title ?? "").trim();
  if (title.length < 4) return { ok: false, message: "Unwaan chahiye." };
  const category = CATEGORIES.includes(args.category) ? args.category : "other";
  const priority = ["low", "medium", "high"].includes(args.priority) ? args.priority : "medium";

  // Feature: raaste se, warna unwaan se milta julta.
  let feature: { key: string; label: string; route: string } | null = null;
  const route = String(args.page_route ?? "").trim();
  if (route) feature = ctx.features.find((f) => route === f.route || route.startsWith(f.route + "/")) ?? null;
  if (!feature) {
    const m = bestMatches(title, null, ctx.features.map((f) => ({ ...f, name: f.label })), 1)[0];
    if (m && m.score >= 0.5) feature = m.item;
  }

  // Milti julti purani tajweezein -- duplicate ka shak (asal kabhi mitti nahi).
  const service = createServiceClient();
  const { data: open } = await service
    .from("suggestions")
    .select("id, number, title, status, department_key")
    .neq("status", "duplicate")
    .order("created_at", { ascending: false })
    .limit(300);
  const similar = bestMatches(title, null, (open ?? []).map((s) => ({ ...s, name: s.title })), 3)
    .filter((c) => c.score >= 0.55)
    .map((c) => ({ number: c.item.number, title: c.item.title, status: c.item.status, match: Math.round(c.score * 100) }));

  const draft = {
    department: ctx.departmentLabel,
    feature: feature ? `${feature.label} (${feature.route})` : null,
    category,
    priority,
    title,
    problem: String(args.problem ?? "").trim() || null,
    improvement: String(args.improvement ?? "").trim() || null,
    submitted_by: ctx.fullName,
  };

  if (!args.confirmed) {
    return {
      ok: true,
      stage: "draft",
      draft,
      similar_existing: similar,
      instruction: "Ye draft staff ko saaf likh kar dikhayein (har khana), milti julti purani tajweez ho to batayein, phir poochein: 'Darj kar doon?'. Haan par confirmed=true ke sath dobara bhejein.",
    };
  }

  const res = await createSuggestion(ctx.userId, {
    title,
    problem: draft.problem,
    improvement: draft.improvement,
    category,
    priority,
    feature_key: feature?.key ?? null,
    page_route: route || feature?.route || null,
    ai_raw: { args, similar },
  });
  if (!res.success) return { ok: false, message: res.error };
  return {
    ok: true,
    stage: "submitted",
    number: res.number,
    message: `Darj ho gayi: ${res.number}. Owner/Admin ko paighaam gaya. Halat badle to staff ko khud paighaam aayega.`,
    similar_existing: similar,
  };
}
