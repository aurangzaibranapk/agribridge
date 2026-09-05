"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveCompanySignature, sendSigningLinkEmail, type ActionState } from "@/actions/shop-rent";
import { SignaturePad } from "@/components/ui/signature-pad";
import { Printer, Copy, Mail, CheckCircle2, PenTool } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};
const SITE_URL = "https://alranatraders.pk";

export function AgreementAdminActions({
  agreementId,
  signingToken,
  hasCompanySignature,
  hasLandlordSignature,
}: {
  agreementId: string;
  signingToken: string;
  hasCompanySignature: boolean;
  hasLandlordSignature: boolean;
}) {
  const [showSign, setShowSign] = useState(false);
  const lang = useLang();
  const [showEmail, setShowEmail] = useState(false);
  const signingLink = `${SITE_URL}/agreement-sign/${signingToken}`;

  function copyLink() {
    navigator.clipboard.writeText(signingLink);
    alert("Link copy ho gaya!");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <div className="flex items-center gap-1.5 rounded-lg bg-surface-50 px-3 py-2 text-xs dark:bg-surface-800">
        <span className={hasCompanySignature ? "text-green-600" : "text-amber-600"}>
          {hasCompanySignature ? "✓ Company Signed" : "○ Company Baaqi"}
        </span>
        <span className="text-surface-300">|</span>
        <span className={hasLandlordSignature ? "text-green-600" : "text-amber-600"}>
          {hasLandlordSignature ? "✓ Landlord Signed" : "○ Landlord Baaqi"}
        </span>
      </div>

      {!hasCompanySignature && (
        <button onClick={() => setShowSign(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700">
          <PenTool className="h-3.5 w-3.5" />{t("ag_company_sign_btn", lang)}</button>
      )}
      <button onClick={copyLink} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-xs font-medium text-surface-600 hover:bg-surface-50">
        <Copy className="h-3.5 w-3.5" />{t("ag_copy_link", lang)}</button>
      <button onClick={() => setShowEmail(true)} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-xs font-medium text-surface-600 hover:bg-surface-50">
        <Mail className="h-3.5 w-3.5" />{t("ag_email_link_btn", lang)}</button>
      <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-xs font-medium text-surface-600 hover:bg-surface-50">
        <Printer className="h-3.5 w-3.5" />{t("c_print", lang)}</button>

      {showSign && <CompanySignModal agreementId={agreementId} onClose={() => setShowSign(false)} />}
      {showEmail && <EmailLinkModal agreementId={agreementId} onClose={() => setShowEmail(false)} />}
    </div>
  );
}

function CompanySignModal({ agreementId, onClose }: { agreementId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(saveCompanySignature, initialState);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  if (state.success) setTimeout(() => window.location.reload(), 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-xl">
        <h3 className="mb-3 font-display text-base font-semibold text-surface-900">{t("ag_company_sign", lang)}</h3>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction}>
          <input type="hidden" name="agreement_id" value={agreementId} />
          <input type="hidden" name="signature_data" value={signatureData ?? ""} />
          <SignaturePad onChange={setSignatureData} />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 py-2 text-sm text-surface-600 hover:bg-surface-50">{t("c_cancel", lang)}</button>
            <SubmitButton disabled={!signatureData} label={t("ag_save_sign", lang)} />
          </div>
        </form>
      </div>
    </div>
  );
}

function EmailLinkModal({ agreementId, onClose }: { agreementId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(sendSigningLinkEmail, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <h3 className="mb-3 font-display text-base font-semibold text-surface-900">{t("ag_email_link", lang)}</h3>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700"><CheckCircle2 className="h-3.5 w-3.5" />{t("c_email_sent", lang)}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="agreement_id" value={agreementId} />
          <input type="email" name="to_email" required placeholder={t("ag_landlord_email", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 py-2 text-sm text-surface-600 hover:bg-surface-50">{t("c_cancel", lang)}</button>
            <SubmitButton disabled={false} label={t("c_send", lang)} />
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40">
      {pending ? "..." : label}
    </button>
  );
}