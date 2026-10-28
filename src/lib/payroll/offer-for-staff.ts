/* eslint-disable @typescript-eslint/no-explicit-any */
import { offerTotal } from "./salary-offer";

export interface StaffOffer {
  offer: any;
  applicationId: string;
  expected: number | null;
  firstTotal: number | null;
  acceptedTotal: number | null;
}

/**
 * 691: Staff ki qubool shuda offer -- pehle staff_details.offer_id / application_id,
 * warna job_applications.created_profile_id (070) se. Migration se pehle bhi chalta hai.
 */
export async function acceptedOfferForStaff(sb: any, profileId: string): Promise<StaffOffer | null> {
  const { data: sd } = await sb.from("staff_details").select("*").eq("profile_id", profileId).maybeSingle();
  let appId: string | null = sd?.application_id ?? null;
  if (!appId && sd?.offer_id) {
    const { data: o } = await sb.from("job_offers").select("application_id").eq("id", sd.offer_id).maybeSingle();
    appId = o?.application_id ?? null;
  }
  if (!appId) {
    const { data: a } = await sb.from("job_applications").select("id").eq("created_profile_id", profileId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    appId = a?.id ?? null;
  }
  if (!appId) return null;
  const [{ data: app }, { data: offers }] = await Promise.all([
    sb.from("job_applications").select("id, expected_salary").eq("id", appId).maybeSingle(),
    sb.from("job_offers").select("*").eq("application_id", appId).order("created_at", { ascending: true }),
  ]);
  const list: any[] = offers ?? [];
  const accepted = (sd?.offer_id && list.find((o) => o.id === sd.offer_id && o.status === "accepted")) || [...list].reverse().find((o) => o.status === "accepted");
  if (!accepted) return null;
  return {
    offer: accepted,
    applicationId: appId,
    expected: app?.expected_salary != null ? Number(app.expected_salary) : null,
    firstTotal: offerTotal(list[0]),
    acceptedTotal: accepted.accepted_total != null ? Number(accepted.accepted_total) : offerTotal(accepted),
  };
}
