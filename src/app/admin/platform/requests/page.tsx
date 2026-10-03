import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SignupRequestActions } from "./signup-request-actions";

export const dynamic = "force-dynamic";

export default async function PlatformRequestsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") return <div className="mx-auto max-w-lg px-4 py-16 text-center">Super Admin only</div>;
  const serviceClient = createServiceClient();
  const { data: requests } = await serviceClient.from("organization_signup_requests").select("id, company_name, admin_name, admin_email, admin_phone, custom_domain, subscription_plan, status, created_at").order("created_at", { ascending: false });
  return <div className="mx-auto max-w-5xl space-y-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">SaaS onboarding</p><h1 className="font-display text-2xl font-bold">Organization Requests</h1></div><Link href="/admin/platform" className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-bold">Back to Platform</Link></div><div className="space-y-3">{(requests ?? []).map((request) => <div key={request.id} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-bold">{request.company_name}</h2><p className="mt-1 text-sm text-surface-500">{request.admin_name} · {request.admin_email}{request.admin_phone ? ` · ${request.admin_phone}` : ""}</p><p className="mt-1 text-xs text-surface-400">{request.subscription_plan} · {request.custom_domain || "No custom domain"} · {new Date(request.created_at).toLocaleString()}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-bold uppercase">{request.status}</span>{request.status === "pending" && <SignupRequestActions requestId={request.id} />}</div></div></div>)}{(!requests || requests.length === 0) && <div className="rounded-2xl border border-dashed border-surface-300 p-10 text-center text-sm text-surface-500">No organization requests yet.</div>}</div></div>;
}
