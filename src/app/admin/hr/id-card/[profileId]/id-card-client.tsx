"use client";
import { useState, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveIdCardDetails, type ActionState } from "@/actions/staff-id-card";
import { Printer, Download, Mail, MessageCircle, User, Settings } from "lucide-react";

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

export function IdCardClient(props: Props) {
  const [design, setDesign] = useState("blue");
  const [showSettings, setShowSettings] = useState(false);

  function cardText() {
    return [
      "AL RANA TRADERS - Staff ID Card",
      `Name: ${props.fullName}`,
      `Designation: ${props.designation}`,
      props.employeeCode ? `Employee Code: ${props.employeeCode}` : "",
      props.branchName ? `Branch: ${props.branchName}` : "",
      props.phone ? `Phone: ${props.phone}` : "",
      props.cnic ? `CNIC: ${props.cnic}` : "",
      props.bloodGroup ? `Blood Group: ${props.bloodGroup}` : "",
      props.emergencyName ? `Emergency Contact: ${props.emergencyName} (${props.emergencyPhone ?? "-"})` : "",
    ].filter(Boolean).join("\n");
  }

  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    const blob = new Blob([cardText()], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.fullName.replace(/\s+/g, "-")}-id-card.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(cardText())}`, "_blank");
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`${props.fullName} - ID Card`)}&body=${encodeURIComponent(cardText())}`;
  }

  return (
    <div>
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
          <button onClick={() => setShowSettings(true)} aria-label="Card settings" className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Settings className="h-4 w-4" /></button>
          <button onClick={handlePrint} aria-label="Print ID card" className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Printer className="h-4 w-4" /></button>
          <button onClick={handleDownload} aria-label="Download ID card details" className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Download className="h-4 w-4" /></button>
          <button onClick={handleWhatsApp} aria-label="Share via WhatsApp" className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /></button>
          <button onClick={handleEmail} aria-label="Share via Email" className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Mail className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-6">
        <CardFace design={design} side="front" {...props} />
        <CardFace design={design} side="back" {...props} />
      </div>

      {showSettings && <SettingsModal {...props} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function CardFace({ design, side, fullName, designation, phone, photoUrl, bloodGroup, emergencyName, emergencyPhone, employeeCode, cnic, branchName }: Props & { design: string; side: "front" | "back" }) {
  const themes: Record<string, { bg: string; accent: string; text: string; subtext: string }> = {
    blue: { bg: "bg-gradient-to-br from-blue-600 to-blue-800", accent: "bg-blue-500", text: "text-white", subtext: "text-blue-100" },
    navy: { bg: "bg-[#0f172a]", accent: "bg-amber-500", text: "text-white", subtext: "text-slate-300" },
    green: { bg: "bg-gradient-to-br from-green-600 to-green-800", accent: "bg-green-400", text: "text-white", subtext: "text-green-100" },
    white: { bg: "bg-white border-2 border-surface-200", accent: "bg-surface-800", text: "text-surface-900", subtext: "text-surface-500" },
    red: { bg: "bg-gradient-to-br from-red-600 to-red-800", accent: "bg-red-400", text: "text-white", subtext: "text-red-100" },
  };
  const t = themes[design];

  if (side === "front") {
    return (
      <div className={`h-[214px] w-[340px] overflow-hidden rounded-2xl shadow-xl ${t.bg}`}>
        <div className={`h-2 w-full ${t.accent}`} />
        <div className="flex h-full flex-col items-center justify-center p-4">
          <p className={`text-xs font-bold uppercase tracking-wider ${t.text}`}>Al Rana Traders</p>
          <div className="my-2 h-20 w-20 overflow-hidden rounded-full border-2 border-white/50 bg-white/20">
            {photoUrl ? (
              <img src={photoUrl} alt={fullName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><User className={`h-10 w-10 ${t.subtext}`} /></div>
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
    <div className={`h-[214px] w-[340px] overflow-hidden rounded-2xl shadow-xl ${t.bg}`}>
      <div className={`h-2 w-full ${t.accent}`} />
      <div className="flex h-full flex-col justify-center gap-1.5 p-5 text-xs">
        <p className={t.text}><strong>CNIC:</strong> {cnic ?? "-"}</p>
        <p className={t.text}><strong>Phone:</strong> {phone ?? "-"}</p>
        <p className={t.text}><strong>Blood Group:</strong> {bloodGroup ?? "-"}</p>
        <p className={t.text}><strong>Emergency:</strong> {emergencyName ?? "-"} {emergencyPhone ? `(${emergencyPhone})` : ""}</p>
        <div className={`mt-2 border-t pt-2 ${design === "white" ? "border-surface-200" : "border-white/20"}`}>
          <p className={`text-[10px] ${t.subtext}`}>Agar ye card kisi ko mile, barah-e-meherbani wapis karein: alranatraders.pk | job@alranatraders.pk</p>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ profileId, onClose, ...current }: Props & { onClose: () => void }) {
  const [state, formAction] = useFormState(saveIdCardDetails, initialState);

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(onClose, 800);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <h3 className="mb-3 font-display text-base font-semibold text-surface-900">Card Details Update Karein</h3>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Save ho gaya.</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <input type="hidden" name="profile_id" value={profileId} />
          <div>
            <label className="text-xs text-surface-500">Photo</label>
            <input type="file" name="photo" accept="image/*" className="mt-1 w-full text-xs" />
          </div>
          <input name="employee_code" defaultValue={current.employeeCode ?? ""} placeholder="Employee Code" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="blood_group" defaultValue={current.bloodGroup ?? ""} placeholder="Blood Group (e.g. O+)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="emergency_contact_name" defaultValue={current.emergencyName ?? ""} placeholder="Emergency Contact Naam" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="emergency_contact_phone" defaultValue={current.emergencyPhone ?? ""} placeholder="Emergency Contact Number" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-surface-200 py-2 text-sm text-surface-600">Cancel</button>
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