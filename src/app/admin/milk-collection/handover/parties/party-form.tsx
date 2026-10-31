"use client";

import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { saveHandoverParty, type PartyState } from "@/actions/milk-handover-party";
import { Button, Input, Label } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: PartyState = {};

export interface PartyRow {
  id: string;
  name: string;
  contact: string | null;
  active: boolean;
}

export function PartyMaster({ lang, parties }: { lang: Lang; parties: PartyRow[] }) {
  return (
    <div className="space-y-4" data-testid="party-master">
      <PartyEditor lang={lang} />
      {parties.length === 0 && <p className="text-sm text-surface-500">{t("mh_party_none", lang)}</p>}
      {parties.map((party) => (
        <PartyEditor key={party.id} lang={lang} party={party} />
      ))}
    </div>
  );
}

function PartyEditor({ lang, party }: { lang: Lang; party?: PartyRow }) {
  const [state, action] = useFormState(saveHandoverParty, initial);
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-surface-200 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
      {party && <input type="hidden" name="party_id" value={party.id} />}
      <div>
        <Label>{t("mh_party_name", lang)}</Label>
        <Input name="name" defaultValue={party?.name ?? ""} required />
      </div>
      <div>
        <Label>{t("mh_party_contact", lang)}</Label>
        <Input name="contact" defaultValue={party?.contact ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:mt-6">
        <input type="checkbox" name="active" value="yes" defaultChecked={party ? party.active : true} />
        {t("mh_party_active", lang)}
      </label>
      <div className="sm:mt-5">
        <PartySave lang={lang} />
      </div>
      {state.error && <p className="sm:col-span-4 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="sm:col-span-4 text-sm text-green-700">{t("mh_saved_party", lang)}</p>}
    </form>
  );
}

function PartySave({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? t("mh_saving", lang) : t("mh_party_save", lang)}</Button>;
}
