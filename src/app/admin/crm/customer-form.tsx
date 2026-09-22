"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveCustomer, updateCustomer, type ActionState } from "@/actions/customers";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { Plus, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface ExistingCustomer {
  id: string;
  name: string;
  contact_person: string | null;
  phone_number: string;
  cnic: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  customer_type?: string;
  business_name?: string | null;
  payment_due_days: number;
}

export function AddCustomerButton() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" />{t("at_add_customer", lang)}</button>
      {open && <CustomerModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditCustomerButton({ customer }: { customer: ExistingCustomer }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-600 hover:underline"
      >{t("at_edit", lang)}</button>
      {open && <CustomerModal customer={customer} onClose={() => setOpen(false)} />}
    </>
  );
}

function CustomerModal({ customer, onClose }: { customer?: ExistingCustomer; onClose: () => void }) {
  const isEditMode = !!customer;
  const lang = useLang();
  const [state, formAction] = useFormState(isEditMode ? updateCustomer : saveCustomer, initialState);
  // Malik (19 September): "wholesale ke liye Shop ka naam bhi add ho" --
  // sirf thok wali dukan ke liye maani rakhta hai, is liye checkbox
  // ke sath hi khulta/band hota hai.
  const [isWholesale, setIsWholesale] = useState(customer?.customer_type === "wholesale_shop");

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {/* Poora dialog ab apne max-height tak mehdood hai, header aur
          Save button hamesha nazar aate hain (kabhi scroll ke peeche
          nahi chhupte) -- sirf beech ka form-body scroll karta hai,
          agar screen chhoti ho to (18 September, malik: chhota/pyara
          form, cross aur Save hamesha dikhen, poora safha scroll na
          ho). */}
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-card bg-white shadow-xl dark:bg-surface-900">
        <div className="flex shrink-0 items-center justify-between border-b border-surface-100 px-4 py-2.5 dark:border-surface-800">
          <h3 className="font-display text-sm font-semibold text-surface-900 dark:text-white">
            {isEditMode ? "Edit Customer" : "New Customer"}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
            {isEditMode && <input type="hidden" name="id" value={customer.id} />}
            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {state.error}
              </p>
            )}
            {state.success && (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("at_saved", lang)}</p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <Label className="mb-1 text-xs">{t("at_customer_name_req", lang)}</Label>
                <Input className="h-9" name="name" defaultValue={customer?.name} required />
              </div>
              <div>
                <Label className="mb-1 text-xs">{t("at_phone_number_req", lang)}</Label>
                <Input className="h-9" name="phone_number" defaultValue={customer?.phone_number} required />
              </div>
              <div>
                <Label className="mb-1 text-xs">{t("c_contact_person", lang)}</Label>
                <Input className="h-9" name="contact_person" defaultValue={customer?.contact_person ?? ""} />
              </div>
              <div>
                <Label className="mb-1 text-xs">CNIC</Label>
                <Input className="h-9" name="cnic" defaultValue={customer?.cnic ?? ""} placeholder="00000-0000000-0" />
              </div>
              <div>
                <Label className="mb-1 text-xs">{t("c_email", lang)}</Label>
                <Input className="h-9" name="email" type="email" defaultValue={customer?.email ?? ""} />
              </div>
              <div className="col-span-2">
                <Label className="mb-1 text-xs">{t("c_address", lang)}</Label>
                <Textarea name="address" rows={2} defaultValue={customer?.address ?? ""} />
              </div>
              <div>
                <Label className="mb-1 text-xs">{t("cr_credit_limit_dot", lang)}</Label>
                <Input className="h-9" name="credit_limit" type="number" step="0.01" defaultValue={customer?.credit_limit} />
              </div>
              <div>
                <Label className="mb-1 text-xs">{t("cr_payment_due_days", lang)}</Label>
                <Input className="h-9" name="payment_due_days" type="number" defaultValue={customer?.payment_due_days} />
              </div>
              <div className="col-span-2">
                {/* Ye darja EK DAFA yahan likha jata hai. POS par har bill
                    par "thok ya retail" chunne se rate counter wale ki
                    marzi par aa jata, aur mahine baad ye sawal ka jawab
                    nahi hota ke falan bill par thok kyun laga tha. */}
                <label className="flex items-start gap-2 text-xs text-surface-700 dark:text-surface-300">
                  <input
                    type="checkbox"
                    name="customer_type"
                    value="wholesale_shop"
                    checked={isWholesale}
                    onChange={(e) => setIsWholesale(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Ye <strong>thok wali dukan</strong> hai — hum isay maal dete hain
                    <span className="block text-[11px] text-surface-500">
                      POS par is ke bill par thok ka rate khud lagega. Jis cheez par thok ka rate darj
                      nahi, us par retail lagega.
                    </span>
                  </span>
                </label>
              </div>
              {/* Malik (19 September): "wholesale ke liye Shop ka naam
                  bhi add ho, wahi POS mein aana chahiye, jaisay dealer
                  ke hota hai" -- customer.name sirf contact/person ka
                  naam hai, dukaan ka apna naam alag khana hai. */}
              {isWholesale && (
                <div className="col-span-2">
                  <Label className="mb-1 text-xs">Shop Name (jo POS par dikhega)</Label>
                  <Input className="h-9" name="business_name" defaultValue={customer?.business_name ?? ""} placeholder="jaise Sultan Traders" />
                </div>
              )}
            </div>

            {/* Malik (18 September): purane DigiKhata se pehle ka baqaya
                yahin se darj ho jaye, alag import safha na kholna paRe.
                Ye khana JAAN BOOJH KAR kabhi bhara hua nahi khulta (koi
                defaultValue nahi) -- "Save Changes" dobara dabane par
                yehi purani raqam dobara ledger mein nahi chaRhti. */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
              <Label htmlFor="purana_baqaya" className="mb-1 text-xs">Purana Baqaya (Digikhata se) — sirf ek dafa ke liye</Label>
              <Input id="purana_baqaya" className="h-9" name="purana_baqaya" type="number" step="0.01" placeholder="e.g. 5000" />
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 text-[11px] text-amber-800 dark:text-amber-300">Baqaya kis cheez ka?</Label>
                  <select
                    name="purana_baqaya_type"
                    className="h-8 w-full rounded-md border border-amber-200 bg-white px-2 text-xs text-surface-800 dark:border-amber-900/40 dark:bg-surface-900 dark:text-surface-200"
                  >
                    <option value="">— chunein —</option>
                    <option value="karyana">Kisan Karyana (karyana)</option>
                    <option value="kisan_dukan">Kisan Dukan (pesticide, wanda, khad)</option>
                    <option value="other">Other Amount</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-1 text-[11px] text-amber-800 dark:text-amber-300">Short Note (ikhtiyari)</Label>
                  <Input
                    name="purana_baqaya_note"
                    className="h-8 text-xs"
                    placeholder="jaise: pichle saal ka hisaab"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                Khali chhoRein agar kuch add nahi karna. Bharne par ye raqam customer ke khate mein
                "lena hai" ban jayegi (manfi likhen agar customer ka pehle se credit/advance para hai).
                Sirf Manager/Admin/Owner kar sakte hain.
              </p>
            </div>
          </div>

          <div className="shrink-0 border-t border-surface-100 px-4 py-2.5 dark:border-surface-800">
            <SubmitButton isEditMode={isEditMode} />
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ isEditMode }: { isEditMode: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving..." : isEditMode ? "Save Changes" : "Add Customer"}
    </Button>
  );
}