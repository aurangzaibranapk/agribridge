"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ChevronDown, CheckCircle2, Camera } from "lucide-react";
import { updateFarmerProfile, type FarmerProfileState } from "@/actions/farmer-profile";
import { Button, Input, Label } from "@/components/ui/form";
import type { ProfileCompletion } from "@/lib/utils/farmer-profile";
import { t, type Lang } from "@/lib/i18n/translations";

const initialState: FarmerProfileState = {};

const fileInputClass =
  "block w-full text-sm text-surface-500 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-surface-900 hover:file:bg-surface-200 dark:file:bg-surface-800 dark:file:text-surface-100";

export function FarmerProfileForm({ farmer, completion, lang }: { farmer: any; completion: ProfileCompletion; lang: Lang }) {
  const [state, formAction] = useFormState(updateFarmerProfile, initialState);
  const [photoPreview, setPhotoPreview] = useState<string | null>(farmer.member_photo_url ?? null);
  const [openSection, setOpenSection] = useState<"basic" | "documents" | null>(
    !completion.basicComplete ? "basic" : "documents"
  );

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-3">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t("save_profile", lang)}.</p>}

      <div className="flex flex-col items-center rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-700 dark:bg-surface-900">
        <label htmlFor="member_photo" className="group relative cursor-pointer">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-brand-200 bg-brand-50 dark:bg-surface-800">
            {photoPreview ? (
              <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-brand-600">
                {farmer.full_name?.charAt(0)?.toUpperCase() ?? "F"}
              </span>
            )}
          </div>
          <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow group-hover:bg-brand-700">
            <Camera className="h-4 w-4" />
          </div>
        </label>
        <input id="member_photo" name="member_photo" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <p className="mt-3 text-sm font-medium text-surface-900 dark:text-surface-100">{farmer.full_name || t("your_name_placeholder", lang)}</p>
        <p className="text-xs text-surface-400">{farmer.farmer_code}</p>
        <p className="mt-1 text-xs text-surface-400">{t("tap_photo_hint", lang)}</p>
      </div>

      <AccordionSection
        title={t("basic_information", lang)}
        complete={completion.basicComplete}
        open={openSection === "basic"}
        onToggle={() => setOpenSection(openSection === "basic" ? null : "basic")}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="full_name">{t("full_name", lang)}</Label>
            <Input id="full_name" name="full_name" defaultValue={farmer.full_name ?? ""} />
          </div>
          <div>
            <Label htmlFor="cnic">{t("cnic", lang)}</Label>
            <Input id="cnic" name="cnic" defaultValue={farmer.cnic ?? ""} placeholder="XXXXX-XXXXXXX-X" />
          </div>
          <div>
            <Label htmlFor="village">{t("village", lang)}</Label>
            <Input id="village" name="village" defaultValue={farmer.village ?? ""} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="city">{t("city", lang)}</Label>
            <Input id="city" name="city" defaultValue={farmer.district ?? ""} />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-surface-600">
          <input
            type="checkbox"
            name="whatsapp_notifications_enabled"
            defaultChecked={farmer.whatsapp_notifications_enabled}
            className="h-4 w-4 rounded border-surface-300"
          />
          {t("whatsapp_updates", lang)}
        </label>
      </AccordionSection>

      <AccordionSection
        title={t("documents_upload", lang)}
        complete={completion.documentsComplete}
        open={openSection === "documents"}
        onToggle={() => setOpenSection(openSection === "documents" ? null : "documents")}
      >
        <div className="grid grid-cols-2 gap-4">
          <DocumentField label={t("cnic_front", lang)} name="cnic_front_image" existingUrl={farmer.cnic_image_url} />
          <DocumentField label={t("cnic_back", lang)} name="cnic_back_image" existingUrl={farmer.cnic_back_image_url} />
        </div>
      </AccordionSection>

      <SubmitButton lang={lang} />
    </form>
  );
}

function AccordionSection({
  title,
  complete,
  open,
  onToggle,
  children,
}: {
  title: string;
  complete: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-700 dark:bg-surface-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 font-medium text-surface-900 dark:text-surface-100">
          {complete && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={open ? "border-t border-surface-100 px-4 py-4 dark:border-surface-800" : "hidden"}>
        {children}
      </div>
    </div>
  );
}

function DocumentField({ label, name, existingUrl }: { label: string; name: string; existingUrl: string | null }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      {existingUrl && (
        <img src={existingUrl} alt={label} className="mb-2 h-16 w-16 rounded-lg border border-surface-200 object-cover dark:border-surface-700" />
      )}
      <input id={name} name={name} type="file" accept="image/*" className={fileInputClass} />
    </div>
  );
}

function SubmitButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t("saving", lang) : t("save_profile", lang)}
    </Button>
  );
}