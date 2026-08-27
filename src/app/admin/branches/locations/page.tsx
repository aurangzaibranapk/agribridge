import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { BranchLocationForm } from "./branch-location-form";
import { MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BranchLocationsPage() {
  const supabase = createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, address, latitude, longitude, attendance_radius_meters")
    .eq("is_active", true)
    .order("name");

  const rows = branches ?? [];
  const set = rows.filter((b) => b.latitude && b.longitude).length;

  return (
    <div>
      <PageHeader
        title="Branch Locations (Hazri ke liye)"
        description="Har branch ki jagah darj karein, taake WhatsApp se lagne wali hazri ki tasdeeq ho sake."
      />

      <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
        {set} / {rows.length} branch ki jagah darj hai.
        {set < rows.length && " Jin ki darj nahi, un ki hazri to lagegi magar faasla nahi naapa jayega."}
      </div>

      <Card className="mb-4 p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
          <MapPin className="h-4 w-4" /> Location kaise nikalein
        </h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-surface-600 dark:text-surface-400">
          <li>Google Maps kholein aur apni branch dhoondein</li>
          <li>Branch ki jagah par ungli daba kar rakhein (ya right-click karein)</li>
          <li>Do number nazar aayenge, jaise <span className="font-mono text-xs">31.4504, 73.1350</span></li>
          <li>Pehla number Latitude, doosra Longitude — neeche bhar dein</li>
        </ol>
        <p className="mt-2 text-xs text-surface-500">
          Daira (radius) wo faasla hai jis ke andar hazri &quot;sahi jagah se&quot; mani jayegi. 200 meter aam tor par theek rehta hai —
          chhoti dukan ke liye 100, bare godown ke liye 500.
        </p>
      </Card>

      <div className="space-y-3">
        {rows.map((b) => (
          <BranchLocationForm
            key={b.id}
            branch={{
              id: b.id,
              name: b.name,
              address: b.address,
              latitude: b.latitude ? Number(b.latitude) : null,
              longitude: b.longitude ? Number(b.longitude) : null,
              radius: Number(b.attendance_radius_meters ?? 200),
            }}
          />
        ))}
      </div>
    </div>
  );
}
