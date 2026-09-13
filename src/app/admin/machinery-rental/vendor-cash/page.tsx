import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { VendorCashClient } from "./vendor-cash-client";

export const dynamic = "force-dynamic";

/**
 * Vendor ke paas para hua hamara paisa.
 *
 * Kisan ne paisa machine wale ke haath mein diya aur us ne "hamein de
 * dunga" kaha. Kisan ka hisaab usi waqt barabar ho gaya tha -- ye us se
 * agla sawal hai: wo paisa hum tak kab pohancha?
 *
 * Ye safha vendor ke hisaab se hai, booking ke hisaab se nahi: ek vendor
 * teen bookings ka paisa ek sath laata hai, aur us waqt koi ye nahi
 * poochhta ke kaun si booking ka kaun sa note hai.
 */
export default async function VendorCashPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: rows }, { data: accounts }] = await Promise.all([
    supabase.from("v_vendor_holding_our_cash").select("*").order("sab_se_purani"),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("fm_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("vc_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("vc_subtitle", lang)}</p>
      </div>

      <VendorCashClient
        vendors={(rows ?? []).map((r) => ({
          vendorId: r.vendor_id as string,
          vendorName: r.vendor_name as string,
          phone: r.phone as string | null,
          holding: Number(r.vendor_ke_paas),
          oldest: r.sab_se_purani as string | null,
          count: Number(r.kitni_payments),
        }))}
        accounts={accounts ?? []}
      />
    </div>
  );
}
