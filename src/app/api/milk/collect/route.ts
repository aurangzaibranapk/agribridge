import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/api-auth";
import { recordCollection, type MilkSource } from "@/lib/milk-collection";

export const dynamic = "force-dynamic";

/**
 * Doodh jama karne ka WAHID darwaza.
 *
 * Website ka form, offline ka sync, WhatsApp ka paighaam aur aage chal
 * kar Play Store wali app -- sab yahi bulate hain. Is liye ye JSON leta
 * hai, form nahi: form sirf browser se aata hai, JSON har jagah se.
 *
 * App banane ke waqt yahan kuch nahi badlega -- wo bhi wahi login aur
 * wahi khana istemal karegi.
 */

interface Item {
  client_uuid?: string;
  farmer_id?: string;
  farmer_code?: string;
  liters?: number;
  lr?: number | null;
  shift?: string;
  entry_date?: string;
  collected_at?: string;
  route_name?: string;
  chiller_name?: string;
  branch_id?: string;
  notes?: string;
  /** LR ki photo -- base64 (data: prefix ke baghair). */
  lr_image_base64?: string;
  lr_image_mime?: string;
}

const SOURCES: MilkSource[] = ["website", "offline", "whatsapp", "app"];

/** Ek sync mein kitni entries tak. Offline se kabhi kabhi poora din aata hai. */
const MAX_ITEMS = 200;

export async function POST(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { source?: string; items?: Item[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON sahi nahi hai." }, { status: 400 });
  }

  const source = (body.source ?? "website") as MilkSource;
  if (!SOURCES.includes(source)) return NextResponse.json({ error: "Source sahi nahi hai." }, { status: 400 });

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "Koi entry nahi bheji gayi." }, { status: 400 });
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Ek baar mein zyada se zyada ${MAX_ITEMS} entries.` }, { status: 400 });
  }

  // MCA ka route aur chiller HR ne darj kiya hota hai. Device ise bhej
  // sakta hai, magar bheja hua sirf tab manate hain jab HR ke paas kuch
  // likha hi na ho -- warna koi bhi device kisi bhi route ka doodh apne
  // naam likhwa sakta.
  const service = createServiceClient();
  const { data: staff } = await service
    .from("staff_details")
    .select("milk_route_name, milk_chiller_name")
    .eq("profile_id", auth.caller.userId)
    .maybeSingle();
  const { data: profile } = await service
    .from("profiles")
    .select("branch_id")
    .eq("id", auth.caller.userId)
    .maybeSingle();

  const results: Array<Record<string, unknown>> = [];

  // Ek ek kar ke -- taake ek entry ki ghalti baqi sab ko na gira de.
  // Offline sync mein ye ahem hai: 40 entries mein se ek kharab ho to
  // baqi 39 phir bhi pahunch jani chahiyen.
  for (const item of items) {
    const liters = Number(item.liters ?? 0);
    const lrRaw = item.lr;
    const lr = lrRaw == null || lrRaw === ("" as unknown) ? null : Number(lrRaw);

    const result = await recordCollection({
      farmerId: item.farmer_id ?? null,
      farmerCode: item.farmer_code ?? null,
      liters,
      lr: lr != null && Number.isFinite(lr) ? lr : null,
      shift: item.shift,
      entryDate: item.entry_date,
      collectedAt: item.collected_at ?? null,
      source,
      clientUuid: item.client_uuid ?? null,
      mcaProfileId: auth.caller.userId,
      branchId: item.branch_id ?? profile?.branch_id ?? null,
      routeName: staff?.milk_route_name ?? item.route_name ?? null,
      chillerName: staff?.milk_chiller_name ?? item.chiller_name ?? null,
      lrImage:
        item.lr_image_base64 && item.lr_image_mime
          ? { base64: item.lr_image_base64, mimeType: item.lr_image_mime }
          : null,
      notes: item.notes ?? null,
    });

    if ("error" in result) {
      results.push({ client_uuid: item.client_uuid ?? null, ok: false, error: result.error });
    } else {
      results.push({
        client_uuid: item.client_uuid ?? null,
        ok: true,
        id: result.id,
        collection_number: result.collectionNumber,
        farmer_name: result.farmerName,
        liters: result.liters,
        already_existed: result.alreadyExisted,
        flags: result.flags,
      });
    }
  }

  const saved = results.filter((r) => r.ok).length;
  return NextResponse.json({ success: true, saved, failed: results.length - saved, results });
}
