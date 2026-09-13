"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveEmailTemplate, type ActionState } from "@/actions/email-templates";
import { Mail } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Template {
  key: string;
  name: string;
  subject: string;
  body: string;
}

export function TemplatesClient({ templates }: { templates: Template[] }) {
  const lang = useLang();
  const [selectedKey, setSelectedKey] = useState(templates[0]?.key ?? "");
  const selected = templates.find((t) => t.key === selectedKey);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
          <Mail className="h-4 w-4" />{t("at_templates", lang)}</h2>
        <div className="space-y-1">
          {templates.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelectedKey(t.key)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                selectedKey === t.key ? "bg-brand-600 text-white" : "text-surface-700 hover:bg-surface-50 dark:text-surface-300"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selected && <TemplateForm key={selected.key} template={selected} />}
      </div>
    </div>
  );
}

function TemplateForm({ template }: { template: Template }) {
  const lang = useLang();
  const [state, formAction] = useFormState(saveEmailTemplate, initialState);

  return (
    <form action={formAction} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <input type="hidden" name="template_key" value={template.key} />
      <input type="hidden" name="template_name" value={template.name} />
      <h2 className="mb-1 text-sm font-semibold text-surface-900 dark:text-white">{template.name}</h2>
      <p className="mb-3 text-xs text-surface-400">
        Placeholders use karein: {"{{fullName}}"} {"{{jobTitle}}"} {"{{interviewDate}}"} {"{{designation}}"} {"{{link}}"} {"{{applicationId}}"} {"{{date}}"}
      </p>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("at_template_saved", lang)}</p>}
      <div className="space-y-2">
        <div>
          <label className="text-xs font-medium text-surface-600">{t("at_subject", lang)}</label>
          <input name="subject" defaultValue={template.subject} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">{t("at_body_html", lang)}</label>
          <textarea name="body_html" defaultValue={template.body} required rows={12} className="mt-1 w-full rounded-lg border border-surface-200 p-2 font-mono text-xs" />
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="mt-3 w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Template Save Karein"}</button>;
}