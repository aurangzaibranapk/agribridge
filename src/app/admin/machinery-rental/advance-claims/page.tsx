import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ClaimsClient } from "./claims-client";

export const dynamic = "force-dynamic";

/**
 * Kisan ke dawe jin ki tasdeeq baqi hai.
 *
 * Ye qatar jaan boojh kar alag safhe par hai. Wajah ye ke ye kisi EK
 * booking ka kaam nahi -- ye finance ka rozana ka kaam hai: subah
 * baith kar dekhna ke raat bhar mein kis kis ne kaha ke paisa bhej
 * diya. Booking ke safhe par para hua dawa us waqt tak nazar nahi aata
 * jab tak koi wo booking na khole.
 *
 * Yahan tak pohanchne wala paisa abhi KAHIN NAHI GINA JA RAHA -- na
 * cash book mein, na kisan ke khate mein, na bill mein. Yehi is qatar
 * ka poora maqsad hai: dawa aur paisa alag rakhna, jab tak koi insaan
 * dono ko mila na de.
 */
export default async function AdvanceClaimsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: claims }, { data: accounts }] = await Promise.all([
    supabase.from("v_machinery_advance_claims").select("*").order("claimed_at"),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("fm_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("ac_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("ac_subtitle", lang)}</p>
      </div>

      <ClaimsClient
        claims={(claims ?? []).map((c) => ({
          paymentId: c.payment_id as string,
          bookingId: c.booking_id as string,
          bookingNumber: c.booking_number as string,
          farmerName: c.farmer_name as string,
          farmerPhone: c.farmer_phone as string | null,
          amount: Number(c.amount),
          method: c.method as string,
          reference: c.reference as string | null,
          proofUrl: c.proof_url as string | null,
          claimedAt: c.claimed_at as string | null,
          daysOld: c.din_purane === null ? null : Number(c.din_purane),
        }))}
        accounts={accounts ?? []}
      />
    </div>
  );
}
