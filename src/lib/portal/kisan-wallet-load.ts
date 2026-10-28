import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loadKhata } from "./khata-load";
import { buildWalletV2, type BookingRow, type FarmerCardRow, type WalletV2Data } from "./kisan-wallet";
import { KISAN_SCAN_PATH, kisanQrSecret, signKisanQr } from "./kisan-qr";
import { encodeQr, qrSvgPath } from "@/lib/qr/qr-encode";
import { withdrawLink } from "@/lib/glass/glass";

/**
 * Kisan Wallet v2 ka data -- SIRF kisan ke apne session (RLS) se.
 * Har query apne farmer.id par; service client istemal nahi hota.
 * Koi likhai (write) nahi.
 */
export async function loadKisanWalletV2(farmerId: string): Promise<{ data: WalletV2Data; qr: { path: string; view: number } | null; links: { khata: string; pay: string; order: string; classic: string; statement: string; withdraw: string } } | null> {
  const sb = createClient();
  const { data: farmer } = await sb
    .from("farmers")
    .select("id, full_name, farmer_code, profile_photo_url, member_photo_url, created_at, credit_limit, whatsapp_number, phone_number")
    .eq("id", farmerId)
    .maybeSingle();
  if (!farmer) return null;
  const loose = sb as unknown as { from: (t: string) => any };
  const [khata, balRes, bookRes] = await Promise.all([
    loadKhata(null, null),
    loose.from("v_farmer_combined_balance").select("total_baqi").eq("farmer_id", farmerId).maybeSingle().then((r: any) => r, () => ({ data: null })),
    sb.from("campaign_bookings").select("acres, status, created_at, campaign_id").eq("farmer_id", farmerId).order("created_at", { ascending: false }).limit(5),
  ]);
  const books = (bookRes.data ?? []) as Array<{ acres: number; status: string; created_at: string; campaign_id: string }>;
  const campIds = Array.from(new Set(books.map((b) => b.campaign_id)));
  const { data: camps } = campIds.length
    ? await sb.from("booking_campaigns").select("id, name, crop, is_active").in("id", campIds)
    : { data: [] as Array<{ id: string; name: string; crop: string; is_active: boolean }> };
  const bookings: BookingRow[] = books.map((b) => ({ ...b, campaign: (camps ?? []).find((c) => c.id === b.campaign_id) ?? null }));
  const tb = balRes?.data?.total_baqi;

  const data = buildWalletV2({
    farmer: farmer as FarmerCardRow,
    totalBaqi: tb == null ? null : Number(tb),
    summaryOwed: khata.summary?.owed ?? null,
    summaryCreditLimit: khata.summary?.credit_limit ?? null,
    rows: khata.rows,
    bookings,
  });

  let qr: { path: string; view: number } | null = null;
  const secret = kisanQrSecret();
  if (secret) {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "https";
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (host ? `${proto}://${host}` : "");
    qr = qrSvgPath(encodeQr(`${base}${KISAN_SCAN_PATH}?t=${signKisanQr(farmerId, secret)}`));
  }
  return {
    data,
    qr,
    links: { khata: "/portal/wallet?look=classic#statement", pay: "/portal/wallet?look=classic#adaigi", order: "/portal/orders", classic: "/portal/wallet?look=classic", statement: "/portal/wallet/statement", withdraw: withdrawLink(data.code) },
  };
}
