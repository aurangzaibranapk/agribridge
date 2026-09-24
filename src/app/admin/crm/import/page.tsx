import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

/**
 * Purane khata-app (jaise DigiKhata) se customers import karne ka safha.
 *
 * Malik (13 September): list bhejenge, main draft mein daalta hoon, wo
 * review kar ke khud "Submit" dabayenge. Isi liye ye sirf admin/owner ke
 * liye hai -- ye ek-dafa ka setup kaam hai, staff ki roz ki jagah nahi.
 */
export default async function CustomerImportPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const sabKuchWala = UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));

  if (!sabKuchWala) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600 dark:text-surface-400">Ye safha sirf admin/owner ke liye hai.</p>
      </div>
    );
  }

  const { data: drafts } = await supabase
    .from("customer_import_drafts")
    .select("id, name, phone_number, opening_balance, status, imported_customer_id, created_at")
    .order("created_at", { ascending: false });

  const pending = (drafts ?? []).filter((d) => d.status === "pending");
  const decided = (drafts ?? []).filter((d) => d.status !== "pending");

  return (
    <div>
      <PageHeader
        title="Purane Customers Import Karein"
        description="DigiKhata (ya kisi bhi purani jagah) ki list yahan paste karein — pehle draft mein aati hai, review/edit ke baad hi asal customer aur khata banta hai."
      />
      <ImportClient pending={pending} decided={decided} />
    </div>
  );
}
