import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import Link from "next/link";
import { Check, AlertTriangle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const STAFF_ROLES = [
  "owner", "super_admin", "admin", "admin_assistant", "manager",
  "sales_staff", "finance", "warehouse", "hr", "procurement", "milk_collection",
];

export default async function StaffWhatsAppPage() {
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .in("role", STAFF_ROLES)
    .eq("is_active", true)
    .order("full_name");

  const { data: details } = await supabase
    .from("staff_details")
    .select("profile_id, phone, cnic, whatsapp_number, whatsapp_verified_at");

  const byProfile = new Map((details ?? []).map((d) => [d.profile_id, d]));

  const rows = (profiles ?? []).map((p) => {
    const d = byProfile.get(p.id);
    const hasPhone = !!d?.phone;
    const hasCnic = !!d?.cnic;
    const verified = !!d?.whatsapp_verified_at;

    // Tasdeeq tabhi mumkin hai jab dono cheezein maujood hon: number
    // (jo phone ke qabze ka saboot banta hai) aur CNIC (jo ilm ka).
    const ready = hasPhone && hasCnic;

    return { ...p, phone: d?.phone ?? null, hasCnic, verified, ready, whatsapp: d?.whatsapp_number ?? null };
  });

  const verifiedCount = rows.filter((r) => r.verified).length;
  const readyCount = rows.filter((r) => r.ready && !r.verified).length;
  const missingCount = rows.filter((r) => !r.ready).length;

  return (
    <div>
      <PageHeader
        title="Staff WhatsApp Pehchan"
        description="WhatsApp se hazri lagane ke liye har staff ka phone aur CNIC darj hona zaroori hai."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><Check className="h-3.5 w-3.5 text-green-600" /> Tasdeeq ho chuki</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{verifiedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><Clock className="h-3.5 w-3.5 text-amber-600" /> Tayyar, intezar mein</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{readyCount}</p>
          <p className="text-xs text-surface-500">Staff ko sirf WhatsApp par message karna hai</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Data adhoora</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{missingCount}</p>
          <p className="text-xs text-surface-500">Phone ya CNIC bharna baqi</p>
        </Card>
      </div>

      <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
        Tareeqa: HR page par staff ka <strong>phone</strong> aur <strong>CNIC</strong> bharein. Phir wo staff apne usi number se WhatsApp par
        koi bhi message bhejay — system CNIC ke aakhri 6 hindse poochhega, aur sahi jawab par number hamesha ke liye jur jayega.
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">Naam</th>
              <th className="px-3 py-2 font-medium text-surface-500">Role</th>
              <th className="px-3 py-2 font-medium text-surface-500">Phone</th>
              <th className="px-3 py-2 font-medium text-surface-500">CNIC</th>
              <th className="px-3 py-2 font-medium text-surface-500">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 text-surface-900 dark:text-white">{r.full_name}</td>
                <td className="px-3 py-2 text-surface-500">{r.role.replace(/_/g, " ")}</td>
                <td className="px-3 py-2 font-mono text-xs text-surface-600 dark:text-surface-400">{r.phone ?? <span className="text-red-500">nahi hai</span>}</td>
                <td className="px-3 py-2">{r.hasCnic ? <span className="text-green-600">✓</span> : <span className="text-red-500">nahi hai</span>}</td>
                <td className="px-3 py-2">
                  {r.verified ? (
                    <Badge tone="green">Jur gaya</Badge>
                  ) : r.ready ? (
                    <Badge tone="amber">Intezar mein</Badge>
                  ) : (
                    <Badge tone="red">Data adhoora</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-3 text-sm text-surface-500">
        Phone ya CNIC bharne ke liye <Link href="/admin/hr" className="text-brand-600 hover:underline">HR page</Link> par jayein.
        Branch ki jagah <Link href="/admin/branches/locations" className="text-brand-600 hover:underline">yahan</Link> darj karein.
      </p>
    </div>
  );
}
