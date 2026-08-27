import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Sprout, Landmark, Tractor, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeProfileCompletion } from "@/lib/utils/farmer-profile";

export default async function FarmerDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase.from("farmers").select("*").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");

  const completion = computeProfileCompletion(farmer);

  // Which service categories has this farmer already opted into? Used
  // to show "View / Add another request" instead of "Get started" for
  // categories they've already touched.
  const { data: categories } = await supabase.from("service_categories").select("category").eq("farmer_id", farmer.id);
  const activeCategories = new Set((categories ?? []).map((c) => c.category));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        ← Back to Website
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">
        Welcome{farmer.full_name ? `, ${farmer.full_name}` : ""}
      </h1>
      <p className="mt-1 text-surface-500">Farmer Code: {farmer.farmer_code}</p>

      {completion.isComplete ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Your profile is complete.
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Your profile is incomplete. Complete it to unlock full features.
        </div>
      )}

      <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-surface-700">Profile Completion</span>
          <span className="text-sm font-semibold text-brand-700">{completion.percent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-100">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${completion.percent}%` }} />
        </div>
        {!completion.isComplete && (
          <Link
            href="/portal/profile"
            className="mt-4 block rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
          >
            Complete your profile to apply for loans
          </Link>
        )}
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold text-surface-900">Services</h2>
      <p className="mt-1 text-sm text-surface-500">Request machinery, fertilizer, or a livestock loan — pick whichever you need.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ServiceCard
          icon={<Tractor className="h-5 w-5" />}
          title="Machinery Rental"
          href="/portal/services/machinery"
          active={activeCategories.has("machinery")}
        />
        <ServiceCard
          icon={<Sprout className="h-5 w-5" />}
          title="Fertilizer Credit"
          href="/portal/services/fertilizer"
          active={activeCategories.has("fertilizer")}
        />
        <ServiceCard
          icon={<Landmark className="h-5 w-5" />}
          title="Livestock Loan"
          href="/portal/services/livestock"
          active={activeCategories.has("livestock")}
        />
      </div>
    </div>
  );
}

function ServiceCard({ icon, title, href, active }: { icon: React.ReactNode; title: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="group rounded-card border border-surface-200 bg-white p-4 text-center shadow-card transition hover:border-brand-300 hover:shadow-md dark:bg-surface-900"
    >
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-surface-800">
        {icon}
      </div>
      <p className="text-xs font-medium text-surface-700">{title}</p>
      {active ? (
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-green-600">Request submitted</p>
      ) : (
        <p className="mt-1 flex items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600 group-hover:underline">
          Get started <ArrowRight className="h-2.5 w-2.5" />
        </p>
      )}
    </Link>
  );
}
