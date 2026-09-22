import { createServiceClient } from "@/lib/supabase/service";

/**
 * Har AI call ka indraj -- ek jagah se.
 *
 * Malik ka sawal (5 September): *"itna AI involve kiya hai, kya is ka
 * bill aayega?"* Us waqt asal ginti kahin nahi thi. `bridge_ai_activity_log`
 * sirf chat panel ka tha; bill reader, qism ki tajweez, tasveer -- in
 * mein se koi bhi darj nahi hota tha. Yani sawal ka theek jawab dena
 * mumkin hi nahi tha.
 *
 * Do usool:
 *
 * 1. **Ye kabhi kisi kaam ko rokta nahi.** Khata likhna nakaam ho jaye
 *    to AI ka jawab phir bhi bande tak jata hai. Hisaab rakhne wali cheez
 *    ka asal kaam rok dena us se bura hai ke hisaab na rakha jaye.
 *
 * 2. **Token Google ke jawab se aate hain, andaze se nahi.** Google
 *    `usageMetadata` mein khud bhejta hai. Na mile to NULL rehta hai --
 *    "sifar token" aur "ginti nahi mili" ek cheez nahi.
 */

export type AiKind = "likhai" | "tasveer" | "tasveer-parhna";

export interface AiUsage {
  /** Kis feature ne bulaya: 'chat', 'qism-tajweez', 'tasveer', ... */
  feature: string;
  kind: AiKind;
  model?: string | null;
  ok: boolean;
  error?: string | null;
  /** Google ka `usageMetadata` -- jaisa aaya waisa. */
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } | null;
  images?: number;
  ms?: number | null;
  actorId?: string | null;
  note?: string | null;
}

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function recordAiUsage(u: AiUsage): Promise<void> {
  try {
    await createServiceClient()
      .from("ai_usage_log")
      .insert({
        feature: u.feature,
        kind: u.kind,
        model: u.model ?? null,
        ok: u.ok,
        // Poora paighaam nahi -- khata paRhne ke qabil rehna chahiye.
        error: u.error ? String(u.error).slice(0, 300) : null,
        prompt_tokens: n(u.usage?.promptTokenCount),
        output_tokens: n(u.usage?.candidatesTokenCount),
        total_tokens: n(u.usage?.totalTokenCount),
        images: u.images ?? 0,
        ms: n(u.ms),
        actor_id: u.actorId ?? null,
        note: u.note ? String(u.note).slice(0, 200) : null,
      });
  } catch {
    // Jaan boojh kar khamosh. Khata na likha ja sake to bhi AI ka kaam
    // rukna nahi chahiye.
  }
}
