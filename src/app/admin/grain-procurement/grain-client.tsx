"use client";
import { grainBagCalculation, grainKgGrams } from "@/lib/grain/bag-calculation";
import { useEffect, useState, useMemo, type FormEvent } from "react";
import { aajKaKhana } from "@/lib/utils/format";
import Link from "next/link";
import { NewSaleForm } from "./sell/sell-grain-client";
import { useFormState, useFormStatus } from "react-dom";
import { createGrainEntry, recordGrainPayment, createGrainParty, editGrainEntry, updateGrainPackRule, type ActionState } from "@/actions/grain-procurement";
import {
  GrainPaymentActionId,
  GrainPaymentAccountField,
  GrainPaymentDateField,
  GrainPaymentSlipField,
  GrainPaymentSuccess,
} from "@/components/grain/grain-payment-fields";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { X, Plus, FileText, AlertTriangle, Trash2 } from "lucide-react";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { enqueue, allActions, type QueuedAction } from "@/lib/offline/queue";
import { registerSender, syncQueue } from "@/lib/offline/sync";

const initialState: ActionState = {};

interface Farmer { id: string; full_name: string; farmer_code: string; }
interface Party { id: string; party_name: string; contact_person: string | null; phone: string | null; }
interface Warehouse { id: string; name: string; }
interface CutPreset { id: string; grain_type: string; label: string; cut_percentage: number; }
interface GrainRule { grain_type: string; is_bag_based: boolean; bag_weight_kg: number | null; default_cut_kg: number; default_cut_grams: number; default_chungi_kg: number; }
interface FinanceAccount { id: string; name: string; account_type: string; }
interface Entry {
  id: string;
  entry_date: string;
  grain_type: string;
  gross_weight_kg: number;
  cut_percentage: number;
  cut_kg: number;
  weight_kg: number;
  moisture_percentage: number | null;
  quality_grade: string | null;
  rate_per_kg: number;
  total_amount: number;
  seller_id: string;
  seller_type: string;
  seller_name: string;
}
interface Payment {
  id: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  seller_id: string;
  seller_type: string;
  seller_name: string;
}
interface Balance {
  seller_id: string;
  seller_type: string;
  seller_name: string;
  total_supplied: number;
  total_paid: number;
  entry_count: number;
  balance_due: number;
}
interface GrainTypeSummary { grain_type: string; totalKg: number; totalValue: number; entryCount: number; }
interface Buyer { id: string; business_name: string; }

/**
 * Fasal aur kharche ka naam database mein angrezi mein rehta hai (wo
 * data hai). Yahan sirf lafz ki chaabi rakhi jati hai; asal lafz t()
 * se aata hai.
 */
const GRAIN_LABELS: Record<string, TranslationKey> = { wheat: "gr_wheat", rice: "gr_rice", maize: "gr_maize" };
const EXPENSE_CATEGORIES: { value: string; label: TranslationKey }[] = [
  { value: "diesel_fuel", label: "gr_diesel" },
  { value: "labor_mazdoori", label: "gr_labor" },
  { value: "bardana", label: "gr_bardana" },
  { value: "tractor_trolley_rent", label: "gr_tractor_rent" },
  { value: "other", label: "gr_other" },
];

export function GrainClient({
  farmers,
  parties,
  warehouses,
  cutPresets,
  grainRules,
  canManageRules,
  financeAccounts,
  buyers,
  entries,
  payments,
  balances,
  byGrainType,
  stockByWarehouseAndType,
}: {
  farmers: Farmer[];
  parties: Party[];
  warehouses: Warehouse[];
  cutPresets: CutPreset[];
  grainRules: GrainRule[];
  canManageRules: boolean;
  financeAccounts: FinanceAccount[];
  buyers: Buyer[];
  entries: Entry[];
  payments: Payment[];
  balances: Balance[];
  byGrainType: GrainTypeSummary[];
  stockByWarehouseAndType: Record<string, Record<string, number>>;
}) {
  const lang = useLang();
  const [tab, setTab] = useState<"entry" | "balances" | "entries" | "rules">("entry");
  const [entryMode, setEntryMode] = useState<"purchase" | "sale">("purchase");
  const [payingBalance, setPayingBalance] = useState<Balance | null>(null);
  const [showNewParty, setShowNewParty] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {byGrainType.map((g) => (
          <div key={g.grain_type} className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
            <p className="text-xs font-medium text-surface-500">{t(GRAIN_LABELS[g.grain_type] ?? "gr_grain", lang)}</p>
            <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">{g.totalKg.toLocaleString()} kg</p>
            <p className="text-xs text-surface-400">Rs {g.totalValue.toLocaleString()} - {g.entryCount} entries</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-surface-200 dark:border-surface-800">
        <TabButton active={tab === "entry"} onClick={() => setTab("entry")}>{t("gr_new_entry", lang)}</TabButton>
        <TabButton active={tab === "balances"} onClick={() => setTab("balances")}>{t("gr_balances", lang)}</TabButton>
        <TabButton active={tab === "entries"} onClick={() => setTab("entries")}>{t("gr_full_history", lang)}</TabButton>
        {canManageRules && <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>Bori, Cut & Chungi Rules</TabButton>}
      </div>

      {tab === "entry" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Grain purchase or sale">
            <Button type="button" variant={entryMode === "purchase" ? "primary" : "secondary"} aria-pressed={entryMode === "purchase"} onClick={() => setEntryMode("purchase")}>Purchase — Farmer / Party se khareedein</Button>
            <Button type="button" variant={entryMode === "sale" ? "primary" : "secondary"} aria-pressed={entryMode === "sale"} onClick={() => setEntryMode("sale")}>Sale — grain bechein / receivable</Button>
          </div>
          <p className="text-sm text-surface-500">{entryMode === "purchase" ? "Purchase: stock aayega, payment deni hai (Payable)." : "Sale: stock jayega, payment leni hai (Receivable). Buyer ka sale khata select karein."}</p>
          <div className={entryMode === "purchase" ? "space-y-4" : "hidden"}>
          <button onClick={() => setShowNewParty(true)} className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
            <Plus className="h-3.5 w-3.5" />{t("gd_new_party", lang)}</button>
          <NewEntryForm farmers={farmers} parties={parties} warehouses={warehouses} cutPresets={cutPresets} grainRules={grainRules} financeAccounts={financeAccounts} />
          </div>
          <div className={entryMode === "sale" ? "space-y-4" : "hidden"}>
            <NewSaleForm buyers={buyers.map(b => ({ ...b, contact_person: null, phone_number: null }))} warehouses={warehouses} financeAccounts={financeAccounts} stockByWarehouseAndType={stockByWarehouseAndType} />
            <Link href="/admin/grain-procurement/sell" className="text-sm text-brand-700 underline">Sale history aur payment recovery kholein</Link>
          </div>
        </div>
      )}

      {tab === "balances" && (
        <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_name", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_type", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_entries", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_total_supply_value", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_total_paid", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_remaining", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_action", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={`${b.seller_type}-${b.seller_id}`} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{b.seller_name}</td>
                  <td className="px-3 py-2 text-xs text-surface-500">{b.seller_type === "farmer" ? "Farmer" : "Party"}</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{b.entry_count}</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {b.total_supplied.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-green-600">Rs {b.total_paid.toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${b.balance_due > 0 ? "text-amber-600" : "text-surface-400"}`}>Rs {b.balance_due.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link href={`/admin/grain-procurement/statement?seller_type=${b.seller_type}&seller_id=${b.seller_id}`} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                        <FileText className="h-3 w-3" />{t("c_statement", lang)}</Link>
                      {b.balance_due > 0 && (
                        <button onClick={() => setPayingBalance(b)} className="text-xs font-medium text-green-600 hover:underline">{t("gr_make_payment", lang)}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {balances.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">{t("gr_no_entries", lang)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "entries" && (
        <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_date", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_seller", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gr_grain", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_gross", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_cut", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_net", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_rate", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gr_total", lang)}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{e.entry_date}</td>
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{e.seller_name}</td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{t(GRAIN_LABELS[e.grain_type] ?? "gr_grain", lang)}</td>
                  <td className="px-3 py-2 text-right text-surface-500">{e.gross_weight_kg} kg</td>
                  <td className="px-3 py-2 text-right text-red-500">-{e.cut_kg.toFixed(1)} kg ({e.cut_percentage}%)</td>
                  <td className="px-3 py-2 text-right font-medium text-surface-800 dark:text-surface-200">{e.weight_kg.toFixed(1)} kg</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {e.rate_per_kg}</td>
                  <td className="px-3 py-2 text-right font-semibold text-surface-900 dark:text-white">Rs {e.total_amount.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2"><Link href={`/admin/grain-procurement/bill/${e.id}`} className="text-xs font-medium text-brand-600 hover:underline">{t("gr_bill", lang)}</Link><button type="button" onClick={() => setEditingEntry(e)} className="text-xs font-medium text-amber-700 hover:underline">Edit</button></div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-surface-400">{t("gr_no_entries_short", lang)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === "rules" && canManageRules && <GrainRulesManager rules={grainRules} />}

      {payingBalance && (
        <PaymentModal balance={payingBalance} financeAccounts={financeAccounts} onClose={() => setPayingBalance(null)} />
      )}
      {showNewParty && <NewPartyModal onClose={() => setShowNewParty(false)} />}
      {editingEntry && <EditEntryModal entry={editingEntry} buyers={buyers} onClose={() => setEditingEntry(null)} />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-brand-600 text-brand-700" : "border-transparent text-surface-500 hover:text-surface-700"}`}
    >
      {children}
    </button>
  );
}

function GrainRuleForm({ rule }: { rule: GrainRule }) {
  const [state, action] = useFormState(updateGrainPackRule, initialState);
  const [bagBased, setBagBased] = useState(rule.is_bag_based);
  return <form action={action} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
    <input type="hidden" name="grain_type" value={rule.grain_type} />
    <input type="hidden" name="is_bag_based" value={bagBased ? "yes" : "no"} />
    <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold capitalize">{rule.grain_type === "wheat" ? "Gandum" : rule.grain_type === "rice" ? "Rice / Dhan" : "Maize / Makai"}</h3><p className="text-xs text-surface-500">Nayi entries ka default rule</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bagBased} onChange={e => setBagBased(e.target.checked)} /> Bori ka hisaab</label></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-surface-600">1 bori kitne kg<Input name="bag_weight_kg" type="number" min="0.001" max="1000" step="0.001" required={bagBased} disabled={!bagBased} defaultValue={rule.bag_weight_kg ?? ""} /></label>
      <label className="text-xs text-surface-600">Default cut kg / bori<Input name="default_cut_kg" type="number" min="0" step="1" defaultValue={rule.default_cut_kg} /></label>
      <label className="text-xs text-surface-600">Default cut gram / bori<Input name="default_cut_grams" type="number" min="0" max="999" step="1" defaultValue={rule.default_cut_grams} /></label>
      <label className="text-xs text-surface-600">Default chungi kg / bori<Input name="default_chungi_kg" type="number" min="0" step="0.001" defaultValue={rule.default_chungi_kg} /></label>
    </div>
    {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
    {state.success && <p className="mt-2 text-xs text-emerald-700">{state.notice}</p>}
    <Button type="submit" className="mt-3">Rule Save Karein</Button>
  </form>;
}

function GrainRulesManager({ rules }: { rules: GrainRule[] }) {
  const defaults: GrainRule[] = ["wheat","rice","maize"].map(grain_type => rules.find(rule => rule.grain_type === grain_type) ?? ({grain_type,is_bag_based:false,bag_weight_kg:null,default_cut_kg:0,default_cut_grams:0,default_chungi_kg:0}));
  return <section className="space-y-4"><div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><b>Yahan se coding ke baghair rules badlein.</b> Rule sirf nayi entry par default aayega. Entry screen par staff zarurat ke mutabiq us entry ka rule edit kar sakta hai. Purana bill apne saved rule par rahega.</div><div className="grid gap-4 lg:grid-cols-3">{defaults.map(rule => <GrainRuleForm key={rule.grain_type} rule={rule} />)}</div></section>;
}


function EditEntryModal({ entry, buyers, onClose }: { entry: Entry; buyers: Buyer[]; onClose: () => void }) {
  const [state, formAction] = useFormState(editGrainEntry, initialState);
  const [type, setType] = useState<"purchase" | "sale">("purchase");
  useEffect(() => {
    if (state.success) {
      const timer = window.setTimeout(() => window.location.reload(), 700);
      return () => window.clearTimeout(timer);
    }
  }, [state.success]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between"><div><h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Entry Edit / Classification</h3><p className="text-xs text-surface-500">{entry.seller_name} · {entry.weight_kg} kg · Rs {entry.total_amount.toLocaleString()}</p></div><button type="button" onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button></div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{state.notice ?? "Saved."}</p>}
        <form action={formAction} className="space-y-3"><input type="hidden" name="entry_id" value={entry.id} /><label className="block text-sm font-medium">Entry type</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setType("purchase")} className={`rounded-lg border px-3 py-2 text-sm ${type === "purchase" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-surface-200"}`}>Purchase / Payable</button><button type="button" onClick={() => setType("sale")} className={`rounded-lg border px-3 py-2 text-sm ${type === "sale" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-surface-200"}`}>Sale / Receivable</button></div><input type="hidden" name="transaction_type" value={type} />{type === "sale" && <label className="block text-sm">Buyer / customer<select name="buyer_id" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"><option value="">Select buyer</option>{buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.business_name}</option>)}</select></label>}<p className="rounded-lg bg-surface-50 p-2 text-xs text-surface-500">Sale select karne par original entry delete nahi hogi; payable se hat kar receivable mein nazar aayegi.</p><SubmitButton label="Save classification" /></form>
      </div>
    </div>
  );
}
function NewEntryForm({
  farmers,
  parties,
  warehouses,
  cutPresets,
  grainRules,
  financeAccounts,
}: {
  farmers: Farmer[];
  parties: Party[];
  warehouses: Warehouse[];
  cutPresets: CutPreset[];
  grainRules: GrainRule[];
  financeAccounts: FinanceAccount[];
}) {
  const lang = useLang();
  const initialRule = grainRules.find(rule => rule.grain_type === "wheat");
  const [state, formAction] = useFormState(createGrainEntry, initialState);
  const [offlineNotice, setOfflineNotice] = useState("");
  const [offlinePending, setOfflinePending] = useState(0);
  const [sellerType, setSellerType] = useState<"farmer" | "party">("farmer");
  const [grainType, setGrainType] = useState("wheat");
  const [grossWeight, setGrossWeight] = useState("");
  const [grossMaund, setGrossMaund] = useState("");
  const [cutMode, setCutMode] = useState<"preset" | "manual">("manual");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [bagWeight, setBagWeight] = useState(initialRule?.is_bag_based && initialRule.bag_weight_kg ? String(initialRule.bag_weight_kg) : "");
  const [manualCut, setManualCut] = useState(String(initialRule?.default_cut_kg ?? 0));
  const [manualCutGrams, setManualCutGrams] = useState(String(initialRule?.default_cut_grams ?? 0));
  const [chungiBasis, setChungiBasis] = useState<"per_bag" | "total">("per_bag");
  const [rate, setRate] = useState("");

  function handleKgChange(value: string) {
    setGrossWeight(value);
    const kg = parseFloat(value);
    setGrossMaund(kg ? (kg / 40).toFixed(2) : "");
  }
  function handleMaundChange(value: string) {
    setGrossMaund(value);
    const maund = parseFloat(value);
    setGrossWeight(maund ? (maund * 40).toFixed(2) : "");
  }
  function applyGrainRule(nextType: string) {
    const next = grainRules.find(rule => rule.grain_type === nextType);
    setGrainType(nextType);
    setSelectedPresetId("");
    setCutMode("manual");
    setBagWeight(next?.is_bag_based && next.bag_weight_kg ? String(next.bag_weight_kg) : "");
    setManualCut(String(next?.default_cut_kg ?? 0));
    setManualCutGrams(String(next?.default_cut_grams ?? 0));
    setChungiType("grain");
    setChungiBasis(next?.is_bag_based ? "per_bag" : "total");
    setChungiKg(String(next?.default_chungi_kg ?? 0));
    setChungiCash("0");
  }

  const [hasExpense, setHasExpense] = useState<"" | "yes" | "no">("");
  const [expenseRows, setExpenseRows] = useState<{ category: string; description: string; amount: string; account_id: string }[]>([
    { category: "diesel_fuel", description: "", amount: "", account_id: "" },
  ]);

  const [chungiType, setChungiType] = useState<"cash" | "grain">("grain");
  const [chungiCash, setChungiCash] = useState("0");
  const [chungiKg, setChungiKg] = useState(String(initialRule?.default_chungi_kg ?? 0));

  const [makePayment, setMakePayment] = useState<"" | "yes" | "no">("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  useEffect(() => {
    registerSender("grain.entry", async (action: QueuedAction, evidence) => {
      try {
        const body = new FormData();
        body.set("fields", JSON.stringify(action.payload.fields ?? {}));
        const photo = evidence.find((item) => item.slot === "receipt_photo");
        if (photo) body.set("receipt_photo", photo.blob, "grain-receiving-photo.jpg");
        const res = await fetch("/api/grain-procurement/entry", { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, retryable: res.status >= 500, error: json.error || "Grain entry sync fail ho gayi." };
        return { ok: true };
      } catch (error) {
        return { ok: false, retryable: true, error: error instanceof Error ? error.message : "Network error" };
      }
    });
    const refresh = async () => {
      const rows = await allActions().catch(() => []);
      setOfflinePending(rows.filter((row) => row.action_type === "grain.entry" && (row.sync_status === "pending" || row.sync_status === "syncing")).length);
    };
    const restored = async () => { await syncQueue().catch(() => undefined); await refresh(); };
    void refresh();
    window.addEventListener("online", restored);
    window.addEventListener("agribridge:offline-queue-changed", refresh);
    return () => {
      window.removeEventListener("online", restored);
      window.removeEventListener("agribridge:offline-queue-changed", refresh);
    };
  }, []);

  const relevantPresets = useMemo(() => cutPresets.filter((p) => p.grain_type === grainType), [cutPresets, grainType]);
  const selectedPreset = relevantPresets.find((p) => p.id === selectedPresetId);
  const currentRule = grainRules.find(rule => rule.grain_type === grainType);
  const gross = Number(grossWeight) || 0;
  const rateNum = Number(rate) || 0;
  const bagKg = currentRule?.is_bag_based ? Number(bagWeight) || null : null;
  const calculation = grainBagCalculation({grainType, grossKg: gross, ratePerMaund: rateNum, bagWeightKg: bagKg,
    cutBasis: cutMode === "preset" ? "percentage" : bagKg ? "per_bag" : "total_weight",
    cutKg: Number(manualCut), cutGrams: Number(manualCutGrams), cutPercentage: selectedPreset?.cut_percentage ?? 0,
    chungiBasis: bagKg ? chungiBasis : "total", chungiType,
    chungiValue: Number(chungiType === "grain" ? chungiKg : chungiCash)});
  const effectiveCutPercentage = calculation.cutPercentage;
  const cutKg = calculation.cutKg;
  const netWeight = calculation.netKg;
  const total = calculation.total;
  const chungiAmount = calculation.chungiAmount;
  const payableToSeller = calculation.payable;

  const expensesJson = JSON.stringify(
    expenseRows
      .filter((r) => r.amount && Number(r.amount) > 0)
      .map((r) => ({ category: r.category, description: r.description, amount: Number(r.amount), account_id: r.account_id }))
  );

  function addExpenseRow() {
    setExpenseRows((prev) => [...prev, { category: "diesel_fuel", description: "", amount: "", account_id: "" }]);
  }
  function removeExpenseRow(idx: number) {
    setExpenseRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateExpenseRow(idx: number, field: string, value: string) {
    setExpenseRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  if (state.success) {
    // Ledger TXN aur cash book ka paighaam parhne ka waqt.
    setTimeout(() => window.location.reload(), state.paymentId ? 6000 : 1200);
  }

  return (
    <div className="mx-auto w-full max-w-[1040px] rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-6 dark:border-surface-800 dark:bg-surface-900">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-surface-100 pb-4 dark:border-surface-800">
        <div>
          <h2 className="font-display text-xl font-semibold text-surface-900 dark:text-white">{t("gr_new_grain_entry", lang)}</h2>
          <p className="mt-1 text-sm text-surface-500">Enter supplier, weight, deductions and payment in a clear order.</p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">Step 1 · Entry</span>
      </div>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {offlineNotice && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{offlineNotice}</p>}
      {offlinePending > 0 && <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">{offlinePending} grain entries sync ka intezar kar rahi hain.</p>}
      {state.success && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-200">
          <p className="font-semibold">Entry record ho gayi, stock add ho gaya.</p>
          <p className="mt-1 text-xs opacity-80">Ab purchase bill aur payment receipt alag se print ya share karein.</p>
          {state.paymentId && state.notice && <p className="mt-1 text-xs font-medium">Payment: {state.notice}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {state.entryId && (
              <Link href={`/admin/grain-procurement/bill/${state.entryId}`} className="inline-flex items-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">
                {t("gr_view_entry_slip", lang)}
              </Link>
            )}
            {state.paymentId && (
              <Link href={`/admin/grain-procurement/payment-slip/${state.paymentId}`} className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100 dark:bg-surface-900 dark:ring-brand-800">
                {t("gr_view_payment_slip", lang)}
              </Link>
            )}
          </div>
        </div>
      )}
      <form
        action={formAction}
        encType="multipart/form-data"
        onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          if (calculation.errors.length) { event.preventDefault(); setOfflineNotice(calculation.errors[0]); return; }
          if (typeof navigator === "undefined" || navigator.onLine !== false) return;
          event.preventDefault();
          try {
            const formData = new FormData(event.currentTarget);
            const photo = formData.get("receipt_photo");
            const fields = Object.fromEntries(formData.entries());
            delete (fields as Record<string, FormDataEntryValue>).receipt_photo;
            const evidence = photo instanceof File && photo.size > 0 ? [{ blob: photo, slot: "receipt_photo" }] : undefined;
            await enqueue({
              actionType: "grain.entry",
              entityType: "grain_procurement_entries",
              payload: { fields },
              evidence,
            });
            setOfflineNotice("Internet nahi hai. Grain entry device par save ho gayi; internet aate hi stock/ledger mein sync hogi.");
          } catch {
            setOfflineNotice("Offline grain entry save nahi ho saki.");
          }
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
          <div className="space-y-5">
        <input type="hidden" name="seller_type" value={sellerType} />
        <input type="hidden" name="cut_percentage" value={effectiveCutPercentage} />
        <input type="hidden" name="bag_calculation" value="on" />
        <input type="hidden" name="bag_weight_kg" value={bagKg ?? ""} />
        <input type="hidden" name="cut_basis" value={cutMode === "preset" ? "percentage" : bagKg ? "per_bag" : "total_weight"} />
        <input type="hidden" name="cut_kg_input" value={manualCut} />
        <input type="hidden" name="cut_grams_input" value={manualCutGrams} />
        <input type="hidden" name="preset_cut_percentage" value={selectedPreset?.cut_percentage ?? 0} />
        <input type="hidden" name="chungi_basis" value={bagKg ? chungiBasis : "total"} />
        <input type="hidden" name="chungi_value" value={chungiType === "grain" ? chungiKg : chungiCash} />
        <input type="hidden" name="has_expense" value={hasExpense} />
        <input type="hidden" name="expenses_json" value={expensesJson} />
        <input type="hidden" name="chungi_type" value={chungiType} />
        <input type="hidden" name="chungi_kg" value={calculation.chungiKg} />
        <input type="hidden" name="chungi_amount" value={chungiAmount} />
        <input type="hidden" name="make_payment" value={makePayment} />

        <div>
          <Label>{t("gr_who_brought", lang)}</Label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setSellerType("farmer")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${sellerType === "farmer" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_farmer", lang)}</button>
            <button type="button" onClick={() => setSellerType("party")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${sellerType === "party" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_party", lang)}</button>
          </div>
        </div>
        {sellerType === "farmer" ? (
          <div>
            <Label>{t("gr_farmer_req", lang)}</Label>
            <Select name="farmer_id" required>
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
              ))}
            </Select>
          </div>
        ) : (
          <div>
            <Label>{t("gr_party_req", lang)}</Label>
            <Select name="party_id" required>
              <option value="">- select -</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.party_name}{p.contact_person ? ` - ${p.contact_person}` : ""}</option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label>{t("gr_grain_type_req", lang)}</Label>
          <Select name="grain_type" value={grainType} onChange={(e) => applyGrainRule(e.target.value)}>
            <option value="wheat">{t("gs_wheat", lang)}</option>
            <option value="rice">{t("gs_rice", lang)}</option>
            <option value="maize">{t("gs_maize", lang)}</option>
          </Select>
        </div>
        <div>
          <Label>{t("gr_date", lang)}</Label>
          <Input type="date" name="entry_date" defaultValue={aajKaKhana()} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("gr_gross_kg_req", lang)}</Label>
            <Input type="number" min="0.001" step="0.001" name="gross_weight_kg" value={grossWeight} onChange={(e) => handleKgChange(e.target.value)} required />
          </div>
          <div>
            <Label>{t("gr_gross_maund", lang)}</Label>
            <Input type="number" step="0.01" value={grossMaund} onChange={(e) => handleMaundChange(e.target.value)} placeholder={t("gr_auto", lang)} />
          </div>
        </div>
        {currentRule?.is_bag_based && <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800"><div className="mb-2 max-w-52"><Label>Is entry mein 1 bori kitne kg</Label><Input aria-label="Entry bag weight" type="number" min="0.001" max="1000" step="0.001" value={bagWeight} onChange={e => setBagWeight(e.target.value)} /></div>{bagKg ? <span>1 bori = {bagKg} kg · {calculation.fullBags} poori boriyan + {calculation.remainingKg} kg · Hisaab: {calculation.bags.toLocaleString(undefined, {maximumFractionDigits: 4})} boriyan. Adhoori bori proportional count hogi.</span> : <span>Bori ka weight likhein.</span>}</div>}
        <div>
          <Label>{t("gr_rate_per_kg_req", lang)}</Label>
          <Input type="number" step="0.01" name="rate_per_kg" value={rate} onChange={(e) => setRate(e.target.value)} required />
          <p className="mt-1 text-xs text-surface-500">Rs {rateNum ? (rateNum / 40).toLocaleString(undefined, {maximumFractionDigits: 4}) : 0} per kg</p>
        </div>

        <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-4 dark:border-surface-700 dark:bg-surface-800/40">
          <Label>{t("gr_cut_deduction", lang)}</Label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setCutMode("preset")} className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${cutMode === "preset" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_from_preset", lang)}</button>
            <button type="button" onClick={() => setCutMode("manual")} className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${cutMode === "manual" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_write_manually", lang)}</button>
          </div>
          {cutMode === "preset" ? (
            <select value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)} className="mt-2 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">- Cut Preset Select Karein (ya 0% ke liye khaali chhodein) -</option>
              {relevantPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.label} - {p.cut_percentage}%</option>
              ))}
            </select>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div><Label>Cut kg {bagKg ? "/ bori" : "total"}</Label><Input aria-label="Cut kg" type="number" min="0" step="1" value={manualCut} onChange={(e) => setManualCut(e.target.value)} /></div>
              <div><Label>Cut gram {bagKg ? "/ bori" : "total"}</Label><Input aria-label="Cut grams" type="number" min="0" max="999" step="1" value={manualCutGrams} onChange={(e) => setManualCutGrams(e.target.value)} /></div>
            </div>
          )}
          <div className="mt-2 space-y-0.5 text-xs">
            <div className="flex justify-between text-surface-500"><span>{t("gr_cut", lang)}</span><span>{grainKgGrams(cutKg)} ({effectiveCutPercentage.toFixed(3)}%)</span></div>
            <div className="flex justify-between font-semibold text-surface-700 dark:text-surface-300"><span>{t("gr_net_weight", lang)}</span><span>{grainKgGrams(netWeight)}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-4 dark:border-surface-700 dark:bg-surface-800/40">
          <Label>{t("gr_chungi", lang)}</Label>
          {bagKg && <div className="mb-2"><Label>Chungi basis</Label><Select aria-label="Chungi basis" value={chungiBasis} onChange={e => setChungiBasis(e.target.value as "per_bag" | "total")}><option value="per_bag">Har bori par</option><option value="total">Poori entry ka total</option></Select></div>}
          <p className="mb-2 text-xs text-surface-500">{bagKg && chungiBasis === "per_bag" ? "Neeche raqam ya kg har bori ke liye likhein." : "Neeche raqam ya kg poori entry ka total likhein."}</p>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setChungiType("cash")} className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${chungiType === "cash" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_cash_rs", lang)}</button>
            <button type="button" onClick={() => setChungiType("grain")} className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${chungiType === "grain" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_grain_kg", lang)}</button>
          </div>
          {chungiType === "cash" ? (
            <Input type="number" min="0" step="0.01" value={chungiCash} onChange={(e) => setChungiCash(e.target.value)} placeholder={t("gr_rs_amount", lang)} className="mt-2" />
          ) : (
            <div className="mt-2">
              <Input type="number" min="0" step="0.001" value={chungiKg} onChange={(e) => setChungiKg(e.target.value)} placeholder={t("gr_how_many_kg", lang)} />
              <p className="mt-1 text-[11px] text-surface-400">Rate se khud calculate hoga: {calculation.chungiKg} kg ÷ 40 = {(calculation.chungiKg / 40).toFixed(3)} maund × Rs {rateNum.toLocaleString()} = Rs {chungiAmount.toLocaleString()}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("gr_moisture", lang)}</Label>
            <Input type="number" step="0.01" name="moisture_percentage" />
          </div>
          <div>
            <Label>{t("gr_quality_grade", lang)}</Label>
            <Input name="quality_grade" placeholder={t("gr_grade_eg", lang)} />
          </div>
        </div>
        <div>
          <Label>{t("gr_warehouse_req", lang)}</Label>
          <Select name="warehouse_id" required>
            <option value="">- select -</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("gr_notes", lang)}</Label>
          <Textarea name="notes" rows={2} />
        </div>

        <div className={`rounded-lg border-2 p-3 ${hasExpense === "" ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20" : "border-surface-200 dark:border-surface-700"}`}>
          <Label>{t("gr_any_expense", lang)}</Label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setHasExpense("yes")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${hasExpense === "yes" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_yes", lang)}</button>
            <button type="button" onClick={() => setHasExpense("no")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${hasExpense === "no" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_no", lang)}</button>
          </div>
          {hasExpense === "" && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />{t("gd_confirm_note", lang)}</p>
          )}
          {hasExpense === "yes" && (
            <div className="mt-3 space-y-2">
              {expenseRows.map((row, idx) => (
                <div key={idx} className="rounded-lg border border-surface-200 p-2 dark:border-surface-700">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-surface-400">Expense {idx + 1}</span>
                    {expenseRows.length > 1 && (
                      <button type="button" onClick={() => removeExpenseRow(idx)} className="text-surface-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={row.category} onChange={(e) => updateExpenseRow(idx, "category", e.target.value)} className="rounded-lg border border-surface-200 p-1.5 text-xs">
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{t(c.label, lang)}</option>
                      ))}
                    </select>
                    <input placeholder={t("gr_amount_rs", lang)} type="number" step="0.01" value={row.amount} onChange={(e) => updateExpenseRow(idx, "amount", e.target.value)} className="rounded-lg border border-surface-200 p-1.5 text-xs" />
                    <input placeholder={t("gr_description", lang)} value={row.description} onChange={(e) => updateExpenseRow(idx, "description", e.target.value)} className="col-span-2 rounded-lg border border-surface-200 p-1.5 text-xs" />
                    <select value={row.account_id} onChange={(e) => updateExpenseRow(idx, "account_id", e.target.value)} className="col-span-2 rounded-lg border border-surface-200 p-1.5 text-xs">
                      <option value="">- Konsa Account Se Paisa Gaya -</option>
                      {financeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addExpenseRow} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <Plus className="h-3.5 w-3.5" />{t("gd_add_more_expense", lang)}</button>
            </div>
          )}
        </div>

        <div className={`rounded-lg border-2 p-3 ${makePayment === "" ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20" : "border-surface-200 dark:border-surface-700"}`}>
          <Label>{t("gr_pay_now", lang)}</Label>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => { setMakePayment("yes"); setPaymentAmount(payableToSeller.toFixed(2)); }} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${makePayment === "yes" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_yes", lang)}</button>
            <button type="button" onClick={() => setMakePayment("no")} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${makePayment === "no" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>{t("gr_no", lang)}</button>
          </div>
          {makePayment === "" && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />{t("gd_confirm_note", lang)}</p>
          )}
          {makePayment === "yes" && (
            <div className="mt-3 space-y-2">
              <div>
                <Label>{t("gr_amount_cap", lang)}</Label>
                <Input type="number" step="0.01" name="payment_amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} max={payableToSeller} required />
              </div>
              <div>
                <Label>{t("gr_payment_method", lang)}</Label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} name="payment_method" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
                  <option value="cash">{t("gr_cash", lang)}</option>
                  <option value="bank_transfer">{t("gr_bank_transfer", lang)}</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                </select>
              </div>
              <div>
                <Label>{t("gr_which_account_req", lang)}</Label>
                <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} name="payment_account_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
                  <option value="">- select -</option>
                  {financeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-surface-500">
                  {paymentAccountId
                    ? `Ye raqam "${financeAccounts.find((a) => a.id === paymentAccountId)?.name ?? ""}" ki cash book aur ledger se entry ki tareekh par nikal kar darj hogi.`
                    : "Naqad diya to \"Cash in Hand\", bank se diya to wohi bank chunein. Payment ki tareekh entry wali tareekh hi hogi."}
                </p>
              </div>
              <GrainPaymentActionId />
              {paymentMethod === "cash" ? (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <Label>{t("gr_receiving_photo_req", lang)}</Label>
                  <input type="file" name="receipt_photo" accept="image/*" required className="mt-1 w-full text-xs" />
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-500">{t("gr_receiving_note_short", lang)}</p>
                </div>
              ) : (
                <GrainPaymentSlipField />
              )}
            </div>
          )}
        </div>

          </div>

          <aside className="sticky top-4 rounded-2xl border border-brand-200 bg-brand-50/80 p-5 shadow-sm dark:border-brand-900/50 dark:bg-brand-950/20">
            <div className="mb-4 border-b border-brand-200 pb-4 dark:border-brand-900/50">
              <h3 className="font-display text-lg font-semibold text-surface-900 dark:text-white">Live Calculation</h3>
              <p className="mt-1 text-xs text-surface-500">Har field ke sath amount update hoga.</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-surface-500">Gross Weight</span><span className="font-semibold text-surface-900 dark:text-white">{gross.toLocaleString()} kg</span></div>
              <div className="flex items-center justify-between"><span className="text-surface-500">Cut / Deduction</span><span className="font-semibold text-amber-700">{grainKgGrams(cutKg)}</span></div>
              <div className="flex items-center justify-between border-b border-brand-200 pb-3 dark:border-brand-900/50"><span className="text-surface-500">Net Weight</span><span className="font-semibold text-surface-900 dark:text-white">{grainKgGrams(netWeight)}</span></div>
              <div className="flex items-center justify-between"><span className="text-surface-500">Rate</span><span className="font-semibold text-surface-900 dark:text-white">Rs {rateNum.toLocaleString()}/maund</span></div>
              <div className="flex items-center justify-between"><span className="text-surface-500">Grain Value</span><span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">Rs {total.toLocaleString()}</span></div>
              <div className="flex items-center justify-between border-b border-brand-200 pb-3 dark:border-brand-900/50"><span className="text-surface-500">Chungi / Bardana</span><span className="font-semibold text-amber-700">- Rs {chungiAmount.toLocaleString()}</span></div>
              <div className="flex items-center justify-between pt-1"><span className="font-semibold text-surface-800 dark:text-surface-200">Payable to {sellerType === "farmer" ? "Farmer" : "Party"}</span><span className="font-display text-xl font-bold text-brand-700 dark:text-brand-300">Rs {payableToSeller.toLocaleString()}</span></div>
            </div>
            <div className="mt-5 rounded-xl border border-brand-200 bg-white/70 p-3 text-xs text-surface-500 dark:border-brand-900/50 dark:bg-surface-900/40">
              <p className="font-semibold text-surface-700 dark:text-surface-200">After this:</p>
              <p className="mt-2">3 · Moisture &amp; Quality</p>
              <p>4 · Warehouse &amp; Notes</p>
              <p>5 · Expenses (Yes / No)</p>
              <p>6 · Payment (Yes / No)</p>
            </div>
            <div className="mt-4 rounded-lg border border-brand-200 bg-brand-100/60 px-3 py-2 text-center text-xs font-semibold text-brand-700 dark:border-brand-900/50 dark:bg-brand-950/30 dark:text-brand-300">Save Entry → Bill + Payment Receipt</div>
          </aside>

        </div>

        <SubmitButton label={t("gr_record_entry", lang)} disabled={hasExpense === "" || makePayment === ""} />
      </form>
    </div>
  );
}

function PaymentModal({ balance, financeAccounts, onClose }: { balance: Balance; financeAccounts: FinanceAccount[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(recordGrainPayment, initialState);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  // Kamyabi ka paighaam (ledger TXN, bank/cash book) parhne ka waqt dein.
  useEffect(() => {
    if (!state.success) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("gr_make_payment", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-surface-500">{balance.seller_name} - Baaqi: Rs {balance.balance_due.toLocaleString()}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && (
          <>
            <GrainPaymentSuccess fallback={balance.seller_type === "party" ? "Wasooli darj ho gayi." : "Payment darj ho gayi."} notice={state.notice} />
            <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("gd_payment_recorded", lang)}<Link href={`/admin/grain-procurement/payment-slip/${state.entryId}`} className="underline">{t("gr_view_slip", lang)}</Link>
            </p>
          </>
        )}
        <form action={formAction} encType="multipart/form-data" className="space-y-5">
          <input type="hidden" name="seller_type" value={balance.seller_type} />
          <input type="hidden" name={balance.seller_type === "farmer" ? "farmer_id" : "party_id"} value={balance.seller_id} />
          <GrainPaymentActionId />
          <div>
            <Label>{t("gr_amount_req", lang)}</Label>
            <Input type="number" step="0.01" name="amount" max={balance.balance_due} defaultValue={balance.balance_due} required />
          </div>
          <div>
            <Label>{t("gr_payment_method", lang)}</Label>
            <Select name="payment_method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">{t("gr_cash", lang)}</option>
              <option value="bank_transfer">{t("gr_bank_transfer", lang)}</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
            </Select>
          </div>
          <GrainPaymentDateField direction={balance.seller_type === "party" ? "in" : "out"} />
          <GrainPaymentAccountField accounts={financeAccounts} direction={balance.seller_type === "party" ? "in" : "out"} />
          {paymentMethod === "cash" && balance.seller_type === "farmer" ? (
            <GrainPaymentSlipField required requiredNote={`${t("gr_receiving_note", lang)} (Cash payment par Kisan ki signed raseed ki photo zaroori hai.)`} />
          ) : (
            <GrainPaymentSlipField />
          )}
          <div>
            <Label>{t("gr_notes", lang)}</Label>
            <Textarea name="notes" rows={2} />
          </div>
          {balance.seller_type === "farmer" && (
            <p className="text-[11px] text-surface-400">{t("gr_credit_note", lang)}</p>
          )}
          <SubmitButton label={t("gr_record_payment", lang)} />
        </form>
      </div>
    </div>
  );
}

function NewPartyModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(createGrainParty, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("gr_new_party", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("gr_party_created", lang)}</p>}
        <form action={formAction} className="space-y-2">
          <Input name="party_name" required placeholder={t("gr_party_name_req", lang)} />
          <Input name="contact_person" placeholder={t("gr_contact_person", lang)} />
          <Input name="phone" placeholder={t("gr_phone", lang)} />
          <Input name="cnic" placeholder={t("gr_cnic_optional", lang)} />
          <Textarea name="address" rows={2} placeholder={t("gr_address", lang)} />
          <SubmitButton label={t("gr_create_party", lang)} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending || disabled} className="w-full">{pending ? t("gr_saving", lang) : label}</Button>;
}
