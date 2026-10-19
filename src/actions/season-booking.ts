"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { isCampaignOpen, type LineKind } from "@/lib/campaigns/booking";
import { validateSeasonBooking, mapImportRows, checkImportRow, parseCsv, SEASON_CROP, type CleanLineV2, type CleanFarm } from "@/lib/campaigns/season-v2";
import { saveSeasonBooking } from "@/lib/campaigns/season-save";
import { readXlsxFirstSheet } from "@/lib/campaigns/xlsx-read";
import { ADMIN_ROLES } from "@/lib/campaigns/season-data";

export interface SeasonState { error?: string; success?: boolean; message?: string }

/** Kisan: Season Booking v2 (farms + pin + beej/khaad/spray + apni product). Sirf gandum. */
export async function submitSeasonBooking(_p: SeasonState, formData: FormData): Promise<SeasonState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };
  const service = createServiceClient() as any;
  const { data: farmer } = await service.from("farmers").select("id, organization_id, branch_id, signup_approval_status, is_deleted").eq("user_id", user.id).maybeSingle();
  if (!farmer || farmer.is_deleted) return { error: "Aap ka kisan khata nahi mila." };
  if (farmer.signup_approval_status === "rejected") return { error: "Aap ka signup manzoor nahi hua. Daftar se raabta karein." };

  const { data: campaign } = await service.from("booking_campaigns").select("id, name, crop, deadline, is_active, allowed_crops").eq("id", String(formData.get("campaign_id") ?? "")).maybeSingle();
  if (!campaign) return { error: "Campaign nahi mili." };
  if (!isCampaignOpen(campaign)) return { error: `${campaign.name} ki booking band ho chuki hai.` };

  let farms: any[] = [], lines: any[] = [];
  try { farms = JSON.parse(String(formData.get("farms") ?? "[]")); lines = JSON.parse(String(formData.get("lines") ?? "[]")); }
  catch { return { error: "Form parha nahi gaya. Dobara koshish karein." }; }

  const ids = [...new Set(lines.map((l) => l?.productId).filter(Boolean))] as string[];
  const { data: prods } = ids.length ? await service.from("v_campaign_products").select("id, name, line_kind").in("id", ids) : { data: [] };
  const catalog = new Map<string, LineKind>(((prods ?? []) as any[]).map((p) => [p.id, p.line_kind]));
  const names = new Map<string, string>(((prods ?? []) as any[]).map((p) => [p.id, p.name]));
  const v = validateSeasonBooking({ crop: String(formData.get("crop") ?? SEASON_CROP), farms, lines, notes: String(formData.get("notes") ?? "") },
    { catalog, allowedCrops: campaign.allowed_crops ?? [campaign.crop] });
  if (!v.ok) return { error: v.error };
  // Beej sirf gandum ka (server par bhi).
  for (const l of v.lines) if (l.kind === "seed" && l.productId && !/wheat|gandum|گندم/i.test(names.get(l.productId) ?? "")) return { error: "Abhi sirf gandum ka beej book ho sakta hai." };

  const r = await saveSeasonBooking(service, { farmer, campaign, farms: v.farms, acres: v.acres, lines: v.lines, notes: v.notes, source: "form", actorId: user.id, productNames: names });
  if (!r.ok) return { error: r.error };
  revalidatePath("/portal/campaigns"); revalidatePath("/admin/season-bookings"); revalidatePath("/admin/demand-center");
  return { success: true, message: `Booking save ho gayi: ${v.farms.length} farm, ${v.acres} acre, ${r.lineCount} product. Koi payment nahi li gayi.` };
}

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role, is_active, organization_id").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ADMIN_ROLES.includes(String(me.role))) return null;
  return { user, me };
}

export interface ImportState extends SeasonState { batchId?: string }

/** Admin: sheet (CSV/XLSX) upload -> staging preview. Abhi koi booking nahi banti. */
export async function previewSeasonImport(_p: ImportState, formData: FormData): Promise<ImportState> {
  const a = await requireAdmin();
  if (!a) return { error: "Sirf Owner/Admin import kar sakta hai." };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Sheet (CSV ya XLSX) chunein." };
  if (file.size > 5_000_000) return { error: "File 5 MB se bari hai." };
  const campaignId = String(formData.get("campaign_id") ?? "");
  const service = createServiceClient() as any;
  const { data: campaign } = await service.from("booking_campaigns").select("id, organization_id").eq("id", campaignId).maybeSingle();
  if (!campaign) return { error: "Campaign nahi mili." };

  let table: string[][];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    table = /\.xlsx$/i.test(file.name) || buf.subarray(0, 2).toString() === "PK" ? readXlsxFirstSheet(buf) : parseCsv(buf.toString("utf8"));
  } catch (e) { return { error: e instanceof Error ? e.message : "Sheet parhi nahi gayi." }; }
  const { rows, missingHeaders } = mapImportRows(table);
  if (missingHeaders.length) return { error: `Sheet mein ye column nahi: ${missingHeaders.join(", ")}. Template download kar ke istemal karein.` };
  if (!rows.length) return { error: "Sheet khali hai." };
  if (rows.length > 3000) return { error: "Ek dafa mein 3000 se zyada qataarein nahi." };

  const phones = [...new Set(rows.map((r) => r.phone).filter(Boolean))] as string[];
  const { data: fs } = phones.length ? await service.from("farmers").select("id, phone_key").in("phone_key", phones).eq("is_deleted", false) : { data: [] };
  const farmerByPhone = new Map<string, string>(((fs ?? []) as any[]).map((f) => [f.phone_key, f.id]));
  const { data: prods } = await service.from("v_campaign_products").select("id, name, line_kind");
  const productByName = new Map<string, { id: string; kind: LineKind }>(((prods ?? []) as any[]).map((p) => [String(p.name).toLowerCase(), { id: p.id, kind: p.line_kind }]));
  const checked = rows.map((r) => ({ r, c: checkImportRow(r, { farmerByPhone, productByName, crop: SEASON_CROP }) }));
  const count = (k: string) => checked.filter((x) => x.c.result === k).length;

  const { data: batch, error } = await service.from("season_import_batches").insert({
    organization_id: campaign.organization_id ?? a.me.organization_id ?? null, campaign_id: campaign.id, file_name: file.name.slice(0, 200),
    total_rows: rows.length, ok_rows: count("ok"), warning_rows: count("warning"), error_rows: count("error"), created_by: a.user.id,
  }).select("id").single();
  if (error || !batch) return { error: "Preview save nahi hua." };
  const { error: rErr } = await service.from("season_import_rows").insert(checked.map(({ r, c }) => ({
    batch_id: batch.id, row_no: r.rowNo, raw: { ...r, raw: r.raw }, farmer_id: c.farmerId, product_id: c.productId, result: c.result, messages: c.messages,
  })));
  if (rErr) return { error: "Preview qataarein save nahi huin." };
  revalidatePath("/admin/season-bookings");
  return { success: true, batchId: batch.id, message: `${rows.length} qataarein parhi gayin. Neeche preview dekhein; abhi kuch save nahi hua.` };
}

/** Admin: preview confirm. Maker-checker: jis ne upload kiya wo khud confirm nahi karega. */
export async function commitSeasonImport(_p: SeasonState, formData: FormData): Promise<SeasonState> {
  const a = await requireAdmin();
  if (!a) return { error: "Sirf Owner/Admin import confirm kar sakta hai." };
  const service = createServiceClient() as any;
  const batchId = String(formData.get("batch_id") ?? "");
  const { data: batch } = await service.from("season_import_batches").select("id, campaign_id, status, created_by").eq("id", batchId).maybeSingle();
  if (!batch || batch.status !== "preview") return { error: "Ye import pehle hi mukammal ya cancel ho chuka." };
  if (batch.created_by === a.user.id) return { error: "Jis ne sheet upload ki wo khud confirm nahi kar sakta. Doosra Admin/Owner confirm kare." };
  const { data: campaign } = await service.from("booking_campaigns").select("id, name, deadline").eq("id", batch.campaign_id).single();
  const { data: rows } = await service.from("season_import_rows").select("row_no, raw, farmer_id, product_id, result").eq("batch_id", batchId).neq("result", "error").order("row_no");
  const good = (rows ?? []) as any[];
  if (!good.length) return { error: "Import karne layak koi qatar nahi." };

  const byFarmer = new Map<string, any[]>();
  for (const r of good) byFarmer.set(r.farmer_id, [...(byFarmer.get(r.farmer_id) ?? []), r]);
  const { data: farmers } = await service.from("farmers").select("id, organization_id, branch_id").in("id", [...byFarmer.keys()]);
  const { data: prods } = await service.from("v_campaign_products").select("id, name");
  const names = new Map<string, string>(((prods ?? []) as any[]).map((p) => [p.id, p.name]));
  let done = 0; const failed: string[] = [];
  for (const f of (farmers ?? []) as any[]) {
    const list = byFarmer.get(f.id)!;
    const farmMap = new Map<string, CleanFarm>();
    const lines: CleanLineV2[] = [];
    for (const r of list) {
      const x = r.raw; const name = String(x.farm || "Farm 1").slice(0, 80);
      if (!farmMap.has(name.toLowerCase())) farmMap.set(name.toLowerCase(), { farmId: null, name, acres: Number(x.acres), village: x.village || null, lat: x.lat ?? null, lng: x.lng ?? null });
      lines.push({ kind: x.kind, productId: r.product_id, customName: r.product_id ? null : String(x.product).slice(0, 120), quantity: Number(x.quantity), unit: x.unit || "bag" });
    }
    const farms = [...farmMap.values()];
    const acres = Math.round(farms.reduce((s, z) => s + z.acres, 0) * 100) / 100;
    const res = await saveSeasonBooking(service, { farmer: f, campaign, farms, acres, lines, notes: `Sheet import ${batchId.slice(0, 8)}`, source: "munshi", actorId: a.user.id, productNames: names });
    if (res.ok) done++; else failed.push(res.error);
  }
  if (!done) return { error: `Koi kisan import nahi hua: ${failed.slice(0, 3).join(" · ")}` };
  await service.from("season_import_batches").update({ status: "committed", committed_by: a.user.id, committed_at: new Date().toISOString() }).eq("id", batchId);
  await logAudit({ actionType: "create", module: "season_booking", recordId: batchId, recordLabel: `Season import: ${done} kisan` });
  revalidatePath("/admin/season-bookings"); revalidatePath("/admin/demand-center");
  return failed.length ? { error: `${done} kisan import hue, ${failed.length} mein masla: ${failed.slice(0, 3).join(" · ")}` } : { success: true, message: `${done} kisanon ki booking import ho gayi.` };
}

export async function cancelSeasonImport(_p: SeasonState, formData: FormData): Promise<SeasonState> {
  const a = await requireAdmin();
  if (!a) return { error: "Sirf Owner/Admin." };
  const service = createServiceClient() as any;
  await service.from("season_import_batches").update({ status: "cancelled" }).eq("id", String(formData.get("batch_id") ?? "")).eq("status", "preview");
  revalidatePath("/admin/season-bookings");
  return { success: true, message: "Import cancel ho gaya." };
}

/** Admin: kisan ki "apni product" ko catalog product se jorna ya rad karna. Maker-checker DB constraint bhi hai. */
export async function reviewCustomProduct(_p: SeasonState, formData: FormData): Promise<SeasonState> {
  const a = await requireAdmin();
  if (!a) return { error: "Sirf Owner/Admin." };
  const service = createServiceClient() as any;
  const id = String(formData.get("request_id") ?? ""); const productId = String(formData.get("product_id") ?? "");
  const decision = productId ? "mapped" : "rejected";
  const { data: req } = await service.from("custom_product_requests").select("id, created_by, name, status").eq("id", id).maybeSingle();
  if (!req || req.status !== "pending") return { error: "Ye request pehle hi review ho chuki." };
  if (req.created_by === a.user.id) return { error: "Apni banayi entry khud review nahi kar sakte." };
  let pname: string | null = null;
  if (productId) {
    const { data: p } = await service.from("v_campaign_products").select("id, name").eq("id", productId).maybeSingle();
    if (!p) return { error: "Product nahi mili." };
    pname = p.name;
  }
  const now = new Date().toISOString();
  const { error } = await service.from("custom_product_requests").update({ status: decision, mapped_product_id: productId || null, reviewed_by: a.user.id, reviewed_at: now }).eq("id", id).eq("status", "pending");
  if (error) return { error: error.message };
  if (productId) await service.from("farmer_product_demands").update({ product_id: productId, product_name: pname, updated_at: now }).eq("custom_request_id", id).eq("status", "pending");
  await logAudit({ actionType: decision === "mapped" ? "approve" : "reject", module: "custom_product", recordId: id, recordLabel: req.name });
  revalidatePath("/admin/season-bookings");
  return { success: true, message: decision === "mapped" ? `"${req.name}" → ${pname}` : `"${req.name}" rad kar di.` };
}
