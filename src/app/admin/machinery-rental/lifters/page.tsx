import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { LiftersClient } from "./lifters-client";

export const dynamic = "force-dynamic";

/**
 * Fasal uthane wale -- arhti aur beopari.
 *
 * Ye `suppliers` se alag fehrist hai, aur jaan boojh kar. Suppliers wo
 * hain jin se HUM maal khareedte hain -- un ke khate mein hamesha "hum
 * ne dena" hota hai. Uthane wale ke khate mein "us ne dena" hota hai.
 * Do ulte hisaab ek jagah rakhne ka anjaam wohi hai jo migration 107
 * mein likha hai: bees ka lena aur bees ka dena aapas mein kat kar sifar
 * dikhata hai, aur kisi ko nazar nahi aata ke kis se lena hai.
 */
export default async function LiftersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: lifters }, { data: balances }] = await Promise.all([
    supabase
      .from("crop_lifters")
      .select("id, name, contact_person, phone, cnic, village, address, commission_rate, is_active, notes")
      .order("is_active", { ascending: false })
      .order("name"),
    supabase.from("v_crop_lifter_balances").select("*"),
  ]);

  const balBy = new Map(
    (balances ?? []).map((b: any) => [
      b.lifter_id as string,
      {
        kattai: Number(b.kattai_ka_zimma ?? 0),
        purana: Number(b.purana_baqi_ka_zimma ?? 0),
        commission: Number(b.commission_bana ?? 0),
        diya: Number(b.diya ?? 0),
        baqi: Number(b.baqi ?? 0),
        bookings: Number(b.uthai_hui_bookings ?? 0),
      },
    ])
  );

  const rows = (lifters ?? []).map((l: any) => ({
    ...l,
    commission_rate: Number(l.commission_rate),
    ...(balBy.get(l.id) ?? { kattai: 0, purana: 0, commission: 0, diya: 0, baqi: 0, bookings: 0 }),
  }));

  const kulBaqi = rows.reduce((s, r) => s + r.baqi, 0);
  const chalu = rows.filter((r) => r.is_active).length;

  return (
    <div>
      <PageHeader
        title={t("ar_title", lang)}
        description={t("ar_subtitle", lang)}
      />

      <div className="mb-4">
        <Link
          href="/admin/machinery-rental/lifters/dashboard"
          className="text-sm font-medium text-brand-600 hover:underline"
        >{t("ar_board_link", lang)}</Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("ar_active", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{chalu}</p>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-xs font-medium uppercase tracking-wide text-red-600">{t("ar_to_collect", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-red-700">Rs {kulBaqi.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("ar_lifted_bookings", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
            {rows.reduce((s, r) => s + r.bookings, 0)}
          </p>
        </Card>
      </div>

      <LiftersClient rows={rows} lang={lang} />
    </div>
  );
}
