import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { TemplatesClient } from "./templates-client";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email";
import { mailboxStatus } from "@/lib/mailer";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const lang = getLanguageFromCookies("rm");
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

  // Kaun se mehkame ki mail apne pate se ja rahi hai, aur kaun si abhi
  // purane sanjhe khate se. Ye sawal setup ke waqt bar bar aata hai aur
  // is ka jawab andaze se nahi milta -- server khud batata hai.
  const boxes = mailboxStatus();

  return (
    <div>
      <PageHeader title={t("at_email_templates", lang)} description="Wording, greeting, aur signature khud edit karein - bina developer ke" />

      <div className="mb-5 overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <p className="font-display text-sm font-semibold text-surface-900 dark:text-white">
            Kis mehkame ki mail kis pate se jati hai
          </p>
          <p className="mt-0.5 text-xs text-surface-500">
            Jis mehkame ka apna mailbox abhi nahi bana, us ki mail purane khate se jati hai — mail rukti nahi.
            Mailbox cPanel mein bana kar us ka user aur password server ke env mein daalein, kaam khud badal jayega.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left dark:border-surface-800">
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">Mehkama</th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">Hona chahiye</th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">Abhi ja rahi hai</th>
              </tr>
            </thead>
            <tbody>
              {boxes.map((b) => (
                <tr key={b.dept} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-2 font-medium capitalize text-surface-800 dark:text-surface-200">{b.dept}</td>
                  <td className="px-4 py-2 font-mono text-xs text-surface-600 dark:text-surface-400">{b.chahiye}</td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs text-surface-800 dark:text-surface-200">{b.chal_raha}</span>
                    {b.apna_box ? (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        apna pata
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        purana khata
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TemplatesClient templates={templates} />
    </div>
  );
}