import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordError, type ErrorModule, type ErrorSeverity } from "@/lib/errors/record";

const MODULES: ErrorModule[] = [
  "code", "pos", "inventory", "purchase", "machinery", "finance",
  "products", "ai", "whatsapp", "hr", "milk", "grain", "website",
];

/**
 * Safhe par kuch toota -- wo khabar yahan aati hai.
 *
 * Client par honay wali kharabi server ke log mein nahi jati. Malik ko
 * "Kuch toot gaya" ka safha nazar aata tha aur us ka koi nishan kahin
 * mehfooz nahi hota tha -- yani wo kharabi sirf us waqt maujood hoti
 * thi jab koi us ki tasveer bhej de.
 *
 * Ye raasta sirf LOGIN shuda bande ke liye hai. Khula chhorna wo darwaza
 * hai jahan se koi bhi khata bhar sakta hai.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const maangaModule = String(body.module ?? "code") as ErrorModule;
  const maangiSeverity = String(body.severity ?? "rukawat") as ErrorSeverity;

  await recordError({
    module: MODULES.includes(maangaModule) ? maangaModule : "code",
    severity: ["rukawat", "ghalti", "khabar"].includes(maangiSeverity) ? maangiSeverity : "rukawat",
    message: String(body.message ?? "Safhe par kuch toot gaya"),
    route: body.route ? String(body.route) : null,
    detail: body.detail ? String(body.detail) : null,
    digest: body.digest ? String(body.digest) : null,
    actorId: user.id,
  });

  return NextResponse.json({ ok: true });
}
