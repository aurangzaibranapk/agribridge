"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ChevronDown, CheckCircle2, Camera } from "lucide-react";
import { updateFarmerProfile, confirmFarmerProfile, type FarmerProfileState } from "@/actions/farmer-profile";
import { Button, Input, Label } from "@/components/ui/form";
import type { ProfileCompletion } from "@/lib/utils/farmer-profile";
import { t, type Lang } from "@/lib/i18n/translations";

const initialState: FarmerProfileState = {};

const fileInputClass =
  "block w-full text-sm text-surface-500 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-surface-900 hover:file:bg-surface-200 dark:file:bg-surface-800 dark:file:text-surface-100";

export function FarmerProfileForm({ farmer, completion, lang }: { farmer: any; completion: ProfileCompletion; lang: Lang }) {
  const [state, formAction] = useFormState(updateFarmerProfile, initialState);
  const [photoPreview, setPhotoPreview] = useState<string | null>(farmer.member_photo_url ?? null);
  // Jo hissa abhi adhoora hai, wohi khula milta hai. Sab band rakhna ya
  // sab khol dena -- dono ka nateeja ek hi hota hai: banda upar se neeche
  // scroll karta hai aur dhoondta hai ke ab kya karna baqi hai.
  const sections = ["identity", "location", "farming", "payment", "documents"] as const;
  type Section = (typeof sections)[number];
  const firstIncomplete: Section | null =
    (!completion.identityComplete && "identity") ||
    (!completion.locationComplete && "location") ||
    (!completion.farmingComplete && "farming") ||
    (!completion.paymentComplete && "payment") ||
    (!completion.documentsComplete && "documents") ||
    null;
  const [openSection, setOpenSection] = useState<Section | null>(firstIncomplete);

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
        title="1 — Pehchan"
        complete={completion.identityComplete}
        open={openSection === "identity"}
        onToggle={() => setOpenSection(openSection === "identity" ? null : "identity")}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="full_name">{t("full_name", lang)}</Label>
            <Input id="full_name" name="full_name" defaultValue={farmer.full_name ?? ""} />
          </div>
          <div className="col-span-2">
            {/* Gaon mein ek hi naam ke kai log hote hain, aur CNIC har
                kisi ke paas nahi hoti. "Aslam walad Ghulam Muhammad" wo
                pehchan hai jo wahan waqai chalti hai. */}
            <Label htmlFor="father_name">Walid ka naam</Label>
            <Input id="father_name" name="father_name" defaultValue={farmer.father_name ?? ""} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="cnic">{t("cnic", lang)}</Label>
            <Input id="cnic" name="cnic" defaultValue={farmer.cnic ?? ""} placeholder="XXXXX-XXXXXXX-X" />
          </div>
          <div className="col-span-2">
            {/* Mobile yahan sirf dikhaya jata hai, badla nahi ja sakta:
                wohi kisan ki pehchan hai aur usi par sab kuch mila jata
                hai. Badalna ho to daftar se, taake do khate na ban jayen. */}
            <Label>Mobile</Label>
            <Input value={farmer.phone_number ?? ""} readOnly disabled />
            <p className="mt-1 text-xs text-surface-500">
              Mobile aap ki pehchan hai. Badalwana ho to Al Rana Traders se raabta karein.
            </p>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        title="2 — Pata"
        complete={completion.locationComplete}
        open={openSection === "location"}
        onToggle={() => setOpenSection(openSection === "location" ? null : "location")}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="village">{t("village", lang)}</Label>
            <Input id="village" name="village" defaultValue={farmer.village ?? ""} />
          </div>
          <div>
            <Label htmlFor="tehsil">Tehsil</Label>
            <Input id="tehsil" name="tehsil" defaultValue={farmer.tehsil ?? ""} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="city">{t("city", lang)}</Label>
            <Input id="city" name="city" defaultValue={farmer.district ?? ""} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="address">Poora pata</Label>
            <Input id="address" name="address" defaultValue={farmer.address ?? ""} placeholder="Ghar tak pahunchne ka pata" />
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        title="3 — Zameen aur fasal"
        complete={completion.farmingComplete}
        open={openSection === "farming"}
        onToggle={() => setOpenSection(openSection === "farming" ? null : "farming")}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="land_size_acres">Kul zameen (acre)</Label>
            <Input
              id="land_size_acres"
              name="land_size_acres"
              type="number"
              step="0.1"
              min="0"
              defaultValue={farmer.land_size_acres ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="crop_types">Faslein</Label>
            <Input
              id="crop_types"
              name="crop_types"
              defaultValue={(farmer.crop_types ?? []).join(", ")}
              placeholder="Gandum, Chawal"
            />
          </div>
        </div>
        {/* Har khet ki apni jagah, raqba aur malkiyat "Mere Khet" wale
            safhe par hai. Yahan sirf kul zameen li jati hai: dono jagah
            wohi tafseel maangna banda ko do baar likhwata hai aur phir
            dono kabhi barabar nahi rehte. */}
        <p className="mt-3 text-xs text-surface-500">
          Har khet ki alag jagah, raqba aur malkiyat (apni ya theke par){" "}
          <a href="/portal/farms" className="font-medium text-brand-700 underline">
            Mere Khet
          </a>{" "}
          wale safhe par likhein.
        </p>
      </AccordionSection>

      <AccordionSection
        title="4 — Paisa kahan bheja jaye"
        complete={completion.paymentComplete}
        open={openSection === "payment"}
        onToggle={() => setOpenSection(openSection === "payment" ? null : "payment")}
      >
        {/* Do raaste, aur koi ek kaafi hai. Bank ko lazmi karna ghalat
            hoga: bohot se kisanon ke paas khata hai hi nahi, aur unhein
            rok dene ka matlab ye ke un ka paisa hamare paas para rehta
            hai. */}
        <p className="mb-3 text-xs text-surface-500">Bank ya mobile wallet — koi ek kaafi hai.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bank_name">Bank ka naam</Label>
            <Input id="bank_name" name="bank_name" defaultValue={farmer.bank_name ?? ""} />
          </div>
          <div>
            <Label htmlFor="bank_account_title">Khata kis naam par</Label>
            <Input id="bank_account_title" name="bank_account_title" defaultValue={farmer.bank_account_title ?? ""} />
          </div>
          <div>
            <Label htmlFor="bank_account_number">Khata number</Label>
            <Input id="bank_account_number" name="bank_account_number" defaultValue={farmer.bank_account_number ?? ""} />
          </div>
          <div>
            <Label htmlFor="bank_iban">IBAN</Label>
            <Input id="bank_iban" name="bank_iban" defaultValue={farmer.bank_iban ?? ""} placeholder="PK__ ____ ____" />
          </div>
          <div>
            <Label htmlFor="mobile_wallet_provider">Mobile wallet</Label>
            <select
              id="mobile_wallet_provider"
              name="mobile_wallet_provider"
              defaultValue={farmer.mobile_wallet_provider ?? ""}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              <option value="">—</option>
              <option value="jazzcash">JazzCash</option>
              <option value="easypaisa">Easypaisa</option>
              <option value="sadapay">SadaPay</option>
              <option value="nayapay">NayaPay</option>
              <option value="other">Deegar</option>
            </select>
          </div>
          <div>
            <Label htmlFor="mobile_wallet_number">Wallet number</Label>
            <Input id="mobile_wallet_number" name="mobile_wallet_number" defaultValue={farmer.mobile_wallet_number ?? ""} />
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        title="5 — Kaghazat"
        complete={completion.documentsComplete}
        open={openSection === "documents"}
        onToggle={() => setOpenSection(openSection === "documents" ? null : "documents")}
      >
        <div className="grid grid-cols-2 gap-4">
          <DocumentField label={t("cnic_front", lang)} name="cnic_front_image" existingUrl={farmer.cnic_image_url} />
          <DocumentField label={t("cnic_back", lang)} name="cnic_back_image" existingUrl={farmer.cnic_back_image_url} />
        </div>
      </AccordionSection>

      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-700 dark:bg-surface-900">
        {/* Zaban cookie mein bhi rehti hai, magar WhatsApp cookie nahi
            parhta -- aur wahi paighaam kisan sab se zyada parhta hai. */}
        <Label htmlFor="preferred_language">Paighaam kis zaban mein?</Label>
        <select
          id="preferred_language"
          name="preferred_language"
          defaultValue={farmer.preferred_language ?? "ur"}
          className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="ur">اردو</option>
          <option value="rm">Roman Urdu</option>
          <option value="en">English</option>
        </select>
        <label className="mt-3 flex items-center gap-2 text-sm text-surface-600">
          <input
            type="checkbox"
            name="whatsapp_notifications_enabled"
            defaultChecked={farmer.whatsapp_notifications_enabled}
            className="h-4 w-4 rounded border-surface-300"
          />
          {t("whatsapp_updates", lang)}
        </label>
      </div>

      <SubmitButton lang={lang} />
    </form>
  );
}

/**
 * "Profile Confirm" -- SAVE se alag, aur jaan boojh kar alag form mein.
 *
 * Save adhoora bhi ho sakta hai: banda aaj naam likh kar chala jaye, kal
 * CNIC ki photo laaye. Confirm ka matlab hai "ye sab theek hai, isi par
 * kaam karein" -- aur usi lamhe se profile ka darja profile_complete ho
 * jata hai, jis ke baad koi service ye tafseel dobara nahi poochhti.
 *
 * Adhoori profile par button aata hi nahi. Us ki jagah ye likha hota hai
 * ke kaun sa hissa baqi hai -- kyunke "confirm nahi ho raha" se agla
 * sawal hamesha "kyun nahi ho raha" hota hai.
 */
export function ConfirmProfileCard({
  completion,
  confirmedAt,
  isVerified,
}: {
  completion: ProfileCompletion;
  confirmedAt: string | null;
  isVerified: boolean;
}) {
  const [state, formAction] = useFormState(confirmFarmerProfile, initialState);

  if (isVerified) {
    return (
      <div className="mt-4 flex items-start gap-2 rounded-card border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Profile tasdeeq shuda hai.</p>
          <p className="mt-1">Al Rana Traders ne aap ke kaghazat dekh kar tasdeeq kar di hai.</p>
        </div>
      </div>
    );
  }

  if (confirmedAt) {
    return (
      <div className="mt-4 flex items-start gap-2 rounded-card border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Profile confirm ho chuki hai.</p>
          <p className="mt-1">
            {new Date(confirmedAt).toLocaleDateString()} ko. Ab koi service aap se ye tafseel dobara nahi poochhegi.
            Kuch badalna ho to upar theek kar ke save kar dein.
          </p>
        </div>
      </div>
    );
  }

  if (!completion.isComplete) {
    return (
      <div className="mt-4 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Confirm karne ke liye ye hissay baqi hain:</p>
        <ul className="mt-2 list-inside list-disc space-y-0.5">
          {!completion.identityComplete && <li>Pehchan — walid ka naam, CNIC</li>}
          {!completion.locationComplete && <li>Pata — gaon, tehsil, zila, poora pata</li>}
          {!completion.farmingComplete && <li>Zameen aur fasal</li>}
          {!completion.paymentComplete && <li>Bank ya mobile wallet</li>}
          {!completion.documentsComplete && <li>CNIC ki dono taraf ki photo</li>}
        </ul>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 rounded-card border border-brand-200 bg-white p-4 shadow-card dark:border-brand-900/40 dark:bg-surface-900">
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.notice && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.notice}</p>}
      <p className="text-sm font-medium text-surface-900 dark:text-surface-100">Profile mukammal hai.</p>
      <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">
        Confirm karne ke baad Al Rana Traders ki har service — machinery, doodh, anaj, marketplace, bataway — yahi
        tafseel istemal karegi. Aap se ye sab dobara nahi poocha jayega.
      </p>
      <ConfirmButton />
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-3 w-full">
      {pending ? "Confirm ho raha hai..." : "Profile Confirm karein"}
    </Button>
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