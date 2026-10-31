"use client";

import { useState } from "react";
import { Mail, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import { certificateShareMessage, emailShareHref, whatsAppShareHref } from "@/lib/milk-handover";

export function CertificatePrintBar({
  lang,
  editHref,
  printHref,
  shareText,
  emailSubject,
}: {
  lang: Lang;
  editHref?: string;
  /** Saved form par Print isi slip par le jata hai. Print safhe par window.print(). */
  printHref?: string;
  shareText: string;
  emailSubject: string;
}) {
  const [copied, setCopied] = useState(false);

  function printUrl() {
    const path = printHref ?? `${window.location.pathname}${window.location.search}`;
    return new URL(path, window.location.origin).href;
  }

  function slipBody() {
    return certificateShareMessage(shareText, printUrl());
  }

  function shareWhatsApp() {
    window.open(whatsAppShareHref(slipBody()), "_blank", "noopener,noreferrer");
  }

  function shareEmail() {
    window.location.href = emailShareHref(emailSubject, slipBody());
  }

  function copyLink() {
    const url = printUrl();
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => setCopied(true));
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
      {printHref ? (
        <a href={printHref} data-testid="handover-print" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
          <Printer className="h-4 w-4" /> {t("mh_print_btn", lang)}
        </a>
      ) : (
        <Button type="button" data-testid="handover-print" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> {t("mh_print_btn", lang)}
        </Button>
      )}
      <button type="button" data-testid="handover-whatsapp" onClick={shareWhatsApp} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
        <MessageCircle className="h-4 w-4" /> {t("mh_whatsapp", lang)}
      </button>
      <button type="button" data-testid="handover-email" onClick={shareEmail} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100">
        <Mail className="h-4 w-4" /> {t("mh_email", lang)}
      </button>
      <Button type="button" variant="secondary" onClick={copyLink}>
        {t("mh_link", lang)}
      </Button>
      {copied && <span className="text-xs text-green-700">{t("mh_link_done", lang)}</span>}
      {editHref && (
        <a href={editHref} className="inline-flex h-10 items-center px-2 text-sm text-brand-700 underline">
          {t("mh_back_form", lang)}
        </a>
      )}
    </div>
  );
}
