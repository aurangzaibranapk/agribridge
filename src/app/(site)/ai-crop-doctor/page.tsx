"use client";

import { Stethoscope, Camera, FileText, Sprout } from "lucide-react";
import { CropDoctorWidget } from "@/components/site/crop-doctor-widget";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const STEPS = [
  { icon: Camera, title: "Upload a photo", description: "Take a clear photo of the affected crop, leaf, or plant." },
  { icon: Stethoscope, title: "Get a diagnosis", description: "Our system identifies the likely disease and its severity." },
  { icon: FileText, title: "Treatment plan", description: "Receive product recommendations and a spray schedule." },
];

export default function AiCropDoctorPublicPage() {
  const lang = useLang();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
          <Sprout className="h-7 w-7" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-surface-900">{t("sp_doctor_title", lang)}</h1>
        <p className="mx-auto mt-2 max-w-xl text-surface-500">
          Upload a photo of any crop or leaf below for a free instant diagnosis. Create a farmer account to
          save your diagnosis history and unlock more features.
        </p>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STEPS.map((s, i) => {
          const isFirstStep = i === 0;
          const CardTag = isFirstStep ? "button" : "div";
          return (
            <CardTag
              key={s.title}
              type={isFirstStep ? "button" : undefined}
              onClick={
                isFirstStep
                  ? () => {
                      document
                        .getElementById("crop-doctor-upload")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  : undefined
              }
              className={`rounded-card border border-surface-200 bg-white p-6 text-center shadow-card ${
                isFirstStep ? "cursor-pointer transition hover:border-brand-300 hover:shadow-md" : ""
              }`}
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {i + 1}
              </div>
              <s.icon className="mx-auto mb-2 h-5 w-5 text-brand-600" />
              <h2 className="font-medium text-surface-900">{s.title}</h2>
              <p className="mt-1 text-sm text-surface-500">{s.description}</p>
            </CardTag>
          );
        })}
      </div>

      <div id="crop-doctor-upload">
        <CropDoctorWidget mode="demo" />
      </div>

      <p className="mt-6 text-center text-xs text-surface-400">
        This is a free demo tool. Diagnoses are AI-generated and should be confirmed by an agronomist before
        large-scale treatment decisions.
      </p>
    </div>
  );
}