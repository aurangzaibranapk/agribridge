"use client";
import { useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { saveIdCardDetails, type ActionState } from "@/actions/staff-id-card";
import { cardMessage, mailtoUrl, whatsAppUrl, type IdCardFields } from "@/lib/hr/id-card-profile";
import { Printer, Download, Mail, MessageCircle, User, Settings } from "lucide-react";
import { t as tr } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Props {
  profileId: string;
  fullName: string;
  designation: string;
  phone: string | null;
  photoUrl: string | null;
  bloodGroup: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  employeeCode: string | null;
  cnic: string | null;
  branchName: string | null;
}

const DESIGNS = [
  { id: "blue", name: "Modern Blue" },
  { id: "navy", name: "Corporate Navy" },
  { id: "green", name: "Agri Green" },
  { id: "white", name: "Minimalist" },
  { id: "red", name: "Bold Red" },
];

function asCard(props: Props): IdCardFields {
  return props;
}

async function photoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function IdCardClient(props: Props) {
  const [design, setDesign] = useState("blue");
  const lang = useLang();
  const [showSettings, setShowSettings] = useState(false);
  const emptyLabel = tr("ic_not_on_file", lang);

  function handlePrint() {
    window.print();
  }
  async function handleDownload() {
    const { buildIdCardPdf, downloadIdCardPdf } = await import("@/lib/hr/id-card-pdf");
    const bytes = buildIdCardPdf(asCard(props), design, emptyLabel, await photoDataUrl(props.photoUrl));
    downloadIdCardPdf(`${props.fullName.replace(/\s+/g, "-")}-id-card.pdf`, bytes);
  }
  function handleWhatsApp() {
    window.open(whatsAppUrl(props.phone, cardMessage(asCard(props), emptyLabel)), "_blank", "noopener,noreferrer");
  }
  function handleEmail() {
    window.location.href = mailtoUrl(props.fullName, cardMessage(asCard(props), emptyLabel));
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #staff-id-print, #staff-id-print * { visibility: visible !important; }
          #staff-id-print {
            position: absolute; left: 0; top: 0;
            display: flex; gap: 8mm;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-1.5">
          {DESIGNS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDesign(d.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${design === d.id ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
            >
              {d.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowSettings(true)} aria-label={tr("ic_settings", lang)} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Settings className="h-4 w-4" /></button>
          <button type="button" onClick={handlePrint} aria-label={tr("ic_print", lang)} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Printer className="h-4 w-4" /></button>
          <button type="button" onClick={handleDownload} aria-label={tr("ic_download", lang)} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Download className="h-4 w-4" /></button>
          <button type="button" onClick={handleWhatsApp} aria-label={tr("ic_share_whatsapp", lang)} className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /></button>
          <button type="button" onClick={handleEmail} aria-label={tr("ic_share_email", lang)} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Mail className="h-4 w-4" /></button>
        </div>
      </div>

      <div id="staff-id-print" className="flex flex-wrap justify-center gap-6 print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        <CardFace design={design} side="front" emptyLabel={emptyLabel} {...props} />
        <CardFace design={design} side="back" emptyLabel={emptyLabel} {...props} />
      </div>

      {showSettings && <SettingsModal {...props} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function CardFace({ design, side, fullName, designation, phone, photoUrl, bloodGroup, emergencyName, emergencyPhone, employeeCode, cnic, branchName, emptyLabel }: Props & { design: string; side: "front" | "back"; emptyLabel: string }) {
  const lang = useLang();
  const themes: Record<string, { bg: string; accent: string; text: string; subtext: string }> = {
    blue: { bg: "bg-blue-700 bg-gradient-to-br from-blue-600 to-blue-800", accent: "bg-blue-500", text: "text-white", subtext: "text-blue-100" },
    navy: { bg: "bg-[#0f172a]", accent: "bg-amber-500", text: "text-white", subtext: "text-slate-300" },
    green: { bg: "bg-green-700 bg-gradient-to-br from-green-600 to-green-800", accent: "bg-green-400", text: "text-white", subtext: "text-green-100" },
    white: { bg: "bg-white border-2 border-surface-200", accent: "bg-surface-800", text: "text-surface-900", subtext: "text-surface-500" },
    red: { bg: "bg-red-700 bg-gradient-to-br from-red-600 to-red-800", accent: "bg-red-400", text: "text-white", subtext: "text-red-100" },
  };
  const t = themes[design];

  if (side === "front") {
    return (
      <div className={`h-[214px] w-[340px] overflow-hidden rounded-2xl shadow-xl print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact] ${t.bg}`}>
        <div className={`h-2 w-full ${t.accent}`} />
        <div className="flex h-full flex-col items-center justify-center p-4">
          <p className={`text-xs font-bold uppercase tracking-wider ${t.text}`}>{tr("sh_company", lang)}</p>
          <div className="my-2 h-20 w-20 overflow-hidden rounded-full border-2 border-white/50 bg-white/20">
            {photoUrl ? (
              <img src={photoUrl} alt={fullName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center" title={emptyLabel}><User className={`h-10 w-10 ${t.subtext}`} /></div>
            )}
          </div>
          <p className={`text-center font-display text-base font-bold ${t.text}`}>{fullName}</p>
          <p className={`text-xs ${t.subtext}`}>{designation}</p>
          {employeeCode && <p className={`mt-1 text-[10px] font-mono ${t.subtext}`}>ID: {employeeCode}</p>}
          {branchName && <p className={`text-[10px] ${t.subtext}`}>{branchName}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[214px] w-[340px] overflow-hidden rounded-2xl shadow-xl print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact] ${t.bg}`}>
      <div className={`h-2 w-full ${t.accent}`} />
      <div className="flex h-full flex-col justify-center gap-1.5 p-5 text-xs">
        <p className={t.text}><strong>{tr("hj_cnic_label", lang)}</strong> {cnic ?? emptyLabel}</p>
        <p className={t.text}><strong>{tr("hj_phone_label", lang)}</strong> {phone ?? emptyLabel}</p>
        <p className={t.text}><strong>{tr("ic_blood_label", lang)}</strong> {bloodGroup ?? emptyLabel}</p>
        <p className={t.text}><strong>{tr("ic_emergency_label", lang)}</strong> {emergencyName ?? emptyLabel} {emergencyPhone ? `(${emergencyPhone})` : ""}</p>
        <div className={`mt-2 border-t pt-2 ${design === "white" ? "border-surface-200" : "border-white/20"}`}>
          <p className={`text-[10px] ${t.subtext}`}>{tr("at_card_return_note", lang)}</p>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ profileId, onClose, ...current }: Props & { onClose: () => void }) {
  const [state, formAction] = useFormState(saveIdCardDetails, initialState);
  const lang = useLang();

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(onClose, 800);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <h3 className="mb-3 font-display text-base font-semibold text-surface-900">{tr("ic_update_details", lang)}</h3>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{tr("c_saved", lang)}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <input type="hidden" name="profile_id" value={profileId} />
          <div>
            <label className="text-xs text-surface-500">{tr("c_photo", lang)}</label>
            <input type="file" name="photo" accept="image/*" className="mt-1 w-full text-xs" />
          </div>
          <input name="phone" defaultValue={current.phone ?? ""} placeholder={tr("sp_phone", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="cnic" defaultValue={current.cnic ?? ""} placeholder={tr("sp_cnic_number", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="employee_code" defaultValue={current.employeeCode ?? ""} placeholder={tr("ic_employee_code", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="blood_group" defaultValue={current.bloodGroup ?? ""} placeholder={tr("ic_blood_group", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="emergency_contact_name" defaultValue={current.emergencyName ?? ""} placeholder={tr("ic_emergency_name", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="emergency_contact_phone" defaultValue={current.emergencyPhone ?? ""} placeholder={tr("ic_emergency_number", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 py-2 text-sm text-surface-600">{tr("c_cancel", lang)}</button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Save Karein"}</button>;
}