"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { applyToVacancy, type ActionState } from "@/actions/jobs";
import { applyInputError, readApplyFields } from "@/lib/jobs/apply-input";
import type { CareerCard } from "@/lib/jobs/vacancy-i18n";
import { isHiddenBrand } from "@/lib/brand";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { CheckCircle2, Upload, X } from "lucide-react";

const initialState: ActionState = {};

const STEPS: TranslationKey[] = ["sp_step_basic", "sp_step_experience", "sp_step_documents"];

const FILES: Array<{ name: string; label: TranslationKey; accept: string }> = [
  { name: "cnic_front_image", label: "sp_cnic_front", accept: "image/*" },
  { name: "cnic_back_image", label: "sp_cnic_back", accept: "image/*" },
  { name: "certificate", label: "sp_qual_cert", accept: "image/*,.pdf" },
  { name: "experience_certificate", label: "sp_exp_cert", accept: "image/*,.pdf" },
  { name: "cv", label: "sp_cv", accept: "image/*,.pdf,.doc,.docx" },
];

export function ApplyForm({ vacancy, onClose }: { vacancy: CareerCard; onClose: () => void }) {
  const lang = useLang();
  const urdu = lang === "ur";
  const [state, formAction] = useFormState(applyToVacancy, initialState);
  const [step, setStep] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const sectionCls = urdu
    ? "col-span-2 text-[13px] font-bold leading-snug text-brand-800"
    : "col-span-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-800";
  const show = (index: number) => (step === index ? "block" : "hidden md:block");

  function goNext() {
    if (step === 0 && formRef.current) {
      const err = applyInputError(readApplyFields(new FormData(formRef.current)));
      if (err) {
        setClientError(err);
        return;
      }
    }
    setClientError(null);
    setStep((current) => Math.min(2, current + 1));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const err = applyInputError(readApplyFields(new FormData(event.currentTarget)));
    if (err) {
      event.preventDefault();
      setClientError(err);
      setStep(0);
    }
  }

  const error = clientError || state.error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-surface-950/45 p-0 md:items-center md:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="career-apply-title"
        data-careers-panel
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-[100dvh] w-full max-w-[1080px] flex-col overflow-hidden bg-white md:h-auto md:max-h-[calc(100dvh-1.5rem)] md:rounded-2xl md:border md:border-brand-100 md:shadow-2xl"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-brand-100 bg-brand-25 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-[11px] font-semibold text-brand-700 ${urdu ? "leading-snug" : "uppercase tracking-wide"}`}>{t("sp_apply_for", lang)}</p>
              {vacancy.brand && !isHiddenBrand(vacancy.brand) && (
                <span className={`inline-flex max-w-full truncate rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[11px] font-medium text-brand-800 ${urdu ? "leading-snug" : ""}`}>{vacancy.brand}</span>
              )}
            </div>
            <h2 id="career-apply-title" className={`truncate text-base font-semibold text-surface-900 ${urdu ? "leading-snug" : ""}`}>{vacancy.title}</h2>
            {vacancy.location && <p className="truncate text-xs text-surface-500">{vacancy.location}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t("sp_close", lang)} className="rounded-lg p-1.5 text-surface-500 hover:bg-white hover:text-surface-800">
            <X className="h-4 w-4" />
          </button>
        </header>

        {state.success ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <CheckCircle2 className="h-9 w-9 text-brand-600" />
            <p className={`max-w-md text-sm text-brand-800 ${urdu ? "leading-relaxed" : ""}`}>{t("sp_application_received", lang)}</p>
            <button type="button" onClick={onClose} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{t("sp_close", lang)}</button>
          </div>
        ) : (
          <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate encType="multipart/form-data" className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="vacancy_id" value={vacancy.id} />
            <input type="hidden" name="ui_lang" value={lang} />

            <div data-careers-form className="min-h-0 flex-1 overflow-hidden px-4 py-2.5 md:flex-none">
              <ol className="mb-2 grid grid-cols-3 gap-1.5 md:hidden">
                {STEPS.map((key, index) => {
                  const active = index === step;
                  const done = index < step;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => { if (done) { setClientError(null); setStep(index); } }}
                        className={`flex w-full items-center justify-center gap-1 rounded-lg px-1 py-1 text-[11px] font-semibold ${active ? "bg-brand-600 text-white" : done ? "bg-brand-50 text-brand-800" : "bg-surface-100 text-surface-500"}`}
                        aria-current={active ? "step" : undefined}
                      >
                        <span className="tabular-nums">{index + 1}</span>
                        <span className="truncate">{t(key, lang)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {error && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</p>}

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <h3 className={`${sectionCls} ${show(0)}`}>{t("sp_basic_info", lang)}</h3>
                <Field label={t("sp_full_name", lang)} className={show(0)} urdu={urdu}>
                  <input name="full_name" required autoComplete="name" placeholder={t("sp_full_name", lang)} className={inputCls(urdu)} />
                </Field>
                <Field label={t("sp_email", lang)} className={show(0)} urdu={urdu}>
                  <input type="email" name="email" required dir="ltr" autoComplete="email" placeholder={t("sp_email", lang)} className={inputCls(urdu)} />
                </Field>
                <Field label={t("sp_phone", lang)} className={show(0)} urdu={urdu}>
                  <input name="phone" dir="ltr" autoComplete="tel" placeholder={t("sp_phone", lang)} className={inputCls(urdu)} />
                </Field>
                <Field label={t("sp_cnic_number", lang)} className={show(0)} urdu={urdu}>
                  <input name="cnic" dir="ltr" placeholder={t("sp_cnic_number", lang)} className={inputCls(urdu)} />
                </Field>
                <Field label={t("sp_address", lang)} className={show(0)} urdu={urdu}>
                  <input name="address" autoComplete="street-address" placeholder={t("sp_address", lang)} className={inputCls(urdu)} />
                </Field>
                <Field label={t("sp_expected_salary", lang)} className={show(0)} urdu={urdu}>
                  <input type="number" name="expected_salary" min="0" dir="ltr" inputMode="numeric" placeholder={t("sp_expected_salary", lang)} className={inputCls(urdu)} />
                </Field>

                <h3 className={`${sectionCls} mt-1 ${show(1)}`}>{t("sp_exp_qual", lang)}</h3>
                <Field label={t("sp_qualification", lang)} className={show(1)} urdu={urdu}>
                  <input name="qualification" placeholder={t("sp_qualification", lang)} className={inputCls(urdu)} />
                </Field>
                <Field label={t("sp_past_work", lang)} className={show(1)} urdu={urdu}>
                  <input name="experience" placeholder={t("sp_past_work", lang)} className={inputCls(urdu)} />
                </Field>
                <Field label={t("sp_about_you", lang)} className={`col-span-2 ${show(1)}`} urdu={urdu}>
                  <input name="message" placeholder={t("sp_about_you", lang)} className={inputCls(urdu)} />
                </Field>

                <h3 className={`${sectionCls} mt-1 ${show(2)}`}>{t("sp_documents", lang)}</h3>
                <div className={`col-span-2 ${show(2)}`}>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {FILES.map((file) => (
                    <FileDrop key={file.name} name={file.name} label={t(file.label, lang)} accept={file.accept} hint={t("sp_drop_or_browse", lang)} ready={t("sp_file_ready", lang)} clearLabel={t("sp_clear_file", lang)} />
                  ))}
                </div>
                </div>
              </div>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-surface-200 px-4 py-2.5">
              <button type="button" onClick={onClose} className="hidden rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 md:inline-flex">
                {t("sp_cancel", lang)}
              </button>
              <div className="flex w-full items-center justify-end gap-2 md:w-auto">
                {step > 0 && (
                  <button type="button" onClick={() => { setClientError(null); setStep((current) => current - 1); }} className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-700 md:hidden">
                    {t("c_back", lang)}
                  </button>
                )}
                {step < 2 && (
                  <button type="button" onClick={goNext} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 md:hidden">
                    {t("sp_next", lang)}
                  </button>
                )}
                <SubmitButton className={step < 2 ? "hidden md:inline-flex" : ""} label={t("sp_submit", lang)} pendingLabel={t("sp_submitting", lang)} />
              </div>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}

function inputCls(urdu: boolean) {
  return `w-full rounded-lg border border-surface-200 bg-white px-2.5 text-sm text-surface-900 outline-none placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${urdu ? "h-9" : "h-8"}`;
}

function Field({ label, className, urdu, children }: { label: string; className?: string; urdu: boolean; children: ReactNode }) {
  return (
    <label className={`min-w-0 ${className ?? "block"}`}>
      <span className={`mb-0.5 block text-[11px] font-semibold leading-tight text-surface-600 ${urdu ? "text-[12px]" : "truncate"}`}>{label}</span>
      {children}
    </label>
  );
}

function FileDrop({ name, label, accept, hint, ready, clearLabel }: { name: string; label: string; accept: string; hint: string; ready: string; clearLabel: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  function take(file: File | null) {
    const input = inputRef.current;
    if (!input) return;
    if (!file) {
      input.value = "";
      setFileName(null);
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    setFileName(file.name);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <label
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex h-[4.25rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-1.5 text-center ${over ? "border-brand-600 bg-brand-50" : "border-brand-200 bg-brand-25 hover:border-brand-500"}`}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        className="sr-only"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
      />
      <Upload className="mb-0.5 h-3.5 w-3.5 text-brand-700" aria-hidden />
      <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-surface-700">{label}</span>
      {fileName ? (
        <span className="mt-0.5 flex max-w-full items-center gap-1 text-[10px] text-brand-800" aria-label={ready}>
          <span className="truncate" dir="ltr">{fileName}</span>
          <button
            type="button"
            aria-label={clearLabel}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); take(null); }}
            className="shrink-0 rounded text-surface-500 hover:text-red-700"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : (
        <span className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-surface-400">{hint}</span>
      )}
    </label>
  );
}

function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 ${className ?? ""}`}>
      {pending ? pendingLabel : label}
    </button>
  );
}
