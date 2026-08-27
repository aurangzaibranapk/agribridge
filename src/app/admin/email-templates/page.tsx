import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { TemplatesClient } from "./templates-client";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const supabase = createClient();
  const { data: saved } = await supabase.from("email_templates").select("template_key, subject, body_html");
  const savedMap = new Map((saved ?? []).map((t) => [t.template_key, t]));

  const templates = EMAIL_TEMPLATE_DEFAULTS.map((d) => {
    const custom = savedMap.get(d.key);
    return {
      key: d.key,
      name: d.name,
      subject: custom?.subject ?? d.subject,
      body: custom?.body_html ?? d.body,
    };
  });

  return (
    <div>
      <PageHeader title="Email Templates" description="Wording, greeting, aur signature khud edit karein - bina developer ke" />
      <TemplatesClient templates={templates} />
    </div>
  );
}