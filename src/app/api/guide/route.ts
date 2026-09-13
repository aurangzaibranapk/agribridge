import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export interface GuideStep {
  path: string;
  target: string | null;
  text: string;
}

/**
 * Training guide (274): module ke qadam, har qadam ka safha aur (agar ho)
 * asal button ka nishan. guide jsonb na ho to steps ke text se raasta
 * nikal liya jata hai.
 */
export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!key) return NextResponse.json({ error: "key" }, { status: 400 });
  const service = createServiceClient();
  const { data: m } = await service.from("training_modules" as never).select("key, title, steps, try_route, guide").eq("key", key).maybeSingle();
  const mod = m as any;
  if (!mod) return NextResponse.json({ error: "not found" }, { status: 404 });
  let steps: GuideStep[] = Array.isArray(mod.guide) ? (mod.guide as GuideStep[]) : [];
  if (steps.length === 0) {
    steps = ((mod.steps as string[]) ?? []).map((text) => {
      const m2 = text.match(/\/admin[\w\-\/?=&.]*/);
      return { path: m2 ? m2[0].replace(/[.,;]+$/, "") : mod.try_route ?? "/admin/my-work", target: null, text };
    });
  }
  return NextResponse.json({ key: mod.key, title: mod.title, steps });
}
