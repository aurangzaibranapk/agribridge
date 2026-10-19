"use client";
import { PortalError } from "@/components/portal/route-states";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortalError error={error} reset={reset} homeHref="/admin/customer-portal" titleKey="ph6_err_title_admin" />;
}
