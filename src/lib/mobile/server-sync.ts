import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { recordCollection } from "@/lib/milk-collection";
import { applyFat } from "@/lib/milk-collection";
import { recordFuel, recordOpening, vehicleForStaff } from "@/lib/vehicle-daily-log";
import { checkLocationAgainstBranch, whatsappCheckInBlockedMessage } from "@/lib/staff-attendance";
import { lockedFuelRate, METER_BUCKET } from "@/lib/dairy/rules";
import { fatActorError, validateOutbox } from "@/lib/mobile/outbox";
import { isUuid, type OutboxItem } from "@/lib/mobile/queue";
import { fileMobileReport } from "@/lib/support/mobile-report";
import { dropVariance, resolveThresholds, settingsOrError, toMilkNotice } from "@/lib/mobile/pricing";
import { karachiWeek, weeklyStatement } from "@/lib/mobile/statement";
import { parseStatement } from "@/lib/portal/khata";
import { shiftTotals } from "@/lib/mobile/shifts";
import { appRoleFor, type AppRole } from "@/lib/mobile/roles";
import { supportChatPath } from "@/lib/mobile/support";
import { readSupportWhatsapp } from "@/lib/mobile/whatsapp-config";
import { PRODUCT_VERSION } from "@/lib/product-version";
import type { SupabaseClient } from "@supabase/supabase-js";

const service = () => createServiceClient() as any;

async function savePhoto(bucket: string, path: string, base64: string, mime: string): Promise<{ path: string } | { error: string }> {
  const bytes = Buffer.from(base64, "base64");
  const { error } = await service().storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) return { error: error.message };
  return { path };
}

async function markInbox(profileId: string, clientUuid: string, status: "applied" | "failed" | "stored", error: string | null) {
  const row = await service().from("mobile_sync_inbox").update({
    status,
    error,
    applied_at: status === "applied" ? new Date().toISOString() : null,
  }).eq("profile_id", profileId).eq("client_uuid", clientUuid);
  return !row.error;
}

async function rememberInbox(profileId: string, item: OutboxItem): Promise<boolean> {
  const row = await service().from("mobile_sync_inbox").upsert({
    profile_id: profileId,
    client_uuid: item.clientUuid,
    kind: item.kind,
    payload: item.payload,
    status: "stored",
    error: null,
  }, { onConflict: "profile_id,client_uuid" });
  if (row.error && /mobile_sync_inbox|schema cache|does not exist|Could not find/i.test(row.error.message)) return false;
  return !row.error;
}

function kindAllowed(appRole: AppRole, kind: OutboxItem["kind"]): boolean {
  if (kind === "feedback") return true;
  if (kind === "fat") return appRole === "mco" || appRole === "admin";
  if (kind === "pickup" || kind === "drop") return appRole === "mca" || appRole === "mco" || appRole === "admin";
  if (kind === "attendance" || kind === "meter" || kind === "petrol") {
    return appRole === "mca" || appRole === "mco" || appRole === "staff" || appRole === "admin";
  }
  return false;
}

export async function applyOutboxItem(input: {
  userId: string;
  role: string;
  appRole: AppRole;
  organizationId: string;
  fullName: string;
  branchId: string | null;
  routeName: string | null;
  chillerName: string | null;
  item: OutboxItem;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!kindAllowed(input.appRole, input.item.kind)) return { ok: false, error: "Is kaam ki ijazat nahi." };
  const checked = validateOutbox(input.item.kind, input.item.payload);
  if (!checked.ok) return checked;
  const body = checked.payload;
  const db = service();

  if (checked.kind === "attendance") {
    if (!isUuid(input.item.clientUuid)) return { ok: false, error: "client uuid sahi nahi." };
    const dup = await db.from("attendance_records").select("id").eq("client_action_id", input.item.clientUuid).maybeSingle();
    if (dup.data) return { ok: true };
    const today = aajKaKhana();
    const already = await db.from("attendance_records").select("status, check_in_at, source").eq("profile_id", input.userId).eq("attendance_date", today).maybeSingle();
    if (already.data) return { ok: false, error: whatsappCheckInBlockedMessage(already.data) };
    const loc = await checkLocationAgainstBranch(input.branchId, Number(body.lat), Number(body.lng));
    const row = {
      profile_id: input.userId,
      attendance_date: today,
      status: "present",
      client_action_id: input.item.clientUuid,
      check_in_at: new Date().toISOString(),
      check_in_lat: Number(body.lat),
      check_in_lng: Number(body.lng),
      check_in_distance_meters: loc.distanceMeters,
      check_in_location_ok: loc.withinRadius,
      notes: "Mobile app check-in",
    };
    let inserted = await db.from("attendance_records").insert({ ...row, source: "app" });
    if (inserted.error && /source|check constraint/i.test(inserted.error.message)) {
      inserted = await db.from("attendance_records").insert({ ...row, source: "web" });
    }
    if (inserted.error?.code === "23505") return { ok: true };
    if (inserted.error) return { ok: false, error: inserted.error.message };
    return { ok: true };
  }

  if (checked.kind === "meter" || checked.kind === "petrol") {
    const vehicle = await vehicleForStaff(input.userId);
    if (!vehicle) return { ok: false, error: "Is bande par koi gaari assign nahi." };
    const mime = String(body.photo_mime ?? "image/jpeg");
    const photo = await savePhoto(METER_BUCKET, `${aajKaKhana()}/${input.userId}/${input.item.clientUuid}.jpg`, String(body.photo_base64), mime);
    if ("error" in photo) return { ok: false, error: photo.error };
    if (checked.kind === "meter") {
      const result = await recordOpening(vehicle, input.userId, input.branchId, Number(body.km), { photoPath: photo.path });
      if ("error" in result) return { ok: false, error: result.error };
      return { ok: true };
    }
    const rates = await db.from("fuel_rate_settings").select("petrol_rate, margin").limit(1).maybeSingle();
    const locked = lockedFuelRate(rates.data?.petrol_rate, rates.data?.margin, body.rate == null ? null : Number(body.rate));
    if ("error" in locked) return { ok: false, error: locked.error };
    const liters = Number(body.liters);
    const amount = Math.round(liters * locked.rate * 100) / 100;
    const result = await recordFuel(
      vehicle,
      input.userId,
      input.branchId,
      { liters, ratePerLiter: locked.rate, amount, receiptPath: photo.path },
      { photoPath: photo.path }
    );
    if ("error" in result) return { ok: false, error: result.error };
    return { ok: true };
  }

  if (checked.kind === "pickup") {
    const result = await recordCollection({
      farmerId: typeof body.farmer_id === "string" ? body.farmer_id : null,
      farmerCode: typeof body.farmer_code === "string" ? body.farmer_code : null,
      liters: Number(body.liters),
      lr: body.lr == null || body.lr === "" ? null : Number(body.lr),
      shift: typeof body.shift === "string" ? body.shift : undefined,
      collectedAt: typeof body.collected_at === "string" ? body.collected_at : new Date().toISOString(),
      channel: "app",
      clientUuid: input.item.clientUuid,
      mcaProfileId: input.userId,
      branchId: input.branchId,
      routeName: input.routeName,
      chillerName: input.chillerName,
      lrImage: body.photo_base64 ? { base64: String(body.photo_base64), mimeType: String(body.photo_mime ?? "image/jpeg") } : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    if ("error" in result) return { ok: false, error: result.error };
    return { ok: true };
  }

  if (checked.kind === "drop") {
    const existing = await db.from("milk_route_collections").select("id").eq("client_uuid", input.item.clientUuid).maybeSingle();
    if (!existing.error && existing.data) return { ok: true };
    const settings = await db.from("milk_rate_settings").select("shortage_alert_threshold").limit(1).maybeSingle();
    const thresholds = resolveThresholds(settings.data);
    const field = Number(body.field_liters ?? body.liters);
    const variance = dropVariance(field, Number(body.liters), thresholds.shortagePct);
    if ("error" in variance) return { ok: false, error: variance.error };
    const row: Record<string, unknown> = {
      route_name: input.routeName || String(body.route_name ?? "Bagair route"),
      branch_id: input.branchId,
      rider_name: input.fullName,
      collection_date: aajKaKhana(),
      shift: body.shift === "evening" ? "evening" : "morning",
      field_collected_volume: field,
      chiller_received_volume: Number(body.liters),
      shortage_liters: variance.shortageLiters,
      shortage_percentage: variance.shortagePercentage,
      is_red_alert: variance.isRedAlert,
      variance_kind: variance.varianceKind,
      notes: `app:${input.item.clientUuid}`,
      created_by: input.userId,
      client_uuid: input.item.clientUuid,
    };
    let inserted = await db.from("milk_route_collections").insert(row);
    if (inserted.error && /client_uuid|schema cache|Could not find/i.test(inserted.error.message)) {
      delete row.client_uuid;
      const prior = await db.from("milk_route_collections").select("id").eq("notes", row.notes).maybeSingle();
      if (prior.data) return { ok: true };
      inserted = await db.from("milk_route_collections").insert(row);
    }
    if (inserted.error) return { ok: false, error: inserted.error.message };
    return { ok: true };
  }

  if (checked.kind === "fat") {
    const entry = await db.from("milk_entries").select("id, created_by, mca_profile_id, lr, status").eq("id", body.entry_id).maybeSingle();
    if (!entry.data) return { ok: false, error: "Entry nahi mili." };
    const blocked = fatActorError(input.userId, entry.data);
    if (blocked) return { ok: false, error: blocked };
    if (entry.data.lr == null && body.lr != null) {
      const updated = await db.from("milk_entries").update({ lr: Number(body.lr) }).eq("id", entry.data.id).eq("status", "pending_fat");
      if (updated.error) return { ok: false, error: updated.error.message };
    }
    const result = await applyFat(String(body.entry_id), Number(body.fat), input.userId, { allowOverride: false });
    if ("error" in result) return { ok: false, error: result.error };
    return { ok: true };
  }

  if (checked.kind === "feedback") {
    const ctx = (body.context && typeof body.context === "object" ? body.context : {}) as Record<string, unknown>;
    const filed = await fileMobileReport({
      userId: input.userId,
      organizationId: input.organizationId,
      fullName: input.fullName,
      text: String(body.text ?? ""),
      context: {
        screen: String(ctx.screen ?? "unknown"),
        route: String(ctx.route ?? "/"),
        userId: input.userId,
        role: input.role,
        appRole: String(ctx.appRole ?? ""),
        deviceModel: String(ctx.deviceModel ?? ""),
        os: String(ctx.os ?? ""),
        appVersion: String(ctx.appVersion ?? PRODUCT_VERSION),
        network: String(ctx.network ?? ""),
        channel: String(ctx.channel ?? ""),
      },
      screenshotBase64: typeof body.photo_base64 === "string" ? body.photo_base64 : null,
      screenshotMime: typeof body.photo_mime === "string" ? body.photo_mime : null,
      voiceBase64: typeof body.voice_base64 === "string" ? body.voice_base64 : null,
      voiceMime: typeof body.voice_mime === "string" ? body.voice_mime : null,
    });
    if (!filed.ok) return filed;
    return { ok: true };
  }

  return { ok: false, error: "Qisam sahi nahi." };
}

export async function syncMobile(input: {
  userId: string;
  userClient: SupabaseClient;
  items: OutboxItem[];
  since: string | null;
}) {
  const db = service();
  const { data: profile } = await db.from("profiles").select("id, full_name, role, organization_id, branch_id, is_active").eq("id", input.userId).maybeSingle();
  if (!profile?.is_active) return { error: "Ye account fa'aal nahi hai.", status: 403 as const };

  let fieldAppRole: string | null = null;
  let designation: string | null = null;
  let routeName: string | null = null;
  let chillerName: string | null = null;
  const staff = await db.from("staff_details").select("designation, milk_route_name, milk_chiller_name, field_app_role").eq("profile_id", input.userId).maybeSingle();
  if (!staff.error && staff.data) {
    fieldAppRole = staff.data.field_app_role ?? null;
    designation = staff.data.designation ?? null;
    routeName = staff.data.milk_route_name ?? null;
    chillerName = staff.data.milk_chiller_name ?? null;
  } else if (staff.error) {
    const again = await db.from("staff_details").select("designation, milk_route_name, milk_chiller_name").eq("profile_id", input.userId).maybeSingle();
    designation = again.data?.designation ?? null;
    routeName = again.data?.milk_route_name ?? null;
    chillerName = again.data?.milk_chiller_name ?? null;
  }

  const appRole: AppRole = appRoleFor({ role: profile.role, designation, fieldAppRole });
  const actor = {
    userId: input.userId,
    role: String(profile.role),
    appRole,
    organizationId: profile.organization_id as string,
    fullName: String(profile.full_name ?? "User"),
    branchId: (profile.branch_id as string | null) ?? null,
    routeName,
    chillerName,
  };

  const pending = await db.from("mobile_sync_inbox").select("client_uuid, kind, payload, created_at, error").eq("profile_id", input.userId).in("status", ["stored", "failed"]).limit(30);
  const inboxReady = !pending.error;
  const queued: OutboxItem[] = inboxReady
    ? (pending.data ?? []).map((row: any) => ({
        clientUuid: row.client_uuid,
        kind: row.kind,
        payload: row.payload ?? {},
        createdAt: row.created_at,
        error: row.error,
      }))
    : [];

  const seen = new Set(queued.map((item) => item.clientUuid));
  const incoming = input.items.filter((item) => isUuid(item.clientUuid) && !seen.has(item.clientUuid));
  const results: { clientUuid: string; ok: boolean; error?: string }[] = [];

  for (const item of [...queued.filter((item) => !item.error), ...incoming]) {
    const durable = await rememberInbox(input.userId, item);
    const applied = await applyOutboxItem({ ...actor, item });
    if (durable) await markInbox(input.userId, item.clientUuid, applied.ok ? "applied" : "failed", applied.ok ? null : applied.error);
    results.push({ clientUuid: item.clientUuid, ok: applied.ok, error: applied.ok ? undefined : applied.error });
  }

  const settingsRow = await db.from("milk_rate_settings").select("standard_rate, self_dropoff_incentive, snf_constant, reference_ts, shortage_alert_threshold, fat_min, fat_max, lr_min, lr_max, snf_alert_low, snf_alert_high").limit(1).maybeSingle();
  const settingsParsed = settingsOrError(settingsRow.data);
  const settings = "error" in settingsParsed ? null : settingsParsed;
  const thresholds = resolveThresholds(settingsRow.error ? null : settingsRow.data);

  let milk: ReturnType<typeof toMilkNotice>[] = [];
  let statement = null as ReturnType<typeof weeklyStatement> | null;
  let khata = null as unknown;
  if (appRole === "farmer" || appRole === "customer") {
    const farmer = await input.userClient.from("farmers").select("id").eq("user_id", input.userId).maybeSingle();
    if (farmer.data?.id) {
      let query = input.userClient.from("milk_entries").select("id, collected_at, entry_date, shift, quantity_liters, fat_percentage, lr, rate_per_liter, total_amount, mca_profile_id, collection_number").eq("farmer_id", farmer.data.id).order("collected_at", { ascending: false }).limit(20);
      if (input.since) query = query.gt("collected_at", input.since);
      const rows = await query;
      const ids = [...new Set((rows.data ?? []).map((row) => row.mca_profile_id).filter(Boolean))] as string[];
      const names = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const nameOf = new Map<string, string | null>();
      for (const row of (names.data ?? []) as { id: string; full_name: string | null }[]) {
        nameOf.set(row.id, row.full_name);
      }
      milk = (rows.data ?? []).map((row) => toMilkNotice({
        ...row,
        collector: row.mca_profile_id ? nameOf.get(row.mca_profile_id) ?? null : null,
      }, settings));
    }
    const week = karachiWeek();
    const summary = await (input.userClient as any).rpc("fn_my_khata_summary", {});
    const lines = await (input.userClient as any).rpc("fn_my_khata_statement", { p_from: week.start, p_to: week.end });
    khata = summary.data ?? null;
    statement = weeklyStatement(parseStatement(lines.data), milk.map((row) => ({ entry_date: row.at, liters: row.liters, amount: row.amount })), week);
  }

  let pendingFat: unknown[] = [];
  let totals = null as ReturnType<typeof shiftTotals> | null;
  if (appRole === "mco" || appRole === "mca" || appRole === "admin") {
    const today = aajKaKhana();
    let fatQuery = db.from("milk_entries").select("id, farmer_id, collection_number, quantity_liters, lr, shift, route_name, chiller_name, mca_profile_id, created_by, status").eq("status", "pending_fat").eq("entry_date", today).order("collected_at", { ascending: false }).limit(20);
    let pricedQuery = db.from("milk_entries").select("shift, quantity_liters, total_amount").eq("entry_date", today).limit(500);
    if (appRole === "mca") {
      fatQuery = fatQuery.eq("mca_profile_id", input.userId);
      pricedQuery = pricedQuery.eq("mca_profile_id", input.userId);
    } else if (appRole === "mco") {
      if (chillerName) {
        fatQuery = fatQuery.eq("chiller_name", chillerName);
        pricedQuery = pricedQuery.eq("chiller_name", chillerName);
      } else if (routeName) {
        fatQuery = fatQuery.eq("route_name", routeName);
        pricedQuery = pricedQuery.eq("route_name", routeName);
      } else {
        fatQuery = fatQuery.eq("created_by", input.userId);
        pricedQuery = pricedQuery.eq("created_by", input.userId);
      }
    }
    const fatRows = await fatQuery;
    pendingFat = fatRows.data ?? [];
    const priced = await pricedQuery;
    totals = shiftTotals((priced.data ?? []).map((row: { shift: string | null; quantity_liters: number; total_amount: number | null }) => ({
      shift: row.shift,
      liters: Number(row.quantity_liters ?? 0),
      amount: row.total_amount == null ? null : Number(row.total_amount),
    })));
  }

  const whatsapp = await readSupportWhatsapp();
  return {
    status: 200 as const,
    body: {
      version: PRODUCT_VERSION,
      appRole,
      portalRole: profile.role,
      routeName,
      chillerName,
      durableInbox: inboxReady,
      results,
      milk,
      khata,
      statement,
      pendingFat,
      totals,
      settings,
      thresholds,
      support: {
        chat: supportChatPath(String(profile.role)),
        whatsapp,
      },
    },
  };
}
